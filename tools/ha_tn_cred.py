import json, urllib.request, urllib.error, http.cookiejar, ssl, base64

print("========== HOME ASSISTANT (192.168.1.4:8123) ==========")
BASE = "http://192.168.1.4:8123"
try:
    jar = http.cookiejar.CookieJar()
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    d = json.loads(op.open(BASE + "/auth/?redirect_uri=/", timeout=8).read())
    print("auth start:", {k: d.get(k) for k in ("handler", "step", "is_allowed")})
    body = {"type": "step/form", "handler": d["handler"], "data": {"username": "local-ai", "password": "lsd~117ab"}}
    req = urllib.request.Request(BASE + "/auth/", data=json.dumps(body).encode(), headers={"Content-Type": "application/json"}, method="POST")
    rd = json.loads(op.open(req, timeout=8).read())
    tok = rd.get("access_token", "")
    print("login step:", rd.get("step"), "error:", rd.get("error"), "access_token:", tok[:40] + ("..." if len(tok) > 40 else ""))
    if tok:
        r2 = urllib.request.urlopen(urllib.request.Request(BASE + "/api/states", headers={"Authorization": f"Bearer {tok}"}), timeout=8)
        states = json.loads(r2.read())
        print("/api/states with Bearer token:", len(states), "entities; sample:", states[0]["entity_id"] if states else None)
        r3 = urllib.request.urlopen(urllib.request.Request(BASE + "/api/config", headers={"Authorization": f"Bearer {tok}"}), timeout=8)
        cfg = json.loads(r3.read())
        print("/api/config:", "version=" + str(cfg.get("version")), "location=" + str(cfg.get("location_name")))
except Exception as e:
    print("HA error:", repr(e))

print("\n========== TRUENAS (192.168.1.3:443) ==========")
ctx = ssl._create_unverified_context()
def tn(method, path, tok, data=None):
    h = {"Authorization": f"Basic {tok}", "Content-Type": "application/json"}
    b = json.dumps(data).encode() if data is not None else None
    r = urllib.request.Request("https://192.168.1.3" + path, data=b, headers=h, method=method)
    try:
        rr = urllib.request.urlopen(r, context=ctx, timeout=8)
        return rr.status, rr.read().decode()[:120]
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:120]
    except Exception as e:
        return -1, repr(e)
for user in ["admin", "truenas", "root"]:
    tok = base64.b64encode(f"{user}:lsd~117ab".encode()).decode()
    s, t = tn("GET", "/api/v2.0/system/version", tok)
    print(f"basic {user:10} /api/v2.0/system/version -> {s}  {t}")
