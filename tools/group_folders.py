#!/usr/bin/env python3
"""Show every rule + sender inside the 8 group folders, to build exact
wildcard patterns and the precise delete list."""
import json

GROUP_FOLDERS = ["AFW", "AMEX", "Amazon", "Bills", "Samsung", "USPS", "UPS", "Network"]

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


for g in GROUP_FOLDERS:
    print(f"===== FOLDER {g!r} =====")
    for i, rec in enumerate(records):
        rule = snap["rules"][i]
        folder = (rule.get("move_to") or "")
        if folder.lower() != g.lower():
            continue
        sends = senders_of(rec["desc"])
        print(f"  [{i+1:3}] {rule['name']!r:55} from={sends}")
    print()
