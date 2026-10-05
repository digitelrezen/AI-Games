# Cats of Purfection Double Felix 3D — Architecture Log

> Living document. Update this log with every significant change.
> Last updated: 2026-09-27 — **Step 1: project init, test arena, FPS controller, build validation.**

---

## 1. Project Overview

| | |
|---|---|
| **Genre** | PVE action looter shooter, up to 6 players on LAN |
| **Theme** | Genetically Modified Super Cats with 9 lives |
| **Tone** | Violent & explicit — destructible bodies, blood, gore (see §7) |
| **Engine** | Babylon.js (WebGL) + TypeScript + Vite |
| **Project folder** | `C:\Dev\AI-GAMES\Cats of Purfection Double Felix 3D` |
| **Docs sandbox** | `C:\AI-Games\.cline` |

---

## 2. Hard Rules (MANDATORY — never break)

1. **No-screenshot policy.** The application, browser, or environment must
   **never** take screenshots.
   - Runtime: `src/config/ScreenshotGuard.ts` blocks `canvas.toDataURL`,
     `canvas.toBlob`, and `navigator.mediaDevices.getDisplayMedia` at boot.
   - Tooling: agent/test loops must never invoke screenshot actions.
     Validation is done via **console output + JS evaluation only**
     (e.g. `window.__game` inspection, `browser_console_messages`).
2. **Automated build validation.** After *every* code revision or file
   update, run `npm run build` (`tsc --noEmit && vite build`). A green build
   is the gate before any testing. Output lands in `dist/` (playable via
   `npm run preview` or any static server).

---

## 3. Tech Stack

- **Babylon.js v8** (pinned) — `@babylonjs/core` (engine/scene),
  `@babylonjs/loaders` (GLTF/OBJ for future cat models), `@babylonjs/gui`
  (HUD/console), `@babylonjs/materials` (PBR/advanced materials for step 2+).
  **Why v8:** the GUI rewrite (new 2D API: Container/InputText, no
  `isThin`/`padding`/`TextInput`) shipped in v8; this codebase targets the
  v8 API. Re-evaluate v9 (further core renames) later.
- **TypeScript** (strict) — all game code
- **Vite** — dev server (`npm run dev`, LAN-hosted via `host: true`) and
  production build (`npm run build` → `dist/`)

---

## 4. Directory Structure

```
src/
├── main.ts                  # entry: screenshot guard → Game boot
├── config/
│   └── ScreenshotGuard.ts   # RULE 1 runtime enforcement
├── game/
│   ├── Game.ts              # orchestrator: engine, scene, loop, wiring
│   └── GameConfig.ts        # all tuning constants (speeds, arena, lives)
├── maps/
│   ├── MapBase.ts           # map contract + collider registry
│   ├── collision.ts         # arcade point-vs-AABB resolver
│   └── TestArena.ts         # Step-1 arena: grid ground, walls, cover, pillars
├── entities/
│   ├── EntityBase.ts        # root node + update hook
│   ├── player/
│   │   ├── Player.ts        # controller + lives + avatar wiring
│   │   ├── PlayerController.ts  # pointer-lock FPS camera, WASD, jump, collision
│   │   ├── NineLives.ts     # 9-lives mechanic (scaffold)
│   │   └── CatAvatar.ts     # procedural GM super-cat test model
│   ├── enemies/
│   │   └── EnemyBase.ts     # health/damage/die pipeline
│   └── bosses/
│       └── BossBase.ts      # phase system (1..N)
├── weapons/
│   ├── WeaponBase.ts        # viewmodel root, cooldown, fire() contract
│   ├── WeaponSlots.ts       # 3-slot manager
│   └── TestPistol.ts        # procedural viewmodel, hitscan, tracer, impact
├── abilities/
│   └── AbilityBase.ts       # cat powers contract (pounce, dash, ...)
├── loot/
│   └── LootTable.ts         # Rarity, ItemBase, weighted LootTable
├── events/
│   └── EventBus.ts          # decoupled pub/sub + canonical event names
├── effects/
│   └── gore/
│       ├── GoreSystem.ts    # gore manager (spray/pool/guts hooks)
│       └── DestructibleBody.ts  # ragdoll/segment destruction scaffold
├── ui/
│   └── HUD.ts               # crosshair, 9-lives, weapon, hints (Babylon GUI)
└── admin/
    ├── DevConsole.ts        # ` key console (help/lives/respawn/pos/lan/gore)
    ├── DebugOverlay.ts      # FPS/draw/mesh/position readout
    └── LanHooks.ts          # LAN status + API surface (relay in step 4)
