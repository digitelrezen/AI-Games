// Filename: Keybinds.js
// Kitty Vs Everything — v3.47.0
// Remappable keybinds for keyboard keys AND mouse buttons (LMB/MMB/RMB +
// mouse 3/4). Every gameplay action maps to a list of codes — any of them
// triggering counts (defaults pair a main hand with a lefty alternate,
// exactly like the old hardcoded Q/H, E/J, F/C, R/G pairs).
// Codes are KeyboardEvent.code strings ('KeyL', 'Space', 'ArrowUp') and
// 'Mouse0'–'Mouse4'. Persisted separately from Settings.js and consumed
// only through InputManager's action layer (isDownAction / wasPressedAction)
// — game code never reads a raw key name.
// One code can only serve one action: rebinding a code steals it from any
// other action (reported as a banner by SettingsScreen).
// v3.16.0: new 'deployFleet' action (default B / N) — undocks the mini-ship
//          fleet into a combat orbit (MiniDeploy.js) and recalls it.
// v3.47.0: new 'synergy' action (default T / -) — fires the Synergy
//          Explosion (PlayerFleet.superWeapon) when the color-match meter
//          (superCharge) is full; replaces the old 10s auto-fire.
// v3.78.0: rotateLeft/rotateRight labels are now mode-neutral ("Strafe /
//          Rotate …") — in 'strafe' control mode (Settings.controlMode,
//          default) A/D slide sideways; in 'spin' mode they rotate (classic).
export const VERSION = 'v3.78.0';
import { bus } from '../core/EventBus.js';

const STORAGE_KEY = 'kve-keybinds-v1';

export const ACTIONS = [
  { id: 'fire',        label: 'Fire (primary)' },
  { id: 'thrust',      label: 'Thrust (forward)' },
  { id: 'brake',       label: 'Brake / Reverse' },
  { id: 'rotateLeft',  label: 'Strafe / Rotate Left' },
  { id: 'rotateRight', label: 'Strafe / Rotate Right' },
  { id: 'boost',       label: 'Boost' },
  { id: 'stun',        label: 'Stun Rockets' },
  { id: 'napalm',      label: 'Napalm Rockets' },
  { id: 'ultimate',    label: 'Ultimate' },
  { id: 'synergy',     label: 'Fleet Orbit' },
  { id: 'cycleWeapon', label: 'Cycle Weapon' },
  { id: 'deployFleet', label: 'Deploy / Recall Fleet' },
];
export const ACTION_IDS = ACTIONS.map(a => a.id);
export const ACTION_LABELS = Object.fromEntries(ACTIONS.map(a => [a.id, a.label]));

export const DEFAULT_BINDS = {
  fire:        ['KeyL', 'Mouse0'],
  thrust:      ['KeyW', 'ArrowUp'],
  brake:       ['KeyS', 'ArrowDown'],
  rotateLeft:  ['KeyA', 'ArrowLeft'],
  rotateRight: ['KeyD', 'ArrowRight'],
  boost:       ['Space', 'Mouse2'],
  stun:        ['KeyQ', 'KeyH'],
  napalm:      ['KeyE', 'KeyJ'],
  ultimate:    ['KeyF', 'KeyC'],
  synergy:     ['KeyT', 'Minus'],
  cycleWeapon: ['KeyR', 'KeyG'],
  deployFleet: ['KeyB', 'KeyN'],
};

export const MOUSE_BUTTON_NAMES = {
  Mouse0: 'LMB', Mouse1: 'MMB', Mouse2: 'RMB', Mouse3: 'BACK', Mouse4: 'FWD',
};

// Codes the capture UI will refuse (browser/OS-critical or bare modifiers)
const BLOCKED_CODES = new Set([
  'F5', 'F11', 'F12', 'MetaLeft', 'MetaRight', 'OSLeft', 'OSRight',
  'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight',
  'AltLeft', 'AltRight',
]);

export function isMouseCode(code) { return /^Mouse[0-4]$/.test(code); }

export function isValidCode(code) {
  if (typeof code !== 'string' || !code) return false;
  if (isMouseCode(code)) return true;
  if (BLOCKED_CODES.has(code)) return false;
  return true; // any other KeyboardEvent.code is fine
}

