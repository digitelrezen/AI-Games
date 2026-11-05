#!/usr/bin/env bash
# =============================================================================
# Hermes — one-shot installer for a Proxmox LXC (Debian / Ubuntu)
#
# Usage (as root inside the container):
#   bash bootstrap.sh
#
# This script is idempotent and fully self-contained: it embeds every
# application file (no git clone, no pip install, no network needed), creates
# an unprivileged 'hermes' user, installs the systemd unit, and starts the
# service. Safe to re-run to re-apply changes.
# =============================================================================
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "ERROR: run as root ->  bash bootstrap.sh" >&2
  exit 1
fi

APP_DIR=/opt/hermes
SVC_NAME=hermes.service

echo "==> [1/6] Ensuring python3 is available"
if ! command -v python3 >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y python3
fi
python3 --version

echo "==> [2/6] Creating service account 'hermes'"
if ! id hermes >/dev/null 2>&1; then
  useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin hermes
fi

echo "==> [3/6] Writing application files to $APP_DIR"
mkdir -p "$APP_DIR"

cat > "$APP_DIR/hermes.py" <<'HERMES_PY_EOF'
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
HERMES_PY_EOF

cat > "$APP_DIR/config.yaml" <<'HERMES_CFG_EOF'
# =============================================================================
# Hermes — multi-backend OpenAI-compatible AI routing gateway
# =============================================================================
# This file is the human-editable source of truth. Environment variables
# (HERMES_*, see .env) always OVERRIDE the values below.
#
# Routing strategies:
#   weighted     -> weighted round-robin (default; uses each backend's weight)
#   round-robin  -> plain round-robin
#   health       -> least-loaded (fewest in-flight requests, then lowest latency)
# =============================================================================

server:
  host: 0.0.0.0
  port: 3000

routing:
  # weighted | round-robin | health
  strategy: weighted

  health:
    enabled: true
    interval_sec: 15      # how often to probe each backend
    timeout_sec: 5        # per-probe timeout (seconds)
    path: /v1/models      # liveness + model-discovery endpoint

  fallback:
    enabled: true         # try the next healthy backend when one fails
    max_retries: 2        # additional backends to try after the first pick

log_level: info

# --- Default generation parameters + VRAM lifecycle (Hermes v1.2) ----------
defaults:
  # Reasoning models (qwen3, deepseek, r1, qwq, ...) silently truncate their
  # internal "thinking" when max_tokens is small. If a request omits
  # max_tokens (or max_completion_tokens), Hermes injects this default so
  # reasoning models actually finish their answer. Floor: 512.
  # Explicit client-supplied max_tokens always wins, untouched.
  max_tokens_reasoning: 512
  # Case-insensitive word-boundary name patterns treated as reasoning models
  # (word-boundary match, so "r1" never matches "llama-3.1").
  reasoning_patterns: [qwen3, qwen-3, qwq, deepseek, r1, o1, o3, thinking, reasoning]

vram:
  # Poll Ollama backends (tagged "ollama") at /api/ps alongside the health
  # checks to track which model weights are resident in VRAM.
  poll: true
  # Optional HARD flush hook, run (in a background thread) whenever Hermes
  # detects a model switch on a backend and from POST /admin/flush.
  # Ollama 0.40.x has NO REST unload endpoint — idle weights are released by
  # the server-side OLLAMA_KEEP_ALIVE (set on the backend host). Use this
  # hook only if you also need a hard flush (e.g. restart the ollama
  # container). Empty = hook disabled (keep_alive-only mode, recommended).
  flush_command: ""

