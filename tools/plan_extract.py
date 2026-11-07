#!/usr/bin/env python3
"""Parse the latest Outlook diagnostic report into a clean, unambiguous automation plan.

Reads the newest JSON in tools/outlook_reports, extracts the consolidated wildcard
groups (patterns + target folder), the exact rule names to DELETE (consolidate), and
the rule names to KEEP (skip). Writes plan.json for the GUI automation to consume.
"""
import json
import glob
import os
import sys

REPORTS_DIR = r"C:\Dev\AI-GAMES\tools\outlook_reports"
OUT = r"C:\Dev\AI-GAMES\tools\plan.json"


def latest_report() -> str:
    files = glob.glob(os.path.join(REPORTS_DIR, "*.json"))
    if not files:
        raise SystemExit("no reports found")
    return max(files, key=os.path.getmtime)


def main() -> int:
    path = latest_report()
    with open(path, "r", encoding="utf-8") as fh:
        data = json.load(fh)

    plan = data.get("plan", {})
    consolidate = plan.get("consolidate", {})
    skip = plan.get("skip", [])

    groups = []
    delete_names = []
    for gname, g in consolidate.items():
        rules = [r["name"] for r in g.get("rules", [])]
        delete_names.extend(rules)
        groups.append({
            "name": gname,
            "patterns": g.get("patterns", []),
            "target_folder": g.get("target_folder"),
            "count": g.get("count"),
            "rule_names": rules,
        })

    keep_names = [s["name"] for s in skip]
    keep_non_sender = [s["name"] for s in skip if s.get("reason") == "non-sender-rule"]
    keep_nomatch = [s["name"] for s in skip if s.get("reason") == "sender-rule-no-match"]

    result = {
        "source_report": os.path.basename(path),
        "rule_api_available": data.get("rule_api_available"),
        "reported_rule_count": data.get("rule_count"),
        "total_rules_in_mailbox": data.get("total_rules_in_mailbox"),
        "groups": groups,
        "delete_names": sorted(set(delete_names)),
        "keep_names": sorted(set(keep_names)),
        "delete_count": len(set(delete_names)),
        "keep_count": len(set(keep_names)),
        "keep_non_sender": keep_non_sender,
        "keep_nomatch": keep_nomatch,
    }

    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(result, fh, indent=2, ensure_ascii=False)

    print(f"source_report        : {result['source_report']}")
    print(f"rule_api_available   : {result['rule_api_available']}")
    print(f"reported_rule_count  : {result['reported_rule_count']}")
    print(f"total_rules_in_mbox  : {result['total_rules_in_mailbox']}")
    print(f"delete_count         : {result['delete_count']}")
    print(f"keep_count           : {result['keep_count']}  (non-sender={len(keep_non_sender)}, nomatch={len(keep_nomatch)})")
    print(f"groups ({len(groups)}):")
    for g in groups:
        print(f"  - {g['name']:<10} folder={g['target_folder']:<10} count={g['count']:<3} patterns={g['patterns']}")
    print(f"\nwrote plan -> {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
