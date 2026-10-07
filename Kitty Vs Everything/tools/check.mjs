#!/usr/bin/env node
// tools/check.mjs — Kitty Vs Everything v3.77.0 (tools/ lives in the game root)
// One-stop health check for the v3.43.0 release work (alien UFO pixel-art
// dual-skin sprite swap) plus the v3.42.0 release work (shared POWERUP_DROPS
// drop pool, fully off-screen asteroid spawns, ship easter egg in most
// levels) plus the v3.33.0 FRENZY / hull-repair / PNG pipeline / HUD checks.
// Pure Node — no canvas, no browser.
//
//   node tools/check.mjs          → version sync + module surface + asset
//                                   pipeline (import-assets --check, validate)
//                                   + headless behavior (power-up collection,
//                                   Vulcan thermal / frenzy overheat immunity,
//                                   drop lifecycle)
//   node tools/check.mjs --full   → additionally runs the full smoke.mjs
//                                   logic suite as a subprocess
//
// Exit code 0 = all green, 1 = at least one ✗.
//
// Thin entry point — the sections live in tools/check/ (infra.mjs +
// runner.mjs + sections/*.mjs). Behavior and output are unchanged.
import { runAll } from './check/runner.mjs';
await runAll();