```

---

## 5. Core Systems

### 5.1 Game loop
`Game.start()` runs `engine.runRenderLoop` → `update(dt)` (player, weapons,
gore, HUD, debug) → `scene.render()`. `dt` is clamped to 100 ms to survive
tab-switch spikes.

### 5.2 Display & scaling (ultrawide-safe)
- Canvas is CSS `100% × 100%` of the window (no fixed resolution).
- `window resize` → `engine.resize()` resizes the render buffer to the
  canvas client size.
- Babylon computes camera aspect from the viewport, so 1920×1080,
  2560×1440, **3440×1440 ultrawide**, etc. all render **without distortion
  or stretching**. No letterboxing, no FOV hacks.

### 5.3 Player & 9 lives
- `PlayerController`: FreeCamera + pointer-lock mouse look (yaw/pitch),
  WASD relative movement, Shift sprint, Space jump, gravity, ground clamp,
  AABB collision against map colliders.
- `NineLives`: 9 lives; `loseLife()` → respawn + `lives:changed` event;
  last life lost → `player:died`. HUD renders 🐱/💀 row from the event.
- `CatAvatar`: procedural GM super-cat (glowing eyes, wagging tail) placed
  near spawn as the **visible test model**.

### 5.4 Weapons
`WeaponSlots` (3 slots) → active `WeaponBase`. `TestPistol`: procedural
viewmodel parented to the camera, hitscan raycast, muzzle flash, tracer,
impact spark, recoil kick, `weapon:fired` / `weapon:hit` events.

### 5.5 Events
All cross-module communication goes through `EventBus`
(`src/events/EventBus.ts`) with canonical names in `GameEvents`.

---

## 6. Entity Framework

- `EntityBase` (root TransformNode + `update(dt)`) →
  - `EnemyBase`: health, `takeDamage()`, abstract `die()` (loot + gore hooks)
  - `BossBase extends EnemyBase`: phase system — evenly spaced health
    thresholds advance `phase` (1..maxPhases), `onPhaseEnter()` swaps
    attack patterns.
- Step 2+: enemy registry/spawner in `Game`, per-map spawn tables.

## 7. Gore & Destructible Body System (design map — explicit content)

All gore is **procedural** (particles + decals), no external assets.

| Component | File | Behavior |
|---|---|---|
| `GoreSystem` | `effects/gore/GoreSystem.ts` | Manager; `spawnBloodSpray / spawnBloodPool / spawnGuts`; global on/off |
| `BloodSpray` | (step 2) | ParticleSystem burst on hit — directional, volume scales with damage |
| `BloodPool` | (step 2) | Persistent surface decal; grows with accumulated damage; capped count + recycling |
| `GutsDecal` | (step 3) | Heavy-hit splatter decal + chunk particles |
| `DestructibleBody` | `effects/gore/DestructibleBody.ts` | Body = torso + limb segments; lethal hit → ragdoll (physics), segment detach, organ chunks, blood pool |

Wiring: `weapon:hit` → `GoreSystem.spawnBloodSpray(hitPoint, dir)`;
`EnemyBase.die()` → `DestructibleBody.destroy()` + `LootTable.roll()`.
Bosses: multi-stage destruction gated by `BossBase.phase`.

## 8. Abilities (cat powers)

`AbilityBase` (cooldown contract). Planned: **CatPounce** (dash damage),
**ClawDash** (melee arc), **NightVision**, **FelineAgility** (speed/jump
boost), **LifeSteal** (convert a lost life into a burst — 9-lives synergy).

## 9. Loot Framework

`Rarity` (Common→Legendary, color-coded), `ItemBase.applyTo(player)`,
`LootTable` weighted rolls with miss chance. Drop tables per enemy/boss
land in step 3.

## 10. LAN Multiplayer (up to 6 players)

- `LanHooks` (`admin/LanHooks.ts`): status machine
  (`disconnected/connecting/hosting/joined`), peer list, `maxPlayers = 6`.
- Plan: **host-authoritative WebSocket relay** (no dedicated server) —
  host simulates, clients send inputs, receive state snapshots; client-side
  interpolation + prediction. Vite `host: true` already exposes dev/preview
  on the LAN.
- Step 4: relay implementation + input/state protocol.

## 11. Admin / Developer Tools

- **DevConsole** — toggle with `` ` ``; commands: `help`, `lives [n]`,
  `respawn`, `pos`, `clear`, `lan`, `gore`. Opening releases pointer lock
  and gates player input.
- **DebugOverlay** — top-right: FPS, draw calls, mesh count, player pos,
  lives (4 Hz refresh).
- **LanHooks** — LAN status surface (see §10).
- `window.__game` — headless validation handle (never used for screenshots).

## 12. Build & Validation Workflow

```
npm install        # once
npm run dev        # dev server (LAN-hosted, port 5173)
npm run build      # VALIDATION GATE: tsc --noEmit && vite build → dist/
npm run preview    # serve the packaged build (port 4173)
```

- **Every code change → `npm run build` must pass** before testing.
- Headless validation (no screenshots): load preview URL, read console
  messages, evaluate `window.__game` (mesh count, FPS, camera position,
  render size after resize to 3440×1440).

## 13. Roadmap

- **Step 1 (done):** project init, rules, test arena, FPS controller,
  visible cat avatar + pistol viewmodel, build validation.
- **Step 2:** enemy base implementation + spawner, blood spray/pool,
  damage pipeline, capsule collision, GLTF cat models via loaders.
- **Step 3:** bosses + phases, abilities, loot drops, destructible bodies,
  gore decals, PBR materials.
- **Step 4:** LAN relay (6 players), input/state protocol, net HUD.
