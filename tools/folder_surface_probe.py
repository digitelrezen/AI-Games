#!/usr/bin/env python3
"""Probe the Inbox folder's COM surface in this stub build: what properties
exist, and can we reach the messages (Messages/Items) to read sender addresses?"""
import sys
import pythoncom
import win32com.client


def main() -> int:
    pythoncom.CoInitialize()
    app = win32com.client.Dispatch("Outlook.Application")
    ns = app.GetNamespace("MAPI")

    f1 = ns.GetDefaultFolder(6)
    print("GetDefaultFolder(6).Name:", f1.Name)
    print("dir(folder):", [a for a in dir(f1) if not a.startswith("_")])

    # also reach Inbox via account hierarchy
    for i in range(1, int(ns.Folders.Count) + 1):
        acc = ns.Folders.Item(i)
        print(f"\naccount {i}: {acc.Name}")
        for j in range(1, int(acc.Folders.Count) + 1):
            f = acc.Folders.Item(j)
            if f.Name.lower() == "inbox":
                print("  inbox found via hierarchy")
                print("  dir:", [a for a in dir(f) if not a.startswith("_")])
                for attr in ("Messages", "Items", "GetRules"):
                    try:
                        v = getattr(f, attr)
                        print(f"  {attr}: OK -> {type(v).__name__}" +
                              (f" count={v.Count}" if hasattr(v, "Count") else ""))
                    except Exception as e:
                        print(f"  {attr}: FAIL {e!r}"[:120])
    return 0


if __name__ == "__main__":
    sys.exit(main())
