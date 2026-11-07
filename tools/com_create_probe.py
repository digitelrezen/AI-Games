#!/usr/bin/env python3
"""Probe: can this Outlook build create/delete a rule via COM?
Creates a disposable test rule, verifies it, then deletes it."""
import sys
import pythoncom
import win32com.client

NAME = "ZZZ_COM_PROBE_RULE_12345"


def main() -> int:
    pythoncom.CoInitialize()
    app = win32com.client.Dispatch("Outlook.Application")
    ns = app.GetNamespace("MAPI")
    store = ns.DefaultStore
    rules = store.GetRules()
    print("connected; rule count:", rules.Count)

    # Does the Rules collection expose Create?
    has_create = hasattr(rules, "Create")
    print("Rules.Create present:", has_create)

    if not has_create:
        print("RESULT: NO create support -> must use GUI")
        return 2

    created = None
    try:
        created = rules.Create(NAME, 0)  # 0 = olRuleReceive
        print("created rule:", created.Name if created else None)
        # Enable + save
        created.Enabled = True
        rules.Save()
        # verify it shows up
        found = any((r.Name == NAME) for i in range(1, rules.Count + 1)
                    for r in [rules.Item(i)])
        print("verified present after save:", found)
    except Exception as e:
        print("CREATE FAILED:", repr(e))
        return 3

    # cleanup
    try:
        for i in range(rules.Count, 0, -1):
            r = rules.Item(i)
            if r.Name == NAME:
                r.Delete()
                break
        rules.Save()
        still = any((r.Name == NAME) for i in range(1, rules.Count + 1)
                    for r in [rules.Item(i)])
        print("deleted; still present:", still)
        print("RESULT: COM create/delete WORKS")
        return 0
    except Exception as e:
        print("cleanup note (rule may remain, delete manually):", repr(e))
        print("RESULT: COM create WORKED (cleanup failed; rule", NAME, "may remain)")
        return 1


if __name__ == "__main__":
    sys.exit(main())
