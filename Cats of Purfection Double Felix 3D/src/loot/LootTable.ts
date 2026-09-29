/**
 * Loot framework (scaffolding).
 * Items drop from enemies/bosses via LootTable weighted rolls.
 * Concrete items (step 3+): weapons, ammo, cat power-ups, life shards.
 */
export enum Rarity {
  Common = 0,
  Uncommon = 1,
  Rare = 2,
  Epic = 3,
  Legendary = 4
}

export const RARITY_COLORS: Record<Rarity, string> = {
  [Rarity.Common]: '#c8c8c8',
  [Rarity.Uncommon]: '#4caf50',
  [Rarity.Rare]: '#2196f3',
  [Rarity.Epic]: '#9c27b0',
  [Rarity.Legendary]: '#ff9800'
};

export abstract class ItemBase {
  abstract readonly name: string;
  readonly rarity: Rarity;

  constructor(rarity: Rarity) {
    this.rarity = rarity;
  }

  /** Apply the item's effect to the player (scaffold signature). */
  abstract applyTo(player: unknown): void;
}

interface LootEntry {
  factory: () => ItemBase;
  weight: number;
}

export class LootTable {
  private entries: LootEntry[] = [];

  add(factory: () => ItemBase, weight: number): void {
    if (weight <= 0) return;
    this.entries.push({ factory, weight });
  }

  /** Weighted random roll. Returns null if the table is empty or roll misses. */
  roll(rng: () => number = Math.random, missChance = 0): ItemBase | null {
    if (this.entries.length === 0) return null;
    if (rng() < missChance) return null;
    const total = this.entries.reduce((sum, e) => sum + e.weight, 0);
    let r = rng() * total;
    for (const e of this.entries) {
      r -= e.weight;
      if (r <= 0) return e.factory();
    }
    return this.entries[this.entries.length - 1].factory();
  }
}
