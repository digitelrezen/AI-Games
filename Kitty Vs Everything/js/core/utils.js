// Filename: utils.js
// Kitty Vs Everything — v3.83.0
// Pure math/formatting helpers (no side effects).
// v3.3.0: Added hexA (hex + alpha → rgba string) for the catship art modules.
// v3.83.0: Added isOnScreen — live-viewport bounds check shared by the
//          off-screen kill gate (EnemyBase.applyDamage) and the drop
//          gating (js/core/DropManager.js).

export const VERSION = 'v3.83.0';

export const TAU = Math.PI * 2;
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (min, max) => min + Math.random() * (max - min);
export const randInt = (min, max) => Math.floor(rand(min, max + 1));
export const dist2 = (ax, ay, bx, by) => { const dx = ax - bx; const dy = ay - by; return dx * dx + dy * dy; };
export const angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
/** Convert a #rrggbb (or #rgb) hex color to an rgba() string with alpha. */
export const hexA = (hex, alpha = 1) => {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r},${g},${b},${a})`;
};
export const formatTime = (secs) => {
  const s = Math.max(0, Math.floor(secs));
  const m = Math.floor(s / 60);
  return String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
};

/**
 * v3.83.0: live-viewport bounds check — true when (x, y) is inside the
 * logical viewport (game.W × game.H, the live ViewScaler bounds) with a
 * small margin, so entities that are half-visible still count as on-screen.
 * Shared by the off-screen kill gate (EnemyBase.applyDamage) and the drop
 * gating (js/core/DropManager.js).
 */
export function isOnScreen(game, x, y, r = 0) {
  const m = (r || 0) + 12;
  return x > -m && x < game.W + m && y > -m && y < game.H + m;
}