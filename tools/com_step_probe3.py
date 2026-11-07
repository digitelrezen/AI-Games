#!/usr/bin/env python3
"""Probe 3: can cond.Address hold multiple From patterns?
Tests single string, comma-joined, SAFEARRAY, and repeated set.
Each test rule is removed afterwards via rules.Remove(name)."""
import sys
import pythoncom
import win32com.client

N = 0


def enumerate1(coll):
    try:
        n = int(coll.Count)
    except Exception:
        return
    for i in range(1, n + 1):
        try:
            yield coll.Item(i)
        except Exception:
            pass


def test(rules, ns, label, setter):
    global N
    N += 1
    name = f"ZZZ_P3_{N}"
    rule = rules.Create(name, 0)
    cond = rule.Conditions.SenderAddress
    try:
        setter(cond)
        readback = None
        try:
            readback = cond.Address
        except Exception as e:
            readback = f"<readback fail {e!r}>"
        print(f"[{label}] Address set OK; readback={readback!r}")
    except Exception as e:
        print(f"[{label}] Address set FAIL: {e!r}")
        rules.Remove(name)
        return

    folder = ns.GetDefaultFolder(6)  # Inbox
    try:
        rule.Actions.MoveToFolder.Folder = folder
    except Exception as e:
        print(f"[{label}] action FAIL: {e!r}")
    cond.Enabled = True
    valid = None
    try:
        rule.Enabled = True
        rules.Save()
        valid = True
        print(f"[{label}] VALIDATION PASSED (enabled+saved OK)")
    except Exception as e:
        valid = False
        print(f"[{label}] validation FAIL: {e!r}"[:200])
    try:
        rules.Remove(name)
        print(f"[{label}] removed test rule")
    except Exception as e:
        print(f"[{label}] remove FAIL: {e!r}")
    _ = valid


def main() -> int:
    pythoncom.CoInitialize()
    app = win32com.client.Dispatch("Outlook.Application")
    ns = app.GetNamespace("MAPI")
    rules = ns.DefaultStore.GetRules()
    print("rule count before:", rules.Count)

    test(rules, ns, "single", lambda c: setattr(c, "Address", "example.com"))

    def comma(c):
        c.Address = "example.com, example.org"
    test(rules, ns, "comma-joined", comma)

    def space(c):
        c.Address = "example.com example.org"
    test(rules, ns, "space-joined", space)

    def safe(c):
        c.Address = win32com.client.VARIANT(
            pythoncom.VT_ARRAY | pythoncom.VT_BSTR,
            ["example.com", "example.org"])
    test(rules, ns, "SAFEARRAY", safe)

    def repeat(c):
        c.Address = "example.com"
        c.Address = "example.org"
    test(rules, ns, "repeat-set", repeat)

    print("=== final state ===")
    for i in range(1, int(rules.Count) + 1):
        r = rules.Item(i)
        print(f"   [{i}] {r.Name!r} enabled={r.Enabled}")
    print("rule count after:", rules.Count)
    return 0


if __name__ == "__main__":
    sys.exit(main())
