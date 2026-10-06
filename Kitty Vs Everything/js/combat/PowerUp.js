// Filename: PowerUp.js
// Kitty Vs Everything — v3.59.0
// Falling drops: extra life, shield, mini-ship, destructible bonus crate,
// the rare Bender (easter egg, v3.24.0), hull health (v3.33.0) and FRENZY
// (v3.33.0 — 30s all-cooldowns-off, Vulcan overheat neutralized).
// v3.59.0: DOUBLE-SIZED ICONS — every drop icon renders at 2× the v3.58.x
//          size: JEWEL_BOX 28 → 56 (sprite fit box), JEWEL_BUF 40 → 80
//          (offscreen buffer), and every jewel-pipeline geometry constant
//          is doubled (bevel, vignette, glint, rim, twinkle, aura 22 → 44,
//          shimmer 13.5 → 27, sparkle orbit 10–18 → 20–36, sparkle size).
//          The robot drop (28 → 56 tall), the crate sprite box (28 → 56) +
//          HP bar + procedural crate, the mini fallback poster (28×28 →
//          56×56) and all procedural glyph fallbacks (heart / shield /
//          health cross / frenzy bolt / cat head / robot silhouette)
//          double with them, and the pickup hitbox doubles too (drop
//          14 → 28, crate 18 → 36) so the catch radius tracks the art.
// v3.58.0: batch power-up pixel-art integration — ALL FIVE drop types now
//          draw the shared pill/poster pixel art through drawJewelDrop():
//   life    blue pill   (.assets/Powerup-BluePill-ExtraLife.png 256×92 → 128×46)
//   health  green pill  (.assets/Powerup-GreanPill-health.png 284×110 → 128×50)
//   frenzy  red pill    (.assets/Powerup-RedPill-Frenzy.png 250×80 → 128×41)
//   shield  yellow pill (.assets/Powerup-YellowPill-Shield.png 284×110 → 128×50)
//   mini    wanted cat  (.assets/Wanted-Cat-pixel-art.png 369×602 → 78×128)
//          Each drop gets a COLOR-MATCHED additive aura (JEWEL palette:
//          blue / green / red / gold / bounty white-gold) and a floating
//          SPARKLE particle field (drawSparkles(), PASS 6) in the pill's
//          own theme color. The health and mini drops now route through
//          the jewel pass too (mini falls back to the embedded 28×28
//          poster, then the classic cat head). PASS-ORDER FIX: the buffered
//          icon is now blitted AFTER the source-atop DEPTH + SHINE passes
//          (v3.51.0 blitted before them, so the bevel/shine never reached
//          the screen). drawJewelDrop() is now 6 passes:
//            PASS 1  DEPTH     (buffer) source-atop bevel + inset vignette
//            PASS 2  SHINE     (buffer) specular glint + rim arc + twinkle
//            PASS 3  AURA      (canvas) pulsating additive radial glow
//            PASS 4  BASE      (canvas) buffered icon blitted 1:1 (crisp)
//            PASS 5  SHIMMER   (canvas) rotating perimeter shimmer (additive)
//            PASS 6  SPARKLES  (canvas) floating theme-colored 4-pt twinkles
//          Procedural fallbacks unchanged; headless smoke path draws base only.
// v3.58.1: BUG FIX — the 'mini' drop was still drawing the OLD embedded
//          28×28 MiniPosterSprite (base64 in MiniPosterSprite.js) instead
//          of the imported "wanted" pixel art. The mini case now draws
//          drawSpriteIcon(c, 'mini', JEWEL_BOX) → AssetManager key
//          "wanted" (.assets/Wanted-Cat-pixel-art.png 369×602 → 78×128);
//          the old 28×28 poster stays the null-sprite fallback, then the
//          classic cat head.
// v3.36.0: bonus crate drop joins the PNG pipeline (key "crate",
//          .assets/Crate-pixel-art.png, 620×574 → 128×119) — nearest-neighbor,
//          aspect-preserving; the procedural wooden crate is the null-sprite
//          fallback and the crate HP bar still draws over the sprite.
// v3.33.0: health / life / shield / frenzy drops draw the shared transparent
//          PNGs via AssetManager.js (imported + validated by
//          tools/import-assets.mjs) — nearest-neighbor, aspect-preserving,
//          centered on the r=14 hitbox. Each type keeps its procedural glyph
//          as the fallback while the sprite decodes (or if the asset is
//          missing/corrupt).

