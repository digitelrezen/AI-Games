#!/usr/bin/env python3
"""Probe: check Outlook profiles, launch OUTLOOK.EXE, wait for any window to appear."""
import os
import subprocess
import time
import winreg
import win32gui

EXE = r"C:\Program Files\Microsoft Office\Root\Office16\OUTLOOK.EXE"
APPDATA_OUTLOOK = os.path.join(os.environ.get("APPDATA", ""), "Microsoft", "Outlook")

# 1) Registry profiles (Office 16.0)
profiles = []
try:
    k = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Office\16.0\Outlook\Profiles")
    i = 0
    while True:
        try:
            profiles.append(winreg.EnumKey(k, i))
            i += 1
        except OSError:
            break
    winreg.CloseKey(k)
except OSError as e:
    profiles = [f"ERROR: {e}"]
print("registry profiles :", profiles)
print("appdata outlook dir:", APPDATA_OUTLOOK, "exists:", os.path.isdir(APPDATA_OUTLOOK))
if os.path.isdir(APPDATA_OUTLOOK):
    for name in sorted(os.listdir(APPDATA_OUTLOOK))[:20]:
        print("   -", name)

# 2) Launch
try:
    subprocess.Popen([EXE], cwd=os.path.dirname(EXE))
    print("launched OUTLOOK.EXE")
except Exception as e:
    print("LAUNCH FAILED:", e)
    raise SystemExit(1)

# 3) Wait up to 40s for any visible window from the Outlook process
deadline = time.time() + 40
last_seen = []
appeared = None
while time.time() < deadline:
    seen = []

    def cb(h, _):
        if win32gui.IsWindowVisible(h):
            t = win32gui.GetWindowText(h).strip()
            if t:
                seen.append((h, t))

    win32gui.EnumWindows(cb, None)
    last_seen = seen
    for h, t in seen:
        if "outlook" in t.lower() or "inbox" in t.lower():
            appeared = (h, t)
            break
    if appeared:
        break
    time.sleep(2)

print("---")
if appeared:
    print("APPEARED:", appeared[0], "|", appeared[1])
else:
    print("NO OUTLOOK WINDOW within 40s. All visible windows:")
for h, t in last_seen:
    print(h, "|", t[:110])
