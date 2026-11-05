"""Local verification harness for hermes.py (no network backends required)."""
import json
from collections import Counter

import hermes

ok = True


def check(label, cond, detail=""):
    global ok
    suffix = ("  | " + str(detail)) if (detail and not cond) else ""
    print(("PASS" if cond else "FAIL"), "-", label, suffix)
    if not cond:
        ok = False


# 1) YAML parser against the shipped config.yaml
y = hermes.load_yaml("config.yaml")
print("=== RAW YAML PARSE ===")
print(json.dumps(y, indent=2, default=str))

check("yaml: server.port == 3000", y.get("server", {}).get("port") == 3000)
check("yaml: routing.strategy == weighted",
      y.get("routing", {}).get("strategy") == "weighted")
check("yaml: routing.health.interval_sec == 15",
      y.get("routing", {}).get("health", {}).get("interval_sec") == 15)
check("yaml: routing.fallback.max_retries == 2",
      y.get("routing", {}).get("fallback", {}).get("max_retries") == 2)
blist = y.get("backends", [])
check("yaml: two backends", len(blist) == 2)
check("yaml: backend[0] name nvidia", blist[0].get("name") == "nvidia")
check("yaml: backend[0] url", blist[0].get("url") == "http://192.168.1.16:11434")
check("yaml: backend[0] weight 3", blist[0].get("weight") == 3)
check("yaml: backend[0] tags include ollama",
      blist[0].get("tags") == ["gpu", "cuda", "ollama"])
check("yaml: backend[1] url port 8080",
      blist[1].get("url") == "http://192.168.1.121:8080")
check("yaml: backend[1] tags list", blist[1].get("tags") == ["gpu", "sycl"])
check("yaml: defaults.max_tokens_reasoning == 512",
      y.get("defaults", {}).get("max_tokens_reasoning") == 512)
check("yaml: defaults.reasoning_patterns list",
      isinstance(y.get("defaults", {}).get("reasoning_patterns"), list)
      and "qwen3" in y["defaults"]["reasoning_patterns"])
check("yaml: vram.poll true", y.get("vram", {}).get("poll") is True)
check("yaml: vram.flush_command empty",
      y.get("vram", {}).get("flush_command") == "")

# 2) Full config load
cfg = hermes.load_config()
print("=== FINAL CONFIG ===")
print("host:", cfg["host"], "port:", cfg["port"], "strategy:", cfg["strategy"])
check("config: port int 3000", cfg["port"] == 3000)
check("config: two normalized backends", len(cfg["backends"]) == 2)
check("config: backends have health_path",
      all("health_path" in b for b in cfg["backends"]))
check("config: max_tokens_reasoning floor 512",
      cfg["max_tokens_reasoning"] >= 512)
check("config: reasoning_patterns present",
      "qwen3" in cfg["reasoning_patterns"])
check("config: vram_poll enabled", cfg["vram_poll"] is True)
check("config: vram_flush_cmd empty by default",
      (cfg["vram_flush_cmd"] or "") == "")

# 3) Router: weighted pool + distribution
router = hermes.Router(cfg)
print("=== ROUTER ===")
print("pool:", [b.name for b in router._pool])
check("router: weighted pool size 5 (3+2)", len(router._pool) == 5)
picks = [router.pick().name for _ in range(100)]
c = Counter(picks)
print("100 picks:", dict(c))
check("router: weighted ~60/40 nvidia", c.get("nvidia", 0) > c.get("intel-arc", 0))
check("router: only configured names", set(c.keys()) <= {"nvidia", "intel-arc"})

# 4) Model-aware conditional routing
nv, ia = router.backends[0], router.backends[1]
nv.models = ["llama-3", "qwen-2"]
ia.models = ["mistral-7b"]
check("model: llama-3 -> nvidia", router.pick_for_model("llama-3").name == "nvidia")
check("model: mistral-7b -> intel-arc",
      router.pick_for_model("mistral-7b").name == "intel-arc")
check("model: unknown -> None", router.pick_for_model("gpt-9") is None)

# 5) Fallback ordering
nv.healthy = False
order = [b.name for b in router.order_for(nv)]
print("fallback order (nvidia down):", order)
check("fallback: starts with pinned first", order[0] == "nvidia")
check("fallback: healthy backend comes next", order[1] == "intel-arc")
nv.healthy = True

# 6) Env-var backend override parsing
env_backends = hermes._parse_backends_env(
    "nvidia=http://192.168.1.16:3,intel-arc=http://192.168.1.121:8080:2")
check("env: two backends parsed", len(env_backends) == 2)
check("env: weight parsed", env_backends[0]["weight"] == 3)
check("env: url parsed", env_backends[1]["url"] == "http://192.168.1.121:8080")

