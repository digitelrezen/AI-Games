#!/usr/bin/env python3
"""Step 1: open Outlook's 'Manage Rules & Alerts' dialog via ribbon keystrokes
(Alt+H, R, M) and dump the dialog's control tree (text) for analysis."""
import sys
import time

from pywinauto import Desktop


def find_outlook_main():
    d = Desktop(backend="win32")
    for w in d.windows():
        try:
            t = w.window_text()
        except Exception:
            continue
        if "Outlook" in t and ("Inbox" in t or "Outlook" == t.strip()):
            return w
    # fallback: any window with Outlook in title
    for w in d.windows():
        try:
            if "Outlook" in w.window_text():
                return w
        except Exception:
            continue
    return None


def dump_tree(win, depth=0, max_depth=4, out=None):
    lines = []
    try:
        kids = win.children()
    except Exception:
        return lines
    for k in kids:
        try:
            ct = k.element_info.control_type
        except Exception:
            ct = "?"
        try:
            name = k.window_text()[:80]
        except Exception:
            name = ""
        lines.append("  " * depth + f"[{ct}] {name!r}")
        if depth < max_depth:
            lines.extend(dump_tree(k, depth + 1, max_depth))
    return lines


def main() -> int:
    win = find_outlook_main()
    if win is None:
        print("Outlook main window not found")
        return 1
    print("focusing:", win.window_text())
    win.set_focus()
    time.sleep(1)

    # Ribbon: Home tab -> Rules button -> Manage Rules & Alerts
    win.type_keys("%h")   # Alt+H  (Home tab)
    time.sleep(0.8)
    win.type_keys("r")    # Rules dropdown
    time.sleep(0.8)
    win.type_keys("m")    # Manage Rules & Alerts
    print("sent keystrokes, waiting for dialog...")

    d = Desktop(backend="win32")
    dlg = None
    for _ in range(30):
        time.sleep(0.5)
        for w in d.windows():
            try:
                t = w.window_text()
            except Exception:
                continue
            if t.strip() == "Manage Rules & Alerts":
                dlg = w
                break
        if dlg:
            break
    if dlg is None:
        print("DIALOG DID NOT APPEAR")
        return 2
    print("dialog found:", dlg.window_text())
    dlg.set_focus()
    time.sleep(1)

    out = []
    out.extend(dump_tree(dlg, max_depth=5))
    path = r"C:\Dev\AI-GAMES\tools\_rulesdlg_tree2.txt"
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(out))
    print(f"tree dumped ({len(out)} lines) -> {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
