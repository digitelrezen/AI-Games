import re
for f, pats in [(r'C:\Dev\AI-GAMES\tools\omada_mgr.js', ['getToken', 'Authorization']),
                (r'C:\Dev\AI-GAMES\tools\omada_app.js', ['setToken', 'getToken'])]:
    s = open(f, encoding='utf-8', errors='replace').read()
    print("####", f.split('\\')[-1])
    for pat in pats:
        for m in list(re.finditer(re.escape(pat), s))[:3]:
            i = m.start()
            print("  ", pat, "::", s[max(0, i - 80): i + 120].replace("\n", " "))
