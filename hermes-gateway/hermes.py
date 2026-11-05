#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Hermes — lightweight, dependency-free, OpenAI-compatible multi-backend
AI routing gateway.

Routes incoming OpenAI-compatible requests (chat/completions, completions,
embeddings, models) across a set of local inference backends with:

  * weighted round-robin / round-robin / least-loaded ("health") routing
  * background health checks (liveness) with flapping protection
  * automatic fallback to the next healthy backend on failure
  * transparent SSE streaming relay for `stream: true` requests
  * optional model-aware conditional routing (route to the backend that
    actually serves the requested model)

Zero third-party dependencies: Python 3.9+ standard library only. This means
the container needs NO pip installs and works fully offline, which avoids
"package resolution failing" problems entirely.

Config precedence (highest wins):
  1. Environment variables  (HERMES_*)
  2. config.yaml            (same directory as this file, or $HERMES_CONFIG)
  3. Built-in defaults
"""

import json
import os
import re
import subprocess
import sys
import time
import threading
import urllib.request
import urllib.error
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

__version__ = "1.2.0"

# --------------------------------------------------------------------------- #
# Logging
# --------------------------------------------------------------------------- #
_LOG_LEVELS = {"debug": 10, "info": 20, "warn": 30, "error": 40}
_log_level = _LOG_LEVELS.get(os.environ.get("HERMES_LOG_LEVEL", "info").lower(), 20)


def log(level, msg):
    if _LOG_LEVELS.get(level, 20) < _log_level:
        return
    ts = time.strftime("%Y-%m-%dT%H:%M:%S%z")
    sys.stderr.write("[hermes] %s [%s] %s\n" % (ts, level, msg))
    sys.stderr.flush()


# --------------------------------------------------------------------------- #
# Minimal YAML-subset loader (zero dependencies)
#
# Supports exactly the schema shipped in config.yaml:
#   - nested mappings (any depth, 2-space indented)
#   - scalar values: str / int / float / bool / null
#   - inline lists  [a, b, c]
#   - block lists of scalars or of flat mappings ("- key: value" items)
#   - full-line and trailing " #" comments
# --------------------------------------------------------------------------- #
def _strip_comment(s):
    out = []
    in_s = in_d = False
    for i, ch in enumerate(s):
        if ch == "'" and not in_d:
            in_s = not in_s
        elif ch == '"' and not in_s:
            in_d = not in_d
        elif ch == "#" and not in_s and not in_d:
            if i == 0 or s[i - 1] in " \t":
                break
        out.append(ch)
    return "".join(out).rstrip()


def _tokenize(text):
    toks = []
    for raw in text.splitlines():
        line = raw.rstrip()
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        s = _strip_comment(s)
        if not s.strip():
            continue
        indent = len(line) - len(line.lstrip(" "))
        toks.append((indent, s.strip()))
    return toks


def _split_top(s):
    parts = []
    depth = 0
    in_s = in_d = False
    cur = ""
    for ch in s:
        if ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
        if ch == "'" and not in_d:
            in_s = not in_s
        elif ch == '"' and not in_s:
            in_d = not in_d
        if ch == "," and depth == 0 and not in_s and not in_d:
            parts.append(cur)
            cur = ""
        else:
            cur += ch
    if cur.strip():
        parts.append(cur)
    return parts


def _parse_scalar(v):
    v = v.strip()
    if v.startswith("[") and v.endswith("]"):
        inner = v[1:-1].strip()
        if not inner:
            return []
        return [_parse_scalar(x) for x in _split_top(inner)]
    if len(v) >= 2 and ((v[0] == v[-1] == '"') or (v[0] == v[-1] == "'")):
        return v[1:-1]
    low = v.lower()
    if low in ("true", "yes", "on"):
        return True
    if low in ("false", "no", "off"):
        return False
    if low in ("null", "~", "none", ""):
        return None
    try:
        return int(v)
    except ValueError:
        pass
    try:
        return float(v)
    except ValueError:
        pass
    return v


def _parse_dict(toks, i, indent):
    d = {}
    while i < len(toks):
        ind, content = toks[i]
        if ind < indent:
            break
        if ind > indent:
            i += 1
            continue
        if content.startswith("- ") or content == "-":
            break
        if ":" not in content:
            i += 1
            continue
        k, v = content.split(":", 1)
        k = k.strip()
        v = v.strip()
        i += 1
        if v == "":
            if i < len(toks) and toks[i][0] > indent:
                child, i = _parse_block(toks, i, toks[i][0])
                d[k] = child
            else:
                d[k] = None
        else:
            d[k] = _parse_scalar(v)
    return d, i


def _parse_list(toks, i, indent):
    lst = []
    while i < len(toks):
        ind, content = toks[i]
        if ind < indent:
            break
        if ind > indent:
            i += 1
            continue
        if not (content.startswith("- ") or content == "-"):
            break
        rest = "" if content == "-" else content[2:].strip()
        i += 1
        if rest == "":
            if i < len(toks) and toks[i][0] > indent:
                child, i = _parse_block(toks, i, toks[i][0])
                lst.append(child)
            else:
                lst.append(None)
        elif ":" in rest and not rest.startswith("["):
            item = {}
            k, v = rest.split(":", 1)
            item[k.strip()] = _parse_scalar(v)
            item_indent = indent + 2
            while i < len(toks):
                nind, ncontent = toks[i]
                if nind < item_indent:
                    break
                if nind > item_indent:
                    i += 1
                    continue
                if ncontent.startswith("- ") or ncontent == "-":
                    break
                if ":" not in ncontent:
                    i += 1
                    continue
                k2, v2 = ncontent.split(":", 1)
                i += 1
                if v2.strip() == "":
                    if i < len(toks) and toks[i][0] > item_indent:
                        child, i = _parse_block(toks, i, toks[i][0])
                        item[k2.strip()] = child
                    else:
                        item[k2.strip()] = None
                else:
                    item[k2.strip()] = _parse_scalar(v2)
            lst.append(item)
        else:
            lst.append(_parse_scalar(rest))
    return lst, i


def _parse_block(toks, i, indent):
    if i >= len(toks):
        return None, i
    if toks[i][1].startswith("- ") or toks[i][1] == "-":
        return _parse_list(toks, i, indent)
    return _parse_dict(toks, i, indent)


def load_yaml(path):
    with open(path, "r", encoding="utf-8") as fh:
        text = fh.read()
    toks = _tokenize(text)
    if not toks:
        return {}
    data, _ = _parse_block(toks, 0, toks[0][0])
    return data or {}


# --------------------------------------------------------------------------- #
# Configuration
# --------------------------------------------------------------------------- #
DEFAULTS = {
    "host": "0.0.0.0",
    "port": 3000,
    "strategy": "weighted",          # weighted | round-robin | health
    "health_enabled": True,
    "health_interval": 15.0,         # seconds between health checks
    "health_timeout": 5.0,           # per-check timeout (seconds)
    "health_path": "/v1/models",     # liveness endpoint on each backend
    "down_threshold": 2,             # consecutive failures before marked down
    "fallback_enabled": True,
    "max_retries": 2,                # extra backends to try after the first
    "request_timeout": 600.0,        # hard timeout for proxied requests (s)
    "log_level": "info",
    "max_tokens_reasoning": 512,     # default max_tokens for reasoning models (floor 512)
    "reasoning_patterns": ["qwen3", "qwen-3", "qwq", "deepseek", "r1", "o1",
                           "o3", "thinking", "reasoning"],
    "vram_poll": True,               # poll Ollama /api/ps alongside health checks
    "vram_flush_cmd": "",            # optional hard-flush shell hook (empty = keep_alive only)
    "backends": [
        {"name": "nvidia", "url": "http://192.168.1.16:11434", "weight": 3, "tags": ["gpu", "cuda"]},
        {"name": "intel-arc", "url": "http://192.168.1.121:8080", "weight": 2, "tags": ["gpu", "sycl"]},
    ],
}


def _as_bool(v, default):
    if v is None:
        return default
    if isinstance(v, bool):
        return v
    return str(v).strip().lower() in ("1", "true", "yes", "on")


def _parse_backends_env(raw):
    """Parse 'name=url:weight,name2=url2:weight2' into a backends list."""
    out = []
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        name, _, rest = part.partition("=")
        url, _, w = rest.rpartition(":")
        try:
            weight = max(1, int(w)) if w else 1
        except ValueError:
            weight = 1
        out.append({"name": name.strip(), "url": url.strip(), "weight": weight,
                    "enabled": True, "tags": []})
    return out


def load_config():
    cfg = dict(DEFAULTS)

    # 1) config.yaml (if present)
    cfg_path = os.environ.get("HERMES_CONFIG") or os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "config.yaml")
    if os.path.exists(cfg_path):
        try:
            y = load_yaml(cfg_path)
            srv = y.get("server", {}) or {}
            rt = y.get("routing", {}) or {}
            hc = rt.get("health", {}) or {}
            fb = rt.get("fallback", {}) or {}
            if "host" in srv:
                cfg["host"] = srv["host"]
            if "port" in srv:
                cfg["port"] = int(srv["port"])
            if "strategy" in rt:
                cfg["strategy"] = str(rt["strategy"])
            if "enabled" in hc:
                cfg["health_enabled"] = _as_bool(hc["enabled"], cfg["health_enabled"])
            if "interval_sec" in hc:
                cfg["health_interval"] = float(hc["interval_sec"])
            if "timeout_sec" in hc:
                cfg["health_timeout"] = float(hc["timeout_sec"])
            if "path" in hc:
                cfg["health_path"] = hc["path"]
            if "enabled" in fb:
                cfg["fallback_enabled"] = _as_bool(fb["enabled"], cfg["fallback_enabled"])
            if "max_retries" in fb:
                cfg["max_retries"] = int(fb["max_retries"])
            if y.get("log_level"):
                cfg["log_level"] = str(y["log_level"])
            if isinstance(y.get("defaults"), dict):
                d = y["defaults"]
                if "max_tokens_reasoning" in d:
                    cfg["max_tokens_reasoning"] = max(
                        512, int(d["max_tokens_reasoning"]))
                if isinstance(d.get("reasoning_patterns"), list) \
                        and d["reasoning_patterns"]:
                    cfg["reasoning_patterns"] = \
                        [str(p) for p in d["reasoning_patterns"]]
            if isinstance(y.get("vram"), dict):
                v = y["vram"]
                if v.get("poll") is not None:
                    cfg["vram_poll"] = _as_bool(v["poll"], cfg["vram_poll"])
                if "flush_command" in v:
                    cfg["vram_flush_cmd"] = str(v["flush_command"] or "")
            if isinstance(y.get("backends"), list) and y["backends"]:
                cfg["backends"] = y["backends"]
            log("debug", "loaded config from %s" % cfg_path)
        except Exception as e:  # noqa: BLE001
            log("warn", "failed to parse %s (%s); using defaults" % (cfg_path, e))

    # 2) environment overrides (highest precedence)
    env = os.environ
    if env.get("HERMES_HOST"):
        cfg["host"] = env["HERMES_HOST"]
    if env.get("HERMES_PORT"):
        cfg["port"] = int(env["HERMES_PORT"])
    if env.get("HERMES_STRATEGY"):
        cfg["strategy"] = env["HERMES_STRATEGY"]
    if env.get("HERMES_HEALTH_ENABLED") is not None:
        cfg["health_enabled"] = _as_bool(env["HERMES_HEALTH_ENABLED"], cfg["health_enabled"])
    if env.get("HERMES_HEALTH_INTERVAL"):
        cfg["health_interval"] = float(env["HERMES_HEALTH_INTERVAL"])
    if env.get("HERMES_HEALTH_TIMEOUT"):
        cfg["health_timeout"] = float(env["HERMES_HEALTH_TIMEOUT"])
    if env.get("HERMES_HEALTH_PATH"):
        cfg["health_path"] = env["HERMES_HEALTH_PATH"]
    if env.get("HERMES_FALLBACK") is not None:
        cfg["fallback_enabled"] = _as_bool(env["HERMES_FALLBACK"], cfg["fallback_enabled"])
    if env.get("HERMES_MAX_RETRIES"):
        cfg["max_retries"] = int(env["HERMES_MAX_RETRIES"])
    if env.get("HERMES_BACKENDS"):
        cfg["backends"] = _parse_backends_env(env["HERMES_BACKENDS"])
    if env.get("HERMES_LOG_LEVEL"):
        cfg["log_level"] = env["HERMES_LOG_LEVEL"]
    if env.get("HERMES_MAX_TOKENS_REASONING"):
        cfg["max_tokens_reasoning"] = max(
            512, int(env["HERMES_MAX_TOKENS_REASONING"]))
    if env.get("HERMES_VRAM_POLL") is not None:
        cfg["vram_poll"] = _as_bool(env["HERMES_VRAM_POLL"], cfg["vram_poll"])
    if env.get("HERMES_VRAM_FLUSH_CMD"):
        cfg["vram_flush_cmd"] = env["HERMES_VRAM_FLUSH_CMD"]

    cfg["port"] = int(cfg["port"])
    norm = []
    for b in cfg["backends"]:
        url = str(b.get("url", "")).strip()
        if not url:
            continue
        norm.append({
            "name": str(b.get("name") or url),
            "url": url,
            "weight": max(1, int(b.get("weight", 1))),
            "enabled": _as_bool(b.get("enabled", True), True),
            "tags": list(b.get("tags", []) or []),
            "health_path": b.get("health_path") or cfg["health_path"],
        })
    cfg["backends"] = norm
    return cfg


# --------------------------------------------------------------------------- #
# Default generation parameters + VRAM lifecycle helpers
#
# Reasoning models (Qwen3, DeepSeek-R1, QwQ, ...) spend tokens on internal
# "thinking" before producing an answer. A small default max_tokens truncates
# the reasoning trace and yields empty or partial answers, so Hermes injects
# a sensible default (>= 512) when the client does not supply one. Explicit
# client-supplied max_tokens / max_completion_tokens ALWAYS win, untouched.
#
# Ollama (v0.40.x) exposes no REST unload endpoint (verified live), so idle
# weights are released by the server-side OLLAMA_KEEP_ALIVE. Hermes tracks the
# resident models + VRAM via GET /api/ps, detects model switches, and offers
# an optional hard-flush hook (vram_flush_cmd) plus /admin endpoints.
# --------------------------------------------------------------------------- #
def is_reasoning_model(model, cfg):
    """True if the `model` name matches a configured reasoning-model pattern
    (case-insensitive, word-boundary matched so e.g. 'r1' does not hit
    'llama-3.1')."""
    if not model:
        return False
    name = str(model).lower()
    for p in cfg.get("reasoning_patterns") or []:
        p = str(p).lower().strip()
        if p and re.search(r"(?<![a-z0-9])" + re.escape(p) + r"(?![a-z0-9])",
                           name):
            return True
    return False


def apply_default_max_tokens(body, model, cfg):
    """Inject a default max_tokens for reasoning models when the client
    omits it. Returns (body_bytes, injected). Client-supplied max_tokens or
    max_completion_tokens are always preserved unchanged."""
    if not body or not is_reasoning_model(model, cfg):
        return body, False
    try:
        doc = json.loads(body.decode("utf-8", "replace"))
    except Exception:
        return body, False
    if not isinstance(doc, dict):
        return body, False
    if "max_tokens" in doc or "max_completion_tokens" in doc:
        return body, False  # explicit client override wins
    limit = max(512, int(cfg.get("max_tokens_reasoning", 512)))
    doc["max_tokens"] = limit
    return json.dumps(doc).encode("utf-8"), True


# --------------------------------------------------------------------------- #
# Backend model
# --------------------------------------------------------------------------- #
class Backend:
    __slots__ = ("name", "url", "weight", "enabled", "tags", "health_path",
                 "healthy", "latency", "failures", "last_check", "last_error",
                 "inflight", "models",
                 # Ollama VRAM lifecycle (populated from GET /api/ps)
                 "ps_models", "ps_vram_bytes", "ps_updated",
                 "last_model", "last_model_ts",
                 # request telemetry (see Router.metrics() / GET /metrics)
                 "req_total", "req_ok", "req_err", "fallbacks",
                 "lat_ms_sum", "lat_ms_n", "last_ok")

    def __init__(self, spec):
        self.name = spec["name"]
        self.url = str(spec["url"]).rstrip("/")
        self.weight = int(spec.get("weight", 1))
        self.enabled = bool(spec.get("enabled", True))
        self.tags = list(spec.get("tags", []) or [])
        self.health_path = spec.get("health_path", "/v1/models")
        self.healthy = True
        self.latency = None
        self.failures = 0
        self.last_check = None
        self.last_error = None
        self.inflight = 0
        self.models = []
        # request telemetry (always updated under Router.lock)
        self.req_total = 0
        self.req_ok = 0
        self.req_err = 0
        self.fallbacks = 0
        self.lat_ms_sum = 0.0
        self.lat_ms_n = 0
        self.last_ok = None
        # Ollama VRAM lifecycle state (updated under Router.lock)
        self.ps_models = []
        self.ps_vram_bytes = 0
        self.ps_updated = None
        self.last_model = None
        self.last_model_ts = None

    def to_dict(self):
        return {
            "name": self.name,
            "url": self.url,
            "weight": self.weight,
            "enabled": self.enabled,
            "tags": self.tags,
            "healthy": self.healthy,
            "latency_ms": (self.latency * 1000.0) if self.latency is not None else None,
            "failures": self.failures,
            "inflight": self.inflight,
            "last_error": self.last_error,
            "models": self.models,
            "vram": {
                "models": self.ps_models,
                "vram_bytes": self.ps_vram_bytes,
                "updated": self.ps_updated,
            },
            "last_model": self.last_model,
        }


# --------------------------------------------------------------------------- #
# Router — chooses which backend serves a request
# --------------------------------------------------------------------------- #
class Router:
    def __init__(self, cfg):
        self.cfg = cfg
        self.backends = [Backend(b) for b in cfg["backends"] if b.get("enabled", True)]
        self.lock = threading.Lock()
        self.strategy = cfg.get("strategy", "weighted")
        self.fallback_enabled = bool(cfg.get("fallback_enabled", True))
        self.max_retries = max(0, int(cfg.get("max_retries", 2)))
        self.started_ts = time.time()
        # request telemetry (always updated under self.lock)
        self.req_total = 0
        self.req_ok = 0
        self.req_err = 0
        self.fallbacks = 0
        self.all_failed = 0
        self.pinned = 0
        self.model_routed = 0
        self.model_switches = 0
        self.vram_flushes = 0
        self.streamed = 0
        self.by_endpoint = {}
        self._rr = 0
        if self.strategy in ("weighted", "round-robin"):
            pool = []
            for b in self.backends:
                rep = b.weight if self.strategy == "weighted" else 1
                pool.extend([b] * rep)
        else:
            pool = list(self.backends)
        self._pool = pool

    def healthy(self):
        return [b for b in self.backends if b.healthy]

    def pick(self):
        with self.lock:
            pool = self._pool
            n = len(pool)
            if n == 0:
                return None
            if self.strategy == "health":
                cands = self.healthy() or list(self.backends)
                return min(cands, key=lambda b: (
                    b.inflight,
                    b.latency if b.latency is not None else 9e9,
                    b.name,
                ))
            for step in range(n):
                idx = (self._rr + step) % n
                b = pool[idx]
                if b.healthy:
                    self._rr = (idx + 1) % n
                    return b
            b = pool[self._rr]
            self._rr = (self._rr + 1) % n
            return b

    def order_for(self, first):
        """Ordered backends to try, starting with `first` (capped by retries)."""
        if first is None:
            return []
        if not self.fallback_enabled:
            return [first]
        out = [first]
        for b in self.healthy():
            if b is not first:
                out.append(b)
        for b in self.backends:
            if b not in out:
                out.append(b)
        return out[: self.max_retries + 1]

    def pick_for_model(self, model):
        """If exactly one healthy backend serves `model`, route there."""
        if not model:
            return None
        matches = [b for b in self.healthy() if model in b.models]
        if len(matches) == 1:
            return matches[0]
        return None

    def track_model(self, backend, model):
        """Record the model `backend` is about to serve.

        Returns (previous_model, switched). Caller must not hold self.lock.
        """
        if not model:
            return None, False
        with self.lock:
            prev = backend.last_model
            backend.last_model = model
            backend.last_model_ts = time.time()
            switched = prev is not None and prev != model
            if switched:
                self.model_switches += 1
        return prev, switched

    def count_request(self, path):
        """Record one proxied request (caller must hold self.lock)."""
        self.req_total += 1
        self.by_endpoint[path] = self.by_endpoint.get(path, 0) + 1

    def metrics(self):
        """Build the JSON telemetry document served at GET /metrics."""
        now = time.time()
        uptime = now - self.started_ts
        with self.lock:
            totals = {
                "requests": self.req_total,
                "ok": self.req_ok,
                "errors": self.req_err,
                "fallbacks": self.fallbacks,
                "all_failed": self.all_failed,
                "pinned": self.pinned,
                "model_routed": self.model_routed,
                "model_switches": self.model_switches,
                "vram_flushes": self.vram_flushes,
                "streamed": self.streamed,
                "requests_per_min": (self.req_total * 60.0 / uptime)
                                    if uptime > 1 else 0.0,
                "by_endpoint": dict(sorted(self.by_endpoint.items(),
                                           key=lambda kv: -kv[1])),
            }
            backends = []
            for b in self.backends:
                backends.append({
                    "name": b.name,
                    "url": b.url,
                    "weight": b.weight,
                    "enabled": b.enabled,
                    "tags": list(b.tags),
                    "healthy": b.healthy,
                    "status": "up" if b.healthy else "down",
                    "requests": b.req_total,
                    "ok": b.req_ok,
                    "errors": b.req_err,
                    "fallbacks": b.fallbacks,
                    "inflight": b.inflight,
                    "share": (b.req_total / self.req_total)
                             if self.req_total else 0.0,
                    "avg_latency_ms": (b.lat_ms_sum / b.lat_ms_n)
                                      if b.lat_ms_n else None,
                    "health_latency_ms": (b.latency * 1000.0)
                                         if b.latency is not None else None,
                    "health_failures": b.failures,
                    "last_check": b.last_check,
                    "last_ok": b.last_ok,
                    "last_error": b.last_error,
                    "models": list(b.models),
                    "vram_models": list(b.ps_models),
                    "vram_bytes": b.ps_vram_bytes,
                    "vram_updated": b.ps_updated,
                    "last_model": b.last_model,
                })
        return {
            "service": "hermes",
            "version": __version__,
            "generated_at": now,
            "generated_at_iso": time.strftime("%Y-%m-%dT%H:%M:%S%z",
                                              time.localtime(now)),
            "uptime_seconds": round(uptime, 1),
            "strategy": self.strategy,
            "fallback_enabled": self.fallback_enabled,
            "totals": totals,
            "backends": backends,
        }


# --------------------------------------------------------------------------- #
# Health checker — background liveness probes + model discovery
# --------------------------------------------------------------------------- #
class HealthChecker:
    def __init__(self, router, cfg):
        self.router = router
        self.enabled = bool(cfg.get("health_enabled", True))
        self.interval = float(cfg.get("health_interval", 15.0))
        self.timeout = float(cfg.get("health_timeout", 5.0))
        self.down_threshold = int(cfg.get("down_threshold", 2))
        self._stop = threading.Event()
        self._thread = None

    def start(self):
        if not self.enabled:
            log("info", "health checks disabled")
            return
        self.check_all()  # immediate first pass
        self._thread = threading.Thread(target=self._loop, daemon=True, name="hermes-health")
        self._thread.start()
        log("info", "health checks: every %.0fs, timeout %.1fs, down after %d fails"
            % (self.interval, self.timeout, self.down_threshold))

    def stop(self):
        self._stop.set()

    def _loop(self):
        while not self._stop.wait(self.interval):
            self.check_all()

    def check_all(self):
        for b in self.router.backends:
            threading.Thread(target=self._check_one, args=(b,), daemon=True).start()

    def _check_one(self, b):
        url = b.url + b.health_path
        host = urllib.parse.urlparse(b.url).netloc
        t0 = time.time()
        ok = False
        err = None
        models = None
        try:
            req = urllib.request.Request(url, method="GET")
            req.add_header("Host", host)
            req.add_header("Accept", "application/json")
            req.add_header("Connection", "close")
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                ok = True
                if "/models" in b.health_path:
                    try:
                        body = resp.read(131072)
                        data = json.loads(body.decode("utf-8", "replace"))
                        models = [m.get("id") for m in data.get("data", [])
                                  if isinstance(m, dict) and m.get("id")]
                    except Exception:
                        models = None
        except urllib.error.HTTPError as e:
            ok = True  # the server responded (any status) -> it is alive
            err = "HTTP %s on %s" % (e.code, b.health_path)
        except Exception as e:  # noqa: BLE001
            ok = False
            err = "%s: %s" % (type(e).__name__, e)
        if self.router.cfg.get("vram_poll", True) and "ollama" in b.tags:
            self._poll_vram(b)
        dt = time.time() - t0
        with self.router.lock:
            b.last_check = time.time()
            b.latency = dt
            if models is not None:
                b.models = models
            if ok:
                was = b.healthy
                b.healthy = True
                b.failures = 0
                if not was:
                    log("info", "backend %s is back UP (%.0fms)" % (b.name, dt * 1000))
                elif err:
                    b.last_error = err
            else:
                b.failures += 1
                b.last_error = err
                if b.failures >= self.down_threshold:
                    if b.healthy:
                        log("warn", "backend %s marked DOWN: %s" % (b.name, err))
                    b.healthy = False
                else:
                    log("warn", "backend %s probe failed (%d/%d): %s"
                        % (b.name, b.failures, self.down_threshold, err))

    def _poll_vram(self, b):
        """Best-effort Ollama VRAM poll: GET {url}/api/ps.

        Tracks which model weights are resident in VRAM and how much they
        occupy. Never affects backend health; failures are silent.
        """
        try:
            req = urllib.request.Request(b.url + "/api/ps", method="GET")
            req.add_header("Accept", "application/json")
            req.add_header("Connection", "close")
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                data = json.loads(resp.read(131072).decode("utf-8", "replace"))
            models, vram = [], 0
            for m in data.get("models") or []:
                models.append(m.get("name") or m.get("model") or "?")
                vram += int(m.get("size_vram") or 0)
            with self.router.lock:
                b.ps_models = models
                b.ps_vram_bytes = vram
                b.ps_updated = time.time()
        except Exception:  # noqa: BLE001
            pass


# --------------------------------------------------------------------------- #
# HTTP handling
# --------------------------------------------------------------------------- #
HOP_HEADERS = {
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
    "te", "trailer", "trailers", "upgrade", "transfer-encoding",
    "content-length", "host", "accept-encoding", "x-hermes-backend",
}

PROXY_POST = {"/v1/chat/completions", "/v1/completions", "/v1/embeddings"}


def _status(resp):
    s = getattr(resp, "status", None)
    if s is None:
        s = getattr(resp, "code", None)
    if s is None:
        s = resp.getcode()
    return s


class HermesHandler(BaseHTTPRequestHandler):
    server_version = "Hermes/" + __version__
    protocol_version = "HTTP/1.1"

    @property
    def router(self):
        return self.server.router

    @property
    def cfg(self):
        return self.server.cfg

    def log_message(self, fmt, *args):
        log("debug", "%s %s" % (self.address_string(), fmt % args))

    # --- small response helpers ------------------------------------------- #
    def _send_json(self, code, obj, content_type="application/json"):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Connection", "close")
        self.end_headers()
        try:
            self.wfile.write(body)
        except Exception:
            pass

    def _error(self, code, message, hint=None):
        err = {"error": {"message": message, "type": "hermes_error"}}
        if hint:
            err["error"]["hint"] = hint
        self._send_json(code, err)

    # --- request body reading --------------------------------------------- #
    def _read_body(self):
        te = (self.headers.get("Transfer-Encoding") or "").lower()
        if "chunked" in te:
            return self._read_chunked()
        cl = self.headers.get("Content-Length")
        if cl:
            try:
                n = int(cl)
            except ValueError:
                n = 0
            return self.rfile.read(n) if n > 0 else b""
        return b""

    def _read_chunked(self):
        data = bytearray()
        while True:
            line = self.rfile.readline().strip()
            if not line:
                continue
            try:
                size = int(line.split(b";")[0], 16)
            except ValueError:
                break
            if size == 0:
                while True:
                    tl = self.rfile.readline()
                    if tl in (b"\r\n", b"\n", b""):
                        break
                break
            data += self.rfile.read(size)
            self.rfile.readline()  # trailing CRLF after each chunk
        return bytes(data)

    # --- forwarding to a backend ------------------------------------------ #
    def _open_backend(self, backend, path, method, body):
        target = backend.url + path
        data = body if method == "POST" else None
        req = urllib.request.Request(target, data=data, method=method)
        host = urllib.parse.urlparse(backend.url).netloc
        for k, v in self.headers.items():
            if k.lower() in HOP_HEADERS:
                continue
            req.add_header(k, v)
        req.add_header("Host", host)
        req.add_header("Connection", "close")
        return urllib.request.urlopen(req, timeout=self.cfg.get("request_timeout", 600.0))

    def _relay(self, resp, stream):
        status = _status(resp)
        ctype = resp.headers.get("Content-Type", "application/json")
        backend = getattr(self, "_backend_name", "?")
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("X-Hermes-Backend", backend)
        if stream:
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "close")
            self.end_headers()
            try:
                while True:
                    chunk = resp.read(1024)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    self.wfile.flush()
            except Exception as e:  # noqa: BLE001
                log("warn", "stream relay to client aborted (%s): %s" % (backend, e))
        else:
            data = resp.read()
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Connection", "close")
            self.end_headers()
            self.wfile.write(data)

    # --- routing with fallback -------------------------------------------- #
    def _route(self, method, path, body, stream):
        router = self.router
        model = None
        if body:
            try:
                model = json.loads(body.decode("utf-8", "replace")).get("model")
            except Exception:
                model = None

        with router.lock:
            router.count_request(path)
            if stream:
                router.streamed += 1

        pinned = self.headers.get("X-Hermes-Backend")
        first = None
        if pinned:
            first = next((b for b in router.backends if b.name == pinned), None)
            if first is None:
                self._error(400, "unknown backend '%s' (X-Hermes-Backend)" % pinned)
                return
            with router.lock:
                router.pinned += 1
        if first is None:
            first = router.pick_for_model(model)
            if first is not None:
                with router.lock:
                    router.model_routed += 1
            else:
                first = router.pick()
        if first is None:
            self._error(503, "no backends configured")
            return

        # --- default generation params + VRAM lifecycle ------------------- #
        if method == "POST" and path in ("/v1/chat/completions",
                                         "/v1/completions"):
            body, injected = apply_default_max_tokens(body, model,
                                                      router.cfg)
            if injected:
                log("info", "injected default max_tokens=%d for reasoning "
                    "model %s"
                    % (max(512, int(router.cfg.get("max_tokens_reasoning",
                                                   512))), model))
            prev, switched = router.track_model(first, model)
            if switched:
                log("info", "model switch on %s: %s -> %s (stale weights "
                    "flush via backend OLLAMA_KEEP_ALIVE)"
                    % (first.name, prev, model))
                self._maybe_flush(first)

        tried = []
        t0 = time.time()
        for b in router.order_for(first):
            b.inflight += 1
            with router.lock:
                b.req_total += 1
            self._backend_name = b.name
            try:
                resp = self._open_backend(b, path, method, body)
            except urllib.error.HTTPError as e:
                b.inflight -= 1
                dt_ms = (time.time() - t0) * 1000.0
                if e.code < 500:
                    with router.lock:
                        b.req_ok += 1
                        router.req_ok += 1
                        b.last_ok = time.time()
                        b.lat_ms_sum += dt_ms
                        b.lat_ms_n += 1
                    log("info", "%s %s -> %s (HTTP %s)" % (method, path, b.name, e.code))
                    self._relay(e, stream)
                    return
                tried.append(b.name)
                with router.lock:
                    b.failures += 1
                    b.last_error = "HTTP %s" % e.code
                    b.req_err += 1
                    b.fallbacks += 1
                    router.req_err += 1
                    router.fallbacks += 1
                log("warn", "backend %s returned HTTP %s for %s; falling back"
                    % (b.name, e.code, path))
                continue
            except Exception as e:  # noqa: BLE001
                b.inflight -= 1
                tried.append(b.name)
                with router.lock:
                    b.failures += 1
                    b.last_error = "%s: %s" % (type(e).__name__, e)
                    b.req_err += 1
                    b.fallbacks += 1
                    router.req_err += 1
                    router.fallbacks += 1
                log("warn", "backend %s unreachable for %s: %s; falling back"
                    % (b.name, path, e))
                continue
            log("info", "%s %s -> %s" % (method, path, b.name))
            try:
                self._relay(resp, stream)
                dt_ms = (time.time() - t0) * 1000.0
                with router.lock:
                    b.failures = 0
                    b.req_ok += 1
                    router.req_ok += 1
                    b.last_ok = time.time()
                    b.lat_ms_sum += dt_ms
                    b.lat_ms_n += 1
            except Exception as e:  # noqa: BLE001
                log("warn", "relay to client failed (%s): %s" % (b.name, e))
            finally:
                b.inflight -= 1
            return
        with router.lock:
            router.all_failed += 1
        self._error(502, "all backends failed",
                    hint="tried: %s" % (", ".join(tried) or "none"))

    # --- endpoint dispatch ------------------------------------------------- #
    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path in ("/health", "/healthz", "/_health"):
            self._health()
        elif path in ("/metrics", "/proxy-stats"):
            self._metrics()
        elif path in ("/monitor", "/dashboard"):
            self._monitor()
        elif path == "/admin/vram":
            self._admin_vram()
        elif path in ("/", "/v1"):
            self._index()
        elif path == "/v1/models":
            self._models()
        else:
            self._route("GET", path, b"", stream=False)

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        if path == "/admin/flush":
            self._read_body()
            self._admin_flush()
            return
        body = self._read_body()
        stream = False
        if body:
            try:
                stream = bool(json.loads(body.decode("utf-8", "replace")).get("stream"))
            except Exception:
                stream = False
        self._route("POST", path, body, stream=stream)

    # --- VRAM lifecycle: flush hook + admin endpoints --------------------- #
    def _maybe_flush(self, backend):
        """Run the configured hard-flush hook after a model switch (if set).

        Ollama has no REST unload endpoint; idle weights are released by the
        server-side OLLAMA_KEEP_ALIVE. vram_flush_cmd lets operators wire a
        hard flush (e.g. ssh + 'docker restart ollama'). Runs in a background
        thread; it never blocks or fails the proxied request.
        """
        cmd = (self.cfg.get("vram_flush_cmd") or "").strip()
        if not cmd:
            return
        with self.router.lock:
            self.router.vram_flushes += 1

        def _run():
            try:
                log("info", "vram flush [%s]: %s" % (backend.name, cmd))
                subprocess.run(cmd, shell=True, timeout=120,
                               stdout=subprocess.DEVNULL,
                               stderr=subprocess.DEVNULL)
                log("info", "vram flush [%s] completed" % backend.name)
            except Exception as e:  # noqa: BLE001
                log("warn", "vram flush [%s] failed: %s" % (backend.name, e))

        threading.Thread(target=_run, daemon=True,
                         name="hermes-flush-" + backend.name).start()

    def _admin_vram(self):
        """GET /admin/vram — per-backend resident models + VRAM usage."""
        router = self.router
        vram = {}
        for b in router.backends:
            vram[b.name] = {
                "url": b.url,
                "ollama": "ollama" in b.tags,
                "loaded_models": list(b.ps_models),
                "vram_bytes": b.ps_vram_bytes,
                "vram_updated": b.ps_updated,
                "last_model": b.last_model,
            }
        self._send_json(200, {
            "service": "hermes",
            "version": __version__,
            "flush_command_configured": bool(
                (self.cfg.get("vram_flush_cmd") or "").strip()),
            "vram": vram,
        })

    def _admin_flush(self):
        """POST /admin/flush — explicit operator trigger for the flush hook.

        Executes vram_flush_cmd when configured (no-op otherwise) and reports
        the current resident-model/VRAM state of every backend.
        """
        router = self.router
        cmd = (self.cfg.get("vram_flush_cmd") or "").strip()
        out = {"flush_command_configured": bool(cmd), "executed": False}
        if cmd:
            with router.lock:
                router.vram_flushes += 1
            try:
                subprocess.run(cmd, shell=True, timeout=120,
                               stdout=subprocess.DEVNULL,
                               stderr=subprocess.DEVNULL)
                out["executed"] = True
            except Exception as e:  # noqa: BLE001
                out["error"] = "%s: %s" % (type(e).__name__, e)
        vram = {}
        for b in router.backends:
            vram[b.name] = {"loaded_models": list(b.ps_models),
                            "vram_bytes": b.ps_vram_bytes,
                            "vram_updated": b.ps_updated}
        out["vram"] = vram
        self._send_json(200, out)

    # --- Hermes-native endpoints ------------------------------------------ #
    def _health(self):
        router = self.router
        backends = [b.to_dict() for b in router.backends]
        up = sum(1 for b in router.backends if b.healthy)
        ok = up > 0
        self._send_json(200 if ok else 503, {
            "status": "ok" if ok else "degraded",
            "version": __version__,
            "strategy": router.strategy,
            "backends_total": len(router.backends),
            "backends_up": up,
            "backends": backends,
        })

    def _index(self):
        router = self.router
        self._send_json(200, {
            "service": "hermes",
            "version": __version__,
            "description": "OpenAI-compatible multi-backend AI routing gateway",
            "strategy": router.strategy,
            "endpoints": {
                "chat": "POST /v1/chat/completions",
                "completions": "POST /v1/completions",
                "embeddings": "POST /v1/embeddings",
                "models": "GET /v1/models",
                "health": "GET /health",
                "metrics": "GET /metrics (alias: /proxy-stats) - JSON telemetry",
                "monitor": "GET /monitor - web dashboard (monitor.html)",
                "admin_vram": "GET /admin/vram - per-backend resident models + VRAM (Ollama /api/ps)",
                "admin_flush": "POST /admin/flush - trigger the configured VRAM flush hook",
            },
            "backends": [
                {"name": b.name, "url": b.url, "weight": b.weight, "healthy": b.healthy}
                for b in router.backends
            ],
            "pin_backend": "send header  X-Hermes-Backend: <name>  to force a backend",
        })

    def _models(self):
        router = self.router
        merged = {}
        for b in router.healthy():
            for m in b.models:
                merged.setdefault(m, b.name)
        if merged:
            data = [{"id": m, "object": "model", "owned_by": "hermes/" + owner}
                    for m, owner in merged.items()]
            self._send_json(200, {"object": "list", "data": data})
            return
        # no cached model list yet -> proxy to a chosen backend
        self._route("GET", "/v1/models", b"", stream=False)

    def _metrics(self):
        self._send_json(200, self.router.metrics())

    def _monitor(self):
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                            "monitor.html")
        try:
            with open(path, "rb") as fh:
                data = fh.read()
        except OSError:
            self._error(404, "monitor.html not found on this host")
            return
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Connection", "close")
        self.end_headers()
        try:
            self.wfile.write(data)
        except Exception:
            pass


# --------------------------------------------------------------------------- #
# Server bootstrap
# --------------------------------------------------------------------------- #
class HermesServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True
    router = None
    cfg = None
    health = None


def main():
    cfg = load_config()
    global _log_level
    _log_level = _LOG_LEVELS.get(str(cfg.get("log_level", "info")).lower(), 20)

    router = Router(cfg)
    if not router.backends:
        log("error", "no enabled backends configured; refusing to start")
        sys.exit(1)

    server = HermesServer((cfg["host"], cfg["port"]), HermesHandler)
    server.cfg = cfg
    server.router = router
    server.health = HealthChecker(router, cfg)

    log("info", "Hermes %s listening on %s:%d" % (__version__, cfg["host"], cfg["port"]))
    log("info", "strategy=%s fallback=%s max_retries=%d request_timeout=%.0fs"
        % (router.strategy, router.fallback_enabled, router.max_retries,
           cfg.get("request_timeout", 600.0)))
    for b in router.backends:
        log("info", "  backend %-12s weight=%d url=%s" % (b.name, b.weight, b.url))
    if cfg.get("vram_poll", True):
        log("info", "vram lifecycle: polling /api/ps for ollama-tagged backends; "
            "reasoning default max_tokens=%d (flush hook %s)"
            % (max(512, int(cfg.get("max_tokens_reasoning", 512))),
               "configured" if (cfg.get("vram_flush_cmd") or "").strip()
               else "off"))

    try:
        server.health.start()
        server.serve_forever()
    except KeyboardInterrupt:
        log("info", "shutting down (keyboard interrupt)")
    finally:
        server.health.stop()
        server.server_close()


if __name__ == "__main__":
    main()