# -----------------------------------------------------------------------------
# Backends
#   name        : identifier (also usable to pin via the X-Hermes-Backend header)
#   url         : base URL of the OpenAI-compatible inference server
#   weight      : relative load-balancing weight (higher = more traffic)
#   enabled     : true / false
#   tags        : free-form labels (informational)
#   health_path : optional per-backend override of the probe endpoint
# -----------------------------------------------------------------------------
backends:
  - name: nvidia
    # Ollama on the NVIDIA box (serves qwen2.5:14b). Port 80 is NOT an
    # inference endpoint on this machine - :11434 is the OpenAI-compatible
    # API (verified 2026-07-06).
    url: http://192.168.1.16:11434
    weight: 3
    enabled: true
    tags: [gpu, cuda, ollama]

  - name: intel-arc
    url: http://192.168.1.121:8080
    weight: 2
    enabled: true
    tags: [gpu, sycl]
HERMES_CFG_EOF

cat > "$APP_DIR/.env" <<'HERMES_ENV_EOF'
# Hermes runtime environment (loaded by the systemd unit via EnvironmentFile)
# These values OVERRIDE config.yaml.
HERMES_HOST=0.0.0.0
HERMES_PORT=3000
HERMES_STRATEGY=weighted
HERMES_HEALTH_ENABLED=true
HERMES_HEALTH_INTERVAL=15
HERMES_HEALTH_TIMEOUT=5
HERMES_HEALTH_PATH=/v1/models
HERMES_FALLBACK=true
HERMES_MAX_RETRIES=2
HERMES_LOG_LEVEL=info

# --- VRAM lifecycle + default generation params (Hermes v1.2) ----
# Poll Ollama /api/ps (backends tagged "ollama") for VRAM/model tracking
HERMES_VRAM_POLL=true
# Optional hard-flush shell hook on model switch (empty = keep_alive only).
# Ollama 0.40.x has no REST unload endpoint; idle weights are released by the
# server-side OLLAMA_KEEP_ALIVE (set on the backend host). Example:
#   HERMES_VRAM_FLUSH_CMD="ssh root@192.168.1.16 'docker restart ollama'"
HERMES_VRAM_FLUSH_CMD=
# Reasoning models (qwen3/r1/qwq/...) get this default max_tokens when the
# client omits it (floor 512). Explicit client max_tokens always wins.
HERMES_MAX_TOKENS_REASONING=512

# To override the backend list purely from the environment, uncomment and edit:
# format: name=url:weight,name2=url2:weight2  (comma separated)
#HERMES_BACKENDS=nvidia=http://192.168.1.16:11434:3,intel-arc=http://192.168.1.121:8080:2
HERMES_ENV_EOF

cat > "$APP_DIR/hermes.service" <<'HERMES_SVC_EOF'
[Unit]
Description=Hermes - OpenAI-compatible multi-backend AI routing gateway
Documentation=file:///opt/hermes/README.md
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
# Unprivileged service account (created by bootstrap.sh)
User=hermes
Group=hermes
WorkingDirectory=/opt/hermes
EnvironmentFile=/opt/hermes/.env
ExecStart=/usr/bin/python3 /opt/hermes/hermes.py
Restart=always
RestartSec=3
# Resource limits
LimitNOFILE=65536
# Hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true
ReadWritePaths=/opt/hermes

[Install]
WantedBy=multi-user.target
HERMES_SVC_EOF

