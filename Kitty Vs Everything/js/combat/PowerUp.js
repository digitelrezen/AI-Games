// Filename: PowerUp.js
// Kitty Vs Everything — v3.33.0
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

export const VERSION = 'v3.36.0';
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
        // v3.33.0: shared pink pixel-art heart (.assets/Extra-life-pink-
        // pixel_art.png via AssetManager) — fallback: classic red heart.
        if (!drawSpriteIcon(ctx, 'life', 28)) {
          ctx.fillStyle = '#ff5252';
          ctx.beginPath();
          ctx.moveTo(0, 8);
          ctx.bezierCurveTo(-14, -4, -8, -16, 0, -8);
          ctx.bezierCurveTo(8, -16, 14, -4, 0, 8);
          ctx.fill();
        }
        break;
      }
      case 'shield': {
        // v3.33.0: shared shield pixel-art (.assets/Shield-pixel-art.png) —
        // fallback: cyan hexagon outline.
        if (!drawSpriteIcon(ctx, 'shield', 28)) {
          ctx.strokeStyle = '#4fc3f7';
          ctx.lineWidth = 3;
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU - Math.PI / 2;
            const px = Math.cos(a) * 14, py = Math.sin(a) * 14;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.stroke();
        }
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
        // v3.33.0: FRENZY drop (.assets/Frenzy-pixel-art.png — 30s, all
        // cooldowns off, Vulcan overheat neutralized) — fallback: bolt.
        if (!drawSpriteIcon(ctx, 'frenzy', 28)) {
          ctx.fillStyle = '#ffd600';
          ctx.beginPath();
          ctx.moveTo(3, -14); ctx.lineTo(-7, 2); ctx.lineTo(-1, 2);
          ctx.lineTo(-3, 14); ctx.lineTo(7, -2); ctx.lineTo(1, -2);
          ctx.closePath();
          ctx.fill();
        }
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