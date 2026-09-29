export type GameEventHandler = (payload?: unknown) => void;

/**
 * Minimal typed-ish event bus. All cross-module communication in the game
 * goes through this bus so systems (player, weapons, HUD, admin, gore)
 * stay decoupled and easy to extend.
 */
export class EventBus {
  private handlers = new Map<string, Set<GameEventHandler>>();

  /** Subscribe. Returns an unsubscribe function. */
  on(event: string, handler: GameEventHandler): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);
    return () => this.off(event, handler);
  }

  off(event: string, handler: GameEventHandler): void {
    this.handlers.get(event)?.delete(handler);
  }

  emit(event: string, payload?: unknown): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of [...set]) {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[EventBus] Handler error for "${event}"`, err);
      }
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}

/** Canonical event names. */
export const GameEvents = {
  GameStarted: 'game:started',
  GamePaused: 'game:paused',
  GameResumed: 'game:resumed',
  PlayerDied: 'player:died',
  PlayerRespawned: 'player:respawned',
  LivesChanged: 'lives:changed',
  WeaponFired: 'weapon:fired',
  WeaponHit: 'weapon:hit',
  WeaponSwitched: 'weapon:switched',
  ConsoleToggled: 'console:toggled',
  LanStatusChanged: 'lan:status'
} as const;