cat > "$APP_DIR/monitor.html" <<'HERMES_HTML_EOF'
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hermes Gateway - Monitor</title>
<style>
  :root {
    --bg: #0b0f14; --panel: #121a23; --panel2: #0e151d; --line: #1f2c3a;
    --text: #d7e1ea; --dim: #7d8fa1; --green: #2fbf71; --red: #e5534b;
    --amber: #d9a441; --blue: #4aa3ff; --a: #ff8a3d; --b: #38c6d9;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text);
         font: 14px/1.45 "Segoe UI", system-ui, -apple-system, sans-serif; }
  header { display: flex; flex-wrap: wrap; gap: 12px; align-items: center;
           justify-content: space-between; padding: 14px 20px;
           background: var(--panel); border-bottom: 1px solid var(--line);
           position: sticky; top: 0; z-index: 5; }
  h1 { font-size: 17px; margin: 0; letter-spacing: .4px; }
  h1 small { color: var(--dim); font-weight: 400; }
  .controls { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .controls label { color: var(--dim); font-size: 12px; display: flex;
                    gap: 6px; align-items: center; }
  input { background: var(--panel2); color: var(--text); border: 1px solid var(--line);
          border-radius: 6px; padding: 5px 8px; font: inherit; }
  #endpoint { width: 250px; }
  button { background: #16324c; color: var(--text); border: 1px solid #23527c;
           border-radius: 6px; padding: 5px 12px; cursor: pointer; font: inherit; }
  button:hover { background: #1b3d5e; }
  .pill { padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600;
          border: 1px solid var(--line); color: var(--dim); }
  .pill.ok { color: var(--green); border-color: var(--green); }
  .pill.bad { color: var(--red); border-color: var(--red); }
  main { padding: 18px 20px 30px; max-width: 1100px; margin: 0 auto;
         display: flex; flex-direction: column; gap: 16px; }
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: 10px;
          padding: 14px 16px; }
  .card h2 { margin: 0 0 10px; font-size: 13px; text-transform: uppercase;
             letter-spacing: 1.2px; color: var(--dim); }
  .statrow { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
             gap: 10px; }
  .stat { background: var(--panel2); border: 1px solid var(--line); border-radius: 8px;
          padding: 8px 10px; }
  .stat .k { color: var(--dim); font-size: 11px; text-transform: uppercase;
             letter-spacing: .8px; }
  .stat .v { font-size: 20px; font-weight: 600; margin-top: 2px; }
  .stat.bad .v { color: var(--red); }
  .bar-row { display: grid; grid-template-columns: 210px 1fr; gap: 10px;
             align-items: center; margin: 8px 0; }
  .bar-label { font-size: 13px; white-space: nowrap; }
  .bar-track { position: relative; height: 26px; background: var(--panel2);
               border: 1px solid var(--line); border-radius: 6px; overflow: hidden; }
  .bar-fill { position: absolute; top: 0; bottom: 0; left: 0; width: 0%;
              transition: width .5s ease; }
  #node-a-bar { background: linear-gradient(90deg, #b45a1f, var(--a)); }
  #node-b-bar { background: linear-gradient(90deg, #1f7d8c, var(--b)); }
  .bar-fill.down { background: repeating-linear-gradient(45deg, #5a2723, #5a2723 8px,
                   #6e302a 8px, #6e302a 16px) !important; }
  .bar-pct { position: absolute; top: 0; bottom: 0; right: 0; left: 0;
             display: flex; align-items: center; padding-left: 10px;
             font-size: 12px; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,.6);
             white-space: nowrap; }
  .backend-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(330px, 1fr));
                  gap: 12px; }
  .be { background: var(--panel2); border: 1px solid var(--line); border-radius: 8px;
        padding: 12px; }
  .be .top { display: flex; align-items: center; gap: 8px; margin-bottom: 6px;
             flex-wrap: wrap; }
  .be .name { font-weight: 600; font-size: 15px; }
  .be .url { color: var(--dim); font-size: 12px; word-break: break-all; }
  .be .kv { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 8px; }
  .be .kv .stat { padding: 5px 8px; }
  .be .kv .stat .v { font-size: 14px; }
  .be .err { margin-top: 8px; color: var(--red); font-size: 12px; word-break: break-word; }
  .be .models { margin-top: 8px; color: var(--dim); font-size: 12px; }
  .be .models code { color: var(--blue); background: var(--panel); padding: 1px 5px;
                     border-radius: 4px; margin-right: 4px; word-break: break-all; }
  .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%;
         background: var(--dim); }
  .dot.up { background: var(--green); box-shadow: 0 0 6px var(--green); }
  .dot.down { background: var(--red); box-shadow: 0 0 6px var(--red); }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--line); }
  th { color: var(--dim); font-size: 11px; text-transform: uppercase; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  th.num { text-align: right; }
  footer { color: var(--dim); font-size: 12px; text-align: center; padding: 4px 0 30px; }
  footer code { color: var(--blue); }
  #split-note { color: var(--dim); font-size: 12px; margin-top: 4px; }
</style>
</head>
<body>
<header>
  <h1>HERMES <small>AI routing gateway &middot; live monitor</small></h1>
  <div class="controls">
    <label>Endpoint <input id="endpoint" value="http://192.168.1.120:3000" spellcheck="false"></label>
    <label>Poll (s) <input id="interval" type="number" min="1" max="60" value="3" style="width:56px"></label>
    <button id="refresh">Refresh</button>
    <span id="conn" class="pill">connecting&hellip;</span>
  </div>
</header>
<main>
  <section class="card">
    <h2>Traffic split (live, from GET /metrics)</h2>
    <div class="bar-row">
      <span class="bar-label"><span class="dot" id="node-a-dot"></span>Node A &mdash; <b>nvidia</b></span>
      <div class="bar-track"><div class="bar-fill" id="node-a-bar"></div><span class="bar-pct" id="node-a-pct">&ndash;</span></div>
    </div>
    <div class="bar-row">
      <span class="bar-label"><span class="dot" id="node-b-dot"></span>Node B &mdash; <b>intel-arc</b></span>
      <div class="bar-track"><div class="bar-fill" id="node-b-bar"></div><span class="bar-pct" id="node-b-pct">&ndash;</span></div>
    </div>
    <div id="split-note">Waiting for data&hellip;</div>
  </section>

  <section class="card">
    <h2>Totals</h2>
    <div id="totals" class="statrow"><div class="stat"><div class="k">requests</div><div class="v">&ndash;</div></div></div>
  </section>

  <section class="card">
    <h2>Backends</h2>
    <div id="backends" class="backend-grid"><div class="be">connecting&hellip;</div></div>
  </section>

  <section class="card">
    <h2>Requests by endpoint</h2>
    <table id="endpoints">
      <thead><tr><th>Path</th><th class="num">requests</th></tr></thead>
      <tbody><tr><td colspan="2">&ndash;</td></tr></tbody>
    </table>
  </section>
</main>
<footer id="meta">Hermes monitor &middot; real-time data from <code>GET /metrics</code></footer>

<script>
"use strict";
var $ = function (id) { return document.getElementById(id); };
var state = { last: null, offline: false, timer: null };

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
function fmtDur(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  var d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600),
      m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (d) return d + "d " + h + "h";
  if (h) return h + "h " + m + "m";
  if (m) return m + "m " + s + "s";
  return s + "s";
}
function fmtTs(t) {
  if (!t) return "\u2014";
  return new Date(t * 1000).toLocaleTimeString();
}
function baseUrl() { return $("endpoint").value.trim().replace(/\/+$/, ""); }
function savePrefs() {
  try { localStorage.setItem("hermes.prefs", JSON.stringify({
    ep: $("endpoint").value.trim(), iv: $("interval").value })); } catch (e) {}
}
function loadPrefs() {
  try {
    var p = JSON.parse(localStorage.getItem("hermes.prefs") || "null");
    if (p && p.ep) { $("endpoint").value = p.ep; $("interval").value = p.iv || 3; }
  } catch (e) {}
}
function setPill(text, cls) {
  var el = $("conn");
  el.textContent = text;
  el.className = "pill " + (cls || "");
}
function stat(k, v, cls) {
  return '<div class="stat ' + (cls || "") + '"><div class="k">' + esc(k) +
         '</div><div class="v">' + esc(v) + "</div></div>";
}