export const VERSION = 'v3.88.1';
import { TAU, disableImageSmoothing } from '../core/utils.js'; // v3.88.0: crisp pixel-art enforcement
import { getMiniPosterSprite } from '../levels/MiniPosterSprite.js';
import { getBenderFull, BENDER_BODY_W, BENDER_BODY_H } from '../core/BenderSprite.js'; // v3.28.0: tiny full-body Bender icon for the 'robot' drop
import { getSprite, getDims, POWERUP_ASSETS } from '../core/AssetManager.js'; // v3.33.0: shared PNG pipeline

/** v3.33.0: draw a power-up's shared PNG icon centered on the origin,
 *  fitted inside a `box`-px square (aspect preserved, nearest-neighbor).
 *  Returns true when the sprite drew, false when the caller should fall
 *  back to the procedural glyph (sprite still decoding / asset missing). */
function drawSpriteIcon(ctx, type, box) {
  const key = POWERUP_ASSETS[type];
  const sprite = key ? getSprite(key) : null;
  const dims = key ? getDims(key) : null;
  if (!sprite || !dims) return false;
  ctx.imageSmoothingEnabled = false;
  const scale = Math.min(box / dims.w, box / dims.h);
  const w = dims.w * scale;
  const h = dims.h * scale;
  ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
  return true;
}

// ═══ v3.58.0: JEWEL SHADING — all five pill/poster drops ═══════════════════
// The five "valuable" drops (life / health / frenzy / shield / mini) render
// through drawJewelDrop(), a 6-pass programmatic gem treatment:
//   1. DEPTH   — source-atop bevel: linear gradient (bright top-left → dark
//                bottom-right) + an inset vignette → faceted 3D look.
//   2. SHINE   — source-atop specular glint: white radial on the top-right
//                face + a bright rim arc + a twinkling 4-point star
//                ('lighter') → gemstone light refraction.
//   3. AURA    — pulsating additive halo in the type's PILL COLOR, drawn
//                behind the icon ('lighter' composite).
//   4. BASE    — the pixel-art sprite (or the procedural fallback) rendered
//                into a small offscreen buffer centered on its origin,
//                blitted 1:1 AFTER passes 1–2 (v3.58.0 pass-order fix — the
//                v3.51.0 blit ran before them, so the bevel/shine never
//                reached the screen).
//   5. SHIMMER — additive rotating arc on the icon perimeter.
//   6. SPARKLES — floating theme-colored 4-point twinkles (drawSparkles).
// The buffer is exactly final size (1:1 blit), so nearest-neighbor pixel
// art stays crisp; the gradients are smooth by nature.
// v3.58.0: aura colors now match the NEW PILL ART exactly — blue pill
// (extra life), green pill (health), red pill (frenzy), yellow pill
// (shield) — and the Wanted poster (mini) glows bounty white-gold.

const JEWEL = {
  life:   { aura: '64, 140, 255',  glint: '224, 240, 255' },  // blue pill
  health: { aura: '64, 220, 110',  glint: '224, 255, 236' },  // green pill
  frenzy: { aura: '255, 64, 54',   glint: '255, 232, 224' },  // red pill
  shield: { aura: '255, 205, 40',  glint: '255, 248, 224' },  // yellow pill
  mini:   { aura: '255, 220, 120', glint: '255, 255, 255' },  // bounty white-gold
  coin:   { aura: '255, 200, 40',  glint: '255, 250, 230' },  // gold coin (v3.86.0)
};
const JEWEL_BOX = 56;   // v3.59.0: icon fit box — 2× the v3.58.x 28 (double-sized icons)
const JEWEL_BUF = 80;   // v3.59.0: offscreen buffer — icon 56 + headroom (2× the v3.58.x 40)

const jewelBuffers = new Map(); // type → { c: canvas, ctx: 2d } (lazy)

/** v3.51.0: lazily create the per-type jewel buffer. Returns null in
 *  headless / no-DOM contexts (the drop then draws its base directly). */
function getJewelBuffer(type) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
  let b = jewelBuffers.get(type);
  if (!b) {
    const c = document.createElement('canvas');
    const g = c && typeof c.getContext === 'function' ? c.getContext('2d') : null;
    if (!c || !g) return null;
    c.width = JEWEL_BUF;
    c.height = JEWEL_BUF;
    // v3.88.0: crisp pixel-art — nearest-neighbor on the jewel icon
    // buffer context (the width/height assignments above reset the
    // context state, so this runs AFTER the sizing).
    disableImageSmoothing(g);
    b = { c, ctx: g };
    jewelBuffers.set(type, b);
  }
  return b;
}

