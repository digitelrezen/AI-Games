# Cats of Purfection Double Felix 3D

PVE action looter shooter — **Genetically Modified Super Cats with 9 lives**.
Up to 6 players on LAN. Explicit: destructible bodies, blood, gore.

Built with **Babylon.js + TypeScript + Vite**.

> Full design: see [`architecture.md`](./architecture.md).

## Quick start

```bash
npm install
npm run dev        # dev server → http://localhost:5173 (LAN-hosted)
npm run build      # validation gate: tsc --noEmit && vite build → dist/
npm run preview    # serve the packaged build → http://localhost:4173
```

## Controls

| Input | Action |
|---|---|
| Click canvas | Lock mouse (pointer lock) |
| Mouse | Look |
| W A S D | Move |
| Shift | Sprint |
| Space | Jump |
| Left mouse | Fire (test pistol) |
| `` ` `` | Dev console (`help` for commands) |
| Esc | Release mouse |

## Mandatory rules

1. **No-screenshot policy** — the app blocks canvas/screen capture at boot
   (`src/config/ScreenshotGuard.ts`), and tooling must never take
   screenshots. Validate via console output + JS evaluation only.
2. **Build validation** — after every code change, `npm run build` must
   pass before testing.

## Current state (Step 1)

- Test arena: lit grid ground, perimeter walls, cover barriers, pillars,
  glowing cat-eye landmark, soft shadows
- First-person controller: pointer-lock look, WASD/sprint/jump, gravity,
  AABB collision
- Visible test model: procedural GM super-cat avatar (glowing eyes,
  wagging tail) + pistol viewmodel with muzzle flash, tracers, impacts
- 9-lives HUD (🐱/💀), dev console, debug overlay, LAN hooks scaffold
- Gore/blood/destructible-body framework mapped (scaffolds in
  `src/effects/gore/`)
