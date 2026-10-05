# KITTY VS EVERYTHING — ADD-ENEMY RUNBOOK

Reusable blueprint for integrating a new enemy species end-to-end.
Written from the **v3.50.0 Space Shuttle** integration (`Human-SpaceShuttle-pixel-art.png`,
17th species, regular waves only, Bone Yard locked to humanoids).

Every file, array, and registry touched is listed with the exact change.
Placeholders: `<key>` = manifest key (e.g. `shuttle`), `<NewEnemy>` = class name
(e.g. `ShuttleEnemy`), `<ver>` = milestone version (e.g. `v3.50.0` / `3.50.0`).

---

## 0. Conventions & prerequisites

- Workspace root (git): `C:\Dev\AI-GAMES` → remote `origin main`
  (https://github.com/digitelrezen/AI-Games.git). Run ALL git commands from the root.
- Game folder: `C:\Dev\AI-GAMES\Kitty Vs Everything`
- Shared art folder: `C:\Dev\AI-GAMES\.assets` (transparent PNGs only)
- Single-file build: `node build.mjs` (from the game folder) →
  `Builds\Kitty Vs Everything <ver>.html` (version read from `package.json`)
- Pick the next minor version up front and sync it EVERYWHERE (Step 9).

---

## STEP 1 — Asset: manifest registration + import script

### 1.1 Drop the art into the shared folder
- File: `C:\Dev\AI-GAMES\.assets\<Your-Art-file>.png`
- Hard requirements enforced by the importer (exit 1 on failure):
  - valid PNG signature + parseable IHDR
  - 8-bit depth, **color type 6 (RGBA)** — transparency is mandatory
  - decoded non-transparent pixel content must exist
- Art larger than 128 px is box-filter downscaled (aspect preserved) and
  re-encoded as 8-bit RGBA — the embedded build stays small.

### 1.2 Register the key in the manifest
- File: `tools/asset-manifest.json` → `assets` object
- Add one line (shuttle example):
  ```json
  "shuttle": "Human-SpaceShuttle-pixel-art.png"
  ```
- Per-key resolution order: (1) exact file name, (2) normalized fuzzy match
  (lowercase, spaces/`-`/`_` stripped — must be UNAMBIGUOUS), (3) hard error
  listing every available PNG.

### 1.3 Run the import script (regenerates the sprite registry)
```
node tools/import-assets.mjs          # import + regenerate
node tools/import-assets.mjs --check  # CI mode: byte-compare, no writes
```
- Output (GENERATED FILE — never hand-edit):
  `Kitty Vs Everything/js/core/AssetSprites.js`
- Three registries gain a `<key>` entry (shuttle example):
  ```js
  export const ASSET_DIMS = {
    // ...
    shuttle: { w: 128, h: 60 },          // normalized dims (≤128 px)
  };
  export const ASSET_SOURCES = {
    // ...
    shuttle: "Human-SpaceShuttle-pixel-art.png (699×329 → 128×60, sha12 75e8703fa11f)",
  };
  export const ASSET_B64 = {
    // ...
    shuttle: "iVBORw0KGgo...",           // embedded base64 PNG
  };
  ```
- Output is DETERMINISTIC (sorted keys, per-asset source sha12, no
  timestamps) → `--check` can byte-compare.

### 1.4 Runtime contract (no changes needed)
- `js/core/AssetManager.js` decodes base64 → `HTMLImageElement` per key with
  per-key error isolation.
- Consumers call `getSprite('<key>')` / `getDims('<key>')`.
- **Null sprite ⇒ procedural fallback** — the enemy class MUST keep a
  procedural draw path (see Step 3).

---

## STEP 2 — Configuration (`js/core/config.js`)

### 2.1 Add the species to `ENEMY_TYPES`
- **Insertion order = wave rotation order** (one species per wave, wraps).
- Shuttle example (17th entry):
  ```js
  export const ENEMY_TYPES = {
    // ... existing 16 species ...
    shuttle:  { name: 'Space Shuttle', color: '#cfd8dc', speed: 2.0, hp: 60, damage: 16, fireRate: 1.4, pattern: 'glide' },
  };
  ```
  - `name` = display name (DevPanel / logs)
  - `color` = procedural fallback accent color
  - `speed` / `hp` / `damage` / `fireRate` = base stats (tier multipliers apply on top)
  - `pattern` = descriptive behavior tag (actual behavior lives in the class)

### 2.2 Bump the wave species count
```js
export const WAVE = {
  SPECIES_COUNT: 17,   // was 16 — MUST equal Object.keys(ENEMY_TYPES).length
  // ...
};
```
- `check.mjs` and `verify-bundle.mjs` both assert this equality.

### 2.3 `TIERS` — NO CHANGE
- `mob / champion / miniboss / boss / finalboss` multipliers are generic
  (hpMul/dmgMul/speedMul/score/shield/size) and apply to every species.

### 2.4 Bump `VERSION`
```js
export const VERSION = 'v3.50.0';   // single source of truth for the title
```
- ⚠ This EXPORT (not the header comment) is what `validate.mjs` compares
  against the `index.html` title. A header-comment-only bump fails validation.

---

## STEP 3 — Enemy class (`js/enemies/<NewEnemy>Enemy.js` — NEW FILE)

Template (shuttle example, `ShuttleEnemy.js`, module `VERSION = 'v1.0.0'`):

```js
// Filename: ShuttleEnemy.js
// Kitty Vs Everything — v1.0.0
// <behavior description + asset key + wave-scope note>
export const VERSION = 'v1.0.0';
import EnemyBase from './EnemyBase.js';
import { TAU, rand, clamp } from '../core/utils.js';
import { getSprite, getDims } from '../core/AssetManager.js';

const SHUTTLE_SPRITE_KEY = 'shuttle';

export default class ShuttleEnemy extends EnemyBase {
  constructor(opts) {
    super(opts);
    // Wave behavior fields (shuttle: glide → hover band → banked strafe)
    this.strafeDir = Math.random() < 0.5 ? -1 : 1;
    this.hoverY = 80 + rand(0, 100);
    this.bank = 0;          // eased rotation toward travel direction
    this.telegraph = 0;     // seconds of visible aim before firing
  }

  move(dt, slowMul) {
    // 1) Telegraphed fire: attack() arms the aim, move() counts down & fires.
    //    slowMul = 0 (stunned) ⇒ hold aim, never fire.
    if (this.telegraph > 0 && slowMul > 0) {
      this.telegraph -= dt;
      if (this.telegraph <= 0) this.fireAtPlayer(this.angleToPlayer(), 340, 1);
    }
    // 2) Glide in: descend into the hover band (no bank).
    if (this.y < this.hoverY) {
      this.y += this.speed * slowMul * dt * 0.5;
      this.bank += (0 - this.bank) * Math.min(1, dt * 4);
      return;
    }
    // 3) Hover band: banked strafe, flip at screen edges.
    this.x += this.speed * slowMul * dt * 0.85 * this.strafeDir;
    const edge = 24 + this.radius;
    if (this.x < edge) this.strafeDir = 1;
    if (this.x > this.game.W - edge) this.strafeDir = -1;
    this.bank += (this.strafeDir * 0.22 - this.bank) * Math.min(1, dt * 4);
    this.x = clamp(this.x, -50, this.game.W + 50);
  }

  attack() {
    this.telegraph = 0.4;   // arm the aim — the shot fires in move()
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.flash > 0) ctx.globalAlpha = 0.55;
    ctx.rotate(this.bank);
    const sprite = getSprite(SHUTTLE_SPRITE_KEY);
    if (sprite) this._drawSprite(ctx, sprite);
    else this._drawProcedural(ctx);   // REQUIRED null-sprite fallback
    // (optional) telegraph indicator drawn un-rotated so it tracks the player
    ctx.restore();
    this.drawShieldRing(ctx);
    this.drawBossBar(ctx);
  }

  // Pixel-art sprite: nearest-neighbor, aspect-preserving (128×60), centered.
  _drawSprite(ctx, sprite) {
    const dims = getDims(SHUTTLE_SPRITE_KEY);
    const w = 76;
    const h = w * dims.h / dims.w;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
  }

  // Procedural fallback (null sprite per the AssetManager contract).
  _drawProcedural(ctx) { /* white silhouette: wings, fuselage, cockpit, glow */ }
}
```

Contract the class inherits from `EnemyBase` (do NOT reimplement):
- tier-scaled hp/shield/score/size, `alive` flag, hit-flash decay
- `fireAtPlayer(angle, speed, dmg)`, `angleToPlayer()`
- stun/slow via the `slowMul` argument of `move(dt, slowMul)`
- `drawShieldRing(ctx)`, `drawBossBar(ctx)`, death bookkeeping

---

## STEP 4 — Factory & spawn wiring (`js/enemies/EnemyFactory.js`)

Two-line change + version bump:
```js
import ShuttleEnemy from './ShuttleEnemy.js';
// ...
export const REGISTRY = {
  // ... existing species ...
  shuttle: ShuttleEnemy,
};
// module header: export const VERSION = 'v3.31.0';   (was v3.30.0)
```
Everything else derives from `REGISTRY` — no other edits:
- `isValidEnemyType(id)` — registry key lookup
- `getEnemyTypeIds()` — `Object.keys(REGISTRY)`
- `createEnemy({ type, tier, x, y, game })` — tier-scaled instantiation
- **DevPanel spawn list** derives from the registry → new species is
  spawnable from the F9 panel automatically (verify in Step 10).

---

## STEP 5 — Wave scheduling (`js/core/WaveManager.js`)

**NO EDIT NEEDED** — the species pool is derived from config:
```js
// js/core/WaveManager.js (constructor)
this.species = Object.keys(ENEMY_TYPES);   // 17 species automatically
```
- One species per wave; rotation wraps after `WAVE.SPECIES_COUNT`.
- Difficulty/HP/damage scaling, tier mix (`TIER_MIX`), count ramp, and the
  per-wave boss (finalboss every 10 waves) all apply to the new species
  with zero extra code.
- **Gate to protect:** the pool MUST stay `Object.keys(ENEMY_TYPES)`.
  `check.mjs [6d]` (headless `new WaveManager({})` must list the new key)
  and `verify-bundle.mjs` (source-gate regex) both assert this — if a future
  refactor hardcodes a species list in WaveManager, those gates fail.

---

## STEP 6 — Bonus-level filters (`js/levels/*.js`)

Audit EVERY level that hardcodes species lists when adding a species:

### Bone Yard (`js/levels/BoneYardBonus.js`) — the v3.50.0 change
Phase 2/3 (the human line march) must stay standard humanoids. Use an
**EXPLICIT ALLOWLIST** (defense in depth), not "exclude the new type":
```js
// v3.50.0: Phase 2/3 is locked to standard humanoids — an explicit allowlist
// (not "everything except X") so new species can never leak into the march.
const BONE_YARD_HUMANOID_TYPES = ['human'];
// ...
// Phase 2/3 spawn sites:
//   type: BONE_YARD_HUMANOID_TYPES[0],
```
- Module version bump: `v3.13.0` → `v3.14.0`.
- Rule for future enemies: if a level should NOT get the new species, add it
  to the level's allowlist pattern; never rely on the new species simply not
  being in a hardcoded list.

### Other levels
- `InternetBonus` / `AsteroidBonus` use fixed boss/entourage rosters —
  confirm they don't iterate `ENEMY_TYPES` (they don't; no change needed).

