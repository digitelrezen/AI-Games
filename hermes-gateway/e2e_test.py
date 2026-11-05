"""End-to-end test: real Hermes server against two mock OpenAI backends."""
import json
import os
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import hermes

results = []


def check(label, cond, detail=""):
    results.append((label, bool(cond)))
    suffix = ("  | " + str(detail)) if (detail and not cond) else ""
    print(("PASS" if cond else "FAIL"), "-", label, suffix)


def make_mock(name, port, fail=False):
    class H(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def log_message(self, *a):
            pass

        def _json(self, code, obj):
            body = json.dumps(obj).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            p = self.path.split("?")[0]
            if p == "/v1/models":
                self._json(200, {"object": "list", "data": [
                    {"id": name + "-a", "object": "model", "owned_by": name},
                    {"id": name + "-b", "object": "model", "owned_by": name},
                ]})
            elif p == "/api/ps":
                # Ollama VRAM endpoint: model weights resident in VRAM
                self._json(200, {"models": [
                    {"name": name + "-a", "model": name + "-a",
                     "size_vram": 1 << 30},
                ]})
            elif p in ("/health", "/healthz"):
                self._json(200, {"status": "ok", "name": name})
            else:
                self._json(404, {"error": "nf"})

        def do_POST(self):
            p = self.path.split("?")[0]
            if p == "/v1/chat/completions":
                n = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(n) or b"{}")
                if fail:
                    self._json(500, {"error": {"message": "forced failure " + name}})
                    return
                if body.get("stream"):
                    self.send_response(200)
                    self.send_header("Content-Type", "text/event-stream")
                    self.send_header("Connection", "close")
                    self.end_headers()
                    for i in range(3):
                        ch = {"id": "c-" + name, "object": "chat.completion.chunk",
                              "choices": [{"index": 0,
                                           "delta": {"content": name + " t%d " % i},
                                           "finish_reason": None}]}
                        self.wfile.write(("data: " + json.dumps(ch) + "\n\n").encode())
                        self.wfile.flush()
                        time.sleep(0.01)
                    end = {"id": "c-" + name, "object": "chat.completion.chunk",
                           "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}]}
                    self.wfile.write(("data: " + json.dumps(end) + "\n\n").encode())
                    self.wfile.write(b"data: [DONE]\n\n")
                    self.wfile.flush()
                else:
                    self._json(200, {"id": "c-" + name, "object": "chat.completion",
                                     "choices": [{"index": 0,
                                                  "message": {"role": "assistant",
                                                              "content": "hello from " + name},
                                                  "finish_reason": "stop"}]})
            else:
                self._json(404, {"error": "nf"})

    srv = ThreadingHTTPServer(("127.0.0.1", port), H)
    srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


# --- start two mock backends --------------------------------------------- #
mock_a = make_mock("nvidia", 18081, fail=False)
mock_b = make_mock("intel-arc", 18082, fail=False)

# --- configure Hermes via environment ------------------------------------ #
os.environ["HERMES_BACKENDS"] = "nvidia=http://127.0.0.1:18081:3,intel-arc=http://127.0.0.1:18082:2"
os.environ["HERMES_PORT"] = "13000"
os.environ["HERMES_HEALTH_INTERVAL"] = "0.2"
os.environ["HERMES_HEALTH_TIMEOUT"] = "2"
os.environ["HERMES_HEALTH_ENABLED"] = "true"
os.environ["HERMES_FALLBACK"] = "true"
os.environ["HERMES_MAX_RETRIES"] = "2"

cfg = hermes.load_config()
router = hermes.Router(cfg)
server = hermes.HermesServer(("127.0.0.1", cfg["port"]), hermes.HermesHandler)
server.cfg = cfg
server.router = router
server.health = hermes.HealthChecker(router, cfg)
threading.Thread(target=server.serve_forever, daemon=True).start()
server.health.start()
time.sleep(0.8)

# Exercise the Ollama VRAM-lifecycle path: tag both mocks as "ollama" so the
# health checker polls their (mock) /api/ps endpoints.
for _b in server.router.backends:
    _b.tags.append("ollama")

BASE = "http://127.0.0.1:13000"


def get(path, headers=None):
    req = urllib.request.Request(BASE + path, headers=headers or {})
    with urllib.request.urlopen(req, timeout=10) as r:
        return r.status, dict(r.headers), r.read()


def post(path, obj, headers=None):
    data = json.dumps(obj).encode()
    h = {"Content-Type": "application/json"}
    if headers:
        h.update(headers)
    req = urllib.request.Request(BASE + path, data=data, headers=h, method="POST")
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.status, dict(r.headers), r.read()


# 1) /health (Hermes-native) --------------------------------------------- #
st, hd, body = get("/health")
j = json.loads(body)
check("health: HTTP 200", st == 200, st)
check("health: two backends up", j.get("backends_up") == 2, j)

# 2) service index -------------------------------------------------------- #
st, hd, body = get("/")
j = json.loads(body)
check("index: service=hermes", j.get("service") == "hermes", j)
check("index: lists two backends", len(j.get("backends", [])) == 2, j)

# 3) /v1/models aggregated across backends -------------------------------- #
st, hd, body = get("/v1/models")
j = json.loads(body)
ids = [m["id"] for m in j.get("data", [])]
check("models: 200", st == 200, st)
check("models: aggregated 4 ids", len(ids) == 4, ids)
check("models: both backends present",
      any(i.startswith("nvidia-") for i in ids) and any(i.startswith("intel-arc-") for i in ids), ids)

# 4) non-streaming chat completion (load balanced) ------------------------ #
# Use a model that NO backend uniquely serves, so model-aware routing does
# not pin the request -> pure weighted load balancing is exercised.
seen = set()
st, hd, body = (0, {}, b"")
for _ in range(20):
    st, hd, body = post("/v1/chat/completions",
                        {"model": "shared-model", "max_tokens": 5,
                         "messages": [{"role": "user", "content": "hi"}]})
    seen.add(hd.get("X-Hermes-Backend"))
j = json.loads(body)
check("chat: HTTP 200", st == 200, st)
check("chat: routed only to configured backends", seen <= {"nvidia", "intel-arc"}, seen)
check("chat: load balanced across both", len(seen) >= 2, seen)
check("chat: response has content", "hello from" in j["choices"][0]["message"]["content"], j)

# 4b) model-aware conditional routing (pin to the backend that has the model) #
st, hd, body = post("/v1/chat/completions",
                    {"model": "nvidia-a", "max_tokens": 5,
                     "messages": [{"role": "user", "content": "hi"}]})
check("model-route: 'nvidia-a' -> nvidia", hd.get("X-Hermes-Backend") == "nvidia", hd.get("X-Hermes-Backend"))
st, hd, body = post("/v1/chat/completions",
                    {"model": "intel-arc-a", "max_tokens": 5,
                     "messages": [{"role": "user", "content": "hi"}]})
check("model-route: 'intel-arc-a' -> intel-arc", hd.get("X-Hermes-Backend") == "intel-arc", hd.get("X-Hermes-Backend"))

# 5) streaming chat completion (SSE relay) -------------------------------- #
st, hd, body = post("/v1/chat/completions",
                    {"model": "nvidia-a", "max_tokens": 5, "stream": True,
                     "messages": [{"role": "user", "content": "hi"}]})
txt = body.decode()
check("stream: HTTP 200", st == 200, st)
check("stream: content-type SSE", "text/event-stream" in (hd.get("Content-Type") or ""), hd.get("Content-Type"))
check("stream: has data lines", "data: " in txt, txt[:160])
check("stream: terminates with [DONE]", "[DONE]" in txt)
check("stream: carries backend tokens", ("nvidia t0" in txt) or ("intel-arc t0" in txt), txt[:160])

# 6) pin a backend with X-Hermes-Backend ---------------------------------- #
st, hd, body = post("/v1/chat/completions",
                    {"model": "nvidia-a", "max_tokens": 5,
                     "messages": [{"role": "user", "content": "hi"}]},
                    headers={"X-Hermes-Backend": "nvidia"})
check("pin: forced to nvidia", hd.get("X-Hermes-Backend") == "nvidia", hd.get("X-Hermes-Backend"))

# 7) live fallback: take backend A down, requests must land on B ---------- #
mock_a.shutdown()
time.sleep(1.2)  # allow health checks to mark A down (2 fails @ 0.2s)
# 7a) unpinned request -> healthy backend chosen automatically
st, hd, body = post("/v1/chat/completions",
                    {"model": "shared-model", "max_tokens": 5,
                     "messages": [{"role": "user", "content": "hi"}]})
check("fallback: HTTP 200 after A down", st == 200, st)
check("fallback: routed to intel-arc", hd.get("X-Hermes-Backend") == "intel-arc", hd.get("X-Hermes-Backend"))
# 7b) pinned to the dead backend -> hermes must still fall back
st, hd, body = post("/v1/chat/completions",
                    {"model": "shared-model", "max_tokens": 5,
                     "messages": [{"role": "user", "content": "hi"}]},
                    headers={"X-Hermes-Backend": "nvidia"})
check("fallback: pinned-to-dead still 200", st == 200, st)
check("fallback: pinned-to-dead landed on intel-arc", hd.get("X-Hermes-Backend") == "intel-arc", hd.get("X-Hermes-Backend"))

# 8) /health now reports A down ------------------------------------------- #
st, hd, body = get("/health")
j = json.loads(body)
a = next((b for b in j["backends"] if b["name"] == "nvidia"), None)
check("health: nvidia reported down", bool(a) and a["healthy"] is False, a)
check("health: one backend up", j.get("backends_up") == 1, j)

# 9) /metrics telemetry ----------------------------------------------------- #
st, hd, body = get("/metrics")
j = json.loads(body)
check("metrics: HTTP 200", st == 200, st)
check("metrics: CORS enabled", hd.get("Access-Control-Allow-Origin") == "*", hd)
check("metrics: totals + 2 backends",
      "totals" in j and len(j["backends"]) == 2, list(j)[:10])
check("metrics: traffic recorded (>=25)", j["totals"]["requests"] >= 25, j["totals"]["requests"])
nv = next((b for b in j["backends"] if b["name"] == "nvidia"), None)
ia = next((b for b in j["backends"] if b["name"] == "intel-arc"), None)
check("metrics: nvidia has traffic", bool(nv) and nv["requests"] > 0, nv)
check("metrics: intel-arc has traffic", bool(ia) and ia["requests"] > 0, ia)
check("metrics: nvidia down after fallback",
      bool(nv) and nv["healthy"] is False and nv["status"] == "down", nv)
check("metrics: intel-arc up",
      bool(ia) and ia["healthy"] is True and ia["status"] == "up", ia)
check("metrics: nvidia errors counted", bool(nv) and nv["errors"] >= 1, nv)
check("metrics: fallbacks counted", j["totals"]["fallbacks"] >= 1, j["totals"])
check("metrics: intel-arc avg latency",
      bool(ia) and ia.get("avg_latency_ms") is not None, ia)
st2, hd2, body2 = get("/proxy-stats")
check("metrics: /proxy-stats alias",
      st2 == 200 and json.loads(body2).get("service") == "hermes", st2)
st3, hd3, body3 = get("/monitor")
check("monitor: dashboard HTML served",
      st3 == 200 and "text/html" in (hd3.get("Content-Type") or "")
      and b"node-a-bar" in body3 and b"node-b-bar" in body3, st3)

# 10) VRAM lifecycle: /api/ps polling + model-switch tracking + admin ------- #
time.sleep(0.8)  # let the health checker's /api/ps poll run at least once
st, hd, body = get("/admin/vram")
j = json.loads(body)
check("vram: /admin/vram HTTP 200 + service",
      st == 200 and j.get("service") == "hermes", (st, body[:120]))
check("vram: per-backend entries for both mocks",
      set(j.get("vram", {}).keys()) == {"nvidia", "intel-arc"},
      list(j.get("vram", {})))
check("vram: resident model tracked (nvidia-a)",
      any("nvidia-a" in m for m in j["vram"]["nvidia"]["loaded_models"]),
      j["vram"]["nvidia"])
check("vram: vram_bytes recorded",
      j["vram"]["nvidia"]["vram_bytes"] > 0, j["vram"]["nvidia"])

st, hd, body = post("/admin/flush", {})
j = json.loads(body)
check("vram: /admin/flush HTTP 200, no-op without hook",
      st == 200 and j.get("executed") is False
      and j.get("flush_command_configured") is False, (st, body[:160]))

# Model-switch tracking on the router (pin to the live backend; nvidia mock
# was shut down in section 7, so a pin to it would exercise fallback).
st, hd, body = post("/v1/chat/completions",
                    {"model": "shared-model", "max_tokens": 5,
                     "messages": [{"role": "user", "content": "hi"}]},
                    headers={"X-Hermes-Backend": "intel-arc"})
check("switch: pinned request to intel-arc",
      hd.get("X-Hermes-Backend") == "intel-arc", hd.get("X-Hermes-Backend"))
with server.router.lock:
    ia_backend = next(b for b in server.router.backends if b.name == "intel-arc")
    last_model = ia_backend.last_model
check("switch: last_model recorded", last_model == "shared-model", last_model)
st, hd, body = get("/metrics")
j = json.loads(body)
check("switch: metrics report model_switches",
      j["totals"].get("model_switches", 0) >= 1,
      j["totals"].get("model_switches"))
check("switch: metrics expose vram fields",
      all("vram_bytes" in b for b in j["backends"]),
      j["backends"][0].keys())

passed = sum(1 for _, c in results if c)
print()
print("E2E RESULT: %d/%d passed" % (passed, len(results)))
server.server_close()
raise SystemExit(0 if passed == len(results) else 1)