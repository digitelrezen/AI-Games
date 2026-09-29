import { Scene } from '@babylonjs/core';
import { AdvancedDynamicTexture, Control, TextBlock } from '@babylonjs/gui';
import { EventBus, GameEvents } from '../events/EventBus';
import { GameConfig } from '../game/GameConfig';

/**
 * In-game HUD (Babylon GUI v8): crosshair, 9-lives display, weapon name,
 * and a control hint. Lives update via the event bus.
 */
export class HUD {
  private texture: AdvancedDynamicTexture;
  private livesText: TextBlock;
  private weaponText: TextBlock;
  private getWeaponName: () => string;

  constructor(scene: Scene, canvas: HTMLCanvasElement, eventBus: EventBus, getWeaponName: () => string) {
    this.getWeaponName = getWeaponName;
    this.texture = AdvancedDynamicTexture.CreateFullscreenUI('hud', undefined, scene);

    // crosshair
    const cross = new TextBlock('crosshair', '+');
    cross.fontSize = 28;
    cross.color = '#ffffffcc';
    cross.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    cross.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    cross.isPointerBlocker = false;
    this.texture.addControl(cross);

    // lives (top-left)
    this.livesText = new TextBlock('lives', '');
    this.livesText.fontSize = 22;
    this.livesText.color = '#ffd166';
    this.livesText.isPointerBlocker = false;
    this.texture.addControl(this.livesText);
    this.setLives(GameConfig.lives.max);

    // weapon (bottom-right)
    this.weaponText = new TextBlock('weapon', '');
    this.weaponText.fontSize = 20;
    this.weaponText.color = '#9ef0ff';
    this.weaponText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.weaponText.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.weaponText.isPointerBlocker = false;
    this.texture.addControl(this.weaponText);

    // hint (bottom-center)
    const hint = new TextBlock(
      'hint',
      'Click to lock mouse  |  WASD move  |  Shift sprint  |  Space jump  |  LMB fire  |  ` dev console'
    );
    hint.fontSize = 14;
    hint.color = '#ffffff88';
    hint.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    hint.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    hint.isPointerBlocker = false;
    this.texture.addControl(hint);

    eventBus.on(GameEvents.LivesChanged, (payload) => {
      this.setLives(payload as number);
    });
  }

  private setLives(n: number): void {
    const max = GameConfig.lives.max;
    const alive = '🐱'.repeat(Math.max(0, n));
    const lost = '💀'.repeat(Math.max(0, max - n));
    this.livesText.text = `LIVES ${n}/${max}  ${alive}${lost}`;
  }

  update(_dt: number): void {
    this.weaponText.text = this.getWeaponName();
  }

  dispose(): void {
    this.texture.dispose();
  }
}
