#!/usr/bin/env python3
"""Classify all 183 rules against the 8 wildcard groups using the authoritative
description lines from the GUI walk. Produces plan_final.json:
  - per-group delete lists (rules whose sender is covered by the group's patterns)
  - keep list (senders not covered by any group)
"""
import json
import re
import sys

GROUPS = {
    "AFW": ["afw.com", "american furniture warehouse"],
    "AMEX": ["aexp.com", "americanexpress.com", "amex"],
    "Amazon": ["amazon.com", "amazonservices.com"],
    "Bills": ["paypal.com", "etrade.com", "xcelenergy.com", "statefarm.com", "rocketmortgage.com", "pnc.com"],
    "Samsung": ["samsung.com", "samsungusa.com"],
    "USPS": ["usps.com", "informeddelivery"],
    "UPS": ["ups.com"],
    "Network": ["nordvpn.com", "no-ip.com", "domain.com", "tp-link.com"],
}

with open(r"C:\Dev\AI-GAMES\tools\rules_snapshot.json", encoding="utf-8") as f:
    snap = json.load(f)
with open(r"C:\Dev\AI-GAMES\tools\rules_descriptions.json", encoding="utf-8") as f:
    walk = json.load(f)

records = walk["records"]
assert len(records) >= 183, f"expected 183 records, got {len(records)}"


def parse_senders(desc_lines):
    senders = []
    for line in desc_lines:
        l = line.strip()
        ll = l.lower()
        if ll.startswith("from "):
            s = l[len("from "):].strip()
            for part in s.split(" or "):
                part = part.strip().strip('"').strip()
                if part:
                    senders.append(part)
        elif "sender" in ll and "words" in ll:
            for m in re.findall(r'"([^"]+)"', l):
                senders.append(m.strip())
    return senders


def classify(senders):
    hits = []
    for gname, patterns in GROUPS.items():
        for s in senders:
            sl = s.lower()
            if any(p.lower() in sl for p in patterns):
                hits.append(gname)
                break
    return hits


plan = {g: [] for g in GROUPS}
keep = []
multi = []

for i, rec in enumerate(records[:183]):
    rule = snap["rules"][i]
    name = rule["name"]
    senders = parse_senders(rec["desc"])
    hits = classify(senders)
    entry = {"index": i, "name": name, "senders": senders, "move_to": rule["move_to"],
             "enabled": rule["enabled"], "desc": rec["desc"]}
    if not hits:
        keep.append(entry)
    elif len(hits) == 1:
        plan[hits[0]].append(entry)
    else:
        multi.append((entry, hits))

total_delete = sum(len(v) for v in plan.values())
out = {
    "total_rules": 183,
    "total_delete": total_delete,
    "total_keep": len(keep),
    "multi_group": [{"name": e["name"], "hits": h, "senders": e["senders"]} for e, h in multi],
    "groups": {g: [e["name"] for e in plan[g]] for g in GROUPS},
    "keep": [e["name"] for e in keep],
}
with open(r"C:\Dev\AI-GAMES\tools\plan_final.json", "w", encoding="utf-8") as f:
    json.dump(out, f, indent=1, ensure_ascii=False)

print(f"total=183  delete={total_delete}  keep={len(keep)}  multi={len(multi)}")
for g, names in plan.items():
    print(f"  {g:<10} {len(names):>3}  e.g. {names[:3]}")
print("multi-group matches:", out["multi_group"])
print("\nKEEP list (senders not covered by any wildcard group):")
for e in keep:
    print(f"  - {e['name']!r}  senders={e['senders']}  move_to={e['move_to']}")
print("\nno-sender rules among KEEP:", [e["name"] for e in keep if not e["senders"]])
