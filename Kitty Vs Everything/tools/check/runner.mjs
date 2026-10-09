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
import s46 from './sections/06an-audio-modular.mjs';
import s47 from './sections/06ao-audio-suite-v411.mjs';

const SECTIONS = [s01, s02, s03, s04, s05, s06, s07, s08, s09, s10, s11, s12, s13, s14, s15, s16, s17, s18, s19, s20, s21, s22, s23, s24, s25, s26, s27, s28, s29, s30, s31, s32, s33, s36, s37, s38, s39, s40, s41, s42, s43, s44, s45, s46, s47, s35, s34];

export async function runAll() {
  for (const run of SECTIONS) await run();
  console.log(failures === 0
    ? '\n\x1b[32m[check] ALL GREEN — v4.11.0: AUDIO SUITE POLISH + ADMIN JUKEBOX (dedicated weapon SFX vulkanShot / pulseShot / railShot, zero-silent-trigger action SFX hullHit / shieldBreak / bossSpawn / overheat / dock / weaponSwitch, SFX-bus soft-clip shaper + bounded voice pool, rebuilt explosion tail, and the DevPanel Music Jukebox previewing all 13 SONGS album tracks via the MusicScheduler preview session) — on top of v4.10.0: MULTIPLAYER INSTRUCTIONS PANEL REDESIGN (the tiny LAN footer hint is replaced by a dedicated collapsible HOW TO HOST & JOIN LAN guide card in the MULTIPLAYER (LAN) settings panel — NetSettingsUI.js renders the card with 3 numbered steps: (1) start the relay via npm run lan on port 8765, (2) set the host LAN IP + port, (3) HOST GAME = Pilot 1 / JOIN GAME = Pilot 2; style.css styles the card to the dark-sci-fi cockpit theme — navy gradient, blue glow, gold step badges) — on top of v4.9.0: POLYPHONIC SYNTH OVERHAUL (SynthVoice.js — the polyphonic voice engine: detuned multi-osc voices + sine subs + soft-clip + full ADSR + filter sweeps + stereo image + delay/reverb sends, makeChord() real polyphony, kick/snare/hat percussion — under the MusicScheduler session graph: layer buses (pad/arp/lead/bass/perc/fx), bass soft-clip + sidechain pump, perc punch compressor, procedural convolver reverb, feedback delay; leads + harmony counter-voices (Für Elise octave double, Johnny March third below), chord stabs on combat/boss, sidechain-pumped basslines; SFX voices rebuilt on the same engine — on top of v4.8.0 AUDIO MODULARIZATION (the ~1000-line AudioSystem.js monolith is split into a single-responsibility E6 tree under js/core/audio/ — AudioCore.js: lazy AudioContext + masterGain→compressor→destination chain + SFX/music buses + master/sfx/music volumes + global mute; SoundEffects.js: all standalone SFX voices with tracked timers + live-source GC; MusicScheduler.js: the SINGLE mission-music scheduler — one lookahead timer, one session graph, start() hard-kills any previous session (timer + gain nodes + live sources) before a new track begins, zero overlapping loops; MusicPlaylists.js: the soundtrack data — MUSIC_MODES, the 13-song SONGS album, per-mode PLAYLISTS, the Für Elise + Johnny Marching Home crossover motifs; the AudioSystem.js facade keeps the public audio singleton API and adds stopAllMusic() / resetAudioEngine() / setMuted()) — plus v4.7.0: RnM SHIP DIALOGUE + SPAWN-RATE BOOST (the interceptor\'s "RnM SHIP INTERCEPTOR INBOUND" spawn banner is replaced by its sequential on-screen Rick & Morty dialogue — RnMShip.js RNMSHIP_DIALOGUE through the #alert-banner \'dialogue\' style: RICK "Come on Morty, 20 minutes! In and out!" → MORTY "Aw geez, Rick, is that a snake?" → RICK "Yes Morty, I told you, there\'s everything in space." — and the spawn roll is significantly boosted: RNMSHIP.spawnChance 0.19, 8–15 s roll windows, 8 s first roll, 5 per mission, in BOTH classic + Search & Destroy modes; destruction still drops the GUARANTEED Frenzy power-up) — plus v4.6.0: MULTI-TRACK PLAYLIST SOUNDTRACK (AudioSystem.js v4.6.0 rotates a per-mode playlist of 3–4 distinct 32-bar compositions with a 1-bar overlap crossfade at each boundary; crossover tracks: Für Elise as a 128 BPM cyber-remix — portamento detuned-saw lead, 4-on-the-floor kick, offbeat hats, sidechain-pumped 16th sub — and When Johnny Comes Marching Home as a 132 BPM industrial synth-march — gritty square lead, marching snare accents, distorted 8th bass pulses, tension sweeps; MusicDirector.js syncs the mode from SAR zones / classic stage flow / enemy pressure) — plus v4.5.0: PAUSE MENU RETURN TO HANGAR (the ⌂ #pause-hangar button in the pause overlay — PauseMenu.js → game.returnToHangar() → StageFlow.js — tears down the live session: active-stage cleanup, entities, hazards, particles, ships, co-op/LAN, SAR facade, score, mission music, pointer lock — and transitions state back to the hangar terminal / Catship selection; headless teardown verified) — plus v4.3.0: SAR world-space drift fix + multi-layer parallax starfield (displacement-accumulator camera — dead-zone + excess-delta world accumulation + soft recentering; world-anchored debris/hazard/patrol layout; OPEN SPACE → THE BONEYARD → DEEP SECTOR journey to Eridath\'s Mom\'s House, the 512px shootable base; F1 cockpit radar) — plus version sync, LevelRegistry surface, asset pipeline, and headless behavior verified.\x1b[0m'
    : `\n\x1b[31m[check] ${failures} FAILURE(S) — see ✗ lines above.\x1b[0m`);
  process.exit(failures === 0 ? 0 : 1);
}
