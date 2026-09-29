import { Scene } from '@babylonjs/core';
import { EventBus, GameEvents } from '../events/EventBus';
import { WeaponBase } from './WeaponBase';

/**
 * Weapon slot manager (3 slots).
 * Handles equipping, switching and per-frame updates of the active weapon.
 */
export class WeaponSlots {
  private slots: (WeaponBase | null)[] = [null, null, null];
  private currentIndex = 0;
  private scene: Scene;
  private eventBus: EventBus;

  constructor(scene: Scene, eventBus: EventBus) {
    this.scene = scene;
    this.eventBus = eventBus;
  }

  get slotCount(): number {
    return this.slots.length;
  }

  get currentWeapon(): WeaponBase | null {
    return this.slots[this.currentIndex];
  }

  get currentIndexSlot(): number {
    return this.currentIndex;
  }

  equip(index: number, weapon: WeaponBase): void {
    if (index < 0 || index >= this.slots.length) return;
    this.slots[index] = weapon;
    this.currentIndex = index;
  }

  switchTo(index: number): void {
    if (index < 0 || index >= this.slots.length || !this.slots[index]) return;
    if (index === this.currentIndex) return;
    this.currentIndex = index;
    this.eventBus.emit(GameEvents.WeaponSwitched, index);
  }

  update(dt: number): void {
    this.currentWeapon?.update(dt);
  }

  dispose(): void {
    for (const w of this.slots) w?.dispose();
    this.slots = [null, null, null];
  }
}
