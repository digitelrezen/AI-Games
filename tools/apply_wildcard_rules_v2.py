#!/usr/bin/env python3
"""Create the remaining wildcard consolidation rules (24 folders) via COM.

Proven COM pattern on this build:
  rule = rules.Create(name, 0)
  cond = rule.Conditions.SenderAddress
  cond.Address = VARIANT(VT_ARRAY|VT_BSTR, [patterns])
  cond.Enabled = True
  rule.Enabled = True
  rules.Save()

KNOWN LIMITATION (this Outlook build): assigning
rule.Actions.MoveToFolder.Folder is a SILENT NO-OP (tested MAPIFolder
object, MAPIOBJECT, EntryID, FolderPath/FullName strings - all discarded,
readback None). The Move-to-Folder target must be set in the Outlook UI:
  Manage Rules & Alerts -> select rule -> Edit -> "Move it to the
  folder..." -> pick folder -> OK -> OK.
So this script creates conditions-only rules, ENABLED, ready for the
user to point each one at its folder.

Pattern design (matches the 8 already-deployed rules):
  * bare domain  = whole-domain wildcard (any addr on that domain)
  * name strings = case-insensitive substring of sender name/address
  * NO gmail.com (per user: friends use gmail)
"""
import json
import os
import sys
import datetime

import pythoncom
import win32com.client

REPORT_DIR = r"C:\Dev\AI-GAMES\tools\outlook_reports"

# folder (exact mailbox folder name) -> From patterns
PLAN = [
    ("Crap", [
        "aliexpress.com", "aliexpress",
        "comedy works",
        "discounttire.com", "discount tire",
        "ftd.com",
        "garlic knot",
        "ikea.com", "ikea",
        "life is good",
        "men's wearhouse", "mens wearhouse",
        "omhasteaks.com", "omhasteaks.net", "omaha steak",
        "providentmetals.com", "provident metals",
        "redrobin.com", "red robin",
        "standard restaurant supply",
        "hcg shotss",
        "vision first eye care",
        "ispring",
        "spores101.com",
        "azure standard",
    ]),
    ("Doctor stuff", [
        "adventhealth.com", "adventhealth",
        "questdiagnostics.com", "quest diagnostics",
        "envision",
        "health images",
        "radiology",
        "integrated ear nose",
        "tps pharmacy",
        "us anesthesia",
        "anesthesia partners",
        "healthipass.com",
        "paymydoc.net",
    ]),
    ("home depot", [
        "homedepot.com", "homedepot", "home depot",
        "delta mechanical",
        "angela giessinger",
        "destani",
    ]),
    ("Gun stuff", [
        "2awarehouse.com", "2a warehouse",
        "atlanticfirearms.com", "atlantic firearms",
        "classic firearms",
        "psausa.com", "palmetto state armory",
        "tanner gun show",
    ]),
    ("Vonage", ["vonage.com", "vonage"]),
    ("Guitar", [
        "guitarcenter.com", "guitar center",
        "guitarfetish.com", "guitar fetish",
        "musiciansfriend.com", "musician's friend",
        "sologuitars.com", "solo guitars",
        "guitar",
    ]),
    ("Microcenter", ["microcenter.com", "micro center"]),
    ("Xfinity", ["xfinity.com", "xfinity", "yahoo mail"]),
    ("ASUS", ["asus.com", "asus"]),
    ("Ankarsrum", ["ankarsrum"]),
    ("Bestbuy", ["bestbuy.com", "best buy"]),
    ("Ebay", ["ebay.com", "ebay"]),
    ("Intel", ["intel.com", "intel"]),
    ("Jenise", ["jenise", "jenes76"]),
    ("Seagate", ["seagate.com", "seagate"]),
    ("Twitch", ["twitch.tv", "twitch"]),
    ("steam", ["steam"]),
    ("Bowley Lock", ["bowley lock"]),
    ("CD keys", ["cjs cd keys"]),
    ("EA", ["@ea.com", "electronic arts"]),
    ("Fractal Design", ["fractal-design.com", "fractal design"]),
    ("Newegg", ["newegg.com", "newegg"]),
    ("microsoft", ["microsoft account", "account.microsoft.com", "@microsoft.com"]),
    ("yahoo", ["yahoo.com", "yahoo"]),
]

RULE_PREFIX = "Wildcard - "


def log(m=""):
    print(m, flush=True)


