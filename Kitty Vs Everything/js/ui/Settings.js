// Filename: Settings.js
// Kitty Vs Everything — v3.55.0
// User-tunable settings (singleton + localStorage, same pattern as EventBus's
// `bus` and AudioSystem's `audio`).
// v3.5.0: spinSpeed (single shared multiplier).
// v3.11.0: screenBounds.
// v3.14.0: Modern UI settings pass —
//   • spinSpeed split into spinSpeedKeyboard + spinSpeedMouse (the legacy
//     shared spinSpeed value is migrated into BOTH on first load, so old
//     saves keep their exact feel; the old key is then retired)
//   • audio volume sliders (master / sfx / music) consumed by AudioSystem
//   • screenShake toggle (Game.render) and particleDensity slider
//     (ParticleSystem.burst).
// Keybind remapping lives in Keybinds.js (separate persistence, own module).
// v3.55.0: crosshairOffset range widened to 140–340 logical px (default 140);
// LIMITS is exported so Crosshair.js clamps the drawn offset to it.
// v3.78.0: controlMode enum setting (ENUMS) — 'strafe' (default; A/D slide
// the ship sideways, PlayerFlight.js) or 'spin' (classic keyboard rotation).
// v4.22.0: CROSSHAIR CUSTOMIZATION — crosshairColor (enum, red default) +
// crosshairStyle (enum, 'classic' default) + crosshairLength / crosshairSize
// sliders (0.5–2×); and gamepad (boolean, default ON) — Gamepad API
// controller support (js/input/Gamepad.js, Xbox standard mapping).
// v4.31.0: BASELINE SETTINGS — the SFX / music volume sliders are now
// multipliers around the mix baseline (SFX 40% / music 60% of full scale;
// master stays 100%): both sliders default to 0.5 so they read 50%, and
// AudioCore.setVolumes maps slider 50% → the baseline gains (SFX_BASELINE
// 0.40 / MUSIC_BASELINE 0.60; slider 100% = 2× baseline, 0% = silence).
// The crosshair starts OFF (opt-in in Settings → FX) and screen bounds
// start LOCKED (bounce walls, not classic wrap).
export const VERSION = 'v4.31.0';

const STORAGE_KEY = 'kve-settings-v1';

// Numeric setting limits + factory defaults (single source of truth).
export const LIMITS = {
  spinSpeedKeyboard: { min: 0.25, max: 3, def: 1 },
  spinSpeedMouse:    { min: 0.1,  max: 3, def: 1 },
  audioMaster:       { min: 0,    max: 1, def: 1 },
  audioSfx:          { min: 0,    max: 1, def: 0.5 },  // v4.31.0: × around the 40% SFX baseline (50% = baseline, 100% = 80%)
  audioMusic:        { min: 0,    max: 1, def: 0.5 },  // v4.31.0: × around the 60% music baseline (50% = baseline, 100% = 120%)
  particleDensity:   { min: 0,    max: 2, def: 1 },
  crosshairOffset:   { min: 140,  max: 340, def: 140 }, // v3.48.0: reticle forward offset (logical px) · v3.55.0: range 140–340
  crosshairLength:   { min: 0.5,  max: 2,   def: 1 },   // v4.22.0: reticle tick length (×, 50–200%)
  crosshairSize:     { min: 0.5,  max: 2,   def: 1 },   // v4.22.0: reticle overall size (×, 50–200%)
};
const BOOLEANS = {
  screenShake: true,    // default ON (classic feel) — dev toggle in the settings panel
  screenBounds: true,   // v4.31.0: default LOCKED (bounce walls) — was classic wrap
  crosshair: false,     // v4.31.0: procedural aim reticle (Settings → FX, default OFF)
  gamepad: true,        // v4.22.0: controller support (Gamepad API, Xbox standard mapping)
};

// v3.78.0: enum settings — a fixed value set + factory default (single
// source of truth for load-sanitize / setSetting / resetSettings).
// controlMode picks what A/D do in PlayerFlight.js: 'strafe' (lateral slide,
// default) or 'spin' (classic keyboard rotation).
// v4.22.0: crosshairColor (red default) + crosshairStyle ('classic' default)
// — the Settings → CROSSHAIR section (Crosshair.js palette / styles).
const ENUMS = {
  controlMode: { values: ['strafe', 'spin'], def: 'strafe' },
  crosshairColor: { values: ['red', 'green', 'yellow', 'blue', 'white'], def: 'red' },
  crosshairStyle: { values: ['classic', 'brackets', 'diamond', 'dot'], def: 'classic' },
};

