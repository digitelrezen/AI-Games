# Kitty Vs Everything — Architecture Roadmap / File Index

> **Workspace:** `c:\AI-Games\Kitty Vs Everything`
> **Generated:** 2026-09-27 (v3.27.0 easter-egg manager + Planet Express ship flyby)
> **Layout:** ~80 files, flat in the root folder + a `net/` subfolder for multiplayer; `npm run build` (build.mjs) inlines every module into a single self-contained `Kitty Vs Everything <version>.html` in `C:\AI-Games\Builds\`
> **Stack:** Native ES modules, Canvas 2D, WebAudio, plain DOM, `ws` (LAN relay, Node-only)
> **Run:** `python -m http.server 8000` → http://localhost:8000  ·  LAN: `npm run lan`

## Dependency Flow (top → bottom)

```
index.html ─▶ main.js ─▶ Game.js (orchestrator)
Game.js ─▶ CatShipFactory ─▶ Player ─▶ 5 cat variants
        ─▶ PlayerFleet / MiniDeploy / WeaponAnim (v3.16.0 fleet deploy + weapon anim)
        ─▶ WaveManager ─▶ EnemyFactory ─▶ EnemyBase ─▶ 17 species
        ─▶ Combat / Bullet / PowerUp / MiniShip
        ─▶ BonusLevel ─▶ BoneYardBonus / InternetBonus
        ─▶ InternetBonus ─▶ BlackCatEntourage / RealTimeClock
        ─▶ HUD / DevPanel / Leaderboard (DOM)
        ─▶ InputManager / AudioSystem / ParticleSystem
```

**Foundation:** `config.js`, `utils.js`, `EventBus.js`, `Entity.js` (imported by nearly every other file)

## 1. Entry & App Shell (4 files)

- **index.html** — App shell: canvas, main menu (5 `.ship-option` cards), game-over + leaderboard lists, touch UI, HUD DOM; loads `main.js` as the ES-module entry point.
- **style.css** — All styling: layout, menu cards, HUD bars, touch-button colors, and the `.hidden` utility class.
- **main.js** — Entry point: boots Game, wires `#start-btn`/`#retry-btn`/`#save-score`, `.ship-option` theme selection, Enter shortcut; also carries the project manifest comment.
- **Game.js** — Orchestrator: state machine, fixed update loop, all collision detection, scoring, starfield, render dispatch. v3.13.0: `W`/`H` mirror the LIVE viewport (`view.viewW/H`) and re-sync on resize — legacy `game.W/H` consumers track ultra-wide. v3.27.0: `this.aimbot` is the EasterEgg manager — one slot per egg (`game.eggs = { bender, ship }`); Bender from the robot power-up, ship flyby from the dev panel.

## 2. Core Infrastructure (6 files)

- **config.js** — Single source of truth for tunables: GAME dims (native 1280×720 REFERENCE since v3.13.0), SHIP_GEOMETRY (catship hardpoints), WEAPONS, PLAYER_THEMES, ENEMY_TYPES/TIERS, BONUS.
- **Viewport.js** — v3.13.0 dynamic viewport math: `computeViewport(winW, winH, dpr)` → `viewW/viewH` (the constrained axis stays at native GAME size, the other axis stretches to fill the window → zero letterboxing), crisp buffer scale `q` (≤ 3), and `ULTRA_WIDE_PRESETS` (exact native-pixel buffers at 3440×1440 / 5120×1440 @ DPR 1).
- **ViewScaler.js** — Applies `computeViewport`: CSS `scale()` on `#game-root`, canvas buffer sized `viewW×q × viewH×q`, identity ctx transform (Game.js applies `ctx.scale(q)` per frame). `U` = browser fullscreen.
- **utils.js** — Shared math helpers: TAU, rand, clamp, dist2, angleTo, pick.
- **EventBus.js** — Global pub/sub `bus` for UI events (banner, score, life) so game logic never touches the DOM directly.
- **Entity.js** — Base class for every actor: position, velocity, radius, hp/shield, alive flag.

## 3. Player Ships / Art (9 files)

