# Hermes — Multi-Backend OpenAI-Compatible AI Routing Gateway

A lightweight, **dependency-free** (Python 3 standard library only) routing
proxy that sits in front of two local inference nodes and exposes a single
OpenAI-compatible API on **port 3000**. No `pip`, no `git clone`, no network
needed at install time.

| Role | Backend name | URL | Known model (verified 2026-11-04) |
|------|--------------|-----|-----------------------------------|
| NVIDIA (Ollama) | `nvidia` | `http://192.168.1.16:11434` | `qwen2.5:14b`, `qwen2.5:7b` |
| Intel Arc Pro B70 (llama.cpp) | `intel-arc` | `http://192.168.1.121:8080` | `/home/digitel/models/Qwen3.8-27B-Q4_K_M.gguf` |

## Features
- **Weighted round-robin** load balancing (default `nvidia:3`, `intel-arc:2`)
- **Health checks** (liveness) with flapping protection
- **Automatic fallback** to the next healthy backend on 5xx / connection failure
- **Model-aware conditional routing** — if a model is served by exactly one
  healthy backend, requests for that model are routed there
- **SSE streaming** relay for `stream: true`
- **Pin a backend** with the `X-Hermes-Backend: <name>` request header
- Aggregated `GET /v1/models` and a native `GET /health` endpoint
- **JSON telemetry**: `GET /metrics` (alias `GET /proxy-stats`) — totals,
  per-backend request/ok/error/fallback counts, share, latency, health,
  models, and per-endpoint counts
- **Live dashboard**: `GET /monitor` (alias `GET /dashboard`) — a
  zero-dependency HTML page that polls `/metrics` and renders the live
  traffic split + backend health (no simulated data)
- CORS headers on the JSON endpoints (cross-origin dashboard/API use)
- **Reasoning-model defaults (v1.2)** — when a request for a reasoning model
  (Qwen3, DeepSeek-R1, QwQ, …; patterns configurable) omits `max_tokens`,
  Hermes injects a default (`max_tokens_reasoning`, floor 512) so the model's
  internal "thinking" trace is not truncated. Explicit client `max_tokens` /
  `max_completion_tokens` always win, untouched
- **VRAM lifecycle (v1.2)** — Ollama-tagged backends are polled at
  `/api/ps` alongside the health checks to track which model weights are
  resident in VRAM (`/admin/vram`, `/metrics`); model switches are tracked
  and logged; an optional `vram_flush_cmd` hard-flush hook runs on switch
  (and via `POST /admin/flush`) — Ollama 0.40.x has no REST unload
  endpoint, so idle weights are released by the server-side
  `OLLAMA_KEEP_ALIVE` (set on the backend host)

## Files
- `hermes.py` — the router (single file, stdlib only)
- `config.yaml` — human-editable configuration (source of truth)
- `.env` — runtime env overrides (loaded by the systemd unit)
- `hermes.service` — systemd unit (boot startup + auto-restart)
- `monitor.html` — live dashboard (served at `/monitor`, embedded in bootstrap)
- `bootstrap.sh` — one-shot, **self-contained** installer (embeds all of the
  above; generated LF-only so it runs on stock bash)

## Deployment (Proxmox LXC `hermes`, ID 120, IP `192.168.1.120`)
**Status: installed and running** (verified 2026-11-04).

The LXC (Debian 12, bridge `vmbr0`, IP `192.168.1.120/24`) runs
`hermes.service` from `/opt/hermes` — enabled at boot, auto-restarting.

To (re)install from scratch, copy `bootstrap.sh` into the container —
`scp bootstrap.sh root@192.168.1.120:/tmp/` (OpenSSH password auth) or via
Proxmox web UI → `hermes` → **Send File to Guest** — then in the console:
```bash
bash /tmp/bootstrap.sh
```
The script installs to `/opt/hermes`, creates the unprivileged `hermes`
user, installs + enables + starts the systemd service, and smoke-tests
`/health`, `/`, `/metrics`, `/monitor`.

> The minimal Debian template ships without `curl` — run
> `apt-get update && apt-get install -y curl` in the container if the
> smoke tests (or your own checks) need it.
>
> If you enable SSH exec on the Proxmox MCP integration
> (`PROXMOX_SSH_ENABLED=true` + key + node), the operator can run all of
> this end-to-end automatically.

