#!/usr/bin/env python3
"""Replace the outdated Outlook COM section in C:\\Dev\\.clinerules\\clinerules.md
with the live-verified API surface. The section runs from its heading to EOF."""
from pathlib import Path

PATH = Path(r"C:\Dev\.clinerules\clinerules.md")
NEW_SECTION = """## Outlook COM Automation (pywin32) - Workspace Standard
- **Tooling (all in `C:\\Dev\\AI-GAMES\\tools\\`):**
  - `outlook_rules.py` — audit/plan/consolidate (CLI; `--selftest` needs no Outlook).
  - `apply_wildcard_rules.py` — creates the consolidated "Wildcard - <folder>" rules (the working builder).
  - `verify_wildcard_rules.py` — fresh-session check that rules persisted + are enabled.
  - `com_step_probe*.py` — API probes (how this build's Rules surface actually behaves).
  - Reports land in `C:\\Dev\\AI-GAMES\\tools\\outlook_reports\\`.
- **Run:** `python tools\\apply_wildcard_rules.py` (create) | `python tools\\verify_wildcard_rules.py` (verify). Outlook must be running (launch `C:\\Program Files\\Microsoft Office\\Root\\Office16\\OUTLOOK.EXE` if not).
- **Verified Rules API on THIS machine (Office16, live-tested 2026-11-05) — the only patterns that work:**
  1. Connect via the store, not a folder property: `rules = ns.DefaultStore.GetRules()` (`MAPIFolder.Rules` does not exist, but the store method does).
  2. Create: `rule = rules.Create(name, 0)` (0 = olRuleReceive). `rules.Add()` does NOT exist here.
  3. Delete: `rules.Remove(name)`. Neither `rules.Delete(...)` nor `rule.Delete()` exists here.
  4. From condition uses the NAMED property: `cond = rule.Conditions.SenderAddress`. String keys (`Conditions["From"]`) raise `Type mismatch` in this build.
  5. Set senders with a SAFEARRAY on `.Address`: `cond.Address = win32com.client.VARIANT(pythoncom.VT_ARRAY | pythoncom.VT_BSTR, [p1, p2, ...])`. A plain string, `.Text`, and `.IncludeNames` all FAIL here (`.IncludeNames` is absent; `.Text` is not settable). A bare domain in the array is Outlook's whole-domain wildcard.
  6. Move action uses the NAMED property: `rule.Actions.MoveToFolder.Folder = <MAPIFolder>`. String key `Actions["MoveToFolder"]` raises `Type mismatch`.
  7. Configure fully, then `rule.Enabled = True` (this runs validation — an empty/invalid From condition raises 0x80040202 "invalid actions or conditions"), then `rules.Save()` (collection level; `rule.Save()` does not exist). `rule.StopProcessingOnErrors` is not settable here.
  8. Verify by fresh COM session: rules persist only after `rules.Save()`; a new `GetRules()` should show the expected count with `Enabled=True`. The From senders and move-target folder are NOT readable back in this build (they return empty) — rely on the enabled flag + name + successful save-validation.
- **GUI fallback (pywinauto/pyautogui) is no longer required** for rule create/delete — COM works. Keep it only if a future build regresses.
- **Safety:** audit to JSON before mutation; isolate per-rule COM errors; on failure call `rules.Remove(name)`; never leave a rule `Enabled=True` until every part is set and `rules.Save()` succeeds.
"""

text = PATH.read_text(encoding="utf-8")
lines = text.splitlines()
idx = next((i for i, l in enumerate(lines) if l.startswith("## Outlook COM Automation")), None)
if idx is None:
    raise SystemExit("section heading not found")
prefix = "\r\n".join(lines[:idx])
out = prefix + "\r\n" + NEW_SECTION
PATH.write_text(out, encoding="utf-8")
print(f"patched: replaced lines {idx + 1}..{len(lines)} with {NEW_SECTION.count(chr(10))} new lines")
