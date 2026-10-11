// Filename: config/stages.js
// Kitty Vs Everything — v3.77.0
// E6 modularization (v3.77.0): bonus-stage constants + score-life cadence
// split out of js/core/config.js (now the compatibility re-export shim —
// the public surface is unchanged).

export const BONUS = {
  DURATION: 30,
  CRATE_POINTS: 2500,
  // ═══════════════════════════════════════════════════════════
  //  BONE YARD — v4.24.0: 4-PHASE SCRIPTED ENCOUNTER
  //  Phase 1 (BONE_YARD_PHASE1): a long single-file line of humans
  //    streams in from the top (marchMode) + the weighted bone rain.
  //    Dialogue line 0.
  //  Phase 2 (BONE_YARD_PHASE2): BONE_YARD_RUSH_LINES parallel lines
  //    of humans rush bottom→top (HumanEnemy.rushMode). Lines 1–2.
  //  Phase 3: player controls are LOCKED (Player.controlsLocked);
  //    Eridath's Mom's House (js/levels/EridathsMomsHouse.js) descends
  //    from the top of the view and settles.
  //  Phase 4: controls unlock; the house dumps humans + skeletons until
  //    the player has survived BONE_YARD_FIGHT_MIN seconds OR the house
  //    has taken its 1/16 damage cap; the house teleports out; complete.
  // ═══════════════════════════════════════════════════════════
  BONE_YARD_PHASE1: 12,
  BONE_YARD_PHASE2: 8,
  BONE_YARD_RUSH_LINES: 4,
  BONE_YARD_FIGHT_MIN: 15,
  // 8 dense bone columns (4 per interior border) frame the yard; the
  // center corridor stays clear. bonesPerColumn = stacked bones/column.
  BONE_YARD_COLUMNS: { perSide: 4, bonesPerColumn: 10 },
  // Eridath's Mom's House — the scripted centerpiece. hp is nominal: the
  // house can only ever take hp * damageCapFrac (1/16) of damage before
  // the encounter resolves — it is a set piece, not a boss.
  BONE_YARD_HOUSE: {
    hp: 16000,
    damageCapFrac: 1 / 16,
    size: 170,
    settleY: 0.16, // fraction of viewH where the house settles
    descentTime: 3, // seconds from top of view to settle
    dumpHuman: [0.55, 0.95], // seconds between dumped humans
    dumpSkeleton: [1.4, 2.4], // seconds between dumped skeletons
    maxDumps: 16, // max concurrent house-dumped enemies
    teleportTime: 2.2, // seconds for the teleport-out
  },
  // v3.60.0: the destructible yard field — 29 bones seeded at stage start
  // (BoneYardBonus._seedYardField). Regular bones dominate; the skeleton
  // sentinels hug the left/right margins.
  BONE_YARD_FIELD: { femur: 10, profile_bone: 10, skull: 6, skeleton: 3 },
  // v4.24.0: the encounter's subtitle lines (RnM-style 'dialogue' banner).
  // [0] Phase 1 · [1]–[2] Phase 2 · [3]–[4] Phase 3 (house settled).
  BONE_YARD_DIALOGUE: [
    "Oh Lord, look at the line! I'll never make it in time to Eridath's mom's house.",
    "They are 4 deep...",
    "Heh, been there...",
    "Hey, back of the line!",
    "We got a soup kitchen running in here... we need at least another hour!",
  ],
  INTERNET_DURATION: 30,
};

export const LIFE_SCORE_INTERVAL = 30000;
