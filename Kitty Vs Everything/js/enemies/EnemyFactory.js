// Filename: EnemyFactory.js
// Kitty Vs Everything — v2.1.0
// Factory pattern: single entry point for spawning any enemy by type ID.
// v2.1.0: Added PinkCatEnemy registration.
// v2.2.0: Added Wasp2Enemy registration (wireframe wasp — see Wasp2Sprite.js).
// v3.31.0 (v3.50.0 release): Added ShuttleEnemy registration — the space
//          shuttle is the 17th species (regular waves only; Bone Yard Phase 2
//          stays humanoid via its explicit allowlist).
// v3.32.0 (v3.52.0 release): Added MothEnemy registration — the moth is the
//          18th species (regular waves only; Bone Yard Phase 2 stays
//          humanoid via its explicit allowlist).
export const VERSION = 'v3.32.0';
import { ENEMY_TYPES } from '../core/config.js';
import WaspEnemy from './WaspEnemy.js';
import Wasp2Enemy from './Wasp2Enemy.js';
import BeetleEnemy from './BeetleEnemy.js';
import ButterflyEnemy from './ButterflyEnemy.js';
import RatEnemy from './RatEnemy.js';
import WolfEnemy from './WolfEnemy.js';
import FalconEnemy from './FalconEnemy.js';
import BatEnemy from './BatEnemy.js';
import BlackCatEnemy from './BlackCatEnemy.js';
import LizardEnemy from './LizardEnemy.js';
import DragonEnemy from './DragonEnemy.js';
import HumanEnemy from './HumanEnemy.js';
import AlienEnemy from './AlienEnemy.js';
import SnakeEnemy from './SnakeEnemy.js';
import SpiderEnemy from './SpiderEnemy.js';
import PinkCatEnemy from './PinkCatEnemy.js';
import ShuttleEnemy from './ShuttleEnemy.js';
import MothEnemy from './MothEnemy.js';

// ─── REGISTRY: type ID → class ───
const REGISTRY = {
  wasp:      WaspEnemy,
  wasp2:     Wasp2Enemy,
  beetle:    BeetleEnemy,
  butterfly: ButterflyEnemy,
  rat:       RatEnemy,
  wolf:      WolfEnemy,
  falcon:    FalconEnemy,
  bat:       BatEnemy,
  blackcat:  BlackCatEnemy,
  lizard:    LizardEnemy,
  dragon:    DragonEnemy,
  human:     HumanEnemy,
  alien:     AlienEnemy,
  snake:     SnakeEnemy,
  spider:    SpiderEnemy,
  pinkcat:   PinkCatEnemy,
  shuttle:   ShuttleEnemy,
  moth:      MothEnemy,
};

/**
 * Create an enemy instance by type ID.
 * @param {object} opts - { type, tier, x, y, game, difficulty? }
 *   difficulty (v3.30.0) is the wave difficulty multiplier (default 1); it
 *   scales enemy HP + damage only (see EnemyBase). Omitted by dev-panel and
 *   easter-egg spawners, which use base stats.
 * @returns {EnemyBase} The instantiated enemy (subclass of EnemyBase).
 * @throws {Error} If the type ID is not registered.
 */
export function createEnemy({ type, tier, x, y, game, difficulty = 1 }) {
  const Cls = REGISTRY[type];
  if (!Cls) {
    throw new Error(`EnemyFactory: unknown type "${type}". Available: ${Object.keys(REGISTRY).join(', ')}`);
  }
  return new Cls({ type, tier, x, y, game, difficulty });
}

/**
 * Get the class for a given type ID (useful for instanceof checks or dev tools).
 * @param {string} type - e.g. 'wasp'
 * @returns {Function|undefined}
 */
export function getEnemyClass(type) {
  return REGISTRY[type];
}

/**
 * All registered type IDs (for DevPanel dropdown, WaveManager roster, etc.)
 * @returns {string[]}
 */
export function getEnemyTypeIds() {
  return Object.keys(REGISTRY);
}

/**
 * Check if a type ID is valid.
 * @param {string} type
 * @returns {boolean}
 */
export function isValidEnemyType(type) {
  return type in REGISTRY;
}