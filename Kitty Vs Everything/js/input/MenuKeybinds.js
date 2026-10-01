// Filename: MenuKeybinds.js
// Kitty Vs Everything — v3.47.0
// Select-screen keybind footer (#menu-keybinds — the old hardcoded
// .controls-help block in index.html). Renders the player's ACTIVE
// keybinds from the live KEYBINDS table (Keybinds.js) — the same source
// of truth the Settings page rebinds — and re-renders instantly on
// every 'keybindsChanged' bus event (setBind / removeBind / resetBinds
// all emit it, so the footer tracks the Settings page live, rebind by
// rebind, and is always correct when the menu is next shown).
//
// Display rules:
//   • An action still on its factory DEFAULT_BINDS set shows the
//     standard default label (WSAD / Q / E / R / F / T / Left Click /
//     Right Click) — the standard default set.
//   • A customized action shows its real bound keys (LMB / MMB / RMB
//     for mouse buttons, codeLabel for everything else).
//   • Esc (Menu), M (Fire Control Panel), U (Fullscreen) and F9
//     (Admin Panel) are fixed system keys — they live in PauseMenu /
//     HUDFireControl / ViewScaler / DevPanel, not in the remappable
//     table, so they always show their standard labels.
// v3.47.0: new 'T: Synergy Explosion' row (after 'F: Super') — the
//          key-triggered Synergy Explosion ('synergy' action, T / -).
export const VERSION = 'v3.47.0';
import { bus } from '../core/EventBus.js';
import { getBinds, codeLabel, DEFAULT_BINDS, MOUSE_BUTTON_NAMES } from './Keybinds.js';

// The four flight actions behind the standard "WSAD" row, in display
// order: Forward / Back-stop / Spin Left / Spin Right.
const WSAD_ACTIONS = ['thrust', 'brake', 'rotateLeft', 'rotateRight'];

// Standard default-set key labels (shown while an action is unmodified).
const STANDARD = {
  wsad: 'WSAD',
  stun: 'Q',
  napalm: 'E',
  cycleWeapon: 'R',
  ultimate: 'F',
  synergy: 'T',
  fire: 'Left Click',
  boost: 'Right Click',
};

// Footer row spec — order + labels of the standard default set.
const ROWS = [
  { kind: 'wsad', label: 'Forward, Back/stop, Spin Left, Spin Right' },
  { kind: 'action', action: 'stun', label: 'Stun Rockets' },
  { kind: 'action', action: 'napalm', label: 'Napalm' },
  { kind: 'action', action: 'cycleWeapon', label: 'Weapon Switch' },
  { kind: 'action', action: 'ultimate', label: 'Super' },
  { kind: 'action', action: 'synergy', label: 'Synergy Explosion' },
  { kind: 'action', action: 'fire', label: 'Fire Weapon' },
  { kind: 'action', action: 'boost', label: 'Boost' },
  { kind: 'static', keys: ['Esc'], label: 'Menu' },
  { kind: 'static', keys: ['M'], label: 'Minimize Fire Control Panel (Toggle)' },
  { kind: 'static', keys: ['U'], label: 'Fullscreen Toggle' },
  { kind: 'static', keys: ['F9'], label: 'Admin Panel' },
];

/** Short display label for one bound code (mouse buttons stay compact). */
function shortLabel(code) {
  if (MOUSE_BUTTON_NAMES[code]) return MOUSE_BUTTON_NAMES[code];
  return codeLabel(code);
}

/** True when the action's live binds are exactly the factory defaults. */
function isDefault(action) {
  const cur = getBinds(action);
  const def = DEFAULT_BINDS[action];
  return cur.length === def.length && cur.every((c, i) => c === def[i]);
}

/** Display keys for one footer row (array of strings, one <kbd> each). */
function rowKeys(row) {
  if (row.kind === 'static') return row.keys;
  if (row.kind === 'wsad') {
    if (WSAD_ACTIONS.every(isDefault)) return [STANDARD.wsad];
    // Customized: show each flight action's primary key, W S A D order.
    return WSAD_ACTIONS.map((a) => {
      const codes = getBinds(a);
      return codes.length ? shortLabel(codes[0]) : '—';
    });
  }
  if (isDefault(row.action)) return [STANDARD[row.action]];
  const codes = getBinds(row.action);
  return codes.length ? codes.map(shortLabel) : ['—'];
}

export default class MenuKeybinds {
  constructor(elId = 'menu-keybinds') {
    this.el = document.getElementById(elId);
    this._onChanged = () => this.render();
    bus.on('keybindsChanged', this._onChanged);
    this.render();
  }

  /** Rebuild the footer from the live KEYBINDS table. */
  render() {
    if (!this.el) return;
    this.el.textContent = '';
    for (const row of ROWS) {
      const line = document.createElement('div');
      line.className = row.kind === 'wsad' ? 'menu-kb-row menu-kb-wide' : 'menu-kb-row';

      const keys = document.createElement('span');
      keys.className = 'menu-kb-keys';
      for (const k of rowKeys(row)) {
        const kbd = document.createElement('kbd');
        kbd.textContent = k;
        keys.appendChild(kbd);
      }

      const label = document.createElement('span');
      label.className = 'menu-kb-label';
      label.textContent = row.label;

      line.appendChild(keys);
      line.appendChild(label);
      this.el.appendChild(line);
    }
  }

  /** Unsubscribe from the bus (parity with the other bus consumers). */
  destroy() {
    bus.off('keybindsChanged', this._onChanged);
  }
}