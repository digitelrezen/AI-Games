#!/usr/bin/env python3
"""Replace the Outlook section (last section) of clinerules.md."""
import io

P = r"C:\Dev\.clinerules\clinerules.md"

NEW = """## Outlook COM Automation (pywin32) - Workspace Standard
- **Tools:** `C:\\Dev\\AI-GAMES\\tools\\outlook_rules.py` (audit/consolidate/rebuild Outlook rules; reports in `C:\\Dev\\AI-GAMES\\tools\\outlook_reports\\`), `apply_wildcard_rules.py` (first 8 wildcard rules), `apply_wildcard_rules_v2.py` (remaining 24; idempotent - skips existing `Wildcard - <folder>` rules), `verify_patterns.py` (read-back spot check), `audit_extract.py` (rule-name to folder map from audit JSON).
- **Run:** `python tools\\outlook_rules.py --selftest` (no Outlook) | plain = dry-run audit+plan | `--apply` create | `--apply --cleanup` also delete consolidated originals.
- **Proven-working COM pattern (this Outlook build, verified 2026-11-05):**
  1. Enumerate Outlook collections 1-based via `coll.Item(i)` for `i in 1..coll.Count`.
  2. `rules = ns.DefaultStore.GetRules()`; `rule = rules.Create(name, 0)` (0 = olRuleReceive).
  3. From condition: `cond = rule.Conditions.SenderAddress`; `cond.Address = win32com.client.VARIANT(pythoncom.VT_ARRAY | pythoncom.VT_BSTR, [plain strings])`; `cond.Enabled = True`. Bare domain string = whole-domain wildcard; other strings = case-insensitive substrings of sender name/address.
  4. `rule.Enabled = True; rules.Save()`. Audit to JSON BEFORE any mutation; delete half-built rules on failure.
- **Proven limitation (this build):** assigning `rule.Actions.MoveToFolder.Folder` is a SILENT NO-OP - tested MAPIFolder from the folder hierarchy, MAPIFolder read back from a working rule's action, `folder.MAPIOBJECT`, EntryID, and FolderPath/FullName strings; read-back is `Folder=None` and the rule ends up with no action. Setting `Actions.MoveToFolder.Enabled = True` without a folder fails ("invalid actions or conditions"). **The Move-to-Folder target MUST be set in the Outlook UI**: Manage Rules & Alerts -> select rule -> Edit -> "Move it to the folder..." -> pick folder -> OK -> OK.
- **Read-back works:** `rule.Conditions.SenderAddress.Address` returns the pattern list, and `rule.Actions.MoveToFolder.Folder` returns a MAPIFolder (Name/FolderPath) for actions set via the UI - use this to verify rules without the UI.
- **State (2026-11-05):** 32 enabled `Wildcard - <folder>` rules cover all 32 folders targeted by the old 183 rules (deleted). `gmail.com` intentionally NOT wildcarded (friends use gmail).
"""


def main() -> int:
    with open(P, "rb") as f:
        raw = f.read()
    text = raw.decode("utf-8")
    marker = "## Outlook COM Automation"
    i = text.find(marker)
    if i < 0:
        print("marker not found - no change")
        return 1
    # preserve whatever newline style the file uses
    nl = "\r\n" if "\r\n" in text else "\n"
    head = text[:i].rstrip("\r\n") + "\n"
    new_section = NEW.replace("\n", nl)
    out = head + "\n" + new_section
    with open(P, "wb") as f:
        f.write(out.encode("utf-8"))
    print("clinerules.md updated: replaced Outlook section "
          f"(old tail {len(text) - i} chars -> new {len(new_section)} chars)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
