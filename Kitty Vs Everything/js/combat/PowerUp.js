// Filename: PowerUp.js
// Kitty Vs Everything — v3.58.0
// Falling drops: extra life, shield, mini-ship, destructible bonus crate,
// the rare Bender (easter egg, v3.24.0), hull health (v3.33.0) and FRENZY
// (v3.33.0 — 30s all-cooldowns-off, Vulcan overheat neutralized).
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

export const VERSION = 'v3.58.0';
import { TAU } from '../core/utils.js';
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
};
const JEWEL_BOX = 28;   // icon fit box (same sizing as the v3.33.0 sprites)
const JEWEL_BUF = 40;   // offscreen buffer (icon 28 + headroom)

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
    const orbit = 10 + 8 * h1;                            // 10–18 px ring
    const speed = 0.5 + 0.9 * h2;                         // 0.5–1.4 rad/s
    const phase = h3 * TAU;
    const rise = (t * (6 + 6 * h4) + h1 * 26) % 26;       // 0–26 px cycle
    const x = Math.cos(phase + t * speed) * orbit;
    const y = Math.sin(phase + t * speed) * orbit * 0.55 + 10 - rise;
    const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(t * (2.4 + 2.2 * h2) + phase * 3));
    const alpha = (0.2 + 0.55 * twinkle) * (1 - 0.55 * (rise / 26));
    ctx.fillStyle = 'rgba(' + sp.rgb + ',' + alpha.toFixed(3) + ')';
    sparkleStar(ctx, x, y, 1.1 + 1.5 * h3);
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
  const bevel = b.createLinearGradient(-14, -14, 14, 14);
  bevel.addColorStop(0, 'rgba(255, 255, 255, 0.40)');
  bevel.addColorStop(0.38, 'rgba(255, 255, 255, 0.10)');
  bevel.addColorStop(0.55, 'rgba(0, 0, 0, 0.00)');
  bevel.addColorStop(1, 'rgba(0, 0, 0, 0.42)');
  b.fillStyle = bevel;
  b.fillRect(0, 0, JEWEL_BUF, JEWEL_BUF);
  const vig = b.createRadialGradient(JEWEL_BUF / 2, JEWEL_BUF / 2, 8, JEWEL_BUF / 2, JEWEL_BUF / 2, 20);
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(0.72, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, 'rgba(0, 0, 0, 0.30)');
  b.fillStyle = vig;
  b.fillRect(0, 0, JEWEL_BUF, JEWEL_BUF);

  // ── PASS 2: SHINE — specular glint, rim arc + twinkling 4-pt star ───
  b.globalCompositeOperation = 'source-atop';
  const glint = b.createRadialGradient(6, -6, 0, 6, -6, 13);
  glint.addColorStop(0, 'rgba(' + j.glint + ', 0.85)');
  glint.addColorStop(0.35, 'rgba(255, 255, 255, 0.30)');
  glint.addColorStop(1, 'rgba(255, 255, 255, 0)');
  b.fillStyle = glint;
  b.beginPath(); b.arc(6, -6, 13, 0, TAU); b.fill();
  b.globalCompositeOperation = 'lighter';
  b.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  b.lineWidth = 1.5;
  b.beginPath(); b.arc(0, 0, 11, -2.4, -0.55); b.stroke();
  const tw = 0.5 + 0.5 * Math.sin(t * 5.1 + 1.3);
  if (tw > 0.25) {
    const sx = 5, sy = -7, s = 2.6 * tw;
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
  const aura = ctx.createRadialGradient(0, 0, 5, 0, 0, 22);
  aura.addColorStop(0, 'rgba(' + j.aura + ', ' + (0.38 * pulse).toFixed(3) + ')');
  aura.addColorStop(0.55, 'rgba(' + j.aura + ', ' + (0.14 * pulse).toFixed(3) + ')');
  aura.addColorStop(1, 'rgba(' + j.aura + ', 0)');
  ctx.fillStyle = aura;
  ctx.beginPath(); ctx.arc(0, 0, 22, 0, TAU); ctx.fill();
  ctx.restore();

  // ── PASS 4: BASE — blit the buffered icon (1:1, crisp pixel art) ────
  // v3.58.0: blit AFTER passes 1–2 (v3.51.0 blitted before them, so the
  // bevel/shine never reached the screen).
  ctx.drawImage(buf.c, -JEWEL_BUF / 2, -JEWEL_BUF / 2);

  // ── PASS 5: SHIMMER — rotating additive arc on the perimeter ────────
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = 'rgba(' + j.glint + ', 0.5)';
  ctx.lineWidth = 1.5;
  const a0 = t * 2.2;
  ctx.beginPath(); ctx.arc(0, 0, 13.5, a0, a0 + 1.1); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 13.5, a0 + Math.PI, a0 + Math.PI + 0.7); ctx.stroke();
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
    this.radius = type === 'crate' ? 18 : 14;
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
            c.moveTo(0, 8);
            c.bezierCurveTo(-14, -4, -8, -16, 0, -8);
            c.bezierCurveTo(8, -16, 14, -4, 0, 8);
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
            c.lineWidth = 3;
            c.beginPath();
            for (let i = 0; i < 6; i++) {
              const a = (i / 6) * TAU - Math.PI / 2;
              const px = Math.cos(a) * 14, py = Math.sin(a) * 14;
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
            c.fillRect(-4, -12, 8, 24);
            c.fillRect(-12, -4, 24, 8);
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
            c.moveTo(3, -14); c.lineTo(-7, 2); c.lineTo(-1, 2);
            c.lineTo(-3, 14); c.lineTo(7, -2); c.lineTo(1, -2);
            c.closePath();
            c.fill();
          }
        });
        break;
      }
      case 'mini': {
        // v3.58.0: "Adopt Me!" WANTED poster (cat behind bars) —
        // .assets/Wanted-Cat-pixel-art.png via AssetManager — through the
        // 6-pass jewel pipeline (depth → shine → bounty white-gold aura →
        // blit → shimmer → gold sparkles). Falls back to the classic cat
        // head if the sprite isn't ready.
        drawJewelDrop(ctx, 'mini', this.t, (c) => {
          const poster = getMiniPosterSprite();
          if (poster) {
            c.imageSmoothingEnabled = false;
            c.drawImage(poster, -14, -14, 28, 28);
          } else {
            c.fillStyle = '#ff9d3b';
            c.beginPath(); c.arc(0, 2, 9, 0, TAU); c.fill();
            c.beginPath(); c.moveTo(-6, -4); c.lineTo(-9, -13); c.lineTo(-1, -6); c.closePath(); c.fill();
            c.beginPath(); c.moveTo(6, -4); c.lineTo(9, -13); c.lineTo(1, -6); c.closePath(); c.fill();
            c.fillStyle = '#fff';
            c.beginPath(); c.arc(-3, 0, 1.6, 0, TAU); c.arc(3, 0, 1.6, 0, TAU); c.fill();
          }
        });
        break;
      }
      case 'robot': {
        // v3.28.0: tiny FULL-BODY Bender (293×441 art → 19×28) — the whole
        // robot, not just the head (v3.24.0–v3.27.0).
        const full = getBenderFull();
        if (full) {
          ctx.imageSmoothingEnabled = false;
          const h = 28;
          const w = h * (BENDER_BODY_W / BENDER_BODY_H);
          ctx.drawImage(full, -w / 2, -h / 2, w, h);
        } else {
          // Fallback glyph while the sprite decodes: tiny robot silhouette
          ctx.fillStyle = '#90a4ae';
          ctx.fillRect(-6, -13, 12, 7);   // head
          ctx.fillRect(-8, -5, 16, 11);   // torso
          ctx.fillRect(-7, 6, 5, 8);      // left leg
          ctx.fillRect(2, 6, 5, 8);       // right leg
          ctx.strokeStyle = '#cfd8dc';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(0, -19); ctx.stroke(); // antenna
          ctx.fillStyle = '#00e5ff';
          ctx.beginPath(); ctx.arc(0, -19, 2, 0, TAU); ctx.fill();
        }
        break;
      }
      case 'crate': {
        // v3.36.0: shared crate pixel-art (.assets/Crate-pixel-art.png via
        // AssetManager) — fallback: classic wooden crate with $.
        if (!drawSpriteIcon(ctx, 'crate', 28)) {
          ctx.fillStyle = '#8d6e63';
          ctx.fillRect(-14, -14, 28, 28);
          ctx.strokeStyle = '#5d4037';
          ctx.lineWidth = 3;
          ctx.strokeRect(-14, -14, 28, 28);
          ctx.beginPath(); ctx.moveTo(-14, -14); ctx.lineTo(14, 14); ctx.moveTo(14, -14); ctx.lineTo(-14, 14); ctx.stroke();
          ctx.fillStyle = '#ffd54f';
          ctx.font = 'bold 16px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('$', 0, 6);
          ctx.textAlign = 'left';
        }
        if (this.hp < this.maxHp) {
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.fillRect(-14, -22, 28, 4);
          ctx.fillStyle = '#4caf50';
          ctx.fillRect(-14, -22, 28 * (this.hp / this.maxHp), 4);
        }
        break;
      }
    }
    ctx.restore();
  }
}