- **Player.js** — Base cat-ship: WASD move, SPACE boost, weapon fire, Q stun rocket, F ultimate (generic fallback), mini-ship docking, lives & respawn.
- **PlayerRenderer.js** — Canvas art for the player ship (v3.2.0 base model): sleek teardrop hull with belly armor + neon nose trim, antenna ears, blinking glowing eyes, front-paw weapon pods at SHIP_GEOMETRY hardpoints, back-paw thruster rockets, reactive tail, muzzle flashes, docked mini-pods.
- **CatShipFactory.js** — Theme-ID → class registry; `createCatShip(theme, game)` is the single player spawn path (grey/gray alias, yellow fallback); `getUltimateName` for HUD.
- **orangeCat.js** — Orange Tabby variant — ultimate: Nova Shockwave.
- **yellowCat.js** — Yellow Tabby variant — ultimate: Energy Ring Explosion (bullet rings + shield break + knockback).
- **greyCat.js** — Grey variant — ultimate: Black Hole Pull (warps enemies into a dense, crushable cluster).
- **whiteCat.js** — White variant — ultimate: Tactical Nuke (screen-wide AOE + mushroom-cloud visual).
- **brownCat.js** — Brown variant — ultimate: Shield Overcharge (brief invulnerability + pushes nearby enemies away).
- **MiniShip.js** — Galaga-style docked clone firing the player's active weapon profile. v3.16.0: docked minis are INERT (snap to dock slot, no fire, no weapon anim); deployed minis (player.fleetDeployed) fire the hull's active weapon on the hull's cadence and tick their weapon animation (WeaponAnim.js). `this.weapon` tracks the player's active weapon.
- **PlayerFleet.js** — Mini-fleet lifecycle: dock/undock, clearFleet (resets player.fleetDeployed = false), damage bookkeeping.
- **WeaponAnim.js** — v3.16.0 pure-logic weapon animation state (vulkanSpin / railCharge / plasmaPulse). `initWeaponAnimState(s)` + `updateWeaponAnim(s, dt, { active, time })`. Ticked by Player.js (hull) and MiniShip.js (minis); surfaced by PlayerShipArt/PlayerMiniArt → PlayerShipFx.drawWeaponPaw. Decays cleanly when active: false.
- **MiniDeploy.js** — v3.16.0 pure-logic fleet deploy/recall. `toggleFleetDeploy(player)` flips player.fleetDeployed; `updateFleetDeploy(player, dt)` places deployed minis in a combat orbit (MINI_SHIP.deployRadius / deployOrbitSpeed) and advances mini.orbitAngle. Docked minis are inert (no fire, no anim).

## 4. Weapons / Combat (3 files)

- **Bullet.js** — Projectile: velocity, damage, weapon profile, optional homing/tracking, friendly flag, lifetime.
- **Combat.js** — `applyWeaponHit`: per-weapon damage rules (incl. plasma-pulse shield melt), hit-flash, `onEnemyDeath`.
- **PowerUp.js** — Falling drops: extra life, shield, mini-ship, bonus crate, rare Bender (easter egg). v3.51.0: frenzy / extra-life / shield drops render through `drawJewelDrop()`, a programmatic 5-pass gem treatment (no new art): pulsating additive AURA in the type's jewel color (golden/emerald/azure) → icon into a 40×40 offscreen buffer → source-atop DEPTH bevel (light top-left → shade bottom-right) + inset vignette → specular SHINE (white radial glint + rim arc + twinkling 4-point sparkle) → rotating perimeter SHIMMER; procedural fallbacks unchanged and headless-safe (no DOM → base only). v3.36.0: bonus crate draws the shared `.assets` PNG (key `crate`, `Crate-pixel-art.png`, 620×574 → 128×119) via the AssetManager pipeline, procedural crate kept as null-sprite fallback.

## 5. Enemies (28 files)

