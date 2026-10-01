// Filename: BoneFragment.js
// Kitty Vs Everything — v2.2.0
// Bone that drifts downward in the Bone Yard bonus. When shot, shatters
// into sharp bone shrapnel particles.
// v2.2.0 (v3.54.0 release): sprite swap — each fragment now draws the
// shared pixel-art PNG "femur" (126×128) or "profile_bone" (128×56)
// through the AssetManager pipeline, aspect-preserving, rotated with the
// fragment, with an ethereal glow pass. The classic procedural bone is
// kept as the null-sprite fallback per the AssetManager contract.
export const VERSION = 'v2.2.0';
import Entity from '../core/Entity.js';
import { TAU, rand } from '../core/utils.js';
import { audio } from '../core/AudioSystem.js';
import { getSprite, getDims } from '../core/AssetManager.js'; // v2.2.0: shared PNG pipeline

// v2.2.0: each fragment rolls one of the two bone sprites (per instance).
const BONE_FRAGMENT_SPRITE_KEYS = ['femur', 'profile_bone'];

export default class BoneFragment extends Entity {
  constructor({ x, y, game }) {
    super({
      x, y,
      radius: rand(14, 26),
      hp: rand(15, 35),
      shield: 0,
      color: '#f5f0e0',
    });
    this.game = game;
    this.t = rand(0, TAU);
    this.vy = rand(40, 80);
    this.vx = rand(-20, 20);
    this.rotation = rand(0, TAU);
    this.rotSpeed = rand(-1.5, 1.5);
    // Procedural bone shape parameters
    this.shaftLen = rand(1.2, 2.0);
    this.shaftWidth = rand(0.25, 0.4);
    this.knobSize = rand(0.35, 0.55);
    this.knobOffset = rand(0.8, 1.1);
    this.bent = rand(-0.15, 0.15); // slight curve
    this.scoreValue = 500;
    // v2.2.0: per-instance sprite (femur or profile bone).
    this.spriteKey = BONE_FRAGMENT_SPRITE_KEYS[Math.floor(Math.random() * BONE_FRAGMENT_SPRITE_KEYS.length)];
  }

