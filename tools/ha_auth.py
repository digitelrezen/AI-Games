import json, urllib.request as u, http.cookiejar as cj

BASE = "http://192.168.1.4:8123"

print("== basic probes ==")
for path in ["/api/", "/auth/", "/auth/?redirect_uri=/"]:
    try:
        with u.urlopen(BASE + path, timeout=8) as r:
            print("GET", path, r.status, r.read()[:160])
    except Exception as e:
        print("GET", path, "ERR", e)

print("== auth flow (password login) ==")
jar = cj.CookieJar()
op = u.build_opener(u.HTTPCookieProcessor(jar))
try:
    with op.open(BASE + "/auth/?redirect_uri=/", timeout=8) as r:
        d = json.loads(r.read())
        print("auth start:", {k: d.get(k) for k in ("handler", "step", "is_allowed")})
    body = {"type": "step/form", "handler": d["handler"],
            "data": {"username": "local-ai", "password": "lsd~117ab"}}
    req = u.Request(BASE + "/auth/", data=json.dumps(body).encode(),
                    headers={"Content-Type": "application/json"}, method="POST")
    with op.open(req, timeout=8) as r:
        rd = json.loads(r.read())
        print("login result:", rd.get("step"), "err:", rd.get("error"), "keys:", list(rd.keys()))
        print("cookies:", [c.name for c in jar])
    with op.open(BASE + "/api/", timeout=8) as r:
        print("/api/ with session:", r.status, r.read()[:80])
    with op.open(BASE + "/api/states", timeout=8) as r:
        states = json.loads(r.read())
        print("/api/states:", r.status, "count:", len(states), "sample:", states[0]["entity_id"] if states else None)
except Exception as e:
    print("auth flow error:", repr(e))
