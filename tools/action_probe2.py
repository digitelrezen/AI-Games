#!/usr/bin/env python3
"""1) Read back the user-fixed 'Wildcard - Amazon' rule action (what does a
WORKING rule expose?). 2) Try assigning Folder as EntryID / FolderPath strings
on test rules and read back."""
import sys
import pythoncom
import win32com.client


def main() -> int:
    pythoncom.CoInitialize()
    app = win32com.client.Dispatch("Outlook.Application")
    ns = app.GetNamespace("MAPI")
    rules = ns.DefaultStore.GetRules()

    # 1) the working rule
    for i in range(1, int(rules.Count) + 1):
        r = rules.Item(i)
        if r.Name == "Wildcard - Amazon":
            act = r.Actions.MoveToFolder
            print("WORKING Amazon rule action:")
            print("  ActionType:", act.ActionType)
            print("  Enabled:", act.Enabled)
            try:
                f = act.Folder
                print("  Folder:", repr(f)[:200])
                if f is not None:
                    print("  Folder.Name:", f.Name)
                    print("  Folder.FolderPath:", f.FolderPath)
            except Exception as e:
                print("  Folder FAIL:", repr(e)[:150])
            break

    # find a folder for tests
    folder = None
    for i in range(1, int(ns.Folders.Count) + 1):
        acc = ns.Folders.Item(i)
        for j in range(1, int(acc.Folders.Count) + 1):
            f = acc.Folders.Item(j)
            if f.Name.lower() == "trash":
                folder = f
                break
        if folder:
            break
    print("\ntest folder:", folder.Name, "EntryID len:", len(folder.EntryID or ""))

    # 2) string-assignment strategies
    for tag, val in [
        ("EntryID", folder.EntryID),
        ("FolderPath", folder.FolderPath),
        ("FullName", folder.FullFolderPath),
    ]:
        name = f"ZZZ_STR_{tag}"
        r = rules.Create(name, 0)
        try:
            r.Actions.MoveToFolder.Folder = val
            r.Enabled = True
            rules.Save()
            print(f"[{tag}] set+save OK")
        except Exception as e:
            print(f"[{tag}] FAIL: {e!r}"[:160])
            try:
                rules.Remove(name)
            except Exception:
                pass
            continue
        # read back
        for k in range(1, int(rules.Count) + 1):
            rr = rules.Item(k)
            if rr.Name == name:
                try:
                    fb = rr.Actions.MoveToFolder.Folder
                    print(f"[{tag}] readback Folder: {repr(fb)[:120]}")
                    if fb is not None:
                        print(f"[{tag}] readback Folder.Name: {fb.Name}")
                except Exception as e:
                    print(f"[{tag}] readback FAIL: {e!r}"[:120])
                break
        try:
            rules.Remove(name)
        except Exception:
            pass
    rules.Save()
    print("\ncount now:", rules.Count)
    return 0


if __name__ == "__main__":
    sys.exit(main())
