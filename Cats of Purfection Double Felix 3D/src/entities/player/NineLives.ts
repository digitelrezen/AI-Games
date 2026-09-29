import { GameConfig } from '../../game/GameConfig';

/**
 * 9-lives mechanic (scaffolding).
 * GM super cats have 9 lives. Losing a life respawns the cat; losing the
 * last one ends the run. HUD + event bus are wired through onLivesChanged.
 */
export class NineLives {
  private _lives: number;
  onLivesChanged?: (lives: number) => void;

  constructor(initial?: number) {
    this._lives = initial ?? GameConfig.lives.max;
  }

  get lives(): number {
    return this._lives;
  }

  get isAlive(): boolean {
    return this._lives > 0;
  }

  /** Consume one life. Returns true if the cat still has lives left. */
  loseLife(): boolean {
    if (this._lives <= 0) return false;
    this._lives--;
    this.onLivesChanged?.(this._lives);
    return this._lives > 0;
  }

  restoreLife(): void {
    if (this._lives < GameConfig.lives.max) {
      this._lives++;
      this.onLivesChanged?.(this._lives);
    }
  }

  setLives(n: number): void {
    this._lives = Math.max(0, Math.min(GameConfig.lives.max, n));
    this.onLivesChanged?.(this._lives);
  }

  reset(): void {
    this.setLives(GameConfig.lives.max);
  }
}
