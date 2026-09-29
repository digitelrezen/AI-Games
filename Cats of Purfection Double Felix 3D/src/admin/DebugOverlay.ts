import { Engine, Scene } from '@babylonjs/core';
import { AdvancedDynamicTexture, Control, TextBlock } from '@babylonjs/gui';

/**
 * Debugger overlay (top-right): FPS, mesh count and any extra info
 * supplied by the game (player position, lives, etc.).
 * Refreshes 4x per second to stay cheap.
 */
export class DebugOverlay {
  private texture: AdvancedDynamicTexture;
  private text: TextBlock;
  private engine: Engine;
  private scene: Scene;
  private getExtraInfo: () => string;
  private timer = 0;

  constructor(scene: Scene, canvas: HTMLCanvasElement, engine: Engine, getExtraInfo: () => string) {
    this.scene = scene;
    this.engine = engine;
    this.getExtraInfo = getExtraInfo;
    this.texture = AdvancedDynamicTexture.CreateFullscreenUI('debugOverlay', undefined, scene);

    this.text = new TextBlock('debugText', '');
    this.text.fontSize = 13;
    this.text.color = '#7dff7d';
    this.text.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.text.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.text.isPointerBlocker = false;
    this.texture.addControl(this.text);
  }

  update(dt: number): void {
    this.timer += dt;
    if (this.timer < 0.25) return;
    this.timer = 0;
    const fps = this.engine.getFps().toFixed(0);
    const meshes = this.scene.meshes.length;
    this.text.text = `FPS ${fps} | meshes ${meshes}\n${this.getExtraInfo()}`;
  }

  dispose(): void {
    this.texture.dispose();
  }
}