# 8) Default max_tokens for reasoning models + VRAM tracking -------------- #
_reason_cfg = dict(cfg)
_reason_cfg["max_tokens_reasoning"] = 512
check("reason: qwen3:7b detected",
      hermes.is_reasoning_model("qwen3:7b", _reason_cfg))
check("reason: deepseek-r1 detected",
      hermes.is_reasoning_model("deepseek-r1:14b", _reason_cfg))
check("reason: qwq detected", hermes.is_reasoning_model("qwq", _reason_cfg))
check("reason: 'llama-3.1' NOT detected (r1 word-boundary)",
      not hermes.is_reasoning_model("llama-3.1:8b", _reason_cfg))
check("reason: 'llama-3' NOT detected",
      not hermes.is_reasoning_model("llama-3", _reason_cfg))

b = json.dumps({"model": "qwen3:7b",
                "messages": [{"role": "user", "content": "hi"}]}).encode()
b2, inj = hermes.apply_default_max_tokens(b, "qwen3:7b", _reason_cfg)
check("reason: max_tokens injected when absent",
      inj and json.loads(b2).get("max_tokens") == 512, b2)

b3 = json.dumps({"model": "qwen3:7b", "max_tokens": 32,
                 "messages": [{"role": "user", "content": "hi"}]}).encode()
b4, inj2 = hermes.apply_default_max_tokens(b3, "qwen3:7b", _reason_cfg)
check("reason: explicit client max_tokens preserved (32 wins)",
      not inj2 and json.loads(b4).get("max_tokens") == 32, b4)

b5, inj3 = hermes.apply_default_max_tokens(b, "llama-3", _reason_cfg)
check("reason: non-reasoning model untouched", not inj3 and b5 == b)

b6 = json.dumps({"model": "qwen3:7b", "max_completion_tokens": 64,
                 "messages": [{"role": "user", "content": "hi"}]}).encode()
b7, inj4 = hermes.apply_default_max_tokens(b6, "qwen3:7b", _reason_cfg)
check("reason: max_completion_tokens preserved, no injection",
      not inj4 and json.loads(b7).get("max_completion_tokens") == 64
      and "max_tokens" not in json.loads(b7), b7)

rt2 = hermes.Router(cfg)
be = rt2.backends[0]
p1, s1 = rt2.track_model(be, "llama-3")
m1 = be.last_model
p2, s2 = rt2.track_model(be, "llama-3")
p3, s3 = rt2.track_model(be, "mistral-7b")
with rt2.lock:
    sw = rt2.model_switches
check("track_model: first call records, no switch",
      p1 is None and not s1 and m1 == "llama-3", (p1, s1, m1))
check("track_model: same model no switch", not s2)
check("track_model: different model counts as switch",
      p3 == "llama-3" and s3 and sw == 1)

# 9) Telemetry / metrics --------------------------------------------------- #
rt = hermes.Router(cfg)
b_nv, b_ia = rt.backends[0], rt.backends[1]
with rt.lock:
    rt.count_request("/v1/chat/completions")
    rt.count_request("/v1/chat/completions")
    rt.streamed += 1
    rt.pinned += 1
    b_nv.req_total += 1
    b_nv.req_ok += 1
    b_nv.lat_ms_sum += 120.0
    b_nv.lat_ms_n += 1
    b_nv.last_ok = 1793832000.0
    b_ia.req_err += 1
    b_ia.fallbacks += 1
    rt.req_err += 1
    rt.fallbacks += 1
m = rt.metrics()
check("metrics: service", m["service"] == "hermes")
check("metrics: version", m["version"] == hermes.__version__)
check("metrics: totals.requests == 2", m["totals"]["requests"] == 2)
check("metrics: totals errors/fallbacks",
      m["totals"]["errors"] == 1 and m["totals"]["fallbacks"] == 1)
check("metrics: pinned + streamed",
      m["totals"]["pinned"] == 1 and m["totals"]["streamed"] == 1)
check("metrics: by_endpoint",
      m["totals"]["by_endpoint"].get("/v1/chat/completions") == 2)
m_nv, m_ia = m["backends"][0], m["backends"][1]
check("metrics: nvidia traffic", m_nv["requests"] == 1 and m_nv["ok"] == 1)
check("metrics: nvidia avg latency",
      abs(m_nv["avg_latency_ms"] - 120.0) < 0.001)
check("metrics: arc errors", m_ia["errors"] == 1 and m_ia["fallbacks"] == 1)
check("metrics: share (1 of 2 total)",
      abs(m_nv["share"] - 0.5) < 0.001 and m_ia["share"] == 0.0)
check("metrics: status up", m_nv["status"] == "up" and m_nv["healthy"] is True)
check("metrics: uptime >= 0", m["uptime_seconds"] >= 0)
check("metrics: strategy", m["strategy"] == cfg["strategy"])

print()
print("RESULT:", "ALL CHECKS PASSED" if ok else "SOME CHECKS FAILED")
raise SystemExit(0 if ok else 1)