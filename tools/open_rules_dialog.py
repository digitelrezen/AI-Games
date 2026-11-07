#!/usr/bin/env python3
"""Open the 'Rules and Alerts' dialog via File backstage, then dump its UIA tree."""
import re
import sys
import time

sys.path.insert(0, r"C:\Dev\AI-GAMES\tools")
from uiautil import find_window, search_node, dump_tree, wait_window  # noqa: E402
from pywinauto import Desktop  # noqa: E402

main = find_window(r"Inbox - digitel303.*Outlook")
if main is None:
    raise SystemExit("main window not found")
main.set_focus()
time.sleep(0.5)
main.type_keys("{ESC}", pause=0.1)
time.sleep(0.3)

# 1) File backstage
filetab = search_node(main, auto="FileTabButton")
filetab.click_input()
time.sleep(1.5)

# 2) Manage Rules & Alerts button
btn = search_node(main, name_re=r"Manage Rules & Alerts")
if btn is None:
    dump_tree(main, r"C:\Dev\AI-GAMES\tools\_tree_file2.txt")
    raise SystemExit("Manage Rules & Alerts button not found; dumped _tree_file2.txt")
print("button rect:", btn.element_info.rectangle)
btn.click_input()
time.sleep(1.0)

# 3) Wait for the dialog
dlg = wait_window(r"Rules and Alerts", timeout=20)
if dlg is None:
    print("dialog window not found; top-level windows:")
    for w in Desktop(backend="uia").windows():
        try:
            t = w.window_text()
        except Exception:
            continue
        if t:
            print("TOP:", t[:110])
    raise SystemExit("no dialog")

print("DIALOG:", dlg.window_text(), "hwnd=", dlg.handle, "rect=", dlg.rectangle())
dlg.set_focus()
time.sleep(0.8)
n, e = dump_tree(dlg, r"C:\Dev\AI-GAMES\tools\_tree_rulesdlg.txt", max_depth=20)
print(f"nodes={n} errors={e}")
