#!/usr/bin/env python3
"""Final COM attempts to persist a MoveToFolder action:
 T1: assign the Folder object READ from the working Amazon rule's action.
 T2: assign folder.MAPIOBJECT.
 T3: full rule (condition + action) with folder object from hierarchy.
Each: create -> configure -> save -> readback -> remove."""
import sys
import pythoncom
import win32com.client


def read_action_folder(rules, name):
    for i in range(1, int(rules.Count) + 1):
        r = rules.Item(i)
        if r.Name == name:
            try:
                f = r.Actions.MoveToFolder.Folder
                if f is None:
                    return "None"
                return f"{f.Name!r} path={f.FolderPath!r}"
            except Exception as e:
                return f"FAIL {e!r}"[:100]
    return "<rule missing>"


def main() -> int:
    pythoncom.CoInitialize()
    app = win32com.client.Dispatch("Outlook.Application")
    ns = app.GetNamespace("MAPI")
    rules = ns.DefaultStore.GetRules()

    # get the working Amazon rule's action folder object
    amz_folder_obj = None
    for i in range(1, int(rules.Count) + 1):
        r = rules.Item(i)
        if r.Name == "Wildcard - Amazon":
            amz_folder_obj = r.Actions.MoveToFolder.Folder
            break
    print("Amazon action folder obj:", type(amz_folder_obj).__name__,
          amz_folder_obj.Name if amz_folder_obj else None)

    # a hierarchy folder for T2/T3
    trash = None
    for i in range(1, int(ns.Folders.Count) + 1):
        acc = ns.Folders.Item(i)
        for j in range(1, int(acc.Folders.Count) + 1):
            f = acc.Folders.Item(j)
            if f.Name.lower() == "trash":
                trash = f
                break
        if trash:
            break

    def run(tag, configure):
        name = f"ZZZ_T_{tag}"
        r = rules.Create(name, 0)
        try:
            configure(r)
            r.Enabled = True
            rules.Save()
            print(f"[{tag}] saved OK -> readback: {read_action_folder(rules, name)}")
        except Exception as e:
            print(f"[{tag}] FAIL {e!r}"[:160])
        finally:
            try:
                rules.Remove(name)
            except Exception:
                pass
    rules.Save()

    def t1(r):
        r.Actions.MoveToFolder.Folder = amz_folder_obj
    run("1_readobj", t1)

    def t2(r):
        r.Actions.MoveToFolder.Folder = trash.MAPIOBJECT
    run("2_mapiobj", t2)

    def t3(r):
        cond = r.Conditions.SenderAddress
        cond.Address = win32com.client.VARIANT(
            pythoncom.VT_ARRAY | pythoncom.VT_BSTR, ["example.com"])
        cond.Enabled = True
        r.Actions.MoveToFolder.Folder = trash
        # also try enabling the action explicitly
        try:
            r.Actions.MoveToFolder.Enabled = True
        except Exception as e:
            print("  (action.Enabled set failed:", repr(e)[:80], ")")
    run("3_full", t3)

    rules.Save()
    print("count now:", rules.Count)
    return 0


if __name__ == "__main__":
    sys.exit(main())
