#!/usr/bin/env python3
"""Scan ALL Inbox items; collect real sender addresses; aggregate by domain.
Ground truth for building matching patterns. Prints the first item's COM
surface once, then per-item senders for the 8 target folders, then a
domain histogram."""
import sys
import pythoncom
import win32com.client
from collections import Counter, defaultdict

TARGET_KEYWORDS = ["amazon", "express", "aexp", "furniture", "afw", "paypal",
                   "etrade", "e*trade", "pnc", "state farm", "statefarm",
                   "rocket", "xcel", "samsung", "usps", "ups", "nord",
                   "no-ip", "domain.com", "tp-link", "zelle", "security"]


def main() -> int:
    pythoncom.CoInitialize()
    app = win32com.client.Dispatch("Outlook.Application")
    ns = app.GetNamespace("MAPI")
    inbox = ns.GetDefaultFolder(6)
    items = inbox.Items
    n = int(items.Count)
    print(f"inbox item count: {n}")

    first = items.Item(1)
    print("item dir:", [a for a in dir(first) if not a.startswith("_")][:60])
    print()

    domain_count = Counter()
    target_senders = defaultdict(set)
    read_fail = 0
    for i in range(1, n + 1):
        try:
            m = items.Item(i)
        except Exception:
            continue
        try:
            name = m.SenderName
        except Exception:
            name = "?"
        try:
            addr = (m.SenderEmailAddress or "").strip()
        except Exception:
            read_fail += 1
            addr = ""
        key = f"{name!r} <{addr}>"
        if addr and "@" in addr:
            dom = addr.rsplit("@", 1)[1].lower()
            domain_count[dom] += 1
        low = (str(name) + " " + addr).lower()
        for kw in TARGET_KEYWORDS:
            if kw in low:
                target_senders[kw].add(key)
                break
    print(f"sender address read failures: {read_fail}")
    print("\n=== TOP DOMAINS IN INBOX ===")
    for dom, c in domain_count.most_common(40):
        print(f"  {c:>4}  {dom}")
    print("\n=== SENDERS HITTING TARGET FOLDER KEYWORDS ===")
    for kw in TARGET_KEYWORDS:
        if kw in target_senders:
            print(f"[{kw}]")
            for s in sorted(target_senders[kw])[:12]:
                print(f"   {s}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