---

## STEP 7 — Validation gates (`tools/check.mjs`)

Four distinct edits:

### 7.1 `EXPECTED_KEYS` (asset manifest key-existence check)
```js
const EXPECTED_KEYS = [
  'health', 'extralife', 'shield', 'frenzy', 'wasp', 'butterfly', 'rat',
  'crate', 'ufo1', 'ufo2', 'shuttle',   // ← new key
];
```

### 7.2 `EXPECTED_MODULE_VERSIONS` (module header pins)
```js
ShuttleEnemy: 'v1.0.0',     // new class
EnemyFactory: 'v3.31.0',    // bumped (was v3.30.0)
BoneYardBonus: 'v3.14.0',   // bumped (was v3.13.0)
```

### 7.3 New dedicated section (v3.50.0 added `[6d]`, 11 checks)
Pattern to copy for the next species:
1. **config**: `Object.keys(ENEMY_TYPES).length === 17`; new entry exists
   with expected `name` + `pattern`; `WAVE.SPECIES_COUNT === 17`.
2. **factory**: `REGISTRY.shuttle` defined; `isValidEnemyType('shuttle')`
   true; `getEnemyTypeIds()` includes it;
   `getEnemyClass('shuttle').name === 'ShuttleEnemy'`.
3. **class**: `ShuttleEnemy.prototype` extends `EnemyBase.prototype`
   (prototype-chain check, not string match); sprite key constant is
   `'shuttle'`; behavior fields exist on a fresh instance.