function loadSaved() {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) || {};
    }
  } catch {}
  return {};
}

const saved = loadSaved();

// ─── BACKWARD MIGRATION (v3.14.0) ───
// Saves from v3.5.0–v3.13.0 store one shared `spinSpeed`. Seed both new
// per-input sensitivities from it (only if the new keys are absent) so the
// old save feels identical, then drop the legacy key on the next persist.
if (saved.spinSpeed != null && saved.spinSpeedKeyboard == null) {
  saved.spinSpeedKeyboard = saved.spinSpeed;
}
if (saved.spinSpeed != null && saved.spinSpeedMouse == null) {
  saved.spinSpeedMouse = saved.spinSpeed;
}
delete saved.spinSpeed;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
// parseFloat of a missing/invalid saved value is NaN — `??` would NOT catch
// that (NaN is not nullish) and a fresh browser would get NaN volumes. 0 is a
// valid saved value (muted), so `||` is wrong too: test finiteness instead.
const num = (v, lim) => {
  const n = parseFloat(v);
  return clamp(Number.isFinite(n) ? n : lim.def, lim.min, lim.max);
};

export const SETTINGS = {
  spinSpeedKeyboard: num(saved.spinSpeedKeyboard, LIMITS.spinSpeedKeyboard),
  spinSpeedMouse:    num(saved.spinSpeedMouse,    LIMITS.spinSpeedMouse),
  audioMaster:       num(saved.audioMaster,       LIMITS.audioMaster),
  audioSfx:          num(saved.audioSfx,          LIMITS.audioSfx),
  audioMusic:        num(saved.audioMusic,        LIMITS.audioMusic),
  particleDensity:   num(saved.particleDensity,   LIMITS.particleDensity),
  crosshairOffset:   num(saved.crosshairOffset,   LIMITS.crosshairOffset),
  crosshairLength:   num(saved.crosshairLength,   LIMITS.crosshairLength),   // v4.22.0
  crosshairSize:     num(saved.crosshairSize,     LIMITS.crosshairSize),     // v4.22.0
  screenShake:       saved.screenShake !== false,
  screenBounds:      saved.screenBounds !== false,  // v4.31.0: default ON (locked); explicit saved wrap still honored
  crosshair:         saved.crosshair === true,      // v4.31.0: default OFF; explicit saved ON still honored
  gamepad:           saved.gamepad !== false,   // v4.22.0: controller support (default ON)
  // v3.78.0: A/D control mode — 'strafe' (default) or 'spin' (classic rotation)
  controlMode:       ENUMS.controlMode.values.includes(saved.controlMode) ? saved.controlMode : ENUMS.controlMode.def,
  // v4.22.0: crosshair customization (Settings → CROSSHAIR)
  crosshairColor:    ENUMS.crosshairColor.values.includes(saved.crosshairColor) ? saved.crosshairColor : ENUMS.crosshairColor.def,
  crosshairStyle:    ENUMS.crosshairStyle.values.includes(saved.crosshairStyle) ? saved.crosshairStyle : ENUMS.crosshairStyle.def,
};

function persist() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SETTINGS));
    }
  } catch {}
}

/** Set a setting (clamped to its limits) and persist immediately. */
export function setSetting(key, value) {
  if (LIMITS[key]) {
    SETTINGS[key] = clamp(parseFloat(value) ?? LIMITS[key].def, LIMITS[key].min, LIMITS[key].max);
  } else if (key in BOOLEANS) {
    SETTINGS[key] = !!value;
  } else if (ENUMS[key]) {
    if (!ENUMS[key].values.includes(value)) return; // v3.78.0: unknown enum value — ignore
    SETTINGS[key] = value;
  } else {
    return;
  }
  persist();
}

/** Restore every factory default and persist. */
export function resetSettings() {
  for (const [k, lim] of Object.entries(LIMITS)) SETTINGS[k] = lim.def;
  for (const [k, def] of Object.entries(BOOLEANS)) SETTINGS[k] = def;
  for (const [k, e] of Object.entries(ENUMS)) SETTINGS[k] = e.def; // v3.78.0
  persist();
}
