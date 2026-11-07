#!/usr/bin/env python3
"""Full COM rules snapshot + folder check + classification against the 8 wildcard groups.

Writes rules_snapshot.json with every rule (name, enabled, sender, move_to, group)
and a classification summary (which rules to delete per group vs keep).
"""
import json
import sys
import win32com.client
import pythoncom

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

COND_KEYS = ["SenderAddress", "From", "SentTo", "CC", "BCC", "To",
             "SubjectOrBody", "Subject", "Body", "Header", "Category",
             "Attachments", "LargerThan", "SmallerThan", "FromMe",
             "Importance", "Unread", "Flagged", "MarkedForFollowUp",
             "MarkedAsDeleted", "SentToMe"]

OUT = r"C:\Dev\AI-GAMES\tools\rules_snapshot.json"

pythoncom.CoInitialize()
try:
    app = win32com.client.Dispatch("Outlook.Application")
    ns = app.GetNamespace("MAPI")
    store = ns.DefaultStore
    rules = store.GetRules()
    n = rules.Count
    print("rule count:", n)

    # ---- folder inventory ----
    folder_names = []

    def collect(folder, depth=0):
        try:
            for i in range(1, folder.Folders.Count + 1):
                sub = folder.Folders.Item(i)
                folder_names.append(sub.Name)
                if depth < 2:
                    collect(sub, depth + 1)
        except Exception as e:
            print("folder walk err:", repr(e))

    try:
        collect(store)
    except Exception as e:
        print("store folders err:", repr(e))
    print("folders found:", sorted(set(folder_names))[:60])
    for g in GROUPS:
        print(f"  target folder {g!r} exists:", g in folder_names)

    # ---- rules ----
    def read_cond(rule):
        found = {}
        try:
            conds = rule.Conditions
        except Exception:
            return found
        for key in COND_KEYS:
            try:
                c = getattr(conds, key)
            except Exception:
                continue
            try:
                txt = c.Text
            except Exception:
                continue
            if txt not in (None, "", "<unknown>"):
                found[key] = txt
        return found

    out_rules = []
    key_stats = {}
    for i in range(1, n + 1):
        r = rules.Item(i)
        rec = {"index": i}
        try:
            rec["name"] = r.Name
        except Exception:
            rec["name"] = None
        try:
            rec["enabled"] = r.Enabled
        except Exception:
            rec["enabled"] = None
        rec["conditions"] = read_cond(r)
        rec["move_to"] = None
        try:
            rec["move_to"] = r.Actions.MoveToFolder.Folder.Name
        except Exception:
            pass
        for k in rec["conditions"]:
            key_stats[k] = key_stats.get(k, 0) + 1
        out_rules.append(rec)

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"count": n, "condition_key_stats": key_stats,
                   "folders": sorted(set(folder_names)), "rules": out_rules},
                  f, indent=1, ensure_ascii=False, default=str)
    print("wrote", OUT)
    print("condition keys used across rules:", key_stats)
    print("sample:")
    for rec in out_rules[:10]:
        print("  ", rec)
finally:
    try:
        pythoncom.CoUninitialize()
    except Exception:
        pass