4. **regular waves**: headless `new WaveManager({})` — `species` array
   includes `'shuttle'` (17 entries); source gate: WaveManager.js text
   must derive the pool from `Object.keys(ENEMY_TYPES)`.
5. **Bone Yard protection**: `BONE_YARD_HUMANOID_TYPES` deep-equals
   `['human']`; Phase 2/3 spawn sites use `BONE_YARD_HUMANOID_TYPES[0]`
   (not a bare string).
6. **AssetSprites**: `ASSET_DIMS.shuttle` matches the generated dims
   (`128×60`).

### 7.4 Header + summary version bump
- File header comment → `v3.50.0`
- Final summary line → `All v3.50.0 checks passed` (or equivalent)

---

## STEP 8 — Bundle verification (`tools/verify-bundle.mjs`)

Add quote-tolerant checks for the new species (v3.50.0 added 6):
1. sprite dims: `shuttle:\s*\{\s*w:\s*128,\s*h:\s*60\s*\}`
2. `ENEMY_TYPES` entry: `shuttle:\s*\{\s*name:\s*['"]Space Shuttle['"]`
   + `pattern:\s*['"]glide['"]`
3. `WAVE.SPECIES_COUNT = 17`: `SPECIES_COUNT:\s*17`
4. factory registry: `shuttle:\s*ShuttleEnemy`
5. WaveManager pool source gate: `Object.keys(ENEMY_TYPES)`
6. Bone Yard allowlist: `BONE_YARD_HUMANOID_TYPES\s*=\s*\[\s*['"]human['"]\s*\]`

