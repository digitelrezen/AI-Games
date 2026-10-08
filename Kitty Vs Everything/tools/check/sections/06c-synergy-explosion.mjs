// ═══════════════════════════════════════════════════════════
//  [6c] v3.96.0 FLEET ORBIT — the 'synergy' action (T / -) is now
//       the FLEET ORBIT toggle (docked <-> flat-circle orbit). The
//       orbiting minis ALWAYS face the main ship's heading no matter
//       where they are in the orbit (position only — drawMiniPod
//       rotates by player.angle). The old key-triggered synergy
//       super-weapon fire (PlayerFleet.js) is GONE; superCharge is
//       now a HUD color-match read only.
// ═══════════════════════════════════════════════════════════

import { ROOT, check } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';

export default async function run() {
console.log('\n[6c] v3.96.0 fleet orbit (source gates)');
{
  const fleetSrc = fs.readFileSync(path.join(ROOT, 'js/player/PlayerFleet.js'), 'utf8');
  check('PlayerFleet: synergy super-weapon fire REMOVED (no wasPressedAction("synergy"))',
    !fleetSrc.includes("input.wasPressedAction('synergy')"));
  check('PlayerFleet: superCharge is a HUD read only (no in-charge superWeapon)',
    !/superCharge\s*>=\s*1\s*\)\s*\{\s*player\.superCharge\s*=\s*0;\s*player\.superWeapon\(\);/.test(fleetSrc));
  check('PlayerFleet: superCharge still charges on theme match (HUD meter)',
    fleetSrc.includes('player.superCharge = Math.min(1, player.superCharge + dt / MINI_SHIP.synergyChargeTime)'));
  const playerSrc = fs.readFileSync(path.join(ROOT, 'js/player/Player.js'), 'utf8');
  check('Player: "synergy" action dispatches to toggleFleetOrbit',
    playerSrc.includes("if (input.wasPressedAction('synergy')) toggleFleetOrbit(this);"));
  check('Player: imports toggleFleetOrbit from MiniDeploy.js',
    playerSrc.includes("import { toggleFleetDeploy, updateFleetDeploy, toggleFleetOrbit } from '../levels/MiniDeploy.js';"));
  check('Player: fleetOrbiting state initialized',
    playerSrc.includes('this.fleetOrbiting = false;'));
  const deploySrc = fs.readFileSync(path.join(ROOT, 'js/levels/MiniDeploy.js'), 'utf8');
  check('MiniDeploy: toggleFleetOrbit exported (T toggle: docked <-> orbit)',
    deploySrc.includes('export function toggleFleetOrbit(player)'));
  check('MiniDeploy: entering orbit recalls deploy (2nd T redocks)',
    deploySrc.includes('player.fleetDeployed = false; // recall deploy so a 2nd T redocks'));
  const miniSrc = fs.readFileSync(path.join(ROOT, 'js/combat/MiniShip.js'), 'utf8');
  check('MiniShip: ORBITING branch drives position only (facing stays player.angle)',
    miniSrc.includes('if (player.fleetOrbiting)') &&
    miniSrc.includes('const a = player.angle + this.side * (Math.PI / 2) + this.orbitAngle;') &&
    miniSrc.includes('this.x = player.x + Math.cos(a) * MINI_SHIP.orbitRadius;'));
  check('MiniShip: orbiting minis fire IN SYNC with the hull (firedThisFrame)',
    miniSrc.includes('if (player.firedThisFrame) this.fireWeapon(player);'));
  const cfgSrc = fs.readFileSync(path.join(ROOT, 'js/core/config/player.js'), 'utf8');
  check('config/player: MINI_SHIP.orbitRadius + orbitSpeed defined',
    cfgSrc.includes('orbitRadius: 120') && cfgSrc.includes('orbitSpeed: 1.0'));
  const kbSrc = fs.readFileSync(path.join(ROOT, 'js/input/Keybinds.js'), 'utf8');
  check('Keybinds: synergy action registered (label "Fleet Orbit")',
    kbSrc.includes("{ id: 'synergy',     label: 'Fleet Orbit' }"));
  check('Keybinds: synergy defaults KeyT / Minus',
    /synergy:\s*\[\s*'KeyT'\s*,\s*'Minus'\s*\]/.test(kbSrc));
  const mkSrc = fs.readFileSync(path.join(ROOT, 'js/input/MenuKeybinds.js'), 'utf8');
  check('MenuKeybinds: synergy row after ultimate (12 rows total, label "Fleet Orbit")',
    mkSrc.includes("action: 'ultimate', label: 'Super'") &&
    mkSrc.includes("action: 'synergy', label: 'Fleet Orbit'") &&
    (mkSrc.match(/\{ kind: '(wsad|action|static)'/g) || []).length === 12);
  const aimSrc = fs.readFileSync(path.join(ROOT, 'js/combat/TestAimbot.js'), 'utf8');
  check('TestAimbot: hotkey moved T → F8 (no KeyT left)',
    aimSrc.includes("e.code !== 'F8'") && !aimSrc.includes('KeyT'));
  const hudSrc2 = fs.readFileSync(path.join(ROOT, 'js/ui/HUDFireControl.js'), 'utf8');
  check('HUDFireControl: NOVA slot key label tracks the synergy action',
    hudSrc2.includes("this._slotLabel(e.novaSlot, 'synergy')"));
  const htmlSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  check('index.html: static NOVA slot key is T (was F)',
    /nova-slot[\s\S]*?fc-slot-key">T</.test(htmlSrc));
  const p2Src = fs.readFileSync(path.join(ROOT, 'net/Player2Controls.js'), 'utf8');
  check('Player2Controls: synergy in P2_ACTIONS + default Comma',
    p2Src.includes("'deployFleet', 'synergy'") && /synergy:\s*\[\s*'Comma'\s*\]/.test(p2Src));
  const netSrc = fs.readFileSync(path.join(ROOT, 'net/NetProtocol.js'), 'utf8');
  check('NetProtocol: encodeInput sends the synergy edge',
    netSrc.includes("synergy: p('synergy') ? 1 : 0"));
  const coopSrc = fs.readFileSync(path.join(ROOT, 'net/CoopManager.js'), 'utf8');
  check('CoopManager: remote P2 synergy edge applied host-side',
    coopSrc.includes('synergy: !!ri.synergy'));
}

}