- **EnemyBase.js** — Base enemy: descend, `move(dt, slowMul)` hook, fire logic, stun/slow state, flash decay, death bookkeeping.
- **EnemyFactory.js** — Type-ID → class registry; `createEnemy({type, tier, x, y, game})` with tier-scaled stats.
- **WaveManager.js** — Wave definitions + spawn scheduling through EnemyFactory; wave-clear detection, bonus scoring.
- **WaspEnemy.js** — Fast sine-weaving striker with aimed shots. v1.2.0: pixel-art sprite from
`.assets/Wasp Update pixel_art.png` via the AssetManager pipeline (key `wasp`, 694×393 → 128×72),
mirrored to face the player (left-facing art), classic procedural wasp kept as null-sprite fallback.
- **Wasp2Enemy.js** — Black wireframe wasp (sprite from `../.assets/Wasp 1 Pixel Art.png` via Wasp2Sprite.js). Tracks player X, oscillates, periodic lunges.
- **Wasp2Sprite.js** — Wasp2 sprite pipeline: base64-embedded PNG, white keyed to transparent (alpha = 255 − luminance), downscaled 882×500 → 256×145, 1-px alpha dilation.
- **BeetleEnemy.js** — Slow armored tank with periodic charge lunges.
- **ButterflyEnemy.js** — Fast fluttering dodger, light shots. v1.2.0: top-down pixel-art sprite from
`.assets/Butteryfly pixel_art.png` via the AssetManager pipeline (key `butterfly`, 530×343 → 128×83),
drawn overhead with a procedural wing-beat (sinusoidal scaleY + subtle wing-fold scaleX + slow rotation
wobble) — no face-the-player mirror (art is a top-down view), classic procedural butterfly kept as null-sprite fallback.
- **RatEnemy.js** — Fast dashing scavenger with lateral jitter.
- **WolfEnemy.js** — Mid-speed pack hunter, offset pack sines.
- **FalconEnemy.js** — Hovers high, then dives straight at the player.
- **BatEnemy.js** — Erratic random-jitter flutterer.
- **BlackCatEnemy.js** — Teleporting phantom, phases every ~1.8s. Drawn skinny & tall (Internet Bonus look).
- **LizardEnemy.js** — Slow tank, 3-way acid spit from fixed altitude.
- **DragonEnemy.js** — Heavy high-hover firing 5-shot fire cones.
- **HumanEnemy.js** — v3.13.0: a REAL PERSON (drawn by HumanSprite.js). Normal waves: descend → hover band → horizontal strafe + telegraphed aimed rifle fire (red sight ring before each shot). Bone Yard: `marchMode = true` → straight-down single-file march at 0.7× speed with an animated walk cycle.
- **HumanSprite.js** — v3.13.0 procedural humanoid art: front-facing chibi person holding a rifle (4 shirt variants, 6 hair colors, 3 hair styles, 4 skin tones via `randomOutfit()`), walk-cycle leg/arm swing + body bob (`drawHuman(ctx, { r, outfit, walkPhase, flash, aim })`).
- **AlienEnemy.js** — Pulsing UFO disc, phase-shift alpha, sine sweeps.
- **SnakeEnemy.js** — Undulating serpent, smooth sine wave.
- **SpiderEnemy.js** — Slow web-spinner, slow web projectiles.
- **PinkCatEnemy.js** — "Internet" boss (InternetBonus), aggressive fire patterns. v3.13.0: small cute FEMALE chibi boss (radius 18 — trash/crate scale); all boss HP/shield/damage/movement/attack behavior unchanged.
- **PinkCatBossArt.js** — v3.13.0 boss art: `drawPinkCatBoss(ctx, { r, t, flash, hpFrac })` — hair bow, long lower lashes, blushing cheeks, tiny "w" mouth, fluffy tail + drifting hearts, "enraged" wide eyes below 35% HP.
- **ShuttleEnemy.js** — v3.50.0: 17th species (REGULAR WAVES ONLY): a crewed space shuttle that glides in from the top, holds a hover band (y 80–180), and strafes left/right with a BANKED TILT (sprite rotates toward travel direction, eased at 4/s). Fires telegraphed aimed cannon shots — a red sight ring on the aim line before each shot (same telegraph contract as HumanEnemy: `attack()` arms the 0.4s aim, `move()` counts down and fires). Pixel-art sprite from `.assets/Human-SpaceShuttle-pixel-art.png` via the AssetManager pipeline (key `shuttle`, 699×329 → 128×60), classic procedural shuttle kept as null-sprite fallback.

## 6. Bonus Levels / Special Sequences (10 files)

