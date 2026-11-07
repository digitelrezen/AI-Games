import ssl, json, base64, urllib.request, urllib.error, sys

CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE

def req(method, url, headers=None, data=None, timeout=8):
    h = dict(headers or {})
    body = None
    if data is not None:
        body = data if isinstance(data, bytes) else json.dumps(data).encode()
        h.setdefault("Content-Type", "application/json")
    r = urllib.request.Request(url, data=body, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=timeout, context=CTX) as resp:
            txt = resp.read().decode("utf-8", "replace")
            return resp.status, dict(resp.headers), txt
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read().decode("utf-8", "replace")
    except Exception as e:
        return -1, {}, repr(e)

print("========== TRUENAS (192.168.1.3:443) ==========")
for user, pw in [("admin", "lsd~117ab"), ("truenas", "lsd~117ab"), ("root", "lsd~117ab")]:
    tok = base64.b64encode(f"{user}:{pw}".encode()).decode()
    s, hd, t = req("GET", "https://192.168.1.3/api/v2.0/system/version",
                    headers={"Authorization": f"Basic {tok}"})
    print(f"basic {user:10} -> {s}  {t[:120]}")

print("\n========== OMADA (192.168.1.99:8043) ==========")
HASH = "0e760eace860f37121ee773f921eca30"
candidates = [
    "https://192.168.1.99:8043/api/v1/login",
    f"https://192.168.1.99:8043/{HASH}/api/v1/login",
    "https://192.168.1.99:8043/api/login",
    "https://192.168.1.99:8043/api/v1/user/login",
    "https://192.168.1.99:8043/omada/api/v1/login",
    "https://192.168.1.99:8043/api/v1/sdn/login",
]
for u in candidates:
    s, hd, t = req("POST", u, data={"username": "admin", "password": "lsd~117ab"})
    print(f"POST {u.split(':8043')[1]:40} -> {s}  {t[:100]}")

print("\n========== HOME ASSISTANT (192.168.1.4:8123) ==========")
s, hd, t = req("GET", "http://192.168.1.4:8123/api/")
print(f"GET /api/ (no auth) -> {s}  {t[:120]}")
