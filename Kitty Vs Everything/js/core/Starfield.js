// Filename: Starfield.js
// Kitty Vs Everything — v3.3.0
// Scrolling starfield background: init / update / draw. Stateless — the
// star array is owned by Game (game.stars).
// v3.3.0: Extracted from Game.js (module split of oversized files).
export const VERSION = 'v3.3.0';
import { rand } from './utils.js';

export const STAR_COUNT = 120;

export function initStars(W, H) {
  const stars = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({ x: rand(0, W), y: rand(0, H), z: rand(0.2, 1) });
  }
  return stars;
}

export function updateStars(stars, dt, W, H) {
  for (const s of stars) {
    s.y += s.z * 60 * dt;
    if (s.y > H) { s.y = 0; s.x = rand(0, W); }
  }
}

export function drawStars(ctx, stars) {
  for (const s of stars) {
    ctx.globalAlpha = 0.3 + s.z * 0.7;
    ctx.fillStyle = '#fff';
    ctx.fillRect(s.x, s.y, s.z * 2, s.z * 2);
  }
  ctx.globalAlpha = 1;
}
