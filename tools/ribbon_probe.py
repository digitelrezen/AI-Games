#!/usr/bin/env python3
"""Materialize the Outlook ribbon so the 'Rules' button appears in the UIA tree.

Tries in order: (1) click Home tab + F1, (2) double-click Home tab, (3) Alt keytips.
After each attempt, dumps the tree and reports whether a Rules button is visible.
"""
import re
import sys
import time

sys.path.insert(0, r"C:\Dev\AI-GAMES\tools")
from uiautil import find_window, search_node, dump_tree  # noqa: E402

main = find_window(r"Inbox - digitel303.*Outlook")
if main is None:
    raise SystemExit("main window not found")

main.set_focus()
time.sleep(0.6)
main.type_keys("{ESC}", pause=0.1)  # clear search box
time.sleep(0.4)

home_tab = search_node(main, auto="TabMail")
print("home tab rect:", home_tab.element_info.rectangle if home_tab else None)


def ribbon_state(tag):
    path = rf"C:\Dev\AI-GAMES\tools\_tree_{tag}.txt"
    n, e = dump_tree(main, path)
    rule_lines = [l.rstrip()[:200] for l in open(path, encoding="utf-8") if re.search(r"\brules?\b", l, re.IGNORECASE)]
    print(f"[{tag}] nodes={n} rule-lines={len(rule_lines)}")
    for l in rule_lines[:10]:
        print("   ", l)
    return rule_lines


# Attempt 1: click Home tab, then F1
if home_tab:
    home_tab.click_input()
    time.sleep(0.6)
main.type_keys("{F1}", pause=0.1)
time.sleep(1.2)
if ribbon_state("f1"):
    sys.exit(0)

# Attempt 2: double-click Home tab
if home_tab:
    home_tab.double_click_input()
    time.sleep(1.2)
if ribbon_state("dblclk"):
    sys.exit(0)

# Attempt 3: Alt keytips
main.type_keys("%{ESC}", pause=0.2)  # reset
time.sleep(0.5)
main.type_keys("%", pause=0.2)
time.sleep(1.5)
if ribbon_state("alt"):
    sys.exit(0)

print("FAILED to materialize ribbon content")
