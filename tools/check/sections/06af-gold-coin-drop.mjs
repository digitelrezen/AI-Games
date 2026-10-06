// ═══════════════════════════════════════════════════════════
//  [6af] v3.86.0 GOLD COIN DROP —
//        (1) config/drops.js: `coin` is the new COMMON drop at
//            0.75 (75%) — the coin-first POWERUP_DROPS pool now
//            leads with the coin (the 06ad section owns the full
//            8-key ladder + sum-to-1.00; here we pin the coin
//            entry at the source level and confirm it is the
//            highest-weight drop in the pool).
//        (2) Game.js collectPowerUp: a new `case 'coin'` awards
//            +500 score, plays audio.coin() (its own two-note
//            arcade SFX, so the generic audio.powerup() below is
//            skipped via customSound = true), emits a gold '+500'
//            floating damage text (bus 'dmg'), and spawns a gold
//            particle burst.
//        (3) PowerUp.js: 'coin' joins JEWEL (gold aura + glint)
//            and SPARKLES (gold twinkles) and gets a `case 'coin'`
//            in draw() that routes through the 6-pass jewel
//            pipeline (drawJewelDrop) with the 'coin' sprite key
//            and a procedural gold-coin fallback. PowerUp.js is
//            bumped to v3.86.0.
//        Headless: collectPowerUp('coin') adds exactly +500 score.
// ═══════════════════════════════════════════════════════════

import { ROOT, check, makeGame, mod, collect } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';

export default async function run() {
{
  console.log('\n[6af] v3.86.0 gold coin drop (source + headless pickup)');
  const dropsSrc = fs.readFileSync(path.join(ROOT, 'js/core/config/drops.js'), 'utf8');
  const gameSrc = fs.readFileSync(path.join(ROOT, 'js/core/Game.js'), 'utf8');
  const pwSrc = fs.readFileSync(path.join(ROOT, 'js/combat/PowerUp.js'), 'utf8');
  const { POWERUP_DROPS } = await mod('js/core/config.js');

  // ── (1) coin is the new COMMON drop ──
  check('drops.js source has `coin: 0.75` (COMMON)', /coin:\s*0\.75/.test(dropsSrc), 'no `coin: 0.75` in drops.js');
  check('POWERUP_DROPS.coin === 0.75 (runtime)', Math.abs(POWERUP_DROPS.coin - 0.75) < 1e-9, `got ${POWERUP_DROPS.coin}`);
  check('coin is the highest-weight drop in the pool (coin-first)',
    Object.entries(POWERUP_DROPS).every(([k, w]) => w <= POWERUP_DROPS.coin + 1e-9),
    JSON.stringify(POWERUP_DROPS));

  // ── (2) Game.js collectPowerUp coin case ──
  check("Game.js has a `case 'coin'` in collectPowerUp", gameSrc.includes("case 'coin':"));
  check("coin case awards +500 score (scoped to the coin case)", /case 'coin':[\s\S]{0,500}?this\.score \+= 500/.test(gameSrc));
  check('coin case plays audio.coin()', gameSrc.includes('audio.coin()'));
  check('coin case sets customSound = true (suppresses the generic SFX)', gameSrc.includes('customSound = true'));
  check("coin case emits the gold '+500' floating text via bus 'dmg'",
    gameSrc.includes("bus.emit('dmg', { x: pw.x, y: pw.y, text: '+500', color: '#ffd54f' })"));
  check('coin case spawns the gold particle burst',
    gameSrc.includes("this.particles.burst(pw.x, pw.y, { count: 64, color: '#ffd54f', speed: 420, life: 1.0 })"));
  check('generic audio.powerup() is gated on !customSound', gameSrc.includes('if (!customSound) audio.powerup()'));

  // ── (3) PowerUp.js coin rendering ──
  check("PowerUp.js VERSION is v3.89.0", pwSrc.includes("VERSION = 'v3.89.0'"));
  check('PowerUp.js JEWEL has a gold coin entry (aura + glint)',
    /coin:\s*\{\s*aura:\s*'255, 200, 40',\s*glint:\s*'255, 250, 230'\s*\}/.test(pwSrc));
  check('PowerUp.js SPARKLES has a gold coin entry',
    /coin:\s*\{\s*rgb:\s*'255, 214, 90',\s*count:\s*8\s*\}/.test(pwSrc));
  check("PowerUp.js draw() has a `case 'coin'`", pwSrc.includes("case 'coin':"));
  check("coin routes through the jewel pipeline (drawJewelDrop 'coin')",
    pwSrc.includes("drawJewelDrop(ctx, 'coin', this.t"));
  check("coin uses the 'coin' sprite key via drawSpriteIcon",
    pwSrc.includes("drawSpriteIcon(c, 'coin', JEWEL_BOX)"));
  check('coin procedural fallback is gold (#ffd54f)', pwSrc.includes("c.fillStyle = '#ffd54f'"));

  // ── headless pickup ──
  const game = makeGame();
  const before = game.score;
  collect(game, 'coin');
  check('headless: collecting a coin adds exactly +500 score', game.score === before + 500, `score ${before} → ${game.score}`);
}
}