/* Real traffic split: bar width = backend share of total routed requests,
   taken straight from /metrics (no random simulation). */
function setBar(barId, pctId, dotId, be) {
  var bar = $(barId), pct = $(pctId), dot = $(dotId);
  if (!be) {
    bar.style.width = "0%";
    bar.classList.add("down");
    pct.textContent = "\u2014 (no data)";
    dot.className = "dot";
    return;
  }
  bar.classList.toggle("down", !be.healthy);
  dot.className = "dot " + (be.healthy ? "up" : "down");
  var share = be.share || 0;
  var w = be.requests > 0 ? Math.max(share * 100, 1.5) : 0;
  bar.style.width = Math.min(100, w) + "%";
  var lat = be.avg_latency_ms != null ? be.avg_latency_ms.toFixed(0) + "ms" : "\u2014";
  pct.textContent = (share * 100).toFixed(1) + "% \u00b7 " + be.requests +
    " req \u00b7 " + lat + (be.healthy ? "" : " \u00b7 DOWN");
}
function backendCard(b) {
  var models = (b.models || []).map(function (m) {
    return "<code>" + esc(m) + "</code>";
  }).join(" ");
  var probe = b.healthy
    ? '<div class="url">healthy &middot; probe ' +
      esc(b.health_latency_ms != null ? b.health_latency_ms.toFixed(0) + "ms" : "\u2014") +
      " &middot; last check " + esc(fmtTs(b.last_check)) + "</div>"
    : '<div class="url" style="color:var(--red)">DOWN &middot; ' + esc(b.health_failures) +
      " consecutive probe failures</div>";
  return '<div class="be">' +
    '<div class="top"><span class="dot ' + (b.healthy ? "up" : "down") + '"></span>' +
    '<span class="name">' + esc(b.name) + "</span>" +
    '<span class="url">' + esc(b.url) + " \u00b7 weight " + esc(b.weight) + "</span></div>" +
    probe +
    '<div class="kv">' +
    stat("requests", b.requests) +
    stat("ok", b.ok) +
    stat("errors", b.errors, b.errors ? "bad" : "") +
    stat("fallbacks", b.fallbacks) +
    stat("in-flight", b.inflight) +
    stat("avg lat", b.avg_latency_ms != null ? b.avg_latency_ms.toFixed(0) + "ms" : "\u2014") +
    stat("last ok", fmtTs(b.last_ok)) +
    stat("status", b.status) +
    "</div>" +
    (b.last_error ? '<div class="err">last error: ' + esc(b.last_error) + "</div>" : "") +
    (models ? '<div class="models">models: ' + models + "</div>" : "") +
    "</div>";
}

