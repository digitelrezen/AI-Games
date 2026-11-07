#!/usr/bin/env python3
"""Extract rule-name -> target-folder mapping from the audit JSON (compact)."""
import json
import collections

SRC = r"C:\Dev\AI-GAMES\tools\outlook_reports\rule_audit_20261105_202938.json"

with open(SRC, encoding="utf-8") as f:
    rules = json.load(f)

by_folder = collections.defaultdict(list)
no_folder = []
for r in rules:
    name = r["name"]
    folders = [a["folder"] for a in r.get("actions", []) if a.get("folder")]
    if folders:
        for fo in set(folders):
            by_folder[fo].append(name)
    else:
        no_folder.append(name)

print(f"total rules: {len(rules)}; folders seen: {len(by_folder)}\n")
for fo in sorted(by_folder, key=lambda x: (-len(by_folder[x]), x)):
    print(f"### {fo}  ({len(by_folder[fo])} rules)")
    for n in sorted(set(by_folder[fo])):
        print(f"    {n}")
print(f"\nrules with NO folder action: {len(no_folder)}")
for n in no_folder:
    print(f"    {n}")
