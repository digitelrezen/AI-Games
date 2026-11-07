#!/usr/bin/env python3
"""Decisive test: force-run the 'Wildcard - Amazon' rule against the Inbox via
rule.Execute(folder) (programmatic 'Run Rules Now'), then check whether the
known Amazon messages moved out of the inbox / into the Amazon folder."""
import sys
import pythoncom
import win32com.client


def count_senders(items, pred):
    n = int(items.Count)
    c = 0
    for i in range(1, n + 1):
        try:
            m = items.Item(i)
            addr = (m.SenderEmailAddress or "").lower()
            name = (m.SenderName or "").lower()
        except Exception:
            continue
        if pred(addr, name):
            c += 1
    return c


def is_amazon(addr, name):
    return "amazon" in addr or "amazon" in name


def main() -> int:
    pythoncom.CoInitialize()
    app = win32com.client.Dispatch("Outlook.Application")
    ns = app.GetNamespace("MAPI")
    inbox = ns.GetDefaultFolder(6)
    rules = ns.DefaultStore.GetRules()

    rule = None
    for i in range(1, int(rules.Count) + 1):
        r = rules.Item(i)
        if r.Name == "Wildcard - Amazon":
            rule = r
            break
    if rule is None:
        print("Wildcard - Amazon rule NOT FOUND")
        return 1
    print(f"found rule, enabled={rule.Enabled}")

    before = count_senders(inbox.Items, is_amazon)
    print(f"amazon-ish messages in inbox BEFORE: {before}")

    print("calling rule.Execute(inbox) ...")
    try:
        rule.Execute(inbox)
        print("Execute returned OK")
    except Exception as e:
        print(f"Execute FAILED: {e!r}")
        return 2

    after = count_senders(inbox.Items, is_amazon)
    print(f"amazon-ish messages in inbox AFTER: {after}")

    # check Amazon folder
    amz_folder = None
    for i in range(1, int(ns.Folders.Count) + 1):
        acc = ns.Folders.Item(i)
        for j in range(1, int(acc.Folders.Count) + 1):
            f = acc.Folders.Item(j)
            if f.Name.lower() == "amazon":
                amz_folder = f
                break
        if amz_folder:
            break
    if amz_folder is not None:
        print(f"Amazon folder item count now: {int(amz_folder.Items.Count)}")
    else:
        print("Amazon folder: not found")

    if after < before:
        print("RESULT: RULE WORKS — mail moved. Patterns are fine; existing "
              "inbox just needs Execute (done for Amazon).")
    else:
        print("RESULT: RULE DID NOT MOVE MAIL — matching/execution problem in "
              "this build; patterns or engine need different approach.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
