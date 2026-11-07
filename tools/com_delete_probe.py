#!/usr/bin/env python3
"""Introspect a Rule COM object: which attributes/methods exist (esp. Delete),
then delete the leftover probe rule if present."""
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
    print("rule count:", rules.Count)

    target = None
    for i in range(1, rules.Count + 1):
        r = rules.Item(i)
        if r.Name == NAME:
            target = (i, r)
            break
    if not target:
        print("probe rule not present; nothing to clean up")
        # still introspect a normal rule for the method surface
        i, r = 1, rules.Item(1)
    else:
        i, r = target
        print("found probe rule at index", i)

    print("rule object type:", type(r))
    attrs = []
    for a in dir(r):
        if not a.startswith("__"):
            attrs.append(a)
    print("rule attrs:", ", ".join(attrs))

    # Try to delete via a few candidate methods
    for meth in ("Delete", "delete", "Remove"):
        if hasattr(r, meth):
            try:
                getattr(r, meth)()
                print(f"called {meth}() OK")
                break
            except Exception as e:
                print(f"{meth}() FAILED: {e!r}")

    rules.Save()
    still = any(rules.Item(k).Name == NAME for k in range(1, rules.Count + 1))
    print("probe rule still present after delete attempt:", still)
    print("new count:", rules.Count)
    return 0


if __name__ == "__main__":
    sys.exit(main())