- **BonusLevel.js** — Randomly dispatches Bone Yard vs Internet Classic.
- **BoneYardBonus.js** — 3-phase comedic round: floating bones → human line march → "win by NOT making it" timer. v3.50.0: Phase 2/3 spawning is locked to standard humanoids by an EXPLICIT allowlist (`BONE_YARD_HUMANOID_TYPES = ['human']`, spawn sites use `BONE_YARD_HUMANOID_TYPES[0]`) so new species (e.g. shuttle) can never leak into the march.
- **AsteroidBonus.js** — Destructible asteroid chain power-up (lives in `game.powerups`, `destructible=true`): a Large rock shatters into 2 Medium + 2 smaller Small shards, each Medium into 4 Small, and every destroyed Small rolls a 40% regular power-up drop. Routed via `Game.destroyAsteroid` (`isAsteroid` flag).
- **AsteroidSprite.js** — v3.22.0 asteroid sprite pipeline: base64-embedded PNG from `../.assets/Asteroid pixel_art_small.png` (241×217, transparent), tight-cropped → downscaled to a 128-px sprite → clipped into 8 seeded jagged shard sub-sprites. Large draws the full rock; Medium/Small fragments draw a jagged shard (a broken chunk of the rock) scaled to tier size. Falls back to the procedural jittered rock if the pipeline hasn't finished.
- **BoneFragment.js** — Shootable bone: shatter shrapnel, 500-pt score.
- **InternetBonus.js** — Boss round: 8 Black Cats orbiting in a circle around the 1 Pink Cat boss, with crate/power-up drops. v3.15.0: the 8 orbiting Black Cats are the boss's entourage — tagged `entourage = true` + `entouragePhase`, and the round owns the RealTimeClock lifecycle (start on spawn, tick in update, stop on phase-out).
- **BlackCatEntourage.js** — v3.15.0 entourage accessory art (pure drawing, no game state): `drawEntourageOutfit(ctx, { r, t, phase, flash })` — chunky old-school gold cuban-link chain (V-drape from neck to chest, subtle sway) + large iced-out digital clock pendant (gold bail/bezel, twinkling diamond "ice" studs, dark LCD, 7-segment HH:MM with blinking colon). Called from `BlackCatEnemy.draw()` when `entourage` is set; the pendant display reads `realTimeClock.getHHMM()` — the art never touches `Date`.
- **RealTimeClock.js** — v3.15.0 real-time clock sync loop: `realTimeClock` singleton (`start()/stop()/update(dt)`) pulls the player's actual local system time (hours + minutes) from JavaScript's `Date` object, re-reading at most once per second; `getHHMM()` feeds the pendant displays and `getSeconds()` drives the colon blink.
- **EasterEgg.js** — Easter-egg manager (v3.27.0): one slot per egg in `game.eggs` — Bender (v3.24.0, BenderSprite.js pixel art: "BENDER ENGAGED" banner, slides in from the right, cigar arm telescopes toward the ship, 10s auto-aim, parting quip on exit) and the Planet Express ship flyby (v3.27.0, ShipSprite.js: one-shot left→right pass, "PLANET EXPRESS, INCOMING" banner, 8s, non-interactive). `switchEgg(game, 'ship')` is the dev-panel trigger; the legacy `game.aimbot` surface (trigger/reset/update/draw/active/timeLeft) is unchanged.
- **ShipSprite.js** — v3.27.0 Planet Express ship sprite (generated file, headless-safe): base64-embedded PNG from `../.assets/Futurama Ship pixel_art_large.png` (935×500), tight-cropped → downsampled /2 to 422×159 (nose faces +x). Exports `SHIP_W`/`SHIP_H`, `getShip()` (decoded canvas, `null` until ready) and `isShipSpriteReady()`. The `new Image()` lives inside the Promise executor and the decode `.catch()`es, so importing under Node never throws — the sprite is optional and `ShipEasterEgg.draw()` (EasterEgg.js) falls back to a placeholder ellipse while it decodes.

## 7. HUD / UI / Meta (3 files)

- **HUD.js** — DOM top bar: score, lives, wave, HP/shield bars, stun/nova/weapon indicators, banners, `#version-label`.
- **DevPanel.js** — Backtick/F9 admin panel: spawn species/tier, weapon override, instant bonus, god mode, robot drop (Bender easter egg), ship drop (Planet Express flyby, v3.27.0). v3.34.0: redesigned — pinned header, scrollable `.dev-body`, pinned footer with a live viewport readout (`Viewport.describeViewport`, refreshes on resize/fullscreenchange); stage-relative `max-height: calc(100% - 20px)` so every control is reachable at any resolution.
- **Leaderboard.js** — localStorage high scores: `submit(name, score)`, render into `#menu-scores-list` / `#go-scores-list`.

