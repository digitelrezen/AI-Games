// ═══════════════════════════════════════════════════════════
//  [6c] v3.47.0 KEY-TRIGGERED SYNERGY EXPLOSION — the meter
//       (superCharge) holds at 100% and the 'synergy' action fires
//       superWeapon (P1: T / -, P2 co-op: ,); TestAimbot moved T → F8
// ═══════════════════════════════════════════════════════════

import { ROOT, check, makeGame } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';
  const makeRocketGame = () => { const g = makeGame(); g.enemies = []; g.player = { minis: [] }; g.fireZones = []; return g; };
    const g = makeRocketGame();

export default async function run() {
console.log('\n[6c] v3.47.0 key-triggered synergy explosion (source gates)');
{
  const fleetSrc = fs.readFileSync(path.join(ROOT, 'js/player/PlayerFleet.js'), 'utf8');
  check('PlayerFleet: synergy key gate (input.wasPressedAction("synergy"))',
    fleetSrc.includes("input.wasPressedAction('synergy')"));
  check('PlayerFleet: fire gated on minis + theme match + superCharge >= 1',
    fleetSrc.includes('player.minis.length > 0') &&
    fleetSrc.includes('m.theme === player.theme') &&
    fleetSrc.includes('player.superCharge >= 1'));
  check('PlayerFleet: old 10s auto-fire removed (no in-charge superWeapon)',
    !/superCharge\s*>=\s*1\s*\)\s*\{\s*player\.superCharge\s*=\s*0;\s*player\.superWeapon\(\);/.test(fleetSrc));
  const kbSrc = fs.readFileSync(path.join(ROOT, 'js/input/Keybinds.js'), 'utf8');
  check('Keybinds: synergy action registered (label "Synergy Explosion")',
    kbSrc.includes("{ id: 'synergy',     label: 'Synergy Explosion' }"));
  check('Keybinds: synergy defaults KeyT / Minus',
    /synergy:\s*\[\s*'KeyT'\s*,\s*'Minus'\s*\]/.test(kbSrc));
  const mkSrc = fs.readFileSync(path.join(ROOT, 'js/input/MenuKeybinds.js'), 'utf8');
  check('MenuKeybinds: synergy row after ultimate (12 rows total)',
    mkSrc.includes("action: 'ultimate', label: 'Super'") &&
    mkSrc.includes("action: 'synergy', label: 'Synergy Explosion'") &&
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
