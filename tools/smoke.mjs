#!/usr/bin/env node
// ../tools/smoke.mjs — Kitty Vs Everything v3.64.0 (tools/ moved up to AI-GAMES root)
// Headless smoke test for the pure-logic v3.47.0 modules (Settings, Keybinds,
// MessageLog, EventBus, DebugBridge, MenuKeybinds) using minimal DOM shims.
// Run: node ../tools/smoke.mjs
//
// v3.47.0: key-triggered Synergy Explosion — the 'synergy' action joins the
//          12-row menu keybind footer (T default, - lefty, , P2 co-op) and
//          TestAimbot moved T → F8.

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'Kitty Vs Everything');
let failures = 0;
const check = (label, cond) => {
  console.log(`  ${cond ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${label}`);
  if (!cond) failures++;
};

// ─── Minimal browser shims ───
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
};

const MOD = { 'Settings.js': 'js/ui/Settings.js', 'Keybinds.js': 'js/input/Keybinds.js', 'EventBus.js': 'js/core/EventBus.js', 'MessageLog.js': 'js/ui/MessageLog.js', 'DebugBridge.js': 'js/ui/DebugBridge.js', 'MenuKeybinds.js': 'js/input/MenuKeybinds.js' };
const imp = (f, tag) => import(pathToFileURL(path.join(ROOT, MOD[f] || f)).href + (tag ? `?t=${tag}` : ''));

console.log('\n[1] Settings.js — defaults, clamping, reset');
{
  const { SETTINGS, setSetting, resetSettings } = await imp('Settings.js', 'a');
  check('spinSpeedKeyboard default 1', SETTINGS.spinSpeedKeyboard === 1);
  check('spinSpeedMouse default 1', SETTINGS.spinSpeedMouse === 1);
  check('audioMaster default 1', SETTINGS.audioMaster === 1);
  check('audioSfx default 0.8', SETTINGS.audioSfx === 0.8);
  check('audioMusic default 0.4', SETTINGS.audioMusic === 0.4);
  check('particleDensity default 1', SETTINGS.particleDensity === 1);
  check('screenShake default true', SETTINGS.screenShake === true);
  check('screenBounds default false', SETTINGS.screenBounds === false);
  check('crosshair default true', SETTINGS.crosshair === true);
  check('crosshairOffset default 140 (v3.55.0 range 140–340)', SETTINGS.crosshairOffset === 140);
  setSetting('audioMaster', 0.5);
  check('setSetting audioMaster 0.5', SETTINGS.audioMaster === 0.5);
  setSetting('audioMaster', 0);
  check('audioMaster 0 (muted) stays 0', SETTINGS.audioMaster === 0);
  setSetting('spinSpeedKeyboard', 99);
  check('spinSpeedKeyboard clamps to 3', SETTINGS.spinSpeedKeyboard === 3);
  setSetting('crosshairOffset', 999);
  check('crosshairOffset clamps to 340 (v3.55.0 max)', SETTINGS.crosshairOffset === 340);
  setSetting('crosshairOffset', 10);
  check('crosshairOffset clamps to 140 (v3.55.0 min)', SETTINGS.crosshairOffset === 140);
  setSetting('screenShake', false);
  check('screenShake toggle false', SETTINGS.screenShake === false);
  resetSettings();
  check('resetSettings restores shake', SETTINGS.screenShake === true);
  check('resetSettings restores spin', SETTINGS.spinSpeedKeyboard === 1 && SETTINGS.spinSpeedMouse === 1);
}

console.log('[2] Settings.js — legacy spinSpeed migration (fresh import)');
{
  store.set('kve-settings-v1', JSON.stringify({ spinSpeed: 1.7 }));
  const { SETTINGS } = await imp('Settings.js', 'migrate');
  check('legacy spinSpeed → keyboard 1.7', SETTINGS.spinSpeedKeyboard === 1.7);
  check('legacy spinSpeed → mouse 1.7', SETTINGS.spinSpeedMouse === 1.7);
}

console.log('[3] Keybinds.js — defaults, steal, reset, labels');
{
  const mod = await imp('Keybinds.js', 'a');
  const { KEYBINDS, setBind, resetBinds, actionForCode, codeLabel, getBinds } = mod;
  check('fire binds LMB by default', getBinds('fire').includes('Mouse0'));
  check('actionForCode KeyL = fire', actionForCode('KeyL') === 'fire');
  setBind('boost', 'KeyL'); // KeyL is fire's — must be stolen
  check('KeyL stolen from fire', !getBinds('fire').includes('KeyL'));
  check('KeyL now on boost', getBinds('boost').includes('KeyL'));
  check('actionForCode KeyL = boost', actionForCode('KeyL') === 'boost');
  setBind('fire', 'Mouse0'); // rebind mouse back into fire slot
  check('fire has Mouse0 again', getBinds('fire').includes('Mouse0'));
  resetBinds();
  check('resetBinds restores fire', JSON.stringify(getBinds('fire')) === JSON.stringify(['KeyL', 'Mouse0']));
  check('codeLabel KeyL = L', codeLabel('KeyL') === 'L');
  check('codeLabel Mouse0 = MOUSE 1 (LMB)', codeLabel('Mouse0') === 'MOUSE 1 (LMB)');
  check('codeLabel Space = SPACE', codeLabel('Space') === 'SPACE');
}