function render(m) {
  state.last = m;
  var T = m.totals;
  $("totals").innerHTML =
    stat("requests", T.requests) +
    stat("ok", T.ok) +
    stat("errors", T.errors, T.errors ? "bad" : "") +
    stat("fallbacks", T.fallbacks) +
    stat("all-failed", T.all_failed, T.all_failed ? "bad" : "") +
    stat("pinned", T.pinned) +
    stat("model-routed", T.model_routed) +
    stat("streamed", T.streamed) +
    stat("req/min", (T.requests_per_min || 0).toFixed(1)) +
    stat("uptime", fmtDur(m.uptime_seconds));
  var byName = {};
  (m.backends || []).forEach(function (b) { byName[b.name] = b; });
  var a = byName["nvidia"] || (m.backends || [])[0];
  var b = byName["intel-arc"] || (m.backends || [])[1];
  setBar("node-a-bar", "node-a-pct", "node-a-dot", a);
  setBar("node-b-bar", "node-b-pct", "node-b-dot", b);
  $("split-note").textContent =
    "Live share of " + T.requests + " routed requests (strategy: " + m.strategy +
    "). Bars turn red when a backend is down.";
  $("backends").innerHTML =
    (m.backends || []).map(backendCard).join("") || '<div class="be">no backends</div>';
  var rows = Object.keys(T.by_endpoint || {}).map(function (k) {
    return "<tr><td>" + esc(k) + '</td><td class="num">' + T.by_endpoint[k] + "</td></tr>";
  }).join("");
  $("endpoints").tBodies[0].innerHTML = rows || '<tr><td colspan="2">\u2014</td></tr>';
  $("meta").textContent =
    "Hermes v" + m.version + " \u00b7 strategy " + m.strategy +
    " \u00b7 generated " + new Date((m.generated_at || 0) * 1000).toLocaleTimeString() +
    " \u00b7 polling every " + $("interval").value + "s";
}

