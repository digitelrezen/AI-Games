// tools/check/runner.mjs — runs the check sections in order, then the summary.
import { failures } from './infra.mjs';
import s01 from './sections/01-version-sync.mjs';
import s02 from './sections/02-module-surface.mjs';
import s03 from './sections/03-asset-pipeline.mjs';
import s04 from './sections/04-powerup-collection.mjs';
import s05 from './sections/05-vulkan-thermal.mjs';
import s06 from './sections/06-drop-lifecycle.mjs';
import s07 from './sections/06b-clean-catship.mjs';
import s08 from './sections/06c-synergy-explosion.mjs';
import s09 from './sections/06d-shuttle-enemy.mjs';
import s10 from './sections/06e-jewel-shading.mjs';
import s11 from './sections/06f-moth-enemy.mjs';
import s12 from './sections/06g-beetle-sprite.mjs';
import s13 from './sections/06h-boneyard-env.mjs';
import s14 from './sections/06i-crosshair-range.mjs';
import s15 from './sections/06j-spider-sprite.mjs';
import s16 from './sections/06k-powerup-pixel-art.mjs';
import s17 from './sections/06l-double-sized-icons.mjs';
import s18 from './sections/06m-destructible-boneyard.mjs';
import s19 from './sections/06n-snake-sprite.mjs';
import s20 from './sections/06o-wolf-sprite.mjs';
import s21 from './sections/06p-lizard-sprite.mjs';
import s22 from './sections/06q-dragon-sprite.mjs';
import s23 from './sections/06r-falcon-sprite.mjs';
import s24 from './sections/06s-bat-sprite.mjs';
import s25 from './sections/06t-squirrel-enemy.mjs';
import s26 from './sections/06u-weapons-base-vulcan.mjs';
import s27 from './sections/06v-pulse-rail.mjs';
import s28 from './sections/06w-rockets.mjs';
import s29 from './sections/06x-supernova.mjs';
import s30 from './sections/06y-catship-themes.mjs';
import s31 from './sections/06z-level-registry.mjs';
import s32 from './sections/06aa-phase4-version-sync.mjs';
import s33 from './sections/06ab-shuttle-wave-event.mjs';
import s34 from './sections/07-full-smoke.mjs';
import s35 from './sections/06ac-control-mode.mjs';
import s36 from './sections/06ad-drop-rarity.mjs';
import s37 from './sections/06ae-spaceballs-one.mjs';
import s38 from './sections/06af-gold-coin-drop.mjs';
import s39 from './sections/06ag-crisp-rendering.mjs';
import s40 from './sections/06ah-hazards.mjs';
import s41 from './sections/06ai-admin-gate.mjs';
import s42 from './sections/06aj-search-destroy.mjs';
import s43 from './sections/06ak-hangar-terminal.mjs';
import s44 from './sections/06al-rnm-ship.mjs';
import s45 from './sections/06am-pause-hangar.mjs';

const SECTIONS = [s01, s02, s03, s04, s05, s06, s07, s08, s09, s10, s11, s12, s13, s14, s15, s16, s17, s18, s19, s20, s21, s22, s23, s24, s25, s26, s27, s28, s29, s30, s31, s32, s33, s36, s37, s38, s39, s40, s41, s42, s43, s44, s45, s35, s34];

export async function runAll() {
  for (const run of SECTIONS) await run();
  console.log(failures === 0
    ? '\n\x1b[32m[check] ALL GREEN — v4.5.0: PAUSE MENU RETURN TO HANGAR (the ⌂ #pause-hangar button in the pause overlay — PauseMenu.js → game.returnToHangar() → StageFlow.js — tears down the live session: active-stage cleanup, entities, hazards, particles, ships, co-op/LAN, SAR facade, score, mission music, pointer lock — and transitions state back to the hangar terminal / Catship selection; headless teardown verified) — plus v4.4.0: DYNAMIC PROCEDURAL SOUNDTRACK (the 4-note A-minor loop is gone — AudioSystem.js v4.4.0 runs a multi-layer generative engine: four context modes open/combat/boneyard/boss with 8-bar chord progressions, evolving pads, per-phrase seeded arpeggio variation, mode-specific bass + noise percussion, space delay + shimmer; MusicDirector.js syncs the mode from SAR zones / classic stage flow / enemy pressure) — plus v4.3.0: SAR world-space drift fix + multi-layer parallax starfield (displacement-accumulator camera — dead-zone + excess-delta world accumulation + soft recentering; world-anchored debris/hazard/patrol layout; OPEN SPACE → THE BONEYARD → DEEP SECTOR journey to Eridath\'s Mom\'s House, the 512px shootable base; F1 cockpit radar) — plus version sync, LevelRegistry surface, asset pipeline, and headless behavior verified.\x1b[0m'
    : `\n\x1b[31m[check] ${failures} FAILURE(S) — see ✗ lines above.\x1b[0m`);
  process.exit(failures === 0 ? 0 : 1);
}