// ═══ v3.58.0: SPARKLE PARTICLES — floating theme-colored twinkles ══════════
// Each drop type carries a deterministic field of 4-point sparkle stars
// (no per-instance state → headless-safe, cheap): they orbit the icon on
// slow individual phases while drifting upward, twinkling (alpha pulse)
// and fading as they rise — a "bountiful gem" ambient effect in the pill's
// exact theme color (blue / green / red / gold / bounty white-gold).
const SPARKLES = {
  life:   { rgb: '110, 180, 255', count: 7 },  // blue pill (extra life)
  health: { rgb: '110, 240, 150', count: 7 },  // green pill (health)
  frenzy: { rgb: '255, 100, 90',  count: 7 },  // red pill (frenzy)
  shield: { rgb: '255, 214, 90',  count: 7 },  // yellow pill (shield)
  mini:   { rgb: '255, 236, 170', count: 8 },  // gold/white bounty (wanted)
  coin:   { rgb: '255, 214, 90',  count: 8 },  // gold coin (v3.86.0)
};

/** v3.58.0: deterministic 0..1 hash from an integer seed (sin hash). */
function sparkleSeed(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** v3.58.0: per-type integer hash so each drop's sparkle field is unique. */
function sparkleTypeHash(type) {
  let h = 7;
  for (let i = 0; i < type.length; i++) h = (h * 31 + type.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** v3.58.0: 4-point sparkle star path centered at (x, y), arm length s. */
function sparkleStar(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y - s * 1.9);
  ctx.lineTo(x + s * 0.45, y - s * 0.45);
  ctx.lineTo(x + s * 1.9, y);
  ctx.lineTo(x + s * 0.45, y + s * 0.45);
  ctx.lineTo(x, y + s * 1.9);
  ctx.lineTo(x - s * 0.45, y + s * 0.45);
  ctx.lineTo(x - s * 1.9, y);
  ctx.lineTo(x - s * 0.45, y - s * 0.45);
  ctx.closePath();
  ctx.fill();
}

/**
 * v3.58.0: PASS 6 — draw the type's floating sparkle field (additive,
 * theme color). Deterministic per (type, index): no state, headless-safe.
 */
function drawSparkles(ctx, type, t) {
  const sp = SPARKLES[type];
  if (!sp) return;
  const base = sparkleTypeHash(type);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < sp.count; i++) {
    const k = base + i * 17;
    const h1 = sparkleSeed(k + 1);   // ring radius
    const h2 = sparkleSeed(k + 2);   // orbit + twinkle speed
    const h3 = sparkleSeed(k + 3);   // phase + size
    const h4 = sparkleSeed(k + 4);   // rise speed
    const orbit = 20 + 16 * h1;                           // 20–36 px ring (v3.59.0: 2×)
    const speed = 0.5 + 0.9 * h2;                         // 0.5–1.4 rad/s
    const phase = h3 * TAU;
    const rise = (t * (6 + 6 * h4) + h1 * 52) % 52;       // 0–52 px cycle (v3.59.0: 2×)
    const x = Math.cos(phase + t * speed) * orbit;
    const y = Math.sin(phase + t * speed) * orbit * 0.55 + 20 - rise;
    const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(t * (2.4 + 2.2 * h2) + phase * 3));
    const alpha = (0.2 + 0.55 * twinkle) * (1 - 0.55 * (rise / 52));
    ctx.fillStyle = 'rgba(' + sp.rgb + ',' + alpha.toFixed(3) + ')';
    sparkleStar(ctx, x, y, 2.2 + 3 * h3);
  }
  ctx.restore();
}

/**
 * v3.51.0 (v3.58.0: 6 passes + pass-order fix): draw a power-up icon with
 * the programmatic JEWEL treatment. `drawBase(c)` renders the original icon
 * (sprite or procedural fallback) centered on the origin of the 2D context
 * `c`. Pipeline: depth bevel → specular shine → aura → base blit → shimmer
 * → sparkles. Headless-safe: with no DOM canvas it just draws the base
 * directly.
 */
