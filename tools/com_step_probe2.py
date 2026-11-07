#!/usr/bin/env python3
"""Probe 2: (1) how to set the From condition (Text plain / SAFEARRAY),
(2) what the Rules collection exposes for deletion, (3) validate a full
condition+action rule end-to-end. Leaves NO rule behind if delete works;
reports what to remove if it doesn't."""
import sys
import pythoncom
import win32com.client
import win32com.client

NAME = "ZZZ_PROBE2"


def main() -> int:
    pythoncom.CoInitialize()
    app = win32com.client.Dispatch("Outlook.Application")
    ns = app.GetNamespace("MAPI")
    rules = ns.DefaultStore.GetRules()
    print("rule count before:", rules.Count)

    print("=== dir(Rules collection) ===")
    print([a for a in dir(rules) if not a.startswith("_")])

    # find a real folder
    folder = None
    try:
        for i in range(1, int(ns.Folders.Count) + 1):
            acc = ns.Folders.Item(i)
            for j in range(1, int(acc.Folders.Count) + 1):
                f = acc.Folders.Item(j)
                if f.Name.lower() in ("bills", "inbox"):
                    folder = f
                    break
            if folder:
                break
    except Exception:
        pass
    if folder is None:
        folder = ns.GetDefaultFolder(6)  # olFolderInbox
    print("using folder:", folder.Name)

    rule = rules.Create(NAME, 0)
    cond = rule.Conditions.SenderAddress
    print("=== dir(SenderAddress condition) ===")
    print([a for a in dir(cond) if not a.startswith("_")])

    # Try setting Text as plain string
    print("--- try cond.Text = plain string ---")
    try:
        cond.Text = "example.com"
        print("plain string OK")
        print("  readback Text:", repr(cond.Text))
    except Exception as e:
        print("plain string FAIL:", repr(e))

    # Try SAFEARRAY of strings (user's original approach)
    print("--- try cond.Text = SAFEARRAY of 2 strings ---")
    try:
        arr = win32com.client.VARIANT(pythoncom.VT_ARRAY | pythoncom.VT_BSTR,
                                      ["example.com", "example.org"])
        cond.Text = arr
        print("SAFEARRAY OK")
    except Exception as e:
        print("SAFEARRAY FAIL:", repr(e))

    # Configure action and try to enable + save
    try:
        rule.Actions.MoveToFolder.Folder = folder
        print("action set OK")
    except Exception as e:
        print("action FAIL:", repr(e))

    cond.Enabled = True
    print("--- try rule.Enabled=True + rules.Save() ---")
    try:
        rule.Enabled = True
        print("Enabled=True OK (validation passed!)")
    except Exception as e:
        print("Enabled=True FAIL:", repr(e))
    try:
        rules.Save()
        print("rules.Save() OK")
    except Exception as e:
        print("rules.Save() FAIL:", repr(e))

    # Now try every conceivable delete
    print("--- delete attempts ---")
    for label, fn in [
        ("rules.Delete(name)", lambda: rules.Delete(NAME)),
        ("rules.Delete(index)", lambda: rules.Delete(1)),
        ("rule.Delete()", lambda: rule.Delete()),
        ("rules.Remove(name)", lambda: rules.Remove(NAME)),
        ("rules.Remove(index)", lambda: rules.Remove(1)),
        ("rules.DeleteItem(name)", lambda: rules.DeleteItem(NAME)),
        ("rules.DeleteRule(name)", lambda: rules.DeleteRule(NAME)),
    ]:
        try:
            fn()
            print(f"  OK   {label}")
            break
        except Exception as e:
            print(f"  FAIL {label}: {type(e).__name__} {e!r}"[:150])

    print("=== final state ===")
    for i in range(1, int(rules.Count) + 1):
        r = rules.Item(i)
        print(f"   [{i}] {r.Name!r} enabled={r.Enabled}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
