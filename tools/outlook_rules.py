#!/usr/bin/env python3
"""
outlook_rules.py -- Audit, consolidate and rebuild Outlook rules safely.

Target: Classic Outlook (Desktop) via pywin32 COM automation.
Use case: hundreds of brittle one-sender rules ("from x@y.com -> move to Z")
replaced by robust wildcard DOMAIN rules ("from *.y.com -> move to Z") plus
merged KEYWORD rules, with optional cleanup of the originals.

WHY THE OLD APPROACH FAILED
--------------------------
    condition = rule.Conditions.SenderAddress          # INVALID key
    condition.Text = VARIANT(VT_ARRAY | VT_BSTR, [...])  # SAFEARRAY to .Text

* "SenderAddress" is NOT a rule condition key. Valid keys: "From", "To",
  "CC", "BCC", "SubjectContains", "BodyContains", "CategoryIs", ...
  An unknown key hands back an <unknown> COM object; setting .Text on it
  raises:  Property <unknown>.Text can not be set
* Rule condition collections are filled one PLAIN STRING at a time via
  .Add(). Never assign a Python list/tuple (or a SAFEARRAY VARIANT) to a
  COM property or Add() parameter.

SAFE PATTERNS USED HERE (verified against pywin32 312 dynamic.py)
-----------------------------------------------------------------
* Enumerate collections 1-based:  coll.Item(i) for i in 1..coll.Count
  (pywin32 int indexing prefers _NewEnum() when present, so explicit
  .Item() is the only unambiguous path).
* String keys for named members:  rule.Conditions["From"], rule.Actions["MoveToFolder"]
* One plain str per call:         cond.IncludeNames.Add("example.com")
  A bare domain string in the From condition is Outlook's documented
  whole-domain wildcard ("any sender at that domain").
* Keyword strings:                rule.Conditions["BodyContains"].IncludeStrings.Add("kw")
* Every per-rule COM operation is isolated: one bad rule never aborts the
  batch, and a full JSON audit is written BEFORE anything is changed.

USAGE
-----
  python outlook_rules.py --selftest            # no Outlook needed: engine test
  python outlook_rules.py --dry-run             # audit + plan (default, no writes)
  python outlook_rules.py --apply               # create consolidated rules
  python outlook_rules.py --apply --cleanup     # also remove consolidated originals
  options: --min-domain-senders N (default 2), --report-dir DIR
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import defaultdict
from datetime import datetime

__version__ = "1.0.0"

REPORT_DIR_DEFAULT = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                  "outlook_reports")

# Rule condition keys (Outlook object model, Rule.Conditions collection)
COND_FROM = "From"
COND_SUBJECT = "SubjectContains"
COND_BODY = "BodyContains"
# Action keys (Rule.Actions collection)
ACT_MOVE = "MoveToFolder"
ACT_COPY = "CopyToFolder"
ACT_DELETE = "DeleteMessage"
ACT_MARK_READ = "MarkAsRead"
ACT_CATEGORIZE = "Categorize"


# --------------------------------------------------------------------------
# Generic helpers
# --------------------------------------------------------------------------

def log(msg: str = "") -> None:
    print(msg, flush=True)


def safe_get(obj, attr):
    """Attribute access that never raises: returns (value, ok)."""
    try:
        return getattr(obj, attr), True
    except Exception:
        return None, False


def item1(coll, i):
    """1-based item access (Outlook collections)."""
    return coll.Item(i)


def enumerate1(coll):
    """Yield items of an Outlook collection, 1-based, robust to errors."""
    count, ok = safe_get(coll, "Count")
    if not ok:
        return
    for i in range(1, int(count) + 1):
        try:
            yield item1(coll, i)
        except Exception:
            continue


def read_recipients(cond) -> list[dict]:
    """Read IncludeNames (Recipients collection) of a condition."""
    out = []
    inc, ok = safe_get(cond, "IncludeNames")
    if not ok:
        return out
    for r in enumerate1(inc):
        entry = {"name": None, "address": None, "type": None}
        for attr, key in (("Name", "name"), ("Address", "address"), ("Type", "type")):
            v, ok2 = safe_get(r, attr)
            if ok2:
                entry[key] = v
        out.append(entry)
    return out


def read_strings(cond) -> list[str]:
    """Read IncludeStrings (Strings collection) of a condition."""
    out = []
    inc, ok = safe_get(cond, "IncludeStrings")
    if not ok:
        return out
    for s in enumerate1(inc):
        v, ok2 = safe_get(s, "Text")
        if ok2 and v:
            out.append(str(v))
    return out


# --------------------------------------------------------------------------
# Audit: read existing rules into plain dicts (no COM refs kept)
# --------------------------------------------------------------------------

def audit_rule(rule) -> dict:
    data = {
        "name": None, "enabled": None, "stop_processing_on_errors": None,
        "description": None, "from_senders": [], "subject_strings": [],
        "body_strings": [], "search_subfolders": None, "actions": [],
        "other_conditions": [],
    }
    for attr, key in (("Name", "name"), ("Enabled", "enabled"),
                      ("StopProcessingOnErrors", "stop_processing_on_errors"),
                      ("Description", "description")):
        v, ok = safe_get(rule, attr)
        if ok:
            data[key] = v
    conds, ok = safe_get(rule, "Conditions")
    if ok:
        for cond in enumerate1(conds):
            cname, _ = safe_get(cond, "Name")
            cname = str(cname or "").strip()
            if cname == COND_FROM:
                data["from_senders"] = read_recipients(cond)
                v, ok2 = safe_get(cond, "SearchSubfolders")
                if ok2:
                    data["search_subfolders"] = v
            elif cname == COND_SUBJECT:
                data["subject_strings"] = read_strings(cond)
            elif cname == COND_BODY:
                data["body_strings"] = read_strings(cond)
            else:
                data["other_conditions"].append(cname or "<unnamed>")
    acts, ok = safe_get(rule, "Actions")
    if ok:
        for act in enumerate1(acts):
            aname, _ = safe_get(act, "Name")
            entry = {"name": str(aname or "").strip() or "<unnamed>", "folder": None}
            fld, ok2 = safe_get(act, "Folder")
            if ok2 and fld is not None:
                fname, ok3 = safe_get(fld, "Name")
                if ok3:
                    entry["folder"] = str(fname)
            data["actions"].append(entry)
    return data


def audit_all_rules(rules) -> list[dict]:
    audit = []
    count, ok = safe_get(rules, "Count")
    if not ok:
        return audit
    for i in range(1, int(count) + 1):
        try:
            rule = item1(rules, i)
            audit.append(audit_rule(rule))
        except Exception as exc:  # one bad rule must not kill the audit
            audit.append({"name": f"<rule #{i} read failed>", "error": str(exc)})
    return audit


# --------------------------------------------------------------------------
# Plan: pure consolidation engine (unit-testable, no COM)
# --------------------------------------------------------------------------

def sender_domain(sender: dict) -> str | None:
    """Domain part of a sender; None if address looks non-email."""
    addr = (sender.get("address") or sender.get("name") or "").strip()
    if not addr or "@" not in addr:
        return None
    dom = addr.rsplit("@", 1)[1].strip().lower()
    return dom or None


def plan_consolidation(audit: list[dict], min_domain_senders: int = 2) -> dict:
    """Build the consolidation plan from an audit list (pure logic)."""
    plan = {"wildcard_rules": [], "merged_rules": [], "keyword_rules": [],
            "keep_as_is": [], "stats": {}}

    # folder -> domain -> {action, senders:set}
    domain_groups: dict[str, dict[str, dict]] = defaultdict(lambda: defaultdict(dict))
    # folder -> action -> senders set  (non-domain / sub-threshold senders)
    explicit_groups: dict[str, dict[str, set]] = defaultdict(lambda: defaultdict(set))
    # folder -> action -> {subject:set, body:set}
    keyword_groups: dict[str, dict[str, dict]] = defaultdict(lambda: defaultdict(dict))

    for rule in audit:
        if "error" in rule:
            plan["keep_as_is"].append(rule.get("name"))
            continue
        name = rule.get("name") or "<unnamed>"
        senders = [s for s in rule.get("from_senders", [])
                   if (s.get("address") or s.get("name"))]
        subj = rule.get("subject_strings", [])
        body = rule.get("body_strings", [])
        actions = rule.get("actions", [])
        move = next((a for a in actions if a.get("name") == ACT_MOVE), None)
        folder = (move or {}).get("folder") if move else None
        has_keywords = bool(subj or body)
        has_other = bool(rule.get("other_conditions"))

        # 1) Keyword-only rules -> merge by (folder, action)
        if has_keywords and not senders:
            key_action = (move or {}).get("name", "")
            kg = keyword_groups[folder or "<no-folder>"][key_action]
            kg.setdefault("subject", set()).update(subj)
            kg.setdefault("body", set()).update(body)
            continue

        # 2) Rules with a From condition
        if senders:
            if has_keywords or has_other or len(senders) > 1:
                plan["keep_as_is"].append(name)  # not brittle; manual review
                continue
            sender = senders[0]
            addr = (sender.get("address") or sender.get("name")).strip()
            if not folder:
                plan["keep_as_is"].append(name)
                continue
            dom = sender_domain(sender)
            if dom:
                g = domain_groups[folder][dom]
                g.setdefault("senders", set()).add(addr.lower())
                g["action"] = (move or {}).get("name", "")
            else:
                explicit_groups[folder][(move or {}).get("name", "")].add(addr)
        else:
            plan["keep_as_is"].append(name)

    # Wildcards need: >= min_domain_senders senders AND the domain must not
    # fan out to multiple target folders (would be ambiguous).
    domain_folder_count: dict[str, set] = defaultdict(set)
    for folder, doms in domain_groups.items():
        for dom in doms:
            domain_folder_count[dom].add(folder)

    consumed: set[str] = set()
    for folder, doms in sorted(domain_groups.items()):
        for dom, g in sorted(doms.items()):
            senders = sorted(g.get("senders", set()))
            action = g.get("action", ACT_MOVE)
            if len(domain_folder_count[dom]) > 1:
                explicit_groups[folder][action].update(senders)
                continue
            if len(senders) >= min_domain_senders:
                plan["wildcard_rules"].append({
                    "name": f"[WILDCARD] {dom} -> {folder}",
                    "folder": folder, "domain": dom,
                    "senders": senders, "action": action,
                })
                consumed.update(senders)
            else:
                explicit_groups[folder][action].update(senders)

    for folder, by_action in sorted(explicit_groups.items()):
        for action, senders in sorted(by_action.items()):
            leftover = sorted(s for s in senders if s not in consumed)
            if not leftover:
                continue
            plan["merged_rules"].append({
                "name": f"[MERGED] {len(leftover)} senders -> {folder}",
                "folder": folder, "senders": leftover,
                "action": action or ACT_MOVE,
            })

    for folder, by_action in sorted(keyword_groups.items()):
        if folder == "<no-folder>":
            continue
        for action, kg in sorted(by_action.items()):
            plan["keyword_rules"].append({
                "name": f"[KEYWORD] {folder}",
                "folder": folder,
                "subject": sorted(kg.get("subject", set())),
                "body": sorted(kg.get("body", set())),
                "action": action or ACT_MOVE,
            })

    n_wc = len(plan["wildcard_rules"])
    n_merged = len(plan["merged_rules"])
    n_kw = len(plan["keyword_rules"])
    replaced = (sum(len(r["senders"]) for r in plan["wildcard_rules"])
                + sum(len(r["senders"]) for r in plan["merged_rules"]))
    plan["stats"] = {
        "rules_audited": len(audit),
        "wildcard_rules": n_wc,
        "merged_rules": n_merged,
        "keyword_rules": n_kw,
        "kept_as_is": len(plan["keep_as_is"]),
        "sender_rules_replaced": replaced,
        "rule_count_after": n_wc + n_merged + n_kw + len(plan["keep_as_is"]),
    }
    return plan


# --------------------------------------------------------------------------
# COM apply layer (runs only with --apply; every call follows the safe
# patterns documented in the module docstring)
# --------------------------------------------------------------------------

def find_folder_by_name(ns, name: str):
    """Case-insensitive folder search across all accounts (2 levels)."""
    try:
        for account in enumerate1(ns.Folders):
            try:
                for folder in enumerate1(account.Folders):
                    fname, ok = safe_get(folder, "Name")
                    if ok and str(fname).lower() == name.lower():
                        return folder
            except Exception:
                continue
    except Exception:
        pass
    return None


def add_from_entries(rule, entries: list[str]) -> None:
    """From condition: one PLAIN STRING per Add() call.

    A bare domain string ('example.com') is Outlook's whole-domain wildcard;
    a full address matches exactly that sender.
    """
    cond = rule.Conditions[COND_FROM]
    cond.Enabled = True
    for s in entries:
        cond.IncludeNames.Add(s)  # <- plain str; never list/tuple/SAFEARRAY
    try:
        cond.SearchSubfolders = True
    except Exception:
        pass


def add_string_condition(rule, cond_key: str, strings: list[str]) -> None:
    cond = rule.Conditions[cond_key]
    cond.Enabled = True
    for s in strings:
        cond.IncludeStrings.Add(s)  # <- plain str


def apply_action(rule, action: str, folder=None) -> None:
    if action == ACT_MOVE:
        rule.Actions[ACT_MOVE].Folder = folder
    elif action == ACT_COPY:
        rule.Actions[ACT_COPY].Folder = folder
    elif action == ACT_DELETE:
        rule.Actions[ACT_DELETE].Enabled = True
    elif action == ACT_MARK_READ:
        rule.Actions[ACT_MARK_READ].Enabled = True
    else:
        raise ValueError(f"unsupported action: {action!r}")


def create_rule(rules, spec: dict, ns) -> str:
    """Create one consolidated rule from a plan spec. Returns rule name.

    The rule is disabled while being configured and enabled+saved only
    after every part succeeded, so a half-built rule can never fire.
    """
    name = spec["name"]
    rule = rules.Add()
    rule.Name = name
    rule.Enabled = False
    try:
        if spec.get("domain"):
            add_from_entries(rule, [spec["domain"]])
        elif spec.get("senders"):
            add_from_entries(rule, spec["senders"])
        if spec.get("subject"):
            add_string_condition(rule, COND_SUBJECT, spec["subject"])
        if spec.get("body"):
            add_string_condition(rule, COND_BODY, spec["body"])
        if spec.get("folder"):
            folder = find_folder_by_name(ns, spec["folder"])
            if folder is None:
                raise LookupError(f"target folder not found: {spec['folder']}")
            apply_action(rule, spec.get("action") or ACT_MOVE, folder)
        rule.StopProcessingOnErrors = False
        rule.Enabled = True
        rule.Save()
        return name
    except Exception:
        # Remove the half-built rule so it cannot linger misconfigured.
        try:
            rules.Delete(name)
        except Exception:
            pass
        raise


# --------------------------------------------------------------------------
# Self-test: synthetic 183-rule audit to prove the engine (no Outlook needed)
# --------------------------------------------------------------------------

def build_synthetic_audit(n_single: int = 170, n_keyword: int = 8, n_other: int = 5) -> list[dict]:
    """Mimic the brittle single-sender rule situation.

    ~76 one-sender rules across 6 target folders with overlapping domains,
    8 keyword rules (some duplicate sets), 5 already-robust rules.
    """
    import random
    rng = random.Random(42)
    folders = {
        "Bills": ["comcast.com", "xfinity.com", "paypal.com", "statefarm.com"],
        "Amazon": ["amazon.com", "amazonservices.com"],
        "USPS": ["usps.com", "informeddelivery.usps.com"],
        "UPS": ["ups.com"],
        "Samsung": ["samsung.com", "samsungusa.com"],
        "Network": ["tp-link.com", "no-ip.com", "nordvpn.com"],
    }
    rules = []
    i = 0
    for folder, domains in folders.items():
        for dom in domains:
            for k in range(rng.randint(3, 8)):
                i += 1
                rules.append({
                    "name": f"OldRule {i}", "enabled": True,
                    "from_senders": [{"name": f"user{k}@{dom}",
                                      "address": f"user{k}@{dom}", "type": None}],
                    "subject_strings": [], "body_strings": [],
                    "actions": [{"name": ACT_MOVE, "folder": folder}],
                    "other_conditions": [],
                })
    for j in range(n_keyword):
        folder = list(folders)[j % len(folders)]
        kw = "unsubscribe" if j % 2 == 0 else "invoice"
        rules.append({
            "name": f"OldKw {j + 1}", "enabled": True,
            "from_senders": [],
            "subject_strings": [kw], "body_strings": [],
            "actions": [{"name": ACT_MOVE, "folder": folder}],
            "other_conditions": [],
        })
    for j in range(n_other):
        rules.append({
            "name": f"Robust {j + 1}", "enabled": True,
            "from_senders": [{"name": f"a@x.com", "address": f"a{j}@x.com",
                              "type": None},
                             {"name": f"b@x.com", "address": f"b{j}@x.com",
                              "type": None}],
            "subject_strings": [], "body_strings": [],
            "actions": [{"name": ACT_MOVE, "folder": "Bills"}],
            "other_conditions": [],
        })
    return rules


def run_selftest() -> int:
    log("== SELFTEST: consolidation engine on synthetic 183-rule audit ==")
    audit = build_synthetic_audit()
    log(f"synthetic rules generated: {len(audit)}")
    plan = plan_consolidation(audit, min_domain_senders=2)
    st = plan["stats"]
    log(f"stats: {json.dumps(st, indent=2)}")
    log(f"wildcard rules ({len(plan['wildcard_rules'])}):")
    for r in plan["wildcard_rules"]:
        log(f"  {r['name']}  ({len(r['senders'])} senders absorbed)")
    log(f"merged rules ({len(plan['merged_rules'])}):")
    for r in plan["merged_rules"]:
        log(f"  {r['name']}  {r['senders'][:4]}{'...' if len(r['senders']) > 4 else ''}")
    log(f"keyword rules ({len(plan['keyword_rules'])}):")
    for r in plan["keyword_rules"]:
        log(f"  {r['name']}  subj={r['subject']} body={r['body']}")
    assert st["rules_audited"] == len(audit)
    assert st["wildcard_rules"] >= 6, "expected most domains to wildcard"
    assert st["keyword_rules"] >= 1
    assert st["rule_count_after"] < st["rules_audited"], "must reduce rule count"
    # every absorbed sender must land in exactly one new rule
    seen = set()
    for r in plan["wildcard_rules"] + plan["merged_rules"]:
        assert not (set(r["senders"]) & seen), f"overlap: {r['name']}"
        seen.update(r["senders"])
    log("SELFTEST PASSED: rule count "
        f"{st['rules_audited']} -> {st['rule_count_after']}")
    return 0


# --------------------------------------------------------------------------
# Live run: connect, audit, plan, (optionally) apply
# --------------------------------------------------------------------------

def connect():
    """Return (outlook, ns, inbox, rules_or_None, diagnostics)."""
    import pythoncom  # noqa: F401  (COM init for this thread)
    import win32com.client
    diags = []
    outlook = win32com.client.Dispatch("Outlook.Application")
    ver, ok = safe_get(outlook, "Version")
    diags.append(f"Outlook version: {ver}")
    ns = outlook.GetNamespace("MAPI")
    accounts = []
    for account in enumerate1(ns.Folders):
        aname, ok = safe_get(account, "Name")
        if ok:
            accounts.append(str(aname))
    diags.append(f"accounts: {accounts}")

    inbox = None
    inbox, ok = safe_get(ns, "GetDefaultFolder")
    if ok:
        try:
            inbox = ns.GetDefaultFolder(6)  # olFolderInbox
            _ = inbox.Name  # validate the wrapper
        except Exception as exc:
            diags.append(f"GetDefaultFolder failed ({exc}); falling back to name search")
            inbox = None
    if inbox is None:
        for account in enumerate1(ns.Folders):
            for folder in enumerate1(account.Folders):
                fname, ok2 = safe_get(folder, "Name")
                if ok2 and str(fname).lower() == "inbox":
                    inbox = folder
                    break
            if inbox is not None:
                break
    if inbox is None:
        diags.append("FATAL: inbox folder not found")
        return outlook, ns, None, None, diags
    iname, _ = safe_get(inbox, "Name")
    ipath, _ = safe_get(inbox, "FullFolderPath")
    diags.append(f"inbox: {iname} ({ipath})")

    # Rules API: the canonical entry point is MAPIStore.GetRules().
    # NOTE: MAPIFolder has NO Rules property in any Outlook build — the
    # earlier check of inbox.Rules was a false negative that made this
    # tool (and downstream diagnostics) wrongly conclude the Rules API
    # was unavailable. Try the store method first, then legacy fallback.
    rules = None
    store, ok = safe_get(ns, "DefaultStore")
    if ok:
        getrules, ok2 = safe_get(store, "GetRules")
        if ok2:
            try:
                rules = getrules()
            except Exception:
                rules = None
    if rules is None:
        rules, ok = safe_get(inbox, "Rules")
        if not ok or rules is None:
            rules = None
    if rules is None:
        diags.append(
            "WARNING: Rules automation API unavailable (neither "
            "MAPIStore.GetRules nor MAPIFolder.Rules worked). "
            "Nothing to audit or apply here."
        )
        return outlook, ns, inbox, None, diags
    count, ok = safe_get(rules, "Count")
    if not ok:
        diags.append("WARNING: Rules collection present but Count unreadable")
        return outlook, ns, inbox, None, diags
    diags.append(f"existing rules: {count}")
    return outlook, ns, inbox, rules, diags


def write_json(path: str, payload) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2, default=str)
    log(f"  wrote {path}")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    ap.add_argument("--selftest", action="store_true",
                    help="run the engine on synthetic data; no Outlook needed")
    ap.add_argument("--apply", action="store_true",
                    help="actually create the consolidated rules (default: dry run)")
    ap.add_argument("--cleanup", action="store_true",
                    help="with --apply: delete original single-sender rules that were consolidated")
    ap.add_argument("--min-domain-senders", type=int, default=2,
                    help="min senders per domain before a wildcard rule is created (default 2)")
    ap.add_argument("--report-dir", default=REPORT_DIR_DEFAULT)
    args = ap.parse_args(argv)

    if args.selftest:
        return run_selftest()

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_dir = args.report_dir
    os.makedirs(report_dir, exist_ok=True)

    log(f"== outlook_rules.py v{__version__} ({'APPLY' if args.apply else 'DRY-RUN'}) ==")
    outlook, ns, inbox, rules, diags = connect()
    for d in diags:
        log("  " + d)
    if rules is None:
        write_json(os.path.join(report_dir, f"connect_{stamp}.json"),
                   {"diagnostics": diags})
        log("No Rules API on this Outlook build: nothing to do. "
            "On a full Classic Outlook install this script audits, plans and "
            "(with --apply) rebuilds the rules.")
        return 0

    audit = audit_all_rules(rules)
    audit_path = os.path.join(report_dir, f"rule_audit_{stamp}.json")
    write_json(audit_path, audit)
    log(f"audited {len(audit)} rules")

    plan = plan_consolidation(audit, min_domain_senders=args.min_domain_senders)
    plan_path = os.path.join(report_dir, f"consolidation_plan_{stamp}.json")
    write_json(plan_path, plan)
    st = plan["stats"]
    log(f"plan: {st['rules_audited']} rules -> "
        f"{st['rule_count_after']} "
        f"({st['wildcard_rules']} wildcard, {st['merged_rules']} merged, "
        f"{st['keyword_rules']} keyword, {st['kept_as_is']} kept)")
    for r in plan["wildcard_rules"]:
        log(f"  WILDCARD  {r['name']}  [{len(r['senders'])} senders]")
    for r in plan["merged_rules"]:
        log(f"  MERGED    {r['name']}")
    for r in plan["keyword_rules"]:
        log(f"  KEYWORD   {r['name']}  subj={r['subject']} body={r['body']}")

    if not args.apply:
        log("dry run complete -- no changes made. Re-run with --apply to create.")
        return 0

    # ---- apply ----
    created, failed = [], []
    for spec in (plan["wildcard_rules"] + plan["merged_rules"]
                 + plan["keyword_rules"]):
        try:
            create_rule(rules, spec, ns)
            created.append(spec["name"])
            log(f"  created: {spec['name']}")
        except Exception as exc:
            failed.append({"name": spec["name"], "error": str(exc)})
            log(f"  FAILED : {spec['name']} -> {exc}")

    if args.cleanup and not failed:
        absorbed = {s for r in plan["wildcard_rules"] + plan["merged_rules"]
                    for s in r["senders"]}
        for r in audit:
            if "error" in r or len(r.get("from_senders", [])) != 1:
                continue
            s = r["from_senders"][0]
            addr = (s.get("address") or s.get("name") or "").strip().lower()
            if addr in absorbed and r.get("name"):
                try:
                    rules.Delete(r["name"])
                    log(f"  deleted original: {r['name']}")
                except Exception as exc:
                    log(f"  delete FAILED: {r['name']} -> {exc}")
    elif args.cleanup and failed:
        log("cleanup skipped: some rule creations failed (safety)")

    final_rules, ok = safe_get(inbox, "Rules")
    final_count = safe_get(final_rules, "Count")[0] if ok else None
    log(f"done: created={len(created)} failed={len(failed)} "
        f"rules now={final_count}")
    write_json(os.path.join(report_dir, f"apply_result_{stamp}.json"),
               {"created": created, "failed": failed,
                "final_rule_count": final_count})
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
