#!/usr/bin/env python3
"""Find the 'Rules' button in Outlook's ribbon via UIA and click it, then
look for the 'Manage Rules & Alerts' item in the popup. Text-only dumps."""
import sys
import time

from pywinauto import Desktop


def find_main():
    for backend in ("uia", "win32"):
        d = Desktop(backend=backend)
        for w in d.windows():
            try:
                t = w.window_text()
            except Exception:
                continue
            if "Outlook" in t:
                return w, backend
    return None, None


def walk(elem, depth=0, max_depth=6, hits=None, out=None):
    hits = hits if hits is not None else []
    out = out if out is not None else []
    try:
        name = elem.element_info.name or ""
        ct = elem.element_info.control_type
    except Exception:
        return hits, out
    if depth > 0:
        out.append("  " * depth + f"[{ct}] {name[:70]!r}")
    low = name.lower()
    if any(k in low for k in ("rules", "manage", "home", "rules and alerts")):
        hits.append((depth, ct, name[:80], elem))
    if depth >= max_depth:
        return hits, out
    try:
        kids = elem.children()
    except Exception:
        return hits, out
    for k in kids:
        walk(k, depth + 1, max_depth, hits, out)
    return hits, out


def main() -> int:
    w, backend = find_main()
    if w is None:
        print("no outlook window")
        return 1
    print("main:", w.window_text(), "backend:", backend)
    w.set_focus()
    time.sleep(1)

    out = []
    hits, out = walk(w, max_depth=7)
    path = r"C:\Dev\AI-GAMES\tools\_mainwin_tree.txt"
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(out))
    print(f"tree dumped ({len(out)} lines) -> {path}")
    print("\n=== HITS (rules/manage/home) ===")
    for d, ct, name, elem in hits[:40]:
        print(f"  depth={d} [{ct}] {name!r}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