function renderOffline(err) {
  state.offline = true;
  setPill("OFFLINE", "bad");
  $("split-note").textContent =
    "Cannot reach Hermes at " + baseUrl() + " (" + esc((err && err.message) || err) +
    ") \u2014 showing last known data. Check the container / hermes.service.";
  if (state.last) render(state.last);  // keep last known values; pill stays OFFLINE
}
function poll() {
  var t0 = performance.now();
  fetch(baseUrl() + "/metrics", { cache: "no-store" })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (m) {
      state.offline = false;
      render(m);
      setPill("LIVE \u00b7 " + Math.round(performance.now() - t0) + "ms", "ok");
    })
    .catch(function (e) { renderOffline(e); })
    .then(function () {
      clearTimeout(state.timer);
      var iv = Math.min(60, Math.max(1, parseInt($("interval").value, 10) || 3));
      state.timer = setTimeout(poll, iv * 1000);
    });
}

$("refresh").addEventListener("click", function () { poll(); });
$("endpoint").addEventListener("change", function () { savePrefs(); poll(); });
$("interval").addEventListener("change", function () { savePrefs(); poll(); });

loadPrefs();
poll();
</script>
</body>
</html>
HERMES_HTML_EOF


echo "==> [4/6] Setting ownership and permissions"
chown -R hermes:hermes "$APP_DIR"
chmod 750 "$APP_DIR"
chmod 640 "$APP_DIR/hermes.py" "$APP_DIR/config.yaml" "$APP_DIR/.env" "$APP_DIR/monitor.html"

echo "==> [5/6] Installing systemd unit"
cp "$APP_DIR/hermes.service" /etc/systemd/system/"$SVC_NAME"
systemctl daemon-reload
systemctl enable "$SVC_NAME"
systemctl restart "$SVC_NAME"
sleep 2
systemctl --no-pager --full status "$SVC_NAME" || true

echo "==> [6/6] Smoke tests"
PORT=$(grep -E '^HERMES_PORT=' "$APP_DIR/.env" | head -1 | cut -d= -f2 | tr -d '\r')
PORT=${PORT:-3000}
echo "--- GET /health (Hermes-native) ---"
curl -sS --max-time 10 "http://127.0.0.1:${PORT}/health" || echo "(health check failed)"
echo
echo "--- GET / (service index) ---"
curl -sS --max-time 10 "http://127.0.0.1:${PORT}/" || echo "(index check failed)"
echo
echo "--- GET /metrics (telemetry) ---"
curl -sS --max-time 10 "http://127.0.0.1:${PORT}/metrics" || echo "(metrics check failed)"
echo
echo "--- GET /monitor (dashboard, first 3 lines) ---"
curl -sS --max-time 10 "http://127.0.0.1:${PORT}/monitor" | head -3 || echo "(monitor check failed)"
echo
echo
echo "==============================================================="
echo " Hermes installed and running."
echo "   service : systemctl status $SVC_NAME"
echo "   logs    : journalctl -u $SVC_NAME -f"
echo "   health  : curl http://127.0.0.1:${PORT}/health"
echo
echo " Routed request (goes to nvidia / intel-arc automatically):"
echo "   curl -s http://127.0.0.1:${PORT}/v1/chat/completions \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"model\":\"llama-3\",\"max_tokens\":8,\"messages\":[{\"role\":\"user\",\"content\":\"ping\"}]}'"
echo
echo " Force a specific backend:"
echo "   ... -H 'X-Hermes-Backend: nvidia'   (or: intel-arc)"
echo
echo " Telemetry + dashboard:"
echo "   curl -s http://127.0.0.1:${PORT}/metrics"
echo "   open http://192.168.1.120:${PORT}/monitor   (live traffic split + health)"
echo "==============================================================="
