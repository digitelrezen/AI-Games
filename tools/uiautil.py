#!/usr/bin/env python3
"""Shared UIA helpers for pywinauto 0.6.9 (no child_window/print_control_identifiers)."""
import re
import time

from pywinauto import Desktop


def find_window(title_re):
    """Find a top-level window whose title matches the regex."""
    for w in Desktop(backend="uia").windows():
        try:
            t = w.window_text()
        except Exception:
            continue
        if t and re.search(title_re, t):
            return w
    return None


def search_node(root, name=None, auto=None, ctrl=None, name_re=None, cls=None):
    """BFS search of a UIA subtree; returns first wrapper matching all given criteria."""
    def check(w):
        try:
            ei = w.element_info
        except Exception:
            return False
        if auto is not None and ei.automation_id != auto:
            return False
        if ctrl is not None and ei.control_type != ctrl:
            return False
        if name is not None and ei.name != name:
            return False
        if name_re is not None and not re.search(name_re, ei.name or ""):
            return False
        if cls is not None and ei.class_name != cls:
            return False
        return True

    frontier = [root]
    while frontier:
        nxt = []
        for w in frontier:
            try:
                if check(w):
                    return w
            except Exception:
                pass
            try:
                nxt.extend(w.children())
            except Exception:
                pass
        frontier = nxt
    return None


def dump_tree(root, path, max_depth=16):
    """Write the full UIA tree to path; return (node_count, error_count)."""
    count = 0
    errors = 0

    def walk(el, depth, out):
        nonlocal count, errors
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

    with open(path, "w", encoding="utf-8") as f:
        walk(root, 0, f)
    return count, errors


def wait_window(title_re, timeout=15, interval=0.5):
    """Poll until a top-level window matching title_re appears."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        w = find_window(title_re)
        if w:
            return w
        time.sleep(interval)
    return None
