import re, glob
all_paths = set()
for f in glob.glob(r'C:\Dev\AI-GAMES\tools\omada_*.js'):
    s = open(f, encoding='utf-8', errors='replace').read()
    for m in re.findall(r'["\'](/openapi/[^"\']+)["\']', s):
        all_paths.add(m)
    # also catch url:"/openapi/..." and url:'/openapi/...' and concatenations
    for m in re.findall(r'url\s*:\s*["\']([^"\']*openapi[^"\']*)["\']', s):
        all_paths.add(m)
for x in sorted(all_paths):
    print(x)
print("---TOTAL:", len(all_paths))
