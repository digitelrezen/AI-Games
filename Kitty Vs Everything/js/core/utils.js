// Filename: utils.js
// Kitty Vs Everything — v3.95.0
// Pure math/formatting helpers (no side effects).
// v3.3.0: Added hexA (hex + alpha → rgba string) for the catship art modules.
// v3.83.0: Added isOnScreen — live-viewport bounds check shared by the
//          off-screen kill gate (EnemyBase.applyDamage) and the drop
//          gating (js/core/DropManager.js).
// v3.88.0: Added disableImageSmoothing — global crisp pixel-art
//          enforcement helper (standard + webkit/moz/ms vendor-prefixed
//          fallbacks), applied at every 2D context initialization and
//          after canvas buffer resizes (which reset context state).
// v3.88.1: CRISP PASS ISOLATION — the helper now applies only to the
//          main gameplay canvas (Game.js init + ViewScaler.js re-apply
//          after each buffer resize) and the offscreen sprite buffers
//          (AssetManager.js, PowerUp.js); the hangar hero canvas keeps
//          default bilinear smoothing (smooth ship preview).
// v3.89.0: the hangar hero canvas (main.js) rejoins the crisp set — its
//          cat sprites are blitted at the integer HANGAR_K 1:1 scale, so
//          nearest-neighbor is exact (no blur, no jaggedness).
// v3.95.0: the hangar hero stays in the crisp set, but the blit is now
//          the shared in-game sprite pipeline (PlayerShipArt
//          .drawSpriteShip onto the 384×384 stage ×DPR buffer) — the
//          HANGAR_K / hangarMetrics / measureHangarSprite path is gone.

export const VERSION = 'v3.95.0';

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

/**
 * v3.88.0: crisp pixel-art enforcement — disables bilinear image
 * smoothing on a Canvas 2D context so drawImage() uses nearest-neighbor
 * scaling (no blur). Also sets the legacy vendor-prefixed variants
 * (webkit/moz/ms) where a browser still exposes them. v3.88.1: applied
 * only to the main gameplay canvas (Game.js init, ViewScaler.js after
 * each buffer resize) and the offscreen sprite-buffer contexts
 * (AssetManager, PowerUp) — the hangar hero canvas (main.js) kept
 * default bilinear smoothing. v3.89.0: the hangar hero canvas rejoins
 * the crisp set; v3.95.0: it now renders the shared in-game sprite
 * pipeline (PlayerShipArt.drawSpriteShip) onto the 384×384 stage ×DPR
 * buffer, so the buffer→CSS downsample is a uniform integer block and
 * nearest-neighbor is exact (no blur, no jaggedness).
 * Intentional one-shot asset downscale passes (Wasp2Sprite /
 * AsteroidSprite) opt back in locally on their own contexts.
 * @param {CanvasRenderingContext2D|null} ctx the 2D context to crisp up
 * @returns {CanvasRenderingContext2D|null} the same context (null-safe)
 */
export function disableImageSmoothing(ctx) {
  if (!ctx) return ctx;
  ctx.imageSmoothingEnabled = false;
  if ('webkitImageSmoothingEnabled' in ctx) ctx.webkitImageSmoothingEnabled = false;
  if ('mozImageSmoothingEnabled' in ctx) ctx.mozImageSmoothingEnabled = false;
  if ('msImageSmoothingEnabled' in ctx) ctx.msImageSmoothingEnabled = false;
  return ctx;
}