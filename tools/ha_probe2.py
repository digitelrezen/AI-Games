import json, urllib.request, urllib.error, http.cookiejar

BASE = "http://192.168.1.4:8123"
def get(path, headers=None):
    try:
        r = urllib.request.urlopen(urllib.request.Request(BASE + path, headers=headers or {}), timeout=8)
        return r.status, r.read().decode("utf-8", "replace")[:150]
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")[:150]
    except Exception as e:
        return -1, repr(e)

print("GET /              ->", get("/"))
print("GET /api/          ->", get("/api/"))
print("GET /api           ->", get("/api"))
print("GET /auth          ->", get("/auth"))
print("GET /auth?redirect_uri=/ ->", get("/auth?redirect_uri=/"))

# try the auth flow with cookie jar, no redirect_uri param first
jar = http.cookiejar.CookieJar()
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
try:
    d = json.loads(op.open(BASE + "/auth", timeout=8).read())
    print("\n/auth ->", d)
    handler = d.get("handler")
    body = {"type": "step/form", "handler": handler, "data": {"username": "local-ai", "password": "lsd~117ab"}}
    req = urllib.request.Request(BASE + "/auth", data=json.dumps(body).encode(), headers={"Content-Type": "application/json"}, method="POST")
    rd = json.loads(op.open(req, timeout=8).read())
    print("login ->", {k: rd.get(k) for k in ("step", "error", "type")}, "access_token:", str(rd.get("access_token"))[:30])
    tok = rd.get("access_token")
    if tok:
        r2 = urllib.request.urlopen(urllib.request.Request(BASE + "/api/states", headers={"Authorization": f"Bearer {tok}"}), timeout=8)
        print("/api/states with token:", len(json.loads(r2.read())))
        print("HA_TOKEN=" + tok)
except Exception as e:
    print("auth flow error:", repr(e))