function drawJewelDrop(ctx, type, t, drawBase) {
  const j = JEWEL[type];
  if (!j) { drawBase(ctx); return; }
  const buf = getJewelBuffer(type);
  if (!buf) { drawBase(ctx); return; }  // headless / no 2d context
  const b = buf.ctx;
  b.clearRect(0, 0, JEWEL_BUF, JEWEL_BUF);
  b.save();
  b.translate(JEWEL_BUF / 2, JEWEL_BUF / 2);
  drawBase(b);
  b.restore();

  // ── PASS 1: DEPTH — bevel + inset vignette on opaque pixels only ────
  b.save();
  b.globalCompositeOperation = 'source-atop';
  const bevel = b.createLinearGradient(-28, -28, 28, 28);
  bevel.addColorStop(0, 'rgba(255, 255, 255, 0.40)');
  bevel.addColorStop(0.38, 'rgba(255, 255, 255, 0.10)');
  bevel.addColorStop(0.55, 'rgba(0, 0, 0, 0.00)');
  bevel.addColorStop(1, 'rgba(0, 0, 0, 0.42)');
  b.fillStyle = bevel;
  b.fillRect(0, 0, JEWEL_BUF, JEWEL_BUF);
  const vig = b.createRadialGradient(JEWEL_BUF / 2, JEWEL_BUF / 2, 16, JEWEL_BUF / 2, JEWEL_BUF / 2, 40);
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(0.72, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, 'rgba(0, 0, 0, 0.30)');
  b.fillStyle = vig;
  b.fillRect(0, 0, JEWEL_BUF, JEWEL_BUF);

  // ── PASS 2: SHINE — specular glint, rim arc + twinkling 4-pt star ───
  b.globalCompositeOperation = 'source-atop';
  const glint = b.createRadialGradient(12, -12, 0, 12, -12, 26);
  glint.addColorStop(0, 'rgba(' + j.glint + ', 0.85)');
  glint.addColorStop(0.35, 'rgba(255, 255, 255, 0.30)');
  glint.addColorStop(1, 'rgba(255, 255, 255, 0)');
  b.fillStyle = glint;
  b.beginPath(); b.arc(12, -12, 26, 0, TAU); b.fill();
  b.globalCompositeOperation = 'lighter';
  b.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  b.lineWidth = 3;
  b.beginPath(); b.arc(0, 0, 22, -2.4, -0.55); b.stroke();
  const tw = 0.5 + 0.5 * Math.sin(t * 5.1 + 1.3);
  if (tw > 0.25) {
    const sx = 10, sy = -14, s = 5.2 * tw;
    b.fillStyle = 'rgba(255, 255, 255, ' + (0.9 * tw).toFixed(3) + ')';
    b.beginPath();
    b.moveTo(sx, sy - s); b.lineTo(sx + s * 0.3, sy - s * 0.3);
    b.lineTo(sx + s, sy); b.lineTo(sx + s * 0.3, sy + s * 0.3);
    b.lineTo(sx, sy + s); b.lineTo(sx - s * 0.3, sy + s * 0.3);
    b.lineTo(sx - s, sy); b.lineTo(sx - s * 0.3, sy - s * 0.3);
    b.closePath(); b.fill();
  }
  b.restore();

  // ── PASS 3: AURA — pulsating additive halo (type's pill color) ───────
  const pulse = 0.55 + 0.45 * Math.sin(t * 3.2);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const aura = ctx.createRadialGradient(0, 0, 10, 0, 0, 44);
  aura.addColorStop(0, 'rgba(' + j.aura + ', ' + (0.38 * pulse).toFixed(3) + ')');
  aura.addColorStop(0.55, 'rgba(' + j.aura + ', ' + (0.14 * pulse).toFixed(3) + ')');
  aura.addColorStop(1, 'rgba(' + j.aura + ', 0)');
  ctx.fillStyle = aura;
  ctx.beginPath(); ctx.arc(0, 0, 44, 0, TAU); ctx.fill();
  ctx.restore();

  // ── PASS 4: BASE — blit the buffered icon (1:1, crisp pixel art) ────
  // v3.58.0: blit AFTER passes 1–2 (v3.51.0 blitted before them, so the
  // bevel/shine never reached the screen).
  ctx.drawImage(buf.c, -JEWEL_BUF / 2, -JEWEL_BUF / 2);

  // ── PASS 5: SHIMMER — rotating additive arc on the perimeter ────────
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = 'rgba(' + j.glint + ', 0.5)';
  ctx.lineWidth = 3;
  const a0 = t * 2.2;
  ctx.beginPath(); ctx.arc(0, 0, 27, a0, a0 + 1.1); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 27, a0 + Math.PI, a0 + Math.PI + 0.7); ctx.stroke();
  ctx.restore();

  // ── PASS 6: SPARKLES — floating theme-colored twinkles (v3.58.0) ─────
  drawSparkles(ctx, type, t);
}

