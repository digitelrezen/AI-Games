#!/usr/bin/env python3
"""Focus Outlook main window, press F1 (expand ribbon), dump UIA tree, print Rule/Manage lines."""
import re
import sys
import time

from pywinauto import Desktop

sys.path.insert(0, r"C:\Dev\AI-GAMES\tools")

desk = Desktop(backend="uia")
match = None
for w in desk.windows():
    try:
        t = w.window_text()
    except Exception:
        continue
    if t and re.search(r"Inbox - digitel303.*Outlook", t):
        match = w
        break
if match is None:
    raise SystemExit("main window not found")

match.set_focus()
time.sleep(0.6)
match.type_keys("{F1}", pause=0.1)  # expand ribbon
time.sleep(1.5)

count = 0

def walk(el, depth, out):
    global count
    try:
        ei = el.element_info
        line = "{}{} name={!r} auto={} class={!r} rect={}".format(
            "  " * depth, ei.control_type, ei.name, ei.automation_id, ei.class_name, ei.rectangle)
    except Exception:
        return
    out.write(line + "\n")
    count += 1
    if depth >= 14:
        return
    try:
        kids = el.children()
    except Exception:
        return
    for k in kids:
        walk(k, depth + 1, out)

out = r"C:\Dev\AI-GAMES\tools\_tree_main2.txt"
with open(out, "w", encoding="utf-8") as f:
    walk(match, 0, f)
print(f"nodes={count}")
for i, line in enumerate(open(out, encoding="utf-8"), 1):
    if re.search(r"Rule|Manage Rules", line):
        print(f"{i}: {line.rstrip()[:160]}")
