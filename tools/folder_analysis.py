#!/usr/bin/env python3
"""Group the 183 real rules by target folder, extract sender domains,
and flag wildcard-safety (especially gmail.com). Uses the GUI-walk
description data as the source of truth for senders."""
import json
import re
from collections import defaultdict

with open(r"C:\Dev\AI-GAMES\tools\rules_snapshot.json", encoding="utf-8") as f:
    snap = json.load(f)
with open(r"C:\Dev\AI-GAMES\tools\rules_descriptions.json", encoding="utf-8") as f:
    walk = json.load(f)

records = walk["records"][:183]


def senders_of(desc):
    out = []
    for line in desc:
        l = line.strip()
        if l.lower().startswith("from "):
            for part in l[len("from "):].split(" or "):
                p = part.strip().strip('"').strip()
                if p:
                    out.append(p)
    return out


def domain_of(s):
    s = s.strip()
    if "@" in s:
        return s.rsplit("@", 1)[1].strip().lower() or None
    return None


# folder -> list of (name, senders, domains)
by_folder = defaultdict(list)
domain_senders = defaultdict(set)      # domain -> set of distinct sender addrs
domain_folders = defaultdict(set)      # domain -> set of folders
total = 0
no_sender = 0
for i, rec in enumerate(records):
    rule = snap["rules"][i]
    name = rule["name"]
    folder = (rule.get("move_to") or "<none>")
    sends = senders_of(rec["desc"])
    doms = set()
    for s in sends:
        d = domain_of(s)
        if d:
            doms.add(d)
            domain_senders[d].add(s.lower())
            domain_folders[d].add(folder)
        else:
            # display name only; bucket by folder for visibility
            doms.add("<name:%s>" % s[:24])
    if not sends:
        no_sender += 1
    total += 1
    by_folder[folder].append({"name": name, "senders": sends, "domains": sorted(doms)})

print(f"total rules: {total}   rules with no readable sender: {no_sender}")
print(f"distinct target folders: {len(by_folder)}")
print(f"distinct email domains: {len([d for d in domain_senders if not d.startswith('<')])}")
print()
print("=== RULES PER TARGET FOLDER (folder: rule count) ===")
for folder in sorted(by_folder, key=lambda k: -len(by_folder[k])):
    print(f"  {len(by_folder[folder]):>3}  {folder}")
print()
print("=== DOMAINS AND WILDCARD-SAFETY ===")
print(f"{'domain':28} {'#send':>5}  {'#folders':>8}  folders")
for d in sorted(domain_senders, key=lambda k: -len(domain_senders[k])):
    if d.startswith("<"):
        continue
    nf = len(domain_folders[d])
    flag = ""
    if d == "gmail.com":
        flag = "  <== GMAIL: DO NOT WILDCARD (legit friends)"
    elif nf > 1:
        flag = "  <== fans out to multiple folders (ambiguous)"
    print(f"  {d:28} {len(domain_senders[d]):>5}  {nf:>8}  {sorted(domain_folders[d])[:3]}{flag}")
