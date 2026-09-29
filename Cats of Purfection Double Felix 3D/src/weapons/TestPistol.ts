import {
  Color3,
  Mesh,
  MeshBuilder,
  Quaternion,
  Ray,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3
} from '@babylonjs/core';
import { EventBus, GameEvents } from '../events/EventBus';
import { GameConfig } from '../game/GameConfig';
import { WeaponBase } from './WeaponBase';

interface Fx {
  mesh: Mesh;
  life: number;
  maxLife: number;
}

/**
 * Test pistol: procedural viewmodel (slide/frame/grip), muzzle flash,
 * raycast hitscan with tracer + impact spark. Proves weapon rendering,
 * firing logic and scene picking all work.
 */
export class TestPistol extends WeaponBase {
  private muzzle: TransformNode;
  private flash: Mesh;
  private flashTimer = 0;
  private tracers: Fx[] = [];
  private impacts: Fx[] = [];
  private tracerMat: StandardMaterial;
  private impactMat: StandardMaterial;

  constructor(scene: Scene, eventBus: EventBus) {
    const cfg = GameConfig.weapon.pistol;
    super(scene, eventBus, 'TestPistol', cfg.fireRate, cfg.damage);
    this.muzzle = new TransformNode('pistolMuzzle', scene);
    this.flash = MeshBuilder.CreateSphere('pistolFlash', { diameter: 0.09 }, scene);
    const flashMat = new StandardMaterial('pistolFlashMat', scene);
    flashMat.emissiveColor = new Color3(1, 0.85, 0.4);
    flashMat.disableLighting = true;
    this.flash.material = flashMat;
    this.flash.parent = this.muzzle;
    this.flash.setEnabled(false);

    this.tracerMat = new StandardMaterial('tracerMat', scene);
    this.tracerMat.emissiveColor = new Color3(1, 0.9, 0.5);
    this.tracerMat.disableLighting = true;
    this.tracerMat.alpha = 0.85;

    this.impactMat = new StandardMaterial('impactMat', scene);
    this.impactMat.emissiveColor = new Color3(1, 0.55, 0.2);
    this.impactMat.disableLighting = true;
  }

  buildViewModel(): void {
    // bottom-right of the player's view
    this.root.position.set(0.28, -0.24, -0.55);

    const slide = MeshBuilder.CreateBox('pistolSlide', { width: 0.06, height: 0.07, depth: 0.28 }, this.scene);
    slide.material = this.mat('#2b2f36');
    slide.parent = this.root;

    const frame = MeshBuilder.CreateBox('pistolFrame', { width: 0.055, height: 0.05, depth: 0.2 }, this.scene);
    frame.position.set(0, -0.055, 0.03);
    frame.material = this.mat('#3a4048');
    frame.parent = this.root;

    const grip = MeshBuilder.CreateBox('pistolGrip', { width: 0.05, height: 0.14, depth: 0.07 }, this.scene);
    grip.position.set(0, -0.13, 0.1);
    grip.rotation.x = 0.25;
    grip.material = this.mat('#1d2026');
    grip.parent = this.root;

    // viewmodel must never be picked by hit rays
    for (const m of [slide, frame, grip, this.flash]) {
      m.isPickable = false;
    }

    this.muzzle.position.set(0, 0, -0.16);
    this.muzzle.parent = this.root;
  }

  private mat(hex: string): StandardMaterial {
    const m = new StandardMaterial(`pistolMat_${hex.slice(1)}`, this.scene);
    m.diffuseColor = Color3.FromHexString(hex);
    m.specularColor = new Color3(0.25, 0.25, 0.28);
    return m;
  }

  fire(origin: Vector3, direction: Vector3): boolean {
    if (!this.canFire) return false;
    this.cooldown = 1 / this.fireRate;

    // muzzle flash
    this.flash.setEnabled(true);
    this.flashTimer = 0.05;

    // hitscan raycast (skip viewmodel meshes via isPickable=false)
    const range = GameConfig.weapon.pistol.range;
    const ray = new Ray(origin, direction, range);
    const hit = this.scene.pickWithRay(ray);

    const muzzlePos = this.muzzle.getAbsolutePosition();
    const end = hit && hit.pickedPoint ? hit.pickedPoint : origin.add(direction.scale(range));
    this.spawnTracer(muzzlePos, end);

    if (hit && hit.pickedPoint) {
      this.spawnImpact(hit.pickedPoint);
      this.eventBus.emit(GameEvents.WeaponHit, {
        point: hit.pickedPoint,
        mesh: hit.pickedMesh ? hit.pickedMesh.name : null,
        damage: this.damage
      });
    }
    this.eventBus.emit(GameEvents.WeaponFired, { weapon: this.name });
    return true;
  }

  private spawnTracer(from: Vector3, to: Vector3): void {
    const dir = to.subtract(from);
    const len = dir.length();
    if (len < 0.01) return;
    const tracer = MeshBuilder.CreateCylinder('tracer', { height: len, diameter: 0.02, tessellation: 6 }, this.scene);
    tracer.position = from.add(to).scale(0.5);
    tracer.rotationQuaternion = this.alignYTo(dir);
    tracer.material = this.tracerMat;
    tracer.isPickable = false;
    this.tracers.push({ mesh: tracer, life: 0.06, maxLife: 0.06 });
  }

  /** Quaternion aligning a cylinder's local +Y axis with `dir`. */
  private alignYTo(dir: Vector3): Quaternion {
    const d = dir.normalize();
    const dot = Vector3.Dot(Vector3.Up(), d);
    if (dot > 0.9999) return Quaternion.Identity();
    if (dot < -0.9999) return Quaternion.RotationAxis(new Vector3(1, 0, 0), Math.PI);
    const axis = Vector3.Cross(Vector3.Up(), d).normalize();
    return Quaternion.RotationAxis(axis, Math.acos(dot));
  }

  private spawnImpact(point: Vector3): void {
    const spark = MeshBuilder.CreateSphere('impact', { diameter: 0.12 }, this.scene);
    spark.position = point;
    spark.material = this.impactMat;
    spark.isPickable = false;
    this.impacts.push({ mesh: spark, life: 0.15, maxLife: 0.15 });
  }

  update(dt: number): void {
    super.update(dt);

    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) this.flash.setEnabled(false);
    }

    this.updateFx(this.tracers, dt);
    this.updateFx(this.impacts, dt);
  }

  private updateFx(list: Fx[], dt: number): void {
    for (let i = list.length - 1; i >= 0; i--) {
      const fx = list[i];
      fx.life -= dt;
      if (fx.life <= 0) {
        fx.mesh.dispose();
        list.splice(i, 1);
        continue;
      }
      const t = fx.life / fx.maxLife;
      fx.mesh.scaling.setAll(Math.max(0.01, t));
    }
  }
}
