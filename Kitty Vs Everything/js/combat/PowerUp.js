// Filename: PowerUp.js
// Kitty Vs Everything — v3.51.0
// Falling drops: extra life, shield, mini-ship, destructible bonus crate,
// the rare Bender (easter egg, v3.24.0), hull health (v3.33.0) and FRENZY
// (v3.33.0 — 30s all-cooldowns-off, Vulcan overheat neutralized).
// v3.33.0: health / life / shield / frenzy drops draw the shared transparent
//          PNGs from Z:\Dev\AI-GAMES\.assets via AssetManager.js (imported +
//          validated by tools/import-assets.mjs) — nearest-neighbor,
//          aspect-preserving, centered on the r=14 hitbox. Each type keeps
//          its procedural glyph as the fallback while the sprite decodes
//          (or if the asset is missing/corrupt).
// v3.36.0: bonus crate drop joins the PNG pipeline (key "crate",
//          .assets/Crate-pixel-art.png, 620×574 → 128×119) — nearest-neighbor,
//          aspect-preserving; the procedural wooden crate is the null-sprite
//          fallback and the crate HP bar still draws over the sprite.
// v3.51.0: JEWEL SHADING for the frenzy / extra-life / shield drops — the
//          flat pixel-art sprites now run through drawJewelDrop(), a
//          programmatic 5-pass gem treatment (no new art assets): a
//          pulsating additive AURA in the type's jewel color (golden /
//          emerald / azure), the icon rendered into a small offscreen
//          buffer, a source-atop DEPTH bevel (light top-left → shade
//          bottom-right) + inset vignette, a specular SHINE (white radial
//          glint on the top-right face + rim arc + twinkling 4-point
//          sparkle), and a rotating perimeter SHIMMER. The procedural
//          fallbacks are unchanged and run through the same jewel pass
//          while the sprite decodes.

export const VERSION = 'v3.51.0';
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

// ═══ v3.51.0: JEWEL SHADING — frenzy / extra-life / shield drops ═══════════
// The three "valuable" drops render through drawJewelDrop(), a 5-pass
// programmatic gem treatment (no extra art assets):
//   1. AURA    — pulsating additive halo in the type's jewel color, drawn
//                behind the icon ('lighter' composite).
//   2. BASE    — the original pixel-art sprite (or the procedural fallback)
//                rendered into a small offscreen buffer centered on its
//                origin, so the overlays below land on the icon's OPAQUE
//                PIXELS ONLY (source-atop) — no rectangular patch over the
//                starfield.
//   3. DEPTH   — source-atop bevel: linear gradient (bright top-left → dark
//                bottom-right) + an inset vignette → faceted 3D look.
//   4. SHINE   — source-atop specular glint: white radial on the top-right
//                face + a bright rim arc + a twinkling 4-point star
//                ('lighter') → gemstone light refraction.
//   5. SHIMMER — additive rotating arc on the icon perimeter.
// The buffer is exactly final size (1:1 blit), so nearest-neighbor pixel
// art stays crisp; the gradients are smooth by nature.

const JEWEL = {
  frenzy: { aura: '255, 200, 40', glint: '255, 248, 224' },  // golden
  life:   { aura: '0, 230, 118',  glint: '224, 255, 240' },  // emerald
  shield: { aura: '64, 196, 255', glint: '224, 247, 255' },  // azure
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

/**
 * v3.51.0: draw a power-up icon with the programmatic JEWEL treatment.
 * `drawBase(c)` renders the original icon (sprite or procedural fallback)
 * centered on the origin of the 2D context `c`. Runs the 5-pass gem
 * pipeline: aura → base → depth bevel → specular shine → shimmer.
 * Headless-safe: with no DOM canvas it just draws the base directly.
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

  // ── PASS 1: AURA — pulsating additive halo behind the icon ──────────
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

  // ── PASS 2: BASE — blit the buffered icon (1:1, crisp pixel art) ────
  ctx.drawImage(buf.c, -JEWEL_BUF / 2, -JEWEL_BUF / 2);

  // ── PASS 3: DEPTH — bevel + inset vignette on opaque pixels only ────
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

  // ── PASS 4: SHINE — specular glint, rim arc + twinkling 4-pt star ───
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

  // ── PASS 5: SHIMMER — rotating additive arc on the perimeter ────────
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = 'rgba(' + j.glint + ', 0.5)';
  ctx.lineWidth = 1.5;
  const a0 = t * 2.2;
  ctx.beginPath(); ctx.arc(0, 0, 13.5, a0, a0 + 1.1); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 13.5, a0 + Math.PI, a0 + Math.PI + 0.7); ctx.stroke();
  ctx.restore();
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
        // v3.51.0: EXTRA LIFE — emerald jewel pass (aura + beveled depth +
        // specular glint + shimmer) over the shared pink pixel-art heart
        // (.assets/Extra-life-pink-pixel_art.png via AssetManager). The
        // classic red heart stays the null-sprite fallback and runs through
        // the same jewel pass.
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
        // v3.51.0: SHIELD — azure jewel pass (aura + beveled depth +
        // specular glint + shimmer) over the shared shield pixel-art
        // (.assets/Shield-pixel-art.png via AssetManager). The cyan hexagon
        // outline stays the null-sprite fallback and runs through the same
        // jewel pass.
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
        // v3.33.0: hull repair drop (.assets/Health-pixel-art.png — wide
        // art, fitted by width) — fallback: green cross.
        if (!drawSpriteIcon(ctx, 'health', 28)) {
          ctx.fillStyle = '#66bb6a';
          ctx.fillRect(-4, -12, 8, 24);
          ctx.fillRect(-12, -4, 24, 8);
        }
        break;
      }
      case 'frenzy': {
        // v3.51.0: FRENZY — golden jewel pass (aura + beveled depth +
        // specular glint + shimmer) over the shared pixel-art lightning bolt
        // (.assets/Frenzy-pixel-art.png via AssetManager). The classic gold
        // bolt stays the null-sprite fallback and runs through the same
        // jewel pass.
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
        // v1.1.0: "Adopt Me!" WANTED poster (cat behind bars) — 28×28 pixel
        // art centered on the origin, matching the r=14 hitbox exactly.
        // Falls back to the classic cat head if the sprite isn't ready.
        const poster = getMiniPosterSprite();
        if (poster) {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(poster, -14, -14, 28, 28);
        } else {
          ctx.fillStyle = '#ff9d3b';
          ctx.beginPath(); ctx.arc(0, 2, 9, 0, TAU); ctx.fill();
          ctx.beginPath(); ctx.moveTo(-6, -4); ctx.lineTo(-9, -13); ctx.lineTo(-1, -6); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(6, -4); ctx.lineTo(9, -13); ctx.lineTo(1, -6); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(-3, 0, 1.6, 0, TAU); ctx.arc(3, 0, 1.6, 0, TAU); ctx.fill();
        }
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