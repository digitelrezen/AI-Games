// ═══════════════════════════════════════════════════════════
//  [6ac] v3.78.0 A/D CONTROL MODE — 'strafe' (default) / 'spin'
//        (classic) via Settings.controlMode + PlayerFlight behavior,
//        and the redundant fire-control pause button removal (Esc / P /
//        the pause overlay remain the pause entry points).
// ═══════════════════════════════════════════════════════════

import { ROOT, check, mod, makeGame, makePlayer } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';

export default async function run() {
{
  console.log('\n[6ac] v3.78.0 A/D control mode (strafe / spin) + pause-button removal');
  const { SETTINGS, setSetting, resetSettings } = await mod('js/ui/Settings.js');
  const { PLAYER } = await mod('js/core/config/player.js');
  const { updateFlight } = await mod('js/player/PlayerFlight.js');

  // ─── Settings.controlMode: default / sanitize / set / reset ───
  check('Settings.controlMode defaults to "strafe"',
    SETTINGS.controlMode === 'strafe', `got ${JSON.stringify(SETTINGS.controlMode)}`);
  setSetting('controlMode', 'spin');
  check('setSetting("controlMode","spin") applies', SETTINGS.controlMode === 'spin', `got ${SETTINGS.controlMode}`);
  setSetting('controlMode', 'banana');
  check('setSetting("controlMode",<invalid>) is ignored', SETTINGS.controlMode === 'spin', `got ${SETTINGS.controlMode}`);
  resetSettings();
  check('resetSettings() restores controlMode to "strafe"', SETTINGS.controlMode === 'strafe', `got ${SETTINGS.controlMode}`);

  // ─── Headless flight behavior (fake input, single frame) ───
  const fakeInput = (actions, { mouseMoveX = 0, mouseIdle = 99 } = {}) => ({
    isDownAction: (a) => actions.includes(a),
    mouseIdleTime: () => mouseIdle,
    mouse: { moveX: mouseMoveX },
  });
  const DT = 1 / 60;
  // Nose at angle 0 points +X → the ship's right side is (0, +1).
  const noseRight = () => { const p = makePlayer(makeGame()); p.angle = 0; return p; };

  setSetting('controlMode', 'spin');
  let p = noseRight();
  updateFlight(p, DT, fakeInput(['rotateRight']));
  check('"spin": rotateRight held rotates the nose (classic)',
    p.angle > 0.01 && Math.abs(p.vx) < 1e-9 && Math.abs(p.vy) < 1e-9,
    `angle=${p.angle} v=(${p.vx},${p.vy})`);

  setSetting('controlMode', 'strafe');
  p = noseRight();
  updateFlight(p, DT, fakeInput(['rotateRight']));
  check('"strafe": rotateRight held does NOT rotate the nose',
    Math.abs(p.angle) < 1e-9, `angle=${p.angle}`);
  check('"strafe": rotateRight held pushes the ship sideways (vy>0, vx≈0)',
    p.vy > 0 && Math.abs(p.vx) < 1e-9, `v=(${p.vx},${p.vy})`);

  p = noseRight();
  updateFlight(p, DT, fakeInput([], { mouseMoveX: 100, mouseIdle: 0 }));
  check('"strafe": mouse movement still spins the nose (no A/D override)',
    Math.abs(p.angle) > 0.1, `angle=${p.angle}`);

  p = noseRight();
  updateFlight(p, DT, fakeInput(['rotateRight'], { mouseMoveX: 100, mouseIdle: 0 }));
  check('"strafe": A/D + mouse at once → lateral thrust AND mouse spin',
    p.vy > 0 && Math.abs(p.angle) > 0.1, `angle=${p.angle} v=(${p.vx},${p.vy})`);

  setSetting('controlMode', 'spin');
  p = noseRight();
  updateFlight(p, DT, fakeInput([], { mouseMoveX: 100, mouseIdle: 0 }));
  check('"spin": mouse spin still active when no rotation key is held',
    Math.abs(p.angle) > 0.1, `angle=${p.angle}`);

  resetSettings(); // leave factory defaults for the sections that follow

  // ─── Source-level gates ───
  const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const playerCfg = read('js/core/config/player.js');
  const flightSrc = read('js/player/PlayerFlight.js');
  const indexHtml = read('index.html');
  const styleCss = read('style.css');
  const pauseSrc = read('js/ui/PauseMenu.js');

  check('config/player.js defines PLAYER.STRAFE_THRUST_MULT',
    playerCfg.includes('STRAFE_THRUST_MULT'));
  check('PLAYER.STRAFE_THRUST_MULT is a positive number',
    typeof PLAYER.STRAFE_THRUST_MULT === 'number' && PLAYER.STRAFE_THRUST_MULT > 0,
    `got ${PLAYER.STRAFE_THRUST_MULT}`);
  check('PlayerFlight.js branches on SETTINGS.controlMode',
    flightSrc.includes('SETTINGS.controlMode'));
  check('index.html has the controlMode radio pair (strafe checked by default)',
    indexHtml.includes('id="set-control-strafe"') && indexHtml.includes('id="set-control-spin"')
      && /name="controlMode"[^>]*checked/.test(indexHtml));
  check('index.html no longer has the fire-control #pause-btn element',
    !indexHtml.includes('id="pause-btn"'));
  check('style.css no longer styles #pause-btn / .console-right-stack',
    !styleCss.includes('#pause-btn {') && !styleCss.includes('.console-right-stack {'));
  check('PauseMenu.js no longer wires a pauseBtn element',
    !pauseSrc.includes('pauseBtn'));
  check('PauseMenu.js still handles the Esc / P keydowns',
    pauseSrc.includes("'Escape'") && pauseSrc.includes("'KeyP'"));
  check('index.html tab title is synced to v4.21.0',
    indexHtml.includes('Kitty Vs Everything — v4.21.0'));
}
}