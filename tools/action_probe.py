#!/usr/bin/env python3
"""Probe the MoveToFolder action object's surface in this stub build and test
strategies for making the action persist. Creates test rules, saves, then
re-reads in a FRESH COM session to see what persisted."""
import sys
import pythoncom
import win32com.client

FOLDER_NAME = "Trash"


def get_rules(app):
    ns = app.GetNamespace("MAPI")
    return ns, ns.DefaultStore.GetRules()


def find_folder(ns, name):
    for i in range(1, int(ns.Folders.Count) + 1):
        acc = ns.Folders.Item(i)
        for j in range(1, int(acc.Folders.Count) + 1):
            f = acc.Folders.Item(j)
            if f.Name.lower() == name.lower():
                return f
    return None


def readback(rules, name):
    """Fresh-ish readback of a rule's action in the same session."""
    for i in range(1, int(rules.Count) + 1):
        r = rules.Item(i)
        if r.Name == name:
            out = []
            try:
                act = r.Actions.MoveToFolder
                out.append(f"action dir: {[a for a in dir(act) if not a.startswith('_')]}")
                for attr in ("Folder", "Address", "Enabled", "EnabledActions"):
                    try:
                        v = getattr(act, attr)
                        out.append(f"  act.{attr} = {v!r}"[:150])
                    except Exception as e:
                        out.append(f"  act.{attr} FAIL {e!r}"[:100])
                try:
                    out.append(f"  act.Folder.Name = {act.Folder.Name!r}")
                except Exception as e:
                    out.append(f"  act.Folder.Name FAIL {e!r}"[:100])
            except Exception as e:
                out.append(f"Actions access FAIL {e!r}"[:100])
            return out
    return ["rule not found"]


def main() -> int:
    pythoncom.CoInitialize()
    app = win32com.client.Dispatch("Outlook.Application")
    ns, rules = get_rules(app)
    folder = find_folder(ns, FOLDER_NAME)
    print("folder:", folder.Name if folder else None)

    # --- inspect action surface on a scratch rule ---
    s = rules.Create("ZZZ_ACT_DIR", 0)
    act = s.Actions.MoveToFolder
    print("action dir:", [a for a in dir(act) if not a.startswith("_")])
    print("actions collection dir:", [a for a in dir(s.Actions) if not a.startswith("_")])
    try:
        print("Actions.Count:", s.Actions.Count)
    except Exception as e:
        print("Actions.Count fail:", e)
    rules.Remove("ZZZ_ACT_DIR")

    # --- strategy tests: one rule per strategy ---
    strategies = []

    def stA(r):  # Folder only (current known-failing)
        r.Actions.MoveToFolder.Folder = folder

    def stB(r):  # Enabled first, then Folder
        a = r.Actions.MoveToFolder
        a.Enabled = True
        a.Folder = folder

    def stC(r):  # Folder, then Enabled
        a = r.Actions.MoveToFolder
        a.Folder = folder
        a.Enabled = True

    strategies = [("A", stA), ("B", stB), ("C", stC)]

    for tag, fn in strategies:
        name = f"ZZZ_ST_{tag}"
        r = rules.Create(name, 0)
        try:
            fn(r)
            r.Enabled = True
            rules.Save()
            print(f"[{tag}] set+save OK")
        except Exception as e:
            print(f"[{tag}] set FAIL: {e!r}")
            rules.Remove(name)
            rules.Save()
            continue

    print("\n=== same-session readback ===")
    for tag, _ in strategies:
        name = f"ZZZ_ST_{tag}"
        for line in readback(rules, name):
            print(f"[{tag}]", line)

    # cleanup
    for tag, _ in strategies:
        try:
            rules.Remove(f"ZZZ_ST_{tag}")
        except Exception:
            pass
    rules.Save()
    print("\ncleaned up; count now:", rules.Count)
    return 0


if __name__ == "__main__":
    sys.exit(main())