console.log('[4] MessageLog.js — ring cap, clear, banner mirror');
{
  const { bus } = await imp('EventBus.js');
  const { default: MessageLog } = await imp('MessageLog.js');
  const log = new MessageLog();
  for (let i = 0; i < 70; i++) log.log('line ' + i, 'info', i);
  check('ring caps at 64', log.entries.length === 64);
  check('oldest dropped', log.entries[0].text === 'line 6');
  log.clear();
  check('clear empties', log.entries.length === 0);
  bus.emit('banner', { text: 'WAVE 2', tone: 'warn' });
  check('banner auto-mirrored', log.entries.length === 1 && log.entries[0].text === 'WAVE 2' && log.entries[0].tone === 'warn');
  log.destroy();
  bus.emit('banner', { text: 'AFTER DESTROY' });
  check('destroy unsubscribes', log.entries.length === 1);
}

console.log('[5] DebugBridge.js — window.__KVE__ handle + console ring');
{
  const { default: DebugBridge } = await imp('DebugBridge.js');
  const bridge = new DebugBridge({});
  check('window.__KVE__ registered', globalThis.window.__KVE__ === bridge);
  console.log('captured?');
  check('console ring captures', bridge.logs.length >= 1 && bridge.logs[bridge.logs.length - 1].args[0] === 'captured?');
}

console.log('\n[6] MenuKeybinds.js — dynamic select-screen footer (v3.23.0)');
{
  // Minimal DOM shim — MenuKeybinds builds real elements via document.*
  // textContent assignment clears children, like a real DOM container
  // (MenuKeybinds.render() clears the footer with el.textContent = '').
  const makeEl = (tag) => {
    const el = { tag, children: [], className: '', _text: '' };
    Object.defineProperty(el, 'textContent', {
      get: () => el._text,
      set: (v) => { el._text = String(v); el.children.length = 0; },
    });
    el.appendChild = (c) => { el.children.push(c); return c; };
    return el;
  };
  const dom = new Map();
  globalThis.document = {
    getElementById: (id) => { if (!dom.has(id)) dom.set(id, makeEl('div')); return dom.get(id); },
    createElement: (tag) => makeEl(tag),
  };

  // Bare import: the same Keybinds.js instance MenuKeybinds.js binds to.
  const { setBind, removeBind, resetBinds } = await imp('Keybinds.js');
  const { default: MenuKeybinds } = await imp('MenuKeybinds.js');
  const footer = new MenuKeybinds();
  const rows = () => footer.el.children;
  const rowText = (row) => {
    const [keys, label] = row.children;
    return keys.children.map((k) => k.textContent).join(' / ') + ': ' + label.textContent;
  };

  check('renders 12 rows', rows().length === 12);
  check('WSAD: Forward, Back/stop, Spin Left, Spin Right', rowText(rows()[0]) === 'WSAD: Forward, Back/stop, Spin Left, Spin Right');
  check('Q: Stun Rockets', rowText(rows()[1]) === 'Q: Stun Rockets');
  check('E: Napalm', rowText(rows()[2]) === 'E: Napalm');
  check('R: Weapon Switch', rowText(rows()[3]) === 'R: Weapon Switch');
  check('F: Super', rowText(rows()[4]) === 'F: Super');
  check('T: Synergy Explosion', rowText(rows()[5]) === 'T: Synergy Explosion');
  check('Left Click: Fire Weapon', rowText(rows()[6]) === 'Left Click: Fire Weapon');
  check('Right Click: Boost', rowText(rows()[7]) === 'Right Click: Boost');
  check('Esc: Menu', rowText(rows()[8]) === 'Esc: Menu');
  check('M: Minimize Fire Control Panel (Toggle)', rowText(rows()[9]) === 'M: Minimize Fire Control Panel (Toggle)');
  check('U: Fullscreen Toggle', rowText(rows()[10]) === 'U: Fullscreen Toggle');
  check('F9: Admin Panel', rowText(rows()[11]) === 'F9: Admin Panel');

  // Live update: rebind from "settings" → footer re-renders instantly
  setBind('stun', 'KeyT');
  check('rebind stun → T: Stun Rockets', rowText(rows()[1]) === 'T: Stun Rockets');
  check('synergy row drops to Minus after KeyT steal', rowText(rows()[5]) === '-: Synergy Explosion');
  // WSAD primary changed → group row shows the real keys (W S A D order)
  removeBind('thrust', 'KeyW');
  removeBind('thrust', 'ArrowUp');
  setBind('thrust', 'KeyZ');
  check('wsad row → Z / S / A / D', rowText(rows()[0]) === 'Z / S / A / D: Forward, Back/stop, Spin Left, Spin Right');
  // Reset → the standard default set returns
  resetBinds();
  check('reset → WSAD standard row', rowText(rows()[0]) === 'WSAD: Forward, Back/stop, Spin Left, Spin Right');
  check('reset → Q: Stun Rockets', rowText(rows()[1]) === 'Q: Stun Rockets');
  // destroy() unsubscribes — no more re-renders
  footer.destroy();
  setBind('stun', 'KeyT');
  check('destroy unsubscribes (stale after destroy)', rowText(rows()[1]) === 'Q: Stun Rockets');
  resetBinds();
}

console.log('');
if (failures) {
  console.log(`\x1b[31mFAILED\x1b[0m — ${failures} check(s) failed`);
  process.exit(1);
} else {
  console.log('\x1b[32mPASSED\x1b[0m — v3.64.0 module smoke tests clean');
}
