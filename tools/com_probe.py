#!/usr/bin/env python3
"""Defensive COM Rules API probe: each step isolated."""
import sys
import win32com.client
import pythoncom

pythoncom.CoInitialize()
app = None
try:
    app = win32com.client.Dispatch("Outlook.Application")
    print("dispatch ok; version:", getattr(app, "Version", "?"))

    ns = app.GetNamespace("MAPI")
    print("namespace ok")

    store = None
    try:
        store = ns.DefaultStore
        print("DefaultStore ok; name:", store.DisplayName)
    except Exception as e:
        print("DefaultStore FAIL:", repr(e))

    # try all top-level folders for one that has Rules
    rules = None
    try:
        rules = store.GetRules()
        print("store.GetRules OK; count:", rules.Count)
    except Exception as e:
        print("store.GetRules FAIL:", repr(e))
        print("-- trying folders --")
        root = None
        try:
            root = ns.Folders
        except Exception as e2:
            print("ns.Folders FAIL:", repr(e2))
        if root is not None:
            for i in range(1, root.Count + 1):
                try:
                    f = root.Item(i)
                except Exception:
                    continue
                try:
                    r2 = f.GetRules()
                    print(f"folder {f.Name!r} rules count:", r2.Count)
                    if rules is None:
                        rules = r2
                except Exception as e3:
                    print(f"folder {f.Name!r} GetRules FAIL:", repr(e3))

    if rules is not None:
        n = rules.Count
        print("TOTAL RULES:", n)
        sample = min(n, 8)
        for i in range(1, sample + 1):
            r = rules.Item(i)
            name = "?"
            enabled = "?"
            sender = "?"
            move_to = "?"
            try:
                name = r.Name
            except Exception as e:
                name = f"<err {e!r}>"
            try:
                enabled = r.Enabled
            except Exception:
                pass
            try:
                sender = r.Conditions.SenderAddress.Text
            except Exception:
                pass
            try:
                move_to = r.Actions.MoveToFolder.Folder.Name
            except Exception:
                pass
            print(f"  [{i}] name={name!r} enabled={enabled} sender={sender!r} move_to={move_to!r}")
except Exception as e:
    print("TOP-LEVEL FAIL:", repr(e))
finally:
    try:
        pythoncom.CoUninitialize()
    except Exception:
        pass