export default class PowerUp {
  constructor({ x, y, type, game }) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.game = game;
    this.alive = true;
    this.t = 0;
    this.radius = type === 'crate' ? 36 : 28; // v3.59.0: 2× hitbox (drop 28, crate 36)
    this.vy = type === 'crate' ? 90 : 70;
    this.destructible = type === 'crate'; // crates must be SHOT, not caught
    this.hp = this.destructible ? 30 : 0;
    this.maxHp = this.hp;
  }
  update(dt) {
    this.t += dt;
    this.y += this.vy * dt;
    if (this.y > this.game.H + 40) this.alive = false;
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y + Math.sin(this.t * 4) * 3);
    switch (this.type) {
      case 'life': {
        // v3.58.0: EXTRA LIFE — blue pill pixel-art
        // (.assets/Powerup-BluePill-ExtraLife.png via AssetManager) through
        // the 6-pass jewel pipeline (depth → shine → blue aura → blit →
        // shimmer → blue sparkles). The classic red heart stays the
        // null-sprite fallback and runs through the same pass.
        drawJewelDrop(ctx, 'life', this.t, (c) => {
          if (!drawSpriteIcon(c, 'life', JEWEL_BOX)) {
            c.fillStyle = '#ff5252';
            c.beginPath();
            c.moveTo(0, 16);
            c.bezierCurveTo(-28, -8, -16, -32, 0, -16);
            c.bezierCurveTo(16, -32, 28, -8, 0, 16);
            c.fill();
          }
        });
        break;
      }
      case 'shield': {
        // v3.58.0: SHIELD — yellow pill pixel-art
        // (.assets/Powerup-YellowPill-Shield.png via AssetManager) through
        // the 6-pass jewel pipeline (depth → shine → gold aura → blit →
        // shimmer → gold sparkles). The cyan hexagon outline stays the
        // null-sprite fallback and runs through the same pass.
        drawJewelDrop(ctx, 'shield', this.t, (c) => {
          if (!drawSpriteIcon(c, 'shield', JEWEL_BOX)) {
            c.strokeStyle = '#4fc3f7';
            c.lineWidth = 6;
            c.beginPath();
            for (let i = 0; i < 6; i++) {
              const a = (i / 6) * TAU - Math.PI / 2;
              const px = Math.cos(a) * 28, py = Math.sin(a) * 28;
              if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
            }
            c.closePath();
            c.stroke();
          }
        });
        break;
      }
      case 'health': {
        // v3.58.0: HULL REPAIR — green pill pixel-art
        // (.assets/Powerup-GreanPill-health.png via AssetManager) through
        // the 6-pass jewel pipeline (depth → shine → green aura → blit →
        // shimmer → green sparkles). The green cross stays the null-sprite
        // fallback and runs through the same pass.
        drawJewelDrop(ctx, 'health', this.t, (c) => {
          if (!drawSpriteIcon(c, 'health', JEWEL_BOX)) {
            c.fillStyle = '#66bb6a';
            c.fillRect(-8, -24, 16, 48);
            c.fillRect(-24, -8, 48, 16);
          }
        });
        break;
      }
      case 'frenzy': {
        // v3.58.0: FRENZY — red pill pixel-art
        // (.assets/Powerup-RedPill-Frenzy.png via AssetManager) through
        // the 6-pass jewel pipeline (depth → shine → red aura → blit →
        // shimmer → red sparkles). The classic gold bolt stays the
        // null-sprite fallback and runs through the same pass.
        drawJewelDrop(ctx, 'frenzy', this.t, (c) => {
          if (!drawSpriteIcon(c, 'frenzy', JEWEL_BOX)) {
            c.fillStyle = '#ffd600';
            c.beginPath();
            c.moveTo(6, -28); c.lineTo(-14, 4); c.lineTo(-2, 4);
            c.lineTo(-6, 28); c.lineTo(14, -4); c.lineTo(2, -4);
            c.closePath();
            c.fill();
          }
        });
        break;
      }
      case 'mini': {
        // v3.58.1: "Adopt Me!" WANTED poster — the NEW pixel art
        // (.assets/Wanted-Cat-pixel-art.png 369×602 → 78×128, AssetManager
        // key "wanted") through the 6-pass jewel pipeline (depth → shine →
        // bounty white-gold aura → blit → shimmer → gold sparkles).
        // v3.58.0 bug fix: this case used to blit the OLD embedded 28×28
        // MiniPosterSprite instead of the imported "wanted" asset. Fallback
        // chain: old 28×28 poster (null-sprite safety net) → classic cat
        // head.
        drawJewelDrop(ctx, 'mini', this.t, (c) => {
          if (!drawSpriteIcon(c, 'mini', JEWEL_BOX)) {
            const poster = getMiniPosterSprite();
            if (poster) {
              c.imageSmoothingEnabled = false;
              c.drawImage(poster, -28, -28, 56, 56);
            } else {
              c.fillStyle = '#ff9d3b';
              c.beginPath(); c.arc(0, 4, 18, 0, TAU); c.fill();
              c.beginPath(); c.moveTo(-12, -8); c.lineTo(-18, -26); c.lineTo(-2, -12); c.closePath(); c.fill();
              c.beginPath(); c.moveTo(12, -8); c.lineTo(18, -26); c.lineTo(2, -12); c.closePath(); c.fill();
              c.fillStyle = '#fff';
              c.beginPath(); c.arc(-6, 0, 3.2, 0, TAU); c.arc(6, 0, 3.2, 0, TAU); c.fill();
            }
          }
        });
        break;
      }
      case 'robot': {
        // v3.28.0: FULL-BODY Bender (293×441 art → 38×56, v3.59.0: 2×) —
        // the whole robot, not just the head (v3.24.0–v3.27.0).
        const full = getBenderFull();
        if (full) {
          ctx.imageSmoothingEnabled = false;
          const h = 56;
          const w = h * (BENDER_BODY_W / BENDER_BODY_H);
          ctx.drawImage(full, -w / 2, -h / 2, w, h);
        } else {
          // Fallback glyph while the sprite decodes: tiny robot silhouette
          ctx.fillStyle = '#90a4ae';
          ctx.fillRect(-12, -26, 24, 14);   // head
          ctx.fillRect(-16, -10, 32, 22);   // torso
          ctx.fillRect(-14, 12, 10, 16);    // left leg
          ctx.fillRect(4, 12, 10, 16);      // right leg
          ctx.strokeStyle = '#cfd8dc';
          ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(0, -38); ctx.stroke(); // antenna
          ctx.fillStyle = '#00e5ff';
          ctx.beginPath(); ctx.arc(0, -38, 4, 0, TAU); ctx.fill();
        }
        break;
      }
      case 'crate': {
        // v3.36.0: shared crate pixel-art (.assets/Crate-pixel-art.png via
        // AssetManager) — fallback: classic wooden crate with $.
        if (!drawSpriteIcon(ctx, 'crate', 56)) {
          ctx.fillStyle = '#8d6e63';
          ctx.fillRect(-28, -28, 56, 56);
          ctx.strokeStyle = '#5d4037';
          ctx.lineWidth = 6;
          ctx.strokeRect(-28, -28, 56, 56);
          ctx.beginPath(); ctx.moveTo(-28, -28); ctx.lineTo(28, 28); ctx.moveTo(28, -28); ctx.lineTo(-28, 28); ctx.stroke();
          ctx.fillStyle = '#ffd54f';
          ctx.font = 'bold 32px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('$', 0, 12);
          ctx.textAlign = 'left';
        }
        if (this.hp < this.maxHp) {
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.fillRect(-28, -44, 56, 8);
          ctx.fillStyle = '#4caf50';
          ctx.fillRect(-28, -44, 56 * (this.hp / this.maxHp), 8);
        }
        break;
      }
      case 'coin': {
        // v3.86.0: GOLD COIN — goldcoin pixel-art (.assets via AssetManager
        // key "coin") through the 6-pass jewel pipeline (depth → shine →
        // gold aura → blit → shimmer → gold sparkles). The procedural gold
        // coin (disc + inner ring + center glint) stays the null-sprite
        // fallback and runs through the same pass.
        drawJewelDrop(ctx, 'coin', this.t, (c) => {
          if (!drawSpriteIcon(c, 'coin', JEWEL_BOX)) {
            c.fillStyle = '#ffd54f';
            c.beginPath(); c.arc(0, 0, 24, 0, TAU); c.fill();
            c.fillStyle = '#ffca28';
            c.beginPath(); c.arc(0, 0, 18, 0, TAU); c.fill();
            c.fillStyle = '#fff8e1';
            c.beginPath(); c.arc(0, 0, 6, 0, TAU); c.fill();
          }
        });
        break;
      }
    }
    ctx.restore();
  }
}