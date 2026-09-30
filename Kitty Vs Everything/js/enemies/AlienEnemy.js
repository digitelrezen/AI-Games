// Filename: AlienEnemy.js
// Kitty Vs Everything — v1.2.0
// Alien Ship: pulsing UFO disc with a translucent dome, glowing lights,
// and a phase-shift alpha oscillation. Moves in wide sine sweeps.
// v1.2.0: sprite swap — draws one of TWO shared pixel-art UFO PNGs
//         (.assets/Alien-UFO1-transparent.png, .assets/Alien-UFO2-transparent.png)
//         through the AssetManager pipeline (tools/import-assets.mjs →
//         AssetSprites.js, keys "ufo1" / "ufo2", normalized to 128×75 /
//         128×52). Each instance picks a skin at random in the constructor
//         (pick(UFO_SPRITE_KEYS)), so a wave of aliens mixes both ships.
//         Nearest-neighbor, aspect-preserving, centered on the hitbox
//         (width-pinned: the art is a wide flat disc, w = r * 2.6, h follows
//         the art aspect), accent glow pass + crisp pass. Both sprites are
//         symmetric — no mirroring needed. The classic procedural alien
//         (dome, rim lights, beam projector, pilot) is kept as the
//         null-sprite fallback per the AssetManager contract.
export const VERSION = 'v1.2.0';
import EnemyBase from './EnemyBase.js';
import { TAU, clamp, pick } from '../core/utils.js';
import { getSprite, getDims } from '../core/AssetManager.js'; // v1.2.0: shared PNG pipeline

// v1.2.0: the two UFO skins — one variant, random per-instance skin.
const UFO_SPRITE_KEYS = ['ufo1', 'ufo2'];

export default class AlienEnemy extends EnemyBase {
  constructor(opts) {
    super(opts);
    this.ufoKey = pick(UFO_SPRITE_KEYS); // v1.2.0: random skin per instance
  }

  move(dt, slowMul) {
    const s = this.speed * slowMul;
    this.y += s * dt * 0.7;
    this.x = this.baseX + Math.sin(this.t * 2) * 120;
    this.x = clamp(this.x, -50, this.game.W + 50);
  }

  attack() {
    const a = this.angleToPlayer();
    this.fireAtPlayer(a, 250, 1.1);
  }

  draw(ctx) {
    const r = this.radius;
    ctx.save();
    ctx.translate(this.x, this.y);
    // Phase-shift: oscillate overall alpha (softened to 0.4–1.0 so the
    // pixel art never fully vanishes).
    const phase = 0.7 + 0.3 * Math.sin(this.t * 4);
    ctx.globalAlpha = this.flash > 0 ? 0.55 : phase;

    // v1.2.0: pixel-art UFO — random per-instance skin (ufo1 / ufo2).
    const sprite = getSprite(this.ufoKey);
    const dims = getDims(this.ufoKey);
    if (sprite && dims) {
      // Width-pinned, aspect-preserving, centered on the hitbox — the art is
      // a wide flat disc (128:75 / 128:52), so pin the width to ~2.6× the
      // hitbox radius and derive the height from the art aspect.
      const w = r * 2.6;
      const h = w * (dims.h / dims.w);
      // Pass 1: accent glow so the ship reads against the space backdrop
      ctx.imageSmoothingEnabled = true;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = Math.max(6, r * 0.55);
      ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
      // Pass 2: crisp pixel art on top (nearest-neighbor, no shadow)
      ctx.shadowBlur = 0;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
    } else {
      // Fallback while the sprite decodes (or if the asset is missing/corrupt)
      this.drawProcedural(ctx, r);
    }

    ctx.restore();
    this.drawShieldRing(ctx);
    this.drawBossBar(ctx);
  }

  /** v1.2.0: the classic procedural alien (pre-pixel-art), kept as the
   *  AssetManager null-sprite fallback. Draws centered on the origin —
   *  the caller has already translated the context. */
  drawProcedural(ctx, r) {
    // ─── DISC BODY (wide, flat) ───
    const discGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    discGrad.addColorStop(0, '#a060e0');
    discGrad.addColorStop(0.5, this.color);
    discGrad.addColorStop(1, '#3a1060');
    ctx.fillStyle = discGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.95, r * 0.35, 0, 0, TAU);
    ctx.fill();

    // Disc rim (lighter ring)
    ctx.strokeStyle = 'rgba(200, 150, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.95, r * 0.35, 0, 0, TAU);
    ctx.stroke();

    // ─── DOME (translucent, on top) ───
    const domeGrad = ctx.createRadialGradient(0, -r * 0.25, 0, 0, -r * 0.25, r * 0.4);
    domeGrad.addColorStop(0, 'rgba(200, 180, 255, 0.6)');
    domeGrad.addColorStop(1, 'rgba(100, 50, 180, 0.3)');
    ctx.fillStyle = domeGrad;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.2, r * 0.45, r * 0.3, 0, Math.PI, 0);
    ctx.fill();
    // Dome highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.1, -r * 0.35, r * 0.15, r * 0.1, -0.3, 0, TAU);
    ctx.fill();

    // ─── GLOWING LIGHTS (around disc rim) ───
    const lightCount = 8;
    for (let i = 0; i < lightCount; i++) {
      const a = (i / lightCount) * TAU;
      const lx = Math.cos(a) * r * 0.8;
      const ly = Math.sin(a) * r * 0.28;
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 6 + i * 0.8);
      ctx.fillStyle = `rgba(180, 100, 255, ${0.4 + pulse * 0.5})`;
      ctx.shadowColor = '#b388ff';
      ctx.shadowBlur = 4 * pulse;
      ctx.beginPath();
      ctx.arc(lx, ly, r * 0.06, 0, TAU);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // ─── UNDER-BELLY (darker, with details) ───
    ctx.fillStyle = 'rgba(30, 10, 60, 0.5)';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.15, r * 0.6, r * 0.15, 0, 0, TAU);
    ctx.fill();

    // ─── BEAM PROJECTOR (center bottom, glowing) ───
    const beamPulse = 0.5 + 0.5 * Math.sin(this.t * 3);
    ctx.fillStyle = `rgba(150, 50, 255, ${0.3 + beamPulse * 0.4})`;
    ctx.shadowColor = '#7b2ff7';
    ctx.shadowBlur = 8 * beamPulse;
    ctx.beginPath();
    ctx.ellipse(0, r * 0.3, r * 0.15, r * 0.08, 0, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;

    // ─── ALIEN PILOT (visible through dome) ───
    ctx.fillStyle = 'rgba(100, 200, 100, 0.5)';
    ctx.beginPath();
    ctx.arc(0, -r * 0.25, r * 0.12, 0, TAU);
    ctx.fill();
    // Pilot eyes
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath(); ctx.arc(-r * 0.05, -r * 0.28, r * 0.03, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.05, -r * 0.28, r * 0.03, 0, TAU); ctx.fill();

    // ─── TRAILING ENERGY (subtle) ───
    ctx.strokeStyle = `rgba(150, 50, 255, ${0.2 + beamPulse * 0.15})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-r * 0.3, r * 0.35);
    ctx.lineTo(-r * 0.4, r * 0.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(r * 0.3, r * 0.35);
    ctx.lineTo(r * 0.4, r * 0.6);
    ctx.stroke();
  }
}