**esbuild IIFE re-emission rules (why the regexes look like this):**
- Every string literal is re-emitted with **DOUBLE quotes** → match with a
  `['"]` character class, never a hardcoded single-quote `s.includes(...)`.
- Default-exported classes become `var Name = class` (never `class Name`)
  → match structural tokens (`/ShuttleEnemy\s*=\s*class/`), not source
  formatting.
- A bare key code (e.g. `KeyT`) may legitimately appear as a DEFAULT BIND —
  negative "stale hotkey" checks must target the specific expression
  (e.g. `e.code !== 'KeyT'`), not the bare token.
- Trailing comments move to their own line; object-literal spacing is
  normalized — never anchor on whitespace/formatting.

---

## STEP 9 — Version sync (every milestone, all files)

| File | Change |
|---|---|
| `Kitty Vs Everything/package.json` | `"version": "3.50.0"` |
| `Kitty Vs Everything/js/core/config.js` | `export const VERSION = 'v3.50.0'` (the EXPORT — validate.mjs compares it to the index.html title) |
| `Kitty Vs Everything/js/core/Game.js` | header comment + `VERSION` constant |
| `Kitty Vs Everything/index.html` | header comment + `<title>` |
| `tools/smoke.mjs` | header comment + `PASSED` message |
| `tools/check.mjs` | header comment + final summary line |
| `Kitty Vs Everything/ARCHITECTURE.md` | dependency-flow species count (15→17), enemy section file count, new roster entry under §5, level allowlist notes |

---

## STEP 10 — Build + verify pipeline (run SEQUENTIALLY)

From the workspace root unless noted:
```
node tools/check.mjs                     # static + headless gates (must be all green)
cd "Kitty Vs Everything"
node build.mjs                           # esbuild IIFE → Builds\Kitty Vs Everything 3.50.0.html
cd ..
node tools/verify-bundle.mjs             # reads the bundle build.mjs just wrote
node tools/smoke.mjs                     # optional headless boot smoke test
```
- ⚠ `build.mjs` and `verify-bundle.mjs` MUST run sequentially — verify
  reads the bundle file; running them in parallel races (ENOENT).
- `build.mjs` reads the version from `package.json` for the output filename.
- `verify-bundle.mjs` reads the current version automatically (same
  `package.json` source) — no per-version path hardcoding.

---

## STEP 11 — Review, stage, commit, push

From the workspace root (`C:\Dev\AI-GAMES`):
```
git status --porcelain                   # review: expect the files from Steps 1–9
git add <explicit paths>                 # or git add -A after review
git commit -m "v3.50.0: space shuttle enemy — 17th species in regular waves ..."
git push origin main
```
Commit-message convention (see `git log`): `v<ver>: <one-line summary> —
<dash-separated detail list: class, asset key/dims, pipeline, gates,
version sync, rebuild>`.

---

## APPENDIX A — v3.50.0 shuttle: exact change inventory

