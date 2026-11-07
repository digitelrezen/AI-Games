#!/usr/bin/env python3
"""Dump a window's UIA tree by HWND (pywinauto 0.6.9)."""
import sys
import time

from pywinauto import Desktop

hwnd = int(sys.argv[1])
outpath = sys.argv[2]
max_depth = int(sys.argv[3]) if len(sys.argv) > 3 else 20

desk = Desktop(backend="uia")
w = desk.window(handle=hwnd)
print("text:", w.window_text(), "class:", w.element_info.class_name)

count = 0
errors = 0


def walk(el, depth, out):
    global count, errors
    try:
        ei = el.element_info
        line = "{}{} name={!r} auto={} class={!r} rect={}".format(
            "  " * depth, ei.control_type, ei.name, ei.automation_id, ei.class_name, ei.rectangle)
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


with open(outpath, "w", encoding="utf-8") as f:
    walk(w, 0, f)
print(f"wrote {outpath} nodes={count} errors={errors}")
