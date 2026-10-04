// ═══════════════════════════════════════════════════════════
//  [6x] v3.71.0 PHASE 4 MODULAR CAT-SHIP COMBAT — CatShipFactory
//        + MiniShip moved js/core/ → js/combat/, and the base
//        nova / synergy super-weapon volleys extracted from
//        Player.js into js/combat/SuperNova.js (fireNova /
//        fireSuperWeapon). Player.js now only delegates; the 5
//        cat variants still override activateUltimate.
// ═══════════════════════════════════════════════════════════

import { ROOT, check, makeGame, makePlayer, mod } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';

export default async function run() {
console.log('\n[6x] v3.71.0 Phase 4 modular cat-ship combat (CatShipFactory + MiniShip + SuperNova)');
{
  const { fireNova, fireSuperWeapon } = await mod('js/combat/SuperNova.js');
  const { default: MiniShip } = await mod('js/combat/MiniShip.js');
  const { createCatShip, createMiniShip } = await mod('js/combat/CatShipFactory.js');
  const csfSrc = fs.readFileSync(path.join(ROOT, 'js/combat/CatShipFactory.js'), 'utf8');
  const msSrc = fs.readFileSync(path.join(ROOT, 'js/combat/MiniShip.js'), 'utf8');
  const snSrc = fs.readFileSync(path.join(ROOT, 'js/combat/SuperNova.js'), 'utf8');
  const pSrc = fs.readFileSync(path.join(ROOT, 'js/player/Player.js'), 'utf8');

  // ── Path gates: old js/core/ locations gone, new js/combat/ in place ──
  check('CatShipFactory moved: js/core/CatShipFactory.js deleted', !fs.existsSync(path.join(ROOT, 'js/core/CatShipFactory.js')));
  check('MiniShip moved: js/core/MiniShip.js deleted', !fs.existsSync(path.join(ROOT, 'js/core/MiniShip.js')));
  check('SuperNova created: js/combat/SuperNova.js exists', fs.existsSync(path.join(ROOT, 'js/combat/SuperNova.js')));

  // ── Source gates ──
  check('CatShipFactory: VERSION = v3.71.0', csfSrc.includes("VERSION = 'v3.71.0'"));
  check('MiniShip: VERSION = v3.73.0', msSrc.includes("VERSION = 'v3.73.0'"));
  check('SuperNova: VERSION = v1.0.0', snSrc.includes("VERSION = 'v1.0.0'"));
  check('SuperNova: exports fireNova + fireSuperWeapon', typeof fireNova === 'function' && typeof fireSuperWeapon === 'function');
  check('SuperNova: nova ring is 16 bullets @ damage 25', snSrc.includes('i < 16') && snSrc.includes('damage: 25'));
  check('SuperNova: super-weapon is 32 ring + 8 homing bolts', snSrc.includes('i < 32') && snSrc.includes('i < 8') && snSrc.includes('b.homing = true'));
  check('SuperNova: shake 8 (nova) + shake 16 (super-weapon)', snSrc.includes('g.shake = 8') && snSrc.includes('g.shake = 16'));
  check('SuperNova: super-weapon emits the COLOR SYNERGY banner', snSrc.includes("'COLOR SYNERGY! SUPER-WEAPON FIRED!'"));
  check('CatShipFactory: exports createCatShip + createMiniShip', typeof createCatShip === 'function' && typeof createMiniShip === 'function');
  check('MiniShip: default export is the MiniShip class', typeof MiniShip === 'function' && /class MiniShip/.test(msSrc));

  // Player.js: delegates to SuperNova, no inline bullet construction left
  check("Player: imports fireNova + fireSuperWeapon from combat/SuperNova.js", pSrc.includes("import { fireNova, fireSuperWeapon } from '../combat/SuperNova.js'"));
  check('Player: activateUltimate delegates to fireNova(this)', pSrc.includes('activateUltimate() {') && pSrc.includes('fireNova(this);'));
  check('Player: superWeapon delegates to fireSuperWeapon(this)', pSrc.includes('superWeapon() {') && pSrc.includes('fireSuperWeapon(this);'));
  check('Player: no inline new Bullet( construction left', !pSrc.includes('new Bullet('));
  check('Player: no stale Bullet/TAU/rand imports', !pSrc.includes('import Bullet') && !pSrc.includes("from '../core/utils.js'"));

  // No stale core/ import paths anywhere in js/ or net/
  const staleHits = [];
  const scanStale = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { scanStale(full); continue; }
      if (!e.name.endsWith('.js')) continue;
      const src = fs.readFileSync(full, 'utf8');
      if (src.includes('core/CatShipFactory') || src.includes('core/MiniShip')) staleHits.push(path.relative(ROOT, full));
    }
  };
  scanStale(path.join(ROOT, 'js'));
  scanStale(path.join(ROOT, 'net'));
  check('no stale core/CatShipFactory or core/MiniShip imports in js/ + net/', staleHits.length === 0, staleHits.join(', '));

  // ── Headless behavior ──
  // fireNova: 16-bullet friendly ring, damage 25, #ffd54f, owner-tagged, shake 8
  {
    const g = makeGame();
    const p = { x: 640, y: 360, game: g };
    fireNova(p);
    check('fireNova: 16-bullet ring', g.bullets.length === 16, `got ${g.bullets.length}`);
    check('fireNova: bullets damage 25 + #ffd54f + friendly', g.bullets.every(b => b.damage === 25 && b.color === '#ffd54f' && b.friendly === true));
    check('fireNova: bullets owner-tagged to the firing player', g.bullets.every(b => b.owner === p));
    check('fireNova: shake set to 8', g.shake === 8, `got ${g.shake}`);
  }
  // fireSuperWeapon: 32 ring + 8 homing bolts, shake 16
  {
    const g = makeGame();
    const p = { x: 640, y: 360, game: g };
    fireSuperWeapon(p);
    const ring = g.bullets.filter(b => b.damage === 40);
    const homing = g.bullets.filter(b => b.homing);
    check('fireSuperWeapon: 32-bullet ring (damage 40 + #ffd54f)', ring.length === 32 && ring.every(b => b.color === '#ffd54f' && b.friendly === true), `got ${ring.length}`);
    check('fireSuperWeapon: 8 homing bolts (damage 60 + #ff5252)', homing.length === 8 && homing.every(b => b.damage === 60 && b.color === '#ff5252'), `got ${homing.length}`);
    check('fireSuperWeapon: 40 bullets total + shake 16', g.bullets.length === 40 && g.shake === 16, `bullets=${g.bullets.length} shake=${g.shake}`);
  }
  // Real Player delegation: base activateUltimate + superWeapon route through SuperNova
  {
    const g = makeGame();
    const p = makePlayer(g);
    p.x = 640; p.y = 360;
    p.activateUltimate();
    check('Player.activateUltimate delegates: 16 nova bullets', g.bullets.length === 16, `got ${g.bullets.length}`);
    p.superWeapon();
    check('Player.superWeapon delegates: +40 super-weapon bullets', g.bullets.length === 56, `got ${g.bullets.length}`);
  }
}

}