| # | File | Change |
|---|---|---|
| 1 | `tools/asset-manifest.json` | `assets` += `"shuttle": "Human-SpaceShuttle-pixel-art.png"` |
| 2 | `Kitty Vs Everything/js/core/AssetSprites.js` | REGENERATED by import script: `ASSET_DIMS.shuttle = {w:128,h:60}`, `ASSET_SOURCES.shuttle` (699×329 → 128×60, sha12 75e8703fa11f), `ASSET_B64.shuttle` |
| 3 | `Kitty Vs Everything/js/core/config.js` | `ENEMY_TYPES` += `shuttle` (17th, `pattern: 'glide'`); `WAVE.SPECIES_COUNT` 16→17; `VERSION` → `v3.50.0` |
| 4 | `Kitty Vs Everything/js/enemies/ShuttleEnemy.js` | NEW (~150 lines): `ShuttleEnemy extends EnemyBase`, `VERSION v1.0.0`, glide → hover band (y 80–180) → banked strafe (±0.22 rad eased), 0.4s telegraphed aimed cannon fire, sprite draw (76 px wide, nearest-neighbor) + procedural fallback |
| 5 | `Kitty Vs Everything/js/enemies/EnemyFactory.js` | `import ShuttleEnemy` + `REGISTRY.shuttle = ShuttleEnemy`; `VERSION` v3.30.0→v3.31.0 |
| 6 | `Kitty Vs Everything/js/core/WaveManager.js` | NO EDIT — pool = `Object.keys(ENEMY_TYPES)` picks up the 17th species automatically |
| 7 | `Kitty Vs Everything/js/levels/BoneYardBonus.js` | `BONE_YARD_HUMANOID_TYPES = ['human']` allowlist; Phase 2/3 spawn sites use `BONE_YARD_HUMANOID_TYPES[0]`; `VERSION` v3.13.0→v3.14.0 |
| 8 | `tools/check.mjs` | `EXPECTED_KEYS` += `shuttle`; `EXPECTED_MODULE_VERSIONS` += ShuttleEnemy v1.0.0 / EnemyFactory v3.31.0 / BoneYardBonus v3.14.0; new `[6d]` section (11 checks: config count/entry, factory registry/class, class prototype/fields, headless WaveManager species list + pool source gate, Bone Yard allowlist, AssetSprites dims); header + summary → v3.50.0 |
| 9 | `tools/verify-bundle.mjs` | 6 new quote-tolerant v3.50.0 checks (sprite dims, ENEMY_TYPES entry, SPECIES_COUNT 17, REGISTRY entry, WaveManager pool source gate, Bone Yard `["human"]` allowlist) |
| 10 | `Kitty Vs Everything/package.json` | `3.49.0` → `3.50.0` |
| 11 | `Kitty Vs Everything/js/core/Game.js` | header comment + `VERSION` → v3.50.0 |
| 12 | `Kitty Vs Everything/index.html` | header comment + `<title>` → v3.50.0 |
| 13 | `tools/smoke.mjs` | header comment + PASSED message → v3.50.0 |
| 14 | `Kitty Vs Everything/ARCHITECTURE.md` | 15→17 species, §5 count 25→28, ShuttleEnemy roster entry, BoneYardBonus allowlist note |

## APPENDIX B — Pitfalls learned (do not repeat)

1. **`VERSION` export vs header comment** — `validate.mjs` compares the
   `index.html` title against the `config.js` VERSION *export*. Bumping only
   the header comment (or only one side) fails validation.
2. **Sequential build → verify** — `verify-bundle.mjs` reads the bundle
   `build.mjs` writes; parallel execution raced with ENOENT.
3. **esbuild re-emission** — double-quoted string literals, `var Name =
   class`, moved comments, normalized spacing → bundle checks must be
   quote-tolerant and structural (Step 8 rules).
4. **`WAVE.SPECIES_COUNT` drift** — must equal
   `Object.keys(ENEMY_TYPES).length`; both check.mjs and verify-bundle.mjs
   assert it, but keep them in lockstep when editing config.
5. **Level filters: allowlist, don't exclude** — Bone Yard Phase 2/3 is
   protected by `BONE_YARD_HUMANOID_TYPES = ['human']`. "Everything except
   shuttle" silently breaks the next time a species is added.
6. **Generated files** — `AssetSprites.js` is generated; hand-edits are
   overwritten by the next `import-assets.mjs` run.
7. **DevPanel** — the F9 spawn list derives from the factory registry;
   verify the new species is spawnable (manual check in Step 10).
8. **`.assets` naming** — fuzzy matching strips spaces/`-`/`_` and must be
   unambiguous; prefer exact file names in the manifest.
