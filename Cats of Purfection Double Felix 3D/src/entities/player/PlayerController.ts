import { FreeCamera, Scene, Vector3 } from '@babylonjs/core';
import { GameConfig } from '../../game/GameConfig';

/**
 * First-person player controller.
 *
 * - Pointer-lock mouse look (click canvas to lock, Esc to release)
 * - WASD movement relative to view direction, Shift sprint, Space jump
 * - Gravity + ground clamp + arcade AABB collision (via injected resolver)
 *
 * Direction convention (Babylon left-handed, Y up):
 *   forward = (-sin(yaw) * cos(pitch), sin(pitch), cos(yaw) * cos(pitch))
 * Mouse right -> yaw decreases... (see onMouseMove) so the view turns right;
 * mouse up -> pitch increases so the view looks up.
 */
export class PlayerController {
  readonly camera: FreeCamera;
  readonly position = new Vector3(0, GameConfig.player.eyeHeight, 0);
  private velocity = new Vector3();
  private yaw = 0;
  private pitch = 0;
  private onGround = true;
  private keys = new Set<string>();
  private locked = false;
  private canvas: HTMLCanvasElement;
  private collisionCheck: (pos: Vector3) => Vector3;

  /** Set false by the game while the dev console has keyboard focus. */
  inputEnabled = true;

  constructor(canvas: HTMLCanvasElement, scene: Scene, spawn: Vector3, collisionCheck: (pos: Vector3) => Vector3) {
    this.canvas = canvas;
    this.collisionCheck = collisionCheck;
    this.position.copyFrom(spawn);

    this.camera = new FreeCamera('playerCamera', this.position.clone(), scene);
    this.camera.minZ = 0.05;
    this.camera.maxZ = 2000;
    this.camera.fov = 1.05;
    this.camera.attachControl(canvas, true);
    // We drive look + movement ourselves; drop Babylon's default inputs.
    const kb = this.camera.inputs.attached.keyboard;
    if (kb) this.camera.inputs.remove(kb);
    const mouse = this.camera.inputs.attached.mouse;
    if (mouse) this.camera.inputs.remove(mouse);

    canvas.addEventListener('click', this.onCanvasClick);
    document.addEventListener('pointerlockchange', this.onLockChange);
    document.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  get isLocked(): boolean {
    return this.locked;
  }

  /** Current view direction (unit vector). */
  get forward(): Vector3 {
    const cp = Math.cos(this.pitch);
    return new Vector3(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
  }

  /** Small upward view kick when firing. */
  addRecoil(amount: number): void {
    this.pitch = Math.min(GameConfig.player.maxPitch, this.pitch + amount);
  }

  teleport(pos: Vector3): void {
    this.position.copyFrom(pos);
    this.velocity.set(0, 0, 0);
    this.onGround = true;
  }

  update(dt: number): void {
    const cfg = GameConfig.player;

    // --- movement basis (flattened view direction)
    const flatForward = new Vector3(this.forward.x, 0, this.forward.z);
    if (flatForward.lengthSquared() < 1e-6) flatForward.set(0, 0, 1);
    flatForward.normalize();
    const right = Vector3.Cross(flatForward, Vector3.Up()).normalize();

    const move = new Vector3();
    if (this.inputEnabled) {
      if (this.keys.has('KeyW')) move.addInPlace(flatForward);
      if (this.keys.has('KeyS')) move.subtractInPlace(flatForward);
      if (this.keys.has('KeyD')) move.addInPlace(right);
      if (this.keys.has('KeyA')) move.subtractInPlace(right);
    }
    const sprinting = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const speed = sprinting ? cfg.sprintSpeed : cfg.walkSpeed;
    if (move.lengthSquared() > 0) move.normalize();

    this.velocity.x = move.x * speed;
    this.velocity.z = move.z * speed;

    // --- gravity + jump
    this.velocity.y -= cfg.gravity * dt;
    if (this.inputEnabled && this.keys.has('Space') && this.onGround) {
      this.velocity.y = cfg.jumpVelocity;
      this.onGround = false;
    }

    // --- integrate
    const next = this.position.clone();
    next.x += this.velocity.x * dt;
    next.y += this.velocity.y * dt;
    next.z += this.velocity.z * dt;

    if (next.y <= cfg.eyeHeight) {
      next.y = cfg.eyeHeight;
      this.velocity.y = 0;
      this.onGround = true;
    }

    this.position.copyFrom(this.collisionCheck(next));

    // --- apply to camera
    this.camera.position.copyFrom(this.position);
    this.camera.setTarget(this.position.clone().add(this.forward));
  }

  // ------------------------------------------------------------------ input

  private onCanvasClick = (): void => {
    if (!this.locked) {
      this.canvas.requestPointerLock();
    }
  };

  private onLockChange = (): void => {
    this.locked = document.pointerLockElement === this.canvas;
    if (!this.locked) this.keys.clear();
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.locked || !this.inputEnabled) return;
    const s = GameConfig.player.mouseSensitivity;
    this.yaw -= e.movementX * s;
    this.pitch -= e.movementY * s;
    const max = GameConfig.player.maxPitch;
    this.pitch = Math.max(-max, Math.min(max, this.pitch));
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.inputEnabled) return;
    if (e.repeat) return;
    this.keys.add(e.code);
    if (e.code === 'Space') e.preventDefault();
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  dispose(): void {
    this.canvas.removeEventListener('click', this.onCanvasClick);
    document.removeEventListener('pointerlockchange', this.onLockChange);
    document.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.camera.dispose();
  }
}
