#!/usr/bin/env python3
"""Step-by-step COM probe: find which rule condition/action access patterns and
deletion methods work in THIS Outlook build. Creates one test rule, tests each
step, then removes the test rule (and reports how)."""
import sys
import pythoncom
import win32com.client

NAME = "ZZZ_STEP_PROBE"


def enumerate1(coll):
    try:
        n = int(coll.Count)
    except Exception:
        return
    for i in range(1, n + 1):
        try:
            yield coll.Item(i)
        except Exception:
            pass


def try_step(label, fn):
    try:
        r = fn()
        print(f"  OK   {label}")
        return r
    except Exception as e:
        print(f"  FAIL {label}: {e!r}")
        return None


def main() -> int:
    pythoncom.CoInitialize()
    app = win32com.client.Dispatch("Outlook.Application")
    ns = app.GetNamespace("MAPI")
    rules = ns.DefaultStore.GetRules()
    print("rule count:", rules.Count)

    # find a real folder to use for the move action (e.g. Inbox)
    folder = None
    for f in enumerate1(ns.Folders):
        try:
            if f.Name.lower() in ("inbox", "outbox", "sent items"):
                folder = f
                print("using folder:", f.Name)
                break
        except Exception:
            pass
    if folder is None:
        # fall back to first subfolder of first account
        try:
            folder = ns.Folders.Item(1).Folders.Item(1)
            print("using folder (fallback):", folder.Name)
        except Exception as e:
            print("no folder found:", e)

    rule = rules.Create(NAME, 0)
    print("created test rule:", rule.Name)

    print("--- CONDITIONS access ---")
    c = try_step('Conditions["From"] (string key)', lambda: rule.Conditions["From"])
    if c is None:
        c = try_step("Conditions.SenderAddress (named)", lambda: rule.Conditions.SenderAddress)
    if c is None:
        c = try_step("Conditions[3] (int enum olConditionFrom)", lambda: rule.Conditions[3])
    if c is None:
        c = try_step("Conditions[0] (int enum)", lambda: rule.Conditions[0])

    if c is not None:
        try_step("cond.Enabled = True", lambda: setattr(c, "Enabled", True))
        inc = try_step("cond.IncludeNames", lambda: c.IncludeNames)
        if inc is not None:
            try_step('IncludeNames.Add("example.com")', lambda: inc.Add("example.com"))
            try_step("IncludeNames count", lambda: inc.Count)

    print("--- ACTIONS access ---")
    a = try_step('Actions["MoveToFolder"] (string key)', lambda: rule.Actions["MoveToFolder"])
    if a is None:
        a = try_step("Actions.MoveToFolder (named)", lambda: rule.Actions.MoveToFolder)
    if a is None:
        a = try_step("Actions[21] (int enum olActionMoveToFolder)", lambda: rule.Actions[21])
    if a is not None and folder is not None:
        try_step("action.Folder = <folder>", lambda: setattr(a, "Folder", folder))

    print("--- RULE-level ---")
    try_step("StopProcessingOnErrors = False", lambda: setattr(rule, "StopProcessingOnErrors", False))
    try_step("Enabled = True", lambda: setattr(rule, "Enabled", True))
    try_step("rule.Save()", lambda: rule.Save())

    print("--- DELETION methods ---")
    def del_by_name():
        rules.Delete(NAME)
    def find_index():
        for i, r in enumerate1(rules):
            if r.Name == NAME:
                return i
        return None
    idx = None
    try:
        idx = find_index()
    except Exception as e:
        print("  find_index fail", e)
    print("  test rule index:", idx)
    if try_step("rules.Delete(NAME) by name", del_by_name) is not None:
        print("  deleted by name OK")
    else:
        if idx:
            if try_step(f"rules.Delete({idx}) by index", lambda: rules.Delete(idx)) is not None:
                print("  deleted by index OK")
            else:
                try_step("rule.Delete()", lambda: rule.Delete())

    # final state
    still = any(r.Name == NAME for r in enumerate1(rules))
    print("test rule still present:", still)
    print("final rule count:", rules.Count)
    for r in enumerate1(rules):
        print("   -", r.Name, "enabled=", r.Enabled)
    return 0


if __name__ == "__main__":
    sys.exit(main())
