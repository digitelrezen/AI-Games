#!/usr/bin/env python3
"""Use Outlook's top-right search box to surface the 'Manage Rules & Alerts' command.

Focus main window -> click search edit -> type query -> wait -> dump UIA tree
(main window + any new top-level popups) -> print candidate lines.
"""
import re
import sys
import time

sys.path.insert(0, r"C:\Dev\AI-GAMES\tools")
from uiautil import find_window, search_node, dump_tree  # noqa: E402
from pywinauto import Desktop  # noqa: E402

main = find_window(r"Inbox - digitel303.*Outlook")
if main is None:
    raise SystemExit("main window not found")

main.set_focus()
time.sleep(0.8)

search = search_node(main, auto="SearchTextBox")
if search is None:
    raise SystemExit("search box not found")
print("search rect:", search.element_info.rectangle)
search.click_input()
time.sleep(0.8)
search.set_focus()
time.sleep(0.3)
search.type_keys("manage rules & alerts", pause=0.04)
time.sleep(2.5)

n, e = dump_tree(main, r"C:\Dev\AI-GAMES\tools\_tree_search.txt")
print(f"main nodes={n} errors={e}")
for i, line in enumerate(open(r"C:\Dev\AI-GAMES\tools\_tree_search.txt", encoding="utf-8"), 1):
    if re.search(r"rule", line, re.IGNORECASE):
        print(f"MAIN {i}: {line.rstrip()[:200]}")

print("--- top-level windows now ---")
for w in Desktop(backend="uia").windows():
    try:
        t = w.window_text()
    except Exception:
        continue
    if t:
        print("TOP:", t[:110])
