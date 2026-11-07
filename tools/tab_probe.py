#!/usr/bin/env python3
"""Click each ribbon tab (and File backstage), dump tree, grep for 'Rule' to locate
the 'Manage Rules & Alerts' command in this Outlook build."""
import re
import sys
import time

sys.path.insert(0, r"C:\Dev\AI-GAMES\tools")
from uiautil import find_window, search_node, dump_tree  # noqa: E402

main = find_window(r"Inbox - digitel303.*Outlook")
if main is None:
    raise SystemExit("main window not found")
main.set_focus()
time.sleep(0.5)
main.type_keys("{ESC}", pause=0.1)
time.sleep(0.3)

tabs = [
    ("FileTabButton", "file"),
    ("TabSendReceive", "sndrcv"),
    ("TabView", "view"),
    ("HelpTab", "help"),
    ("TabMail", "home2"),
]

for auto, tag in tabs:
    tab = search_node(main, auto=auto)
    if tab is None:
        print(f"[{tag}] tab not found")
        continue
    tab.click_input()
    time.sleep(1.2)
    path = rf"C:\Dev\AI-GAMES\tools\_tree_tab_{tag}.txt"
    n, e = dump_tree(main, path)
    hits = [l.rstrip()[:190] for l in open(path, encoding="utf-8") if re.search(r"rule", l, re.IGNORECASE)]
    print(f"[{tag}] nodes={n} rule-hits={len(hits)}")
    for h in hits[:12]:
        print("   ", h)
    main.type_keys("{ESC}", pause=0.1)
    time.sleep(0.3)