## 8. Core Mechanics / Controls (1 file)

- **InputManager.js** — Unified keyboard/mouse/touch: WASD/arrows, L/LMB fire, Q/H stun, E/J napalm, F/C nova, R/G switch, SPACE thrust (alone = forward, +W boost), delta-mouse 360° spin, virtual joystick + FIRE/STUN/NAPALM/BOOST/NOVA/WPN touch buttons.

## 9. Audio & FX (2 files)

- **AudioSystem.js** — Zero-file WebAudio-synthesized SFX (hits, blasts, weapon and UI tones).
- **ParticleSystem.js** — Particle bursts + jagged lightning bolts for explosions, impacts, ultimates.

## Key Cross-File Contracts (refactor hot spots)

- **DOM ids** — `main.js`, `Game.js`, `HUD.js`, `InputManager.js` all reference ids that must match `index.html`: `#game-canvas`, `#start-btn`, `#retry-btn`, `#save-score`, `#initials`, `#menu-scores-list`, `#go-scores-list`, `#version-label`, `#touch-ui`, `#joy-base`/`#joy-knob`, `#btn-fire`/`#btn-boost`/...
- **Theme IDs** — `index.html` `data-theme` ↔ `CatShipFactory` REGISTRY ↔ `PLAYER_THEMES` keys in `config.js` (yellow/orange/white/gray/brown).
- **Enemy types** — `EnemyFactory` REGISTRY keys ↔ `ENEMY_TYPES` in `config.js` ↔ `WaveManager` wave definitions ↔ `DevPanel` spawn list.
- **Viewport** — v3.13.0: `GAME.W/H` in `config.js` is the native 1280×720 REFERENCE only. Live bounds are `game.viewW/viewH` (Game `W/H` mirror them and re-sync on resize) — all spawn/bounds/centering code must use live bounds.
- **Weapon IDs** — `WEAPONS` keys in `config.js` ↔ `Player`/`MiniShip` fire code ↔ `Combat.applyWeaponHit` rules ↔ `DevPanel`.
- **Ultimates** — the `createCatShip` call in `Game.js` is the single player spawn path; `ULTIMATE_COOLDOWN`/`ultimateName` are set per variant class.
- **EventBus** — the `bus` event names (e.g. `'banner'`) are the game-logic → HUD bridge; keep names stable.
- **Internet entourage (v3.15.0)** — `InternetBonus` tags the 8 orbiting Black Cats with `entourage = true` + `entouragePhase`; `BlackCatEnemy.draw()` renders the outfit via `BlackCatEntourage.drawEntourageOutfit()`; pendant time comes from `RealTimeClock.realTimeClock` (started/stopped by InternetBonus, ticked in its update). Art never touches `Date`; the clock module never draws.
- **Fleet deploy state (v3.16.0)** — `player.fleetDeployed` (boolean) is the single source of truth for docked vs deployed. `false` = minis docked + INERT (no fire, no weapon anim); `true` = minis in combat orbit, firing + animating. Set by `MiniDeploy.toggleFleetDeploy` (via `deployFleet` action / DebugBridge `deploy` command); reset to `false` on death, respawn, and `PlayerFleet.clearFleet`. `MiniDeploy.updateFleetDeploy` is the ONLY source of deployed-mini position (called before `MiniShip.update`); `MiniShip.update` skips dock-snapping when deployed. Weapon animation state (vulkanSpin / railCharge / plasmaPulse) is owned by `WeaponAnim.js`, ticked by Player/MiniShip, surfaced by PlayerShipArt/PlayerMiniArt, rendered by PlayerShipFx.drawWeaponPaw.

## 10. Multiplayer / LAN / E6 (v3.20.0, `net/` subfolder)

Host-authoritative LAN co-op: the **host** browser simulates the full game (P1 + P2) and broadcasts authoritative state; the **client** browser sends P2 input and mirrors the host's world (no local physics). P2 is a full second `CatShipFactory` ship (not a visual clone) with its own HP/shield/lives/score, auto-aim, and per-player scoring.

