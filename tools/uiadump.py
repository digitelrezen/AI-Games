#!/usr/bin/env python3
"""Dump a window's UIA tree (custom walker, pywinauto 0.6.9 compatible).

Usage: python uiadump.py <title_regex> <outfile> [max_depth]
"""
import re
import sys
import time

from pywinauto import Desktop

title_re, outfile = sys.argv[1], sys.argv[2]
max_depth = int(sys.argv[3]) if len(sys.argv) > 3 else 14

desk = Desktop(backend="uia")
match = None
for w in desk.windows():
    try:
        t = w.window_text()
    except Exception:
        continue
    if t and re.search(title_re, t):
        match = w
        break
if match is None:
    print("NO WINDOW MATCHING", title_re)
    raise SystemExit(1)

print("matched:", match.window_text(), "hwnd=", match.handle)
match.set_focus()
time.sleep(0.8)

count = 0
errors = 0

def walk(el, depth, out):
    global count, errors
    try:
        ei = el.element_info
        line = "{}{} name={!r} auto={} class={!r} rect={}".format(
            "  " * depth,
            ei.control_type,
            ei.name,
            ei.automation_id,
            ei.class_name,
            ei.rectangle,
        )
    except Exception:
        errors += 1
        return
    out.write(line + "\n")
    count += 1
    if depth >= max_depth:
        return
    try:
        kids = el.children()
    except Exception:
        errors += 1
        return
    for k in kids:
        walk(k, depth + 1, out)

with open(outfile, "w", encoding="utf-8") as f:
    walk(match, 0, f)
print(f"wrote {outfile} nodes={count} errors={errors}")
