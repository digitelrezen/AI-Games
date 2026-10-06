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

const SECTIONS = [s01, s02, s03, s04, s05, s06, s07, s08, s09, s10, s11, s12, s13, s14, s15, s16, s17, s18, s19, s20, s21, s22, s23, s24, s25, s26, s27, s28, s29, s30, s31, s32, s33, s36, s37, s38, s35, s34];

export async function runAll() {
  for (const run of SECTIONS) await run();
  console.log(failures === 0
    ? '\n\x1b[32m[check] ALL GREEN — v3.87.0: start-menu hangar polish (the .menu-hangar CSS block was stranded inside an unclosed #dev-panel rule and silently discarded — style.css now closes #dev-panel and restores the hangar as a top-level section: ship-select arrows flank the stage left/right, the nameplate sits centered under the cat ship, arrow controls enlarged to 56px; the hero canvas renders at native device-pixel resolution via a DPR-aware buffer for a crisp HiDPI start screen), version sync, LevelRegistry surface, asset pipeline (LF registry byte-identical to committed), and headless behavior verified.\x1b[0m'
    : `\n\x1b[31m[check] ${failures} FAILURE(S) — see ✗ lines above.\x1b[0m`);
  process.exit(failures === 0 ? 0 : 1);
}
