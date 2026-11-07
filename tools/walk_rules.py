#!/usr/bin/env python3
"""Walk the Rules dialog grid with the Down arrow; capture the per-rule
'description' lines (authoritative sender conditions) for all 183 rules.

Verifies grid row order matches the COM snapshot (rules_snapshot.json).
Writes rules_descriptions.json.
"""
import json
import sys
import time
import win32gui

sys.path.insert(0, r"C:\Dev\AI-GAMES\tools")
from uiautil import search_node  # noqa: E402
from pywinauto import Desktop  # noqa: E402

SNAP = r"C:\Dev\AI-GAMES\tools\rules_snapshot.json"
OUT = r"C:\Dev\AI-GAMES\tools\rules_descriptions.json"

with open(SNAP, encoding="utf-8") as f:
    snap = json.load(f)
com_names = [r["name"] for r in snap["rules"]]
print("com rules:", len(com_names))

dlg_hwnd = win32gui.FindWindow("#32770", "Rules and Alerts")
if not dlg_hwnd:
    raise SystemExit("Rules dialog not found")
desk = Desktop(backend="uia")
dlg = desk.window(handle=dlg_hwnd)
dlg.set_focus()
time.sleep(0.5)

grid = search_node(dlg, name="Rule List")
if grid is None:
    raise SystemExit("grid not found")
first_item = search_node(grid, ctrl="DataItem")
if first_item is None:
    raise SystemExit("no data items")
first_item.click_input()
time.sleep(0.6)

desc_box = search_node(dlg, cls="REListBox20W")
if desc_box is None:
    raise SystemExit("description listbox not found")


def desc_lines():
    texts = []
    try:
        items = desc_box.descendants(control_type="ListItem")
    except Exception:
        items = []
    seen = set()
    for it in items:
        try:
            t = it.window_text().strip()
        except Exception:
            continue
        if t and t not in seen:
            seen.add(t)
            texts.append(t)
    return texts


def rendered_names():
    names = []
    try:
        for ch in grid.children():
            try:
                if ch.element_info.control_type == "DataItem":
                    names.append(ch.element_info.name)
            except Exception:
                pass
    except Exception:
        pass
    return names


records = []
no_change_streak = 0
prev = None
MAX_STEPS = 220

# sanity: first selected rule should be com_names[0]
d0 = desc_lines()
r0 = rendered_names()
print("initial desc:", d0)
print("initial rendered:", r0[:3], "...")

for i in range(MAX_STEPS):
    desc = desc_lines()
    rendered = rendered_names()
    records.append({"index": i, "desc": desc, "rendered": rendered})
    if desc != prev:
        no_change_streak = 0
    else:
        no_change_streak += 1
    prev = desc
    if no_change_streak >= 4 and i >= 150:
        print(f"end of list detected at step {i}")
        break
    # focus guard: {DOWN} must land in the dialog (foreground must be the dialog)
    try:
        fg = win32gui.GetForegroundWindow()
        root = win32gui.GetAncestor(fg, 2)  # GA_ROOT
    except Exception:
        root = 0
    if root != dlg_hwnd:
        print(f"FOREGROUND LOST at step {i} (root={root} != {dlg_hwnd}); aborting for clean restart")
        break
    grid.type_keys("{DOWN}", pause=0.03)
    time.sleep(0.16)

with open(OUT, "w", encoding="utf-8") as f:
    json.dump({"steps": len(records), "records": records}, f, indent=1, ensure_ascii=False)
print("wrote", OUT, "steps:", len(records))

# --- alignment check: stitch rendered names, compare with com_names ---
stitched = []
seen = set()
for rec in records:
    for nm in rec["rendered"]:
        core = nm.split(", Rule Actions:", 1)[0]
        core = core[len("Active Rule, "):] if core.startswith("Active Rule, ") else core
        if core not in seen:
            seen.add(core)
            stitched.append(core)
mismatch = 0
n = min(len(stitched), len(com_names))
for j in range(n):
    if stitched[j] != com_names[j]:
        mismatch += 1
        if mismatch <= 5:
            print(f"ALIGN MISMATCH @{j}: grid={stitched[j]!r} com={com_names[j]!r}")
print(f"stitched={len(stitched)} com={len(com_names)} mismatches={mismatch}")
