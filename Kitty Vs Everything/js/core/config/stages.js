// Filename: config/stages.js
// Kitty Vs Everything — v3.77.0
// E6 modularization (v3.77.0): bonus-stage constants + score-life cadence
// split out of js/core/config.js (now the compatibility re-export shim —
// the public surface is unchanged).

export const BONUS = {
  DURATION: 30,
  CRATE_POINTS: 2500,
  BONE_YARD_DURATION: 30,
  BONE_YARD_PHASE1: 10,
  BONE_YARD_PHASE2: 5,
  // v3.60.0: the destructible yard field — 29 bones seeded at stage start
  // (BoneYardBonus._seedYardField). Regular bones dominate; the skeleton
  // sentinels hug the left/right margins.
  BONE_YARD_FIELD: { femur: 10, profile_bone: 10, skull: 6, skeleton: 3 },
  INTERNET_DURATION: 30,
};

export const LIFE_SCORE_INTERVAL = 30000;
