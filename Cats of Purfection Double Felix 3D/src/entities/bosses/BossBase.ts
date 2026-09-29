import { Scene } from '@babylonjs/core';
import { EnemyBase } from '../enemies/EnemyBase';

/**
 * Boss framework.
 * Bosses are enemies with a phase system: as health drops they advance
 * through phases (new attack patterns, speedups, enrage).
 * Concrete bosses (step 3+) extend this.
 */
export abstract class BossBase extends EnemyBase {
  phase = 1;
  maxPhases = 3;
  protected onPhaseChange?: (phase: number) => void;

  constructor(scene: Scene, name: string, health: number, maxPhases = 3) {
    super(scene, name, health);
    this.maxPhases = maxPhases;
  }

  setOnPhaseChange(handler: (phase: number) => void): void {
    this.onPhaseChange = handler;
  }

  /** Override in concrete bosses to change behavior per phase. */
  protected onPhaseEnter(_phase: number): void {
    // TODO(step 3): attack pattern swaps, speedups, enrage, phase FX
  }

  /**
   * Advance phase when a health threshold is crossed.
   * Thresholds are evenly spaced: phase N starts at (1 - N/maxPhases) * maxHealth.
   */
  checkPhase(): void {
    if (this.isDead) return;
    const fraction = this.health / this.maxHealth;
    const targetPhase = Math.min(this.maxPhases, Math.max(1, Math.floor((1 - fraction) * this.maxPhases) + 1));
    if (targetPhase > this.phase) {
      this.phase = targetPhase;
      this.onPhaseChange?.(this.phase);
      this.onPhaseEnter(this.phase);
    }
  }
}
