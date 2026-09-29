// Filename: Viewport.js
// Kitty Vs Everything — v3.13.0
// Pure viewport fit math (no DOM): given the window size, compute
//   • scale      — uniform CSS scale (the stage is NEVER distorted)
//   • viewW/H    — the LOGICAL visible area in game coordinates. The
//                  constrained axis stays at its native GAME.W/H size and
//                  the other axis STRETCHES to fill the window exactly, so
//                  ultra-wide (and portrait) displays show a seamless,
//                  letterbox-free world: 1280×720 on 16:9, ~1720×720 on
//                  3440×1440, 2560×720 on 5120×1440, etc.
//   • q          — crisp buffer scale (≈ scale × devicePixelRatio, capped)
//   • bufW/H     — canvas buffer size = viewW×q × viewH×q. The buffer
//                  matches the viewport aspect ratio (no forced uniform
//                  16:9 buffer) and lands EXACTLY on the native pixel size
//                  for the supported ultra-wide presets below.
// v3.13.0: New module — extracted from ViewScaler.js so the fit logic
//          (incl. the native ultra-wide preset table) stays testable and
//          the files stay small. ViewScaler.js applies the result to the
//          DOM (#game-root size + transform) and the canvas buffer.
export const VERSION = 'v3.13.0';
import { GAME } from './config.js';
import { clamp } from './utils.js';

/** Buffer scale cap — canvas buffer = view × q (max 3840×2160-class). */
export const MAX_BUFFER_SCALE = 3;

/**
 * Native ultra-wide resolutions with first-class support.
 * At these window sizes the fit scale is exact (2.0× at DPR 1), so the
 * canvas buffer lands on the display's NATIVE pixel size — crisp 1:1:
 *   3440×1440 → 1720×720 logical view → 3440×1440 buffer
 *   5120×1440 → 2560×720 logical view → 5120×1440 buffer
 * (Any other aspect ratio is handled seamlessly by the generic math.)
 */
export const ULTRA_WIDE_PRESETS = [
  { w: 3440, h: 1440, label: '3440×1440 · 21:9 UWQHD (native)' },
  { w: 5120, h: 1440, label: '5120×1440 · 32:9 (native)' },
];

/** Tolerance (px) for matching a window size to a native preset. */
const PRESET_MATCH_TOLERANCE = 4;

/**
 * Compute the viewport fit for a window of winW×winH CSS pixels.
 * @param {number} winW   window.innerWidth
 * @param {number} winH   window.innerHeight
 * @param {number} dpr    devicePixelRatio (≥1)
 * @returns {{scale:number, viewW:number, viewH:number, q:number,
 *            bufW:number, bufH:number, preset:object|null}}
 */
export function computeViewport(winW, winH, dpr = 1) {
  const win = { w: Math.max(1, Math.floor(winW)), h: Math.max(1, Math.floor(winH)) };
  // Uniform scale that fits the BASE stage (GAME.W × GAME.H) into the
  // window — on ultra-wide the height binds, on portrait the width binds.
  const scale = Math.min(win.w / GAME.W, win.h / GAME.H);

  // Logical visible area: divide the window back by the scale. The
  // constrained axis returns exactly GAME.W (or GAME.H); the other axis
  // grows proportionally to the aspect ratio → zero black bars.
  // Rounded to 1/100 px to keep the CSS stage size stable (no sub-pixel
  // jitter while the window is resized).
  const viewW = Math.round((win.w / scale) * 100) / 100;
  const viewH = Math.round((win.h / scale) * 100) / 100;

  // Native ultra-wide preset match (explicit 3440×1440 / 5120×1440 support).
  const preset = ULTRA_WIDE_PRESETS.find(
    (p) => Math.abs(win.w - p.w) <= PRESET_MATCH_TOLERANCE &&
           Math.abs(win.h - p.h) <= PRESET_MATCH_TOLERANCE
  ) || null;

  // Crisp buffer: q ≈ scale × DPR (capped). Because viewW×scale ≈ win.w,
  // bufW ≈ win.w × min(1, 3/dpr) — on the native presets at DPR 1 the
  // buffer is EXACTLY the display's native resolution (1:1, no resampling).
  const q = Math.round(clamp(scale * dpr, 1, MAX_BUFFER_SCALE));
  const bufW = Math.round(viewW * q);
  const bufH = Math.round(viewH * q);

  return { scale, viewW, viewH, q, bufW, bufH, preset };
}

/**
 * One-line human-readable description of the current viewport (DevPanel).
 * @param {object} vp result of computeViewport()
 * @param {number} winW window.innerWidth
 * @param {number} winH window.innerHeight
 */
export function describeViewport(vp, winW, winH) {
  const aspect = (winW / Math.max(1, winH)).toFixed(2) + ':1';
  const tag = vp.preset ? ' · ' + vp.preset.label : '';
  return `${winW}×${winH} (${aspect}) → ${vp.viewW}×${vp.viewH} logical · ` +
         `scale ${vp.scale.toFixed(2)}× · buffer ${vp.bufW}×${vp.bufH}${tag}`;
}