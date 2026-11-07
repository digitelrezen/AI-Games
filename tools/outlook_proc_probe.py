#!/usr/bin/env python3
"""Check OUTLOOK process state and enumerate ALL windows (incl. invisible) it owns."""
import psutil
import win32gui
import win32process

procs = [p for p in psutil.process_iter(["pid", "name", "create_time", "exe"]) if p.info["name"] and "outlook" in p.info["name"].lower()]
if not procs:
    print("NO OUTLOOK PROCESS RUNNING")
else:
    for p in procs:
        print(f"process pid={p.pid} name={p.info['name']} created={p.info['create_time']:.0f} exe={p.info['exe']}")
        try:
            print("  threads:", p.num_threads(), "status:", p.status())
        except Exception as e:
            print("  (proc query err:", e, ")")
        owned = []

        def cb(h, _):
            try:
                _, pid = win32process.GetWindowThreadProcessId(h)
            except Exception:
                return
            if pid == p.pid:
                title = win32gui.GetWindowText(h)
                cls = win32gui.GetClassName(h)
                vis = win32gui.IsWindowVisible(h)
                try:
                    r = win32gui.GetWindowRect(h)
                except Exception:
                    r = None
                owned.append((h, cls, vis, title, r))

        win32gui.EnumWindows(cb, None)
        if not owned:
            print("  -> owns NO top-level windows")
        for h, cls, vis, title, r in owned:
            print(f"  hwnd={h} class={cls} visible={vis} rect={r} title={title[:80]!r}")
