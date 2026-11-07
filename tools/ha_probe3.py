import json, urllib.request, urllib.error, http.cookiejar

BASE = "http://192.168.1.4:8123"
def raw(method, path, headers=None, data=None):
    b = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(BASE + path, data=b, headers=headers or {}, method=method)
    try:
        r = urllib.request.urlopen(req, timeout=8)
        return r.status, dict(r.headers), r.read().decode("utf-8", "replace")[:200]
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read().decode("utf-8", "replace")[:200]
    except Exception as e:
        return -1, {}, repr(e)

s, hd, t = raw("GET", "/api/")
print("GET /api/ ->", s, {k: v for k, v in hd.items() if k.lower() in ("server", "x-frame-options", "content-type")})

# try auth with Accept json
for p in ["/auth?redirect_uri=/", "/auth"]:
    s, hd, t = raw("GET", p, {"Accept": "application/json"})
    print(f"GET {p} (Accept json) -> {s}  {t[:100]}")

# try POST /auth directly with step/form
jar = http.cookiejar.CookieJar()
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
try:
    req = urllib.request.Request(BASE + "/auth", data=json.dumps({"type": "step/form", "handler": "password", "data": {"username": "local-ai", "password": "lsd~117ab"}}).encode(), headers={"Content-Type": "application/json", "Accept": "application/json"}, method="POST")
    r = op.open(req, timeout=8)
    rd = json.loads(r.read())
    print("POST /auth ->", {k: rd.get(k) for k in ("step", "error", "type")}, "token:", str(rd.get("access_token"))[:30])
    tok = rd.get("access_token")
    if tok:
        s2, _, _ = raw("GET", "/api/states", {"Authorization": f"Bearer {tok}"})
        print("/api/states with token:", s2)
        print("HA_TOKEN=" + tok)
except Exception as e:
    print("POST /auth error:", repr(e))
