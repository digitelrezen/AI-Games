#!/usr/bin/env python3
"""List all rules with whether a Move-to-Folder action target is set.
Use as the 'still to point' checklist while setting folders in the UI."""
import sys
import pythoncom
import win32com.client


def main() -> int:
    pythoncom.CoInitialize()
    app = win32com.client.Dispatch("Outlook.Application")
    ns = app.GetNamespace("MAPI")
    rules = ns.DefaultStore.GetRules()
    rows = []
    for i in range(1, int(rules.Count) + 1):
        r = rules.Item(i)
        try:
            name = r.Name
        except Exception:
            continue
        folder = "?"
        try:
            f = r.Actions.MoveToFolder.Folder
            folder = f.Name if f is not None else None
        except Exception as e:
            folder = f"ERR {e!r}"[:40]
        rows.append((name, folder))
    missing = [n for n, f in rows if f in (None, "?")]
    for name, folder in sorted(rows):
        mark = "OK  " if folder not in (None, "?") else "TODO"
        print(f"  [{mark}] {name}  ->  {folder}")
    print(f"\n{len(rows) - len(missing)}/{len(rows)} rules have a folder target.")
    if missing:
        print("Still to point:")
        for n in sorted(missing):
            print(f"   - {n}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
