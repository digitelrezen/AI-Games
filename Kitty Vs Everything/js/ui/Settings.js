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
export const VERSION = 'v3.55.0';

const STORAGE_KEY = 'kve-settings-v1';

// Numeric setting limits + factory defaults (single source of truth).
export const LIMITS = {
  spinSpeedKeyboard: { min: 0.25, max: 3, def: 1 },
  spinSpeedMouse:    { min: 0.1,  max: 3, def: 1 },
  audioMaster:       { min: 0,    max: 1, def: 1 },
  audioSfx:          { min: 0,    max: 1, def: 0.8 },
  audioMusic:        { min: 0,    max: 1, def: 0.4 },
  particleDensity:   { min: 0,    max: 2, def: 1 },
  crosshairOffset:   { min: 140,  max: 340, def: 140 }, // v3.48.0: reticle forward offset (logical px) · v3.55.0: range 140–340
};
const BOOLEANS = {
  screenShake: true,    // default ON (classic feel) — dev toggle in the settings panel
  screenBounds: false,  // v3.11.0 dev toggle: bounce walls vs classic wrap
  crosshair: true,      // v3.48.0: procedural aim reticle (Settings → FX, default ON)
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
  screenShake:       saved.screenShake !== false,
  screenBounds:      saved.screenBounds === true,
  crosshair:         saved.crosshair !== false,
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
  } else {
    return;
  }
  persist();
}

/** Restore every factory default and persist. */
export function resetSettings() {
  for (const [k, lim] of Object.entries(LIMITS)) SETTINGS[k] = lim.def;
  for (const [k, def] of Object.entries(BOOLEANS)) SETTINGS[k] = def;
  persist();
}
