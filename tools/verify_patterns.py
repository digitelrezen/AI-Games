#!/usr/bin/env python3
"""Read back From-patterns of sample new rules to confirm persistence."""
import sys
import pythoncom
import win32com.client


def main() -> int:
    pythoncom.CoInitialize()
    app = win32com.client.Dispatch("Outlook.Application")
    ns = app.GetNamespace("MAPI")
    rules = ns.DefaultStore.GetRules()
    want = ["Wildcard - Guitar", "Wildcard - Gun stuff",
            "Wildcard - Crap", "Wildcard - Vonage"]
    found = {}
    for i in range(1, int(rules.Count) + 1):
        r = rules.Item(i)
        if r.Name in want:
            pats = []
            try:
                addr = r.Conditions.SenderAddress.Address
                if addr:
                    pats = list(addr)
            except Exception as e:
                pats = [f"READ FAIL: {e!r}"]
            found[r.Name] = pats
    for name in want:
        pats = found.get(name, ["<not found>"])
        print(f"\n{name}  ({len(pats)} patterns):")
        for p in pats:
            print(f"    {p!r}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