  update(dt) {
    this.t += dt;
    this.y += this.vy * dt;
    this.x += this.vx * dt;
    this.rotation += this.rotSpeed * dt;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt);
    if (this.y > this.game.H + 60) this.alive = false;
  }

  /** Trigger the shatter effect when this bone is destroyed. */
  shatter(game) {
    const r = this.radius;
    // Sharp bone shrapnel — angular white/ivory fragments
    const shrapnelCount = 14 + Math.floor(r / 2);
    for (let i = 0; i < shrapnelCount; i++) {
      const a = rand(0, TAU);
      const speed = rand(150, 420);
      game.particles.burst(this.x, this.y, {
        count: 1,
        color: i % 3 === 0 ? '#fffef5' : (i % 3 === 1 ? '#e8dcc8' : '#d4c8a8'),
        speed,
        life: rand(0.4, 0.9),
        size: rand(3, 7),
      });
    }
    // Extra sharp spike particles (smaller, faster)
    for (let i = 0; i < 8; i++) {
      const a = rand(0, TAU);
      const speed = rand(300, 600);
      game.particles.burst(this.x, this.y, {
        count: 1,
        color: '#ffffff',
        speed,
        life: rand(0.2, 0.5),
        size: rand(2, 4),
      });
    }
    game.shake = Math.max(game.shake, 3);
    audio.hit();
  }

  draw(ctx) {
    const r = this.radius;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    if (this.flash > 0) ctx.globalAlpha = 0.5;

    const sprite = getSprite(this.spriteKey);
    if (sprite) {
      this._drawSprite(ctx, sprite, r);
    } else {
      this._drawProcedural(ctx, r);
    }

    ctx.restore();
  }

  // v2.2.0 — pixel-art bone sprite (femur or profile bone, per instance).
  // Aspect-preserving, centered on the hitbox, nearest-neighbor, with the
  // ethereal glow pass the procedural bone had.
  _drawSprite(ctx, sprite, r) {
    const dims = getDims(this.spriteKey);
    const targetW = r * 2.4;
    const targetH = dims ? (targetW * dims.h) / dims.w : targetW;
    ctx.imageSmoothingEnabled = false;
    // Ethereal glow pass
    ctx.globalAlpha = (this.flash > 0 ? 0.5 : 1) * 0.3;
    ctx.shadowColor = '#fffef0';
    ctx.shadowBlur = r * 0.9;
    ctx.drawImage(sprite, -targetW / 2, -targetH / 2, targetW, targetH);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = this.flash > 0 ? 0.5 : 1;
    ctx.drawImage(sprite, -targetW / 2, -targetH / 2, targetW, targetH);
  }

  // v2.2.0 — classic procedural bone, kept as the null-sprite fallback.
  _drawProcedural(ctx, r) {
    // ─── BONE SHAFT (elongated, slightly curved) ───
    const shaftLen = r * this.shaftLen;
    const shaftW = r * this.shaftWidth;
    const boneGrad = ctx.createLinearGradient(-shaftLen, 0, shaftLen, 0);
    boneGrad.addColorStop(0, '#e8dcc8');
    boneGrad.addColorStop(0.3, '#f5f0e0');
    boneGrad.addColorStop(0.5, '#fffef5');
    boneGrad.addColorStop(0.7, '#f5f0e0');
    boneGrad.addColorStop(1, '#e8dcc8');
    ctx.fillStyle = boneGrad;
    ctx.beginPath();
    ctx.moveTo(-shaftLen, -shaftW * 0.6);
    ctx.quadraticCurveTo(0, -shaftW + this.bent * r, shaftLen, -shaftW * 0.6);
    ctx.lineTo(shaftLen, shaftW * 0.6);
    ctx.quadraticCurveTo(0, shaftW + this.bent * r, -shaftLen, shaftW * 0.6);
    ctx.closePath();
    ctx.fill();
    // Shaft outline
    ctx.strokeStyle = 'rgba(180, 160, 120, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // ─── BONE KNOBS (rounded ends, femur-style) ───
    const knobR = r * this.knobSize;
    const knobX = shaftLen * this.knobOffset;
    // Left knob (two lobes)
    ctx.fillStyle = '#f0e8d4';
    ctx.beginPath();
    ctx.arc(-knobX, -knobR * 0.4, knobR * 0.7, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-knobX, knobR * 0.4, knobR * 0.6, 0, TAU);
    ctx.fill();
    // Right knob (two lobes)
    ctx.beginPath();
    ctx.arc(knobX, -knobR * 0.4, knobR * 0.7, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(knobX, knobR * 0.4, knobR * 0.6, 0, TAU);
    ctx.fill();
    // Knob highlights
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.arc(-knobX, -knobR * 0.5, knobR * 0.3, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(knobX, -knobR * 0.5, knobR * 0.3, 0, TAU);
    ctx.fill();

    // ─── BONE TEXTURE (subtle lines along shaft) ───
    ctx.strokeStyle = 'rgba(180, 160, 120, 0.3)';
    ctx.lineWidth = 0.7;
    for (let i = -2; i <= 2; i++) {
      const lx = i * shaftLen * 0.2;
      ctx.beginPath();
      ctx.moveTo(lx, -shaftW * 0.5);
      ctx.lineTo(lx + this.bent * r * 0.3, shaftW * 0.5);
      ctx.stroke();
    }

    // ─── SUBTLE GLOW (ethereal bone glow) ───
    ctx.globalAlpha = 0.15 + 0.1 * Math.sin(this.t * 3);
    ctx.fillStyle = '#fffef0';
    ctx.beginPath();
    ctx.ellipse(0, 0, shaftLen * 1.2, shaftW * 2, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}