function deepCopy(binds) { return JSON.parse(JSON.stringify(binds)); }

function loadSaved() {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw) || {};
        const out = deepCopy(DEFAULT_BINDS);
        for (const id of ACTION_IDS) {
          const codes = Array.isArray(data[id]) ? data[id] : (data[id] ? [data[id]] : null);
          if (codes) {
            const clean = codes.filter(isValidCode).slice(0, 2);
            if (clean.length) out[id] = clean;
          }
        }
        return out;
      }
    }
  } catch {}
  return deepCopy(DEFAULT_BINDS);
}

/** Live keybind table: actionId → [code, code?]. Mutated in place. */
export const KEYBINDS = loadSaved();

function persist() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(KEYBINDS));
    }
  } catch {}
}

/**
 * Bind `code` to `action` (slot 0 or 1; appends if the action is empty).
 * The code is stolen from any other action that claimed it.
 */
export function setBind(action, code, slot = 0) {
  if (!KEYBINDS[action] || !isValidCode(code)) return;
  const list = KEYBINDS[action];
  list.splice(list.indexOf(code), 1); // dedupe within the action
  for (const id of ACTION_IDS) {
    if (id === action) continue;
    KEYBINDS[id] = KEYBINDS[id].filter(c => c !== code); // steal
  }
  if (slot >= 0 && slot < list.length) list[slot] = code;
  else list.push(code);
  persist();
  bus.emit('keybindsChanged');
}

export function removeBind(action, code) {
  KEYBINDS[action] = (KEYBINDS[action] || []).filter(c => c !== code);
  persist();
  bus.emit('keybindsChanged');
}

export function resetBinds() {
  Object.assign(KEYBINDS, deepCopy(DEFAULT_BINDS));
  persist();
  bus.emit('keybindsChanged');
}

/** Action currently claiming `code` (for steal warnings) — '' if none. */
export function actionForCode(code) {
  return ACTION_IDS.find(id => (KEYBINDS[id] || []).includes(code)) || '';
}

/** Human label for a code ('KeyL'→'L', 'Mouse0'→'MOUSE 1 (LMB)', …). */
export function codeLabel(code) {
  if (isMouseCode(code)) {
    const n = Number(code.slice(5)) + 1;
    return `MOUSE ${n} (${MOUSE_BUTTON_NAMES[code] || '?'})`;
  }
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const map = {
    Space: 'SPACE', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    Backspace: '⌫', Enter: 'ENTER', Tab: 'TAB', CapsLock: 'CAPS',
    Semicolon: ';', Comma: ',', Period: '.', Slash: '/', Quote: "'",
    BracketLeft: '[', BracketRight: ']', Backslash: '\\', Minus: '-',
    Equal: '=', Backquote: '`',
  };
  return map[code] || code.toUpperCase();
}

/**
 * One-shot capture of the next keyboard key or mouse button.
 * onDone(code) on capture; onCancel() on Escape or window blur.
 * Registered on window in CAPTURE phase so it wins over game listeners.
 */
export function captureNextInput(onDone, onCancel) {
  let done = false;
  const kd = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (e.code === 'Escape') { finish(null); return; }
    if (e.repeat) return;
    finish(e.code);
  };
  const md = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (e.button < 0 || e.button > 4) return;
    finish('Mouse' + e.button);
  };
  const cm = (e) => e.preventDefault();
  const onBlur = () => finish(null);
  const cleanup = () => {
    window.removeEventListener('keydown', kd, true);
    window.removeEventListener('mousedown', md, true);
    window.removeEventListener('contextmenu', cm, true);
    window.removeEventListener('blur', onBlur);
  };
  function finish(code) {
    if (done) return;
    done = true;
    cleanup();
    if (code) onDone(code); else onCancel();
  }
  window.addEventListener('keydown', kd, true);
  window.addEventListener('mousedown', md, true);
  window.addEventListener('contextmenu', cm, true);
  window.addEventListener('blur', onBlur);
}

/** Copy of the codes bound to an action. */
export function getBinds(action) { return (KEYBINDS[action] || []).slice(); }