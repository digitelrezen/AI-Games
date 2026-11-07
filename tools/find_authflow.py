import re
s = open(r'C:\Dev\AI-GAMES\tools\omada_app.js', encoding='utf-8', errors='replace').read()
# Find the region around the openapi authorize flow and print a big window
idx = s.find('openapi/authorize/login')
if idx > 0:
    print(s[max(0, idx - 900): idx + 1600])
else:
    print("not found in app js")
print("\n\n===== form/mgr search =====")
for f in [r'C:\Dev\AI-GAMES\tools\omada_form.js', r'C:\Dev\AI-GAMES\tools\omada_mgr.js']:
    t = open(f, encoding='utf-8', errors='replace').read()
    i = t.find('openapi/authorize')
    if i > 0:
        print("###", f.split('\\')[-1])
        print(t[max(0, i - 500): i + 1200])
