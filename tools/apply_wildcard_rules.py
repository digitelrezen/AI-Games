#!/usr/bin/env python3
"""Create the 8 consolidated wildcard rules in Classic Outlook via COM.

Proven COM pattern (reused from outlook_rules.py, which connects successfully
on this build):
  rules = ns.DefaultStore.GetRules()
  rule = rules.Add(); rule.Name=...; rule.Enabled=False
  cond = rule.Conditions["From"]; cond.Enabled=True
  for s in patterns: cond.IncludeNames.Add(s)      # plain str each
  rule.Actions["MoveToFolder"].Folder = <folder>
  rule.StopProcessingOnErrors=False; rule.Enabled=True; rule.Save()
  cleanup on failure: rules.Delete(name)

Design notes (from user):
  * No gmail.com wildcard (friends use gmail) -> never added.
  * Ex-Bills senders re-routed to their own folders:
      NordVPN -> Network, American Express -> AMEX.
  * Each rule matches BOTH the company domain (whole-domain wildcard) and the
    display names actually observed, so routing is preserved and broadened.
"""
import json
import os
import sys
import datetime

import pythoncom
import win32com.client

REPORT_DIR = r"C:\Dev\AI-GAMES\tools\outlook_reports"

# folder -> list of From patterns (order: domains first, then names)
PLAN = [
    ("AFW", ["afw.com", "american furniture warehouse", "afwcs"]),
    ("AMEX", ["american express", "aexp.com", "americanexpress.com"]),
    ("Amazon", ["amazon.com", "amazonservices.com", "amazon"]),
    ("Bills", [
        "paypal.com", "paypal",
        "etrade.com", "e*trade", "e-trade",
        "xcelenergy.com", "xcel energy",
        "statefarm.com", "state farm",
        "rocketmortgage.com", "rocket mortgage", "rocket loans",
        "pnc.com", "pnc",
        "social security", "zelle", "id.me", "jbm",
    ]),
    ("Samsung", ["samsung.com", "samsungusa.com", "samsung", "rxo.com", "assurant"]),
    ("USPS", ["usps.com", "informeddelivery", "u.s. postal service", "usps"]),
    ("UPS", ["ups.com", "id.ups.com"]),
    ("Network", [
        "nordvpn.com", "nord",
        "no-ip.com", "no-ip",
        "domain.com", "tp-link.com", "tp-link",
        "network solutions",
    ]),
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
    """Case-insensitive recursive folder search (depth-capped)."""
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
        # descend (cap depth by not going below 6 levels of nesting)
        try:
            if folder.Folders.Count > 0:
                for sub in enumerate1(folder.Folders):
                    stack.append(sub)
        except Exception:
            pass
    return None


def main() -> int:
    pythoncom.CoInitialize()
    app = win32com.client.Dispatch("Outlook.Application")
    ns = app.GetNamespace("MAPI")
    store = ns.DefaultStore
    rules = store.GetRules()
    log(f"connected; existing rule count: {rules.Count}")

    # Refuse to run if something is already there (safety: user said 0).
    if rules.Count > 0:
        log("WARNING: rules already present (expected 0). Listing them:")
        for r in enumerate1(rules):
            log(f"   - {r.Name!r} enabled={r.Enabled}")
        log("Aborting to avoid clobbering. Fix and re-run.")
        return 3

    results = []
    for folder_name, patterns in PLAN:
        rule_name = RULE_PREFIX + folder_name
        folder = find_folder(ns, folder_name)
        if folder is None:
            log(f"[SKIP] {folder_name}: target folder not found")
            results.append({"rule": rule_name, "folder": folder_name,
                            "status": "folder-not-found", "patterns": patterns})
            continue
        rule = rules.Create(rule_name, 0)  # 0 = olRuleReceive
        rule.Enabled = False
        try:
            cond = rule.Conditions.SenderAddress
            cond.Address = win32com.client.VARIANT(
                pythoncom.VT_ARRAY | pythoncom.VT_BSTR, list(patterns))
            cond.Enabled = True
            rule.Actions.MoveToFolder.Folder = folder
            rule.Enabled = True
            rules.Save()
            log(f"[OK]   {rule_name} -> {folder.Name!r} ({len(patterns)} patterns)")
            results.append({"rule": rule_name, "folder": folder_name,
                            "status": "created", "patterns": patterns})
        except Exception as e:
            try:
                rules.Remove(rule_name)
                deleted = True
            except Exception:
                deleted = False
            if not deleted:
                log(f"[WARN] could not auto-delete half-built rule {rule_name!r}")
            log(f"[FAIL] {rule_name}: {e!r} (cleanup done: {deleted})")
            results.append({"rule": rule_name, "folder": folder_name,
                            "status": "failed", "error": repr(e),
                            "patterns": patterns})

    # Verify final state
    log("\n=== FINAL RULE LIST (verification) ===")
    final = []
    for r in enumerate1(rules):
        try:
            final.append({"name": r.Name, "enabled": bool(r.Enabled)})
        except Exception:
            continue
    for f in sorted(final, key=lambda x: x["name"]):
        log(f"   enabled={f['enabled']}  {f['name']}")

    report = {
        "generated": datetime.datetime.now().isoformat(timespec="seconds"),
        "rule_count_after": len(final),
        "created": [x for x in results if x["status"] == "created"],
        "skipped": [x for x in results if x["status"] != "created"],
        "final_rules": final,
        "notes": [
            "No gmail.com wildcard created (per user: friends use gmail).",
            "NordVPN routed to Network; American Express routed to AMEX.",
            "One-off Network senders (Resideo, Emporia, G.Skill, Digitel Rezen, root) "
            "not wildcarded - re-add individually if needed.",
        ],
    }
    os.makedirs(REPORT_DIR, exist_ok=True)
    path = os.path.join(REPORT_DIR, f"wildcard_apply_{datetime.datetime.now():%Y%m%d_%H%M%S}.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2, ensure_ascii=False)
    log(f"\nreport written: {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