def enumerate1(coll):
    try:
        n = int(coll.Count)
    except Exception:
        return
    for i in range(1, n + 1):
        try:
            yield coll.Item(i)
        except Exception:
            continue


def find_folder(ns, name):
    """Case-insensitive recursive folder search."""
    target = name.lower()
    stack = []
    try:
        for acc in enumerate1(ns.Folders):
            stack.append(acc)
    except Exception:
        pass
    while stack:
        folder = stack.pop()
        try:
            fname = folder.Name
        except Exception:
            continue
        if str(fname).lower() == target:
            return folder
        try:
            if folder.Folders.Count > 0:
                for sub in enumerate1(folder.Folders):
                    stack.append(sub)
        except Exception:
            pass
    return None


def existing_rule_names(rules):
    names = set()
    for r in enumerate1(rules):
        try:
            names.add(r.Name)
        except Exception:
            continue
    return names


def main() -> int:
    pythoncom.CoInitialize()
    app = win32com.client.Dispatch("Outlook.Application")
    ns = app.GetNamespace("MAPI")
    rules = ns.DefaultStore.GetRules()
    log(f"connected; existing rule count: {rules.Count}")
    have = existing_rule_names(rules)
    log("existing rules:")
    for n in sorted(have):
        log(f"   - {n!r}")

    results = []
    for folder_name, patterns in PLAN:
        rule_name = RULE_PREFIX + folder_name
        if rule_name in have:
            log(f"[SKIP] {rule_name}: already exists")
            results.append({"rule": rule_name, "folder": folder_name,
                            "status": "exists", "patterns": patterns})
            continue
        folder = find_folder(ns, folder_name)
        if folder is None:
            log(f"[MISS] {rule_name}: folder {folder_name!r} not found")
            results.append({"rule": rule_name, "folder": folder_name,
                            "status": "folder-not-found", "patterns": patterns})
            continue
        try:
            rule = rules.Create(rule_name, 0)  # 0 = olRuleReceive
            rule.Enabled = False
            cond = rule.Conditions.SenderAddress
            cond.Address = win32com.client.VARIANT(
                pythoncom.VT_ARRAY | pythoncom.VT_BSTR, list(patterns))
            cond.Enabled = True
            # NOTE: no Actions.MoveToFolder assignment here - it is a
            # silent no-op on this build. User sets the folder in the UI.
            rule.Enabled = True
            rules.Save()
            have.add(rule_name)
            log(f"[OK]   {rule_name} ({len(patterns)} patterns) -> user points to {folder.Name!r}")
            results.append({"rule": rule_name, "folder": folder_name,
                            "status": "created", "patterns": patterns})
        except Exception as e:
            try:
                rules.Remove(rule_name)
            except Exception:
                pass
            log(f"[FAIL] {rule_name}: {e!r}")
            results.append({"rule": rule_name, "folder": folder_name,
                            "status": "failed", "error": repr(e),
                            "patterns": patterns})

    log("\n=== FINAL RULE LIST (verification) ===")
    final = []
    for r in enumerate1(rules):
        try:
            final.append({"name": r.Name, "enabled": bool(r.Enabled)})
        except Exception:
            continue
    for f in sorted(final, key=lambda x: x["name"]):
        log(f"   enabled={f['enabled']}  {f['name']}")
    log(f"\ntotal rules now: {len(final)}")

    report = {
        "generated": datetime.datetime.now().isoformat(timespec="seconds"),
        "rule_count_after": len(final),
        "created": [x for x in results if x["status"] == "created"],
        "skipped_exists": [x for x in results if x["status"] == "exists"],
        "folder_missing": [x for x in results if x["status"] == "folder-not-found"],
        "failed": [x for x in results if x["status"] == "failed"],
        "final_rules": final,
        "notes": [
            "Conditions-only rules; Move-to-Folder target NOT set (COM setter "
            "is a silent no-op on this build). User sets each folder in the "
            "Manage Rules & Alerts UI.",
            "No gmail.com wildcard (per user: friends use gmail).",
            "Pattern style: bare domain = whole-domain wildcard; other strings "
            "= case-insensitive substring of sender name/address.",
        ],
    }
    os.makedirs(REPORT_DIR, exist_ok=True)
    path = os.path.join(REPORT_DIR,
                        f"wildcard_apply_v2_{datetime.datetime.now():%Y%m%d_%H%M%S}.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2, ensure_ascii=False)
    log(f"report written: {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