## Verification (curl)

```bash
# 1) Hermes health (native) — both backends, live status + latency
curl -s http://192.168.1.120:3000/health | python3 -m json.tool

# 2) Aggregated model list (union of both backends)
curl -s http://192.168.1.120:3000/v1/models | python3 -m json.tool

# 3) Auto-routed chat — qwen2.5:14b is unique to nvidia, so model-aware
#    routing sends it there (verified: X-Hermes-Backend: nvidia)
curl -s http://192.168.1.120:3000/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"qwen2.5:14b","max_tokens":32,"messages":[{"role":"user","content":"Say hi"}]}'

# 4) Pin a backend explicitly (nvidia | intel-arc) — the response carries
#    an X-Hermes-Backend: <name> header naming the node that served it
curl -si http://192.168.1.120:3000/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -H 'X-Hermes-Backend: intel-arc' \
  -d '{"model":"/home/digitel/models/Qwen3.8-27B-Q4_K_M.gguf","max_tokens":32,"messages":[{"role":"user","content":"Say hi"}]}'

# 5) Streaming (SSE)
curl -sN http://192.168.1.120:3000/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"qwen2.5:14b","max_tokens":32,"stream":true,"messages":[{"role":"user","content":"Say hi"}]}'

# 6) Telemetry + live dashboard
curl -s http://192.168.1.120:3000/metrics | python3 -m json.tool   # alias: /proxy-stats
# open http://192.168.1.120:3000/monitor in a browser (live traffic split)

# 7) VRAM lifecycle (v1.2) — resident Ollama models + VRAM usage
curl -s http://192.168.1.120:3000/admin/vram | python3 -m json.tool

# 8) Trigger the configured hard-flush hook (no-op if vram_flush_cmd is empty)
curl -s -X POST http://192.168.1.120:3000/admin/flush | python3 -m json.tool

# 9) Reasoning-model default: no max_tokens in the request body -> Hermes
#    injects max_tokens_reasoning (>=512) for qwen3/r1/qwq/... models
curl -s http://192.168.1.120:3000/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"qwen3:8b","messages":[{"role":"user","content":"Say hi"}]}'
```

Model names come from `/v1/models` (verified: `qwen2.5:14b` on nvidia,
`/home/digitel/models/Qwen3.8-27B-Q4_K_M.gguf` on intel-arc). Every proxied
response carries an **`X-Hermes-Backend`** response header naming the node
that served it — that's your routing proof.

## Operations
```bash
systemctl status hermes      # service status
journalctl -u hermes -f      # live logs
systemctl restart hermes     # restart
# After editing /opt/hermes/config.yaml (or .env):
systemctl restart hermes
```

## Routing strategies (`routing.strategy` in `config.yaml`)
- `weighted` — weighted round-robin (default)
- `round-robin` — plain round-robin
- `health` — least in-flight requests, then lowest observed latency

## Notes / design
- **Liveness** = "the backend answered HTTP at all" (any status), so a 404 on
  the probe path still counts as *up*. Real 5xx / connection errors during a
  proxied request trigger **fallback** to the next healthy backend.
- **Model-aware routing** only pins when a model is unique to one healthy
  backend; otherwise the configured strategy applies.
- **Reasoning defaults never override the client**: only *missing*
  `max_tokens` on reasoning-model requests is filled in; the injected value is
  floored at 512 and configurable (`defaults.max_tokens_reasoning` /
  `HERMES_MAX_TOKENS_REASONING`).
- **VRAM flush strategy**: Ollama (0.40.x) exposes no unload API — verified
  live (`/api/unload` → 404). Idle weights are released by the server-side
  `OLLAMA_KEEP_ALIVE` (set in the backend's docker-compose, e.g. `20m`); the
  gateway additionally tracks model switches (log + `model_switches` counter
  in `/metrics`) and can run an optional hard-flush hook
  (`vram.flush_command` / `HERMES_VRAM_FLUSH_CMD`) on switch or on demand
  (`POST /admin/flush`).
- The gateway strips hop-by-hop headers and rewrites `Host` per backend.