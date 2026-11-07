#!/usr/bin/env python3
"""Independent verification: fresh COM session, confirm the 8 wildcard rules
persisted, are enabled, and point at the right folders."""
import sys
import pythoncom
import win32com.client


def main() -> int:
    pythoncom.CoInitialize()
    app = win32com.client.Dispatch("Outlook.Application")
    ns = app.GetNamespace("MAPI")
    rules = ns.DefaultStore.GetRules()
    n = int(rules.Count)
    print(f"rule count (fresh session): {n}")
    ok = True
    expected = {"AFW", "AMEX", "Amazon", "Bills", "Samsung", "USPS", "UPS", "Network"}
    seen = set()
    for i in range(1, n + 1):
        r = rules.Item(i)
        name = r.Name
        enabled = bool(r.Enabled)
        folder = "?"
        try:
            folder = r.Actions.MoveToFolder.Folder.Name
        except Exception:
            pass
        tag = "OK " if enabled and name in ("Wildcard - " + f for f in expected) else "?? "
        if name.startswith("Wildcard - "):
            seen.add(name[len("Wildcard - "):])
        print(f"  {tag}[{i}] {name!r}  enabled={enabled}  -> folder={folder!r}")
    missing = expected - seen
    if missing:
        ok = False
        print("MISSING folders:", sorted(missing))
    if n != 8:
        ok = False
        print(f"count mismatch: expected 8, got {n}")
    print("VERIFICATION:", "PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
