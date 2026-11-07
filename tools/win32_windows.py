#!/usr/bin/env python3
"""List all visible top-level windows with owning process. Helper for GUI automation."""
import sys
import win32gui
import win32process
import psutil


def main() -> None:
    found = []

    def cb(hwnd, _):
        if win32gui.IsWindowVisible(hwnd):
            title = win32gui.GetWindowText(hwnd).strip()
            if title:
                try:
                    pid = win32process.GetProcessId(hwnd)
                    name = psutil.Process(pid).name()
                except Exception:
                    name = "?"
                found.append((hwnd, name, title))

    win32gui.EnumWindows(cb, None)
    for hwnd, name, title in sorted(found, key=lambda x: (x[1], x[2])):
        print(f"{hwnd:>10} | {name:<20} | {title[:120]}")


if __name__ == "__main__":
    sys.exit(main())