**`net/` modules (11 files):**
- **E6.js** — the project's standard plain-text record codec (pure, no DOM). Line-oriented, pipe-delimited, `#E6 <schema> v<major>.<minor>` header + `#FIELDS f1|f2|...` schema mapping + record rows. Values are escaped (`\\`→`\\\\`, `|`→`\\|`, newline→`\\n`); `splitRow` only guards against splitting on an escaped pipe and preserves backslashes so `unescapeValue` (single-pass) can process them. Used for ALL config, profiles, and wire-state.
- **NetProtocol.js** — wire protocol. JSON envelope (`hello`/`welcome`/`input`/`state`/`event`/`bye`); the state collections (players/enemies/boss) are serialized as E6 record rows. Fixed field order: `player: id|theme|x|y|angle|hp|shield|weapon|minis|score|lives|alive`, `enemy: id|type|x|y|hp|angle`, `boss: active|hp|maxHp|phase|x|y`.
- **NetSettings.js** — multiplayer config (E6 schema `netsettings`: `role|hosting|port|hostIp|syncRate`), persisted to localStorage + export/import as `multiplayer.config.e6`. Roles: `solo|coop|host|client`.
- **PlayerProfile.js** — per-player profiles (E6 schema `profile`: `slot|theme|callsign|score`), persisted to localStorage + export/import as `player1.profile.e6` / `player2.profile.e6`.
- **Player2Controls.js** — P2 keyboard input: a SEPARATE keybind set + input state (action-layer compatible: `isDownAction`/`wasPressedAction`).
- **NetClient.js** — browser WebSocket client (host + client roles); `connect()`, `sendInput()`, `onState`/`onEvent`/`onWelcome`/`onClose` callbacks, `status` for the net HUD.
- **NetSync.js** — host-side sync: broadcasts `encodeState(game, seq)` at `syncRate` Hz, applies the remote P2's `input` stream to `coopManager`.
- **CoopManager.js** — spawns P2 via `createCatShip`, sets `game.players=[p1,p2]` + `game.player2`, applies `PLAYER2` HP/shield/lives scaling, drives P2 from local keyboard (`local`) or remote input (`remote`), P2 auto-aim, co-op game-over (both ships dead).
- **ClientMirror.js** — client-side mirror: sends P2 input, maintains mirror Player/Enemy/Boss instances from host state, renders the mirror world, and updates the local `game.player`/`game.player2` placeholders for the HUD.
- **NetSettingsUI.js** — the `#net-settings` panel in the settings screen: role select, host IP/port, HOST GAME / JOIN GAME buttons, net status, E6 export/import.
- **server.mjs** — Node `ws` relay (Node-only, NOT inlined into the build). Pure relay enforcing host-authoritative direction: host→client `state`/`event`/`welcome`, client→host `input`/`hello`, either→other `bye`. Run with `npm run lan`.

**E6 data files (`net/data/`):** `multiplayer.config.e6`, `player1.profile.e6`, `player2.profile.e6`. A `lan-state.e6` is **not** required — the live state is sent over the wire in real-time (E6 blocks inside a JSON `state` message), never persisted to disk; the relay server holds no state.

**Key contracts (v3.20.0):**
- **Bullet ownership** — `Bullet.owner` is set by `PlayerWeapons`/`Player`/`Rockets`/`MiniShip`; `Combat.onEnemyDeath(game, enemy, owner)` credits both `game.score` and `owner.score`.
- **Per-player collisions** — `Collisions.runCollisions` iterates `game.players` (fallback `[game.player]`), skipping `p.dead`; enemy bullets, enemy rams, and powerup pickup apply per-player via `game.hitPlayer(dmg, player)` / `game.collectPowerUp(pw, player)`.
- **Co-op game-over** — `Game.gameOver()` continues if `coopManager.active && players.some(p => !p.dead)`; `Player.hit()` sets `p.dead` + calls `gameOver()` on final death.
- **Client placeholders** — `ClientMirror.start()` creates a local `game.player2` placeholder (P1 is created by `Game.start()`) so the P2 HUD updates from host state.
- **Net HUD** — `#net-hud` (in-game) + `#p2-hud` (P2 callsign/lives/score/HP/shield) are driven by `HUD._updateP2Hud()` and `main.js` net-status wiring.