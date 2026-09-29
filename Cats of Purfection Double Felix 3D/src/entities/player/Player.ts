import { Scene, Vector3 } from '@babylonjs/core';
import { EventBus, GameEvents } from '../../events/EventBus';
import { ColliderBox } from '../../maps/MapBase';
import { resolveCollision } from '../../maps/collision';
import { GameConfig } from '../../game/GameConfig';
import { CatAvatar } from './CatAvatar';
import { NineLives } from './NineLives';
import { PlayerController } from './PlayerController';

/**
 * The player: first-person controller + 9-lives mechanic + visible test avatar.
 * In the final game the avatar represents the cat's "ghost" (a lost life);
 * for Step 1 it doubles as the visible test model proving rendering works.
 */
export class Player {
  readonly controller: PlayerController;
  readonly lives: NineLives;
  readonly avatar: CatAvatar;
  private scene: Scene;
  private eventBus: EventBus;
  private colliders: ColliderBox[];
  private spawnPoint: Vector3;

  constructor(scene: Scene, eventBus: EventBus, canvas: HTMLCanvasElement, colliders: ColliderBox[], spawnPoint: Vector3) {
    this.scene = scene;
    this.eventBus = eventBus;
    this.colliders = colliders;
    this.spawnPoint = spawnPoint.clone();

    this.controller = new PlayerController(canvas, scene, spawnPoint, (p) =>
      resolveCollision(p, this.colliders, GameConfig.player.collisionRadius)
    );

    this.lives = new NineLives();
    this.lives.onLivesChanged = (lives) => this.eventBus.emit(GameEvents.LivesChanged, lives);

    // Visible test avatar standing near spawn, facing the player.
    this.avatar = new CatAvatar(scene, 'playerAvatar', spawnPoint.clone().add(new Vector3(2.5, 0, 2)), 1.1);
    this.avatar.root.rotation.y = Math.PI; // face the spawn point
  }

  update(dt: number): void {
    this.controller.update(dt);
    this.avatar.update(dt);
  }

  /**
   * Damage scaffold: each hit costs one life.
   * TODO(step 2): real damage model, hitboxes, death sequence, gore hooks.
   */
  takeDamage(): void {
    if (!this.lives.isAlive) return;
    const survived = this.lives.loseLife();
    if (survived) {
      this.respawn();
    } else {
      this.eventBus.emit(GameEvents.PlayerDied);
    }
  }

  respawn(): void {
    this.controller.teleport(this.spawnPoint);
    this.eventBus.emit(GameEvents.PlayerRespawned);
  }

  dispose(): void {
    this.controller.dispose();
    this.avatar.dispose();
  }
}
