#!/usr/bin/env python3
"""Dump a classic Win32 dialog's full child control tree (win32 API enumeration).

Usage: python win32dump.py <exact_title_or_regex> [outfile]
"""
import re
import sys
import win32gui

title_arg = sys.argv[1]
outpath = sys.argv[2] if len(sys.argv) > 2 else None

hwnd = None
if re.fullmatch(r"\d+", title_arg):
    hwnd = int(title_arg)
else:
    found = []

    def cb(h, _):
        if win32gui.IsWindowVisible(h) and re.search(title_arg, win32gui.GetWindowText(h)):
            found.append(h)

    win32gui.EnumWindows(cb, None)
    if not found:
        raise SystemExit(f"no visible window matching {title_arg!r}")
    hwnd = found[0]

print("window:", hwnd, win32gui.GetWindowText(hwnd), win32gui.GetClassName(hwnd), win32gui.GetWindowRect(hwnd))

lines = []


def walk(h, depth):
    cls = win32gui.GetClassName(h)
    txt = win32gui.GetWindowText(h)
    rect = win32gui.GetWindowRect(h)
    vis = win32gui.IsWindowVisible(h)
    style = win32gui.GetWindowLong(h, win32con.GWL_STYLE) if hasattr(win32gui, "GetWindowLong") else 0
    lines.append(f"{'  ' * depth}hwnd={h} {cls} vis={vis} rect={rect} text={txt[:90]!r}")

    def cb(ch, _):
        walk(ch, depth + 1)
        return True

    try:
        win32gui.EnumChildWindows(h, cb, None)
    except Exception as e:
        lines.append(f"{'  ' * depth}(enum error: {e})")


import win32con  # noqa: E402

walk(hwnd, 0)
text = "\n".join(lines)
if outpath:
    with open(outpath, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"wrote {outpath} ({len(lines)} controls)")
else:
    print(text)
