import {
  Color3,
  DirectionalLight,
  DynamicTexture,
  HemisphericLight,
  MeshBuilder,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  Texture,
  Vector3
} from '@babylonjs/core';
import { GameConfig } from '../game/GameConfig';
import { MapBase } from './MapBase';

/**
 * Basic test arena: lit ground with a procedural grid, perimeter walls,
 * cover barriers, corner pillars and a central landmark.
 * All geometry is procedural (no external assets) so the build is self-contained.
 */
export class TestArena extends MapBase {
  constructor(scene: Scene) {
    super(scene, 'TestArena');
  }

  build(): void {
    this.buildLighting();
    this.buildGround();
    this.buildWalls();
    this.buildBarriers();
    this.buildProps();
    this.registerShadows();
  }

  // ---------------------------------------------------------------- lighting

  private buildLighting(): void {
    const hemi = new HemisphericLight('arenaHemi', new Vector3(0, 1, 0), this.scene);
    hemi.intensity = 0.55;
    hemi.groundColor = new Color3(0.16, 0.13, 0.11);

    const sun = new DirectionalLight('arenaSun', new Vector3(-0.55, -1, -0.35), this.scene);
    sun.intensity = 0.95;
    sun.position = new Vector3(25, 35, 15);
  }

  private registerShadows(): void {
    const sun = this.scene.getLightByName('arenaSun') as DirectionalLight | null;
    if (!sun) return;
    const shadowGen = new ShadowGenerator(1024, sun);
    shadowGen.useBlurExponentialShadowMap = true;
    shadowGen.blurKernel = 16;
    shadowGen.setDarkness(0.35);
    for (const mesh of this.scene.meshes) {
      if (mesh.name === 'ground') {
        mesh.receiveShadows = true;
        continue;
      }
      if (mesh.name.startsWith('tracer') || mesh.name.startsWith('impact') || mesh.name === 'pistolFlash') {
        continue;
      }
      shadowGen.addShadowCaster(mesh);
      mesh.receiveShadows = true;
    }
  }

  // ------------------------------------------------------------------ ground

  private buildGround(): void {
    const size = GameConfig.arena.size;
    const ground = MeshBuilder.CreateGround('ground', { width: size, height: size }, this.scene);
    const mat = new StandardMaterial('groundMat', this.scene);
    const tex = this.makeGridTexture();
    mat.diffuseTexture = tex;
    // one texture tile = 10 world units
    tex.uScale = size / 10;
    tex.vScale = size / 10;
    mat.specularColor = new Color3(0.04, 0.04, 0.05);
    ground.material = mat;
    ground.receiveShadows = true;
  }

  private makeGridTexture(): DynamicTexture {
    const res = 256;
    const dt = new DynamicTexture('gridTex', { width: res, height: res }, this.scene, false);
    const ctx = dt.getContext();
    ctx.fillStyle = '#23262e';
    ctx.fillRect(0, 0, res, res);
    // subtle checker
    ctx.fillStyle = 'rgba(255,255,255,0.025)';
    ctx.fillRect(0, 0, res / 2, res / 2);
    ctx.fillRect(res / 2, res / 2, res / 2, res / 2);
    // tile border
    ctx.strokeStyle = '#3a4152';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, res, res);
    // inner cross
    ctx.strokeStyle = 'rgba(120,140,180,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(res / 2, 0);
    ctx.lineTo(res / 2, res);
    ctx.moveTo(0, res / 2);
    ctx.lineTo(res, res / 2);
    ctx.stroke();
    dt.update();
    dt.wrapU = Texture.WRAP_ADDRESSMODE;
    dt.wrapV = Texture.WRAP_ADDRESSMODE;
    return dt;
  }

  // ------------------------------------------------------------------- walls

  private buildWalls(): void {
    const s = GameConfig.arena.size;
    const h = GameConfig.arena.wallHeight;
    const t = GameConfig.arena.wallThickness;
    const mat = this.makeWallMaterial();

    const defs: { pos: Vector3; size: Vector3 }[] = [
      { pos: new Vector3(0, h / 2, -s / 2), size: new Vector3(s + 2 * t, h, t) },
      { pos: new Vector3(0, h / 2, s / 2), size: new Vector3(s + 2 * t, h, t) },
      { pos: new Vector3(-s / 2, h / 2, 0), size: new Vector3(t, h, s) },
      { pos: new Vector3(s / 2, h / 2, 0), size: new Vector3(t, h, s) }
    ];

    for (const d of defs) {
      const wall = MeshBuilder.CreateBox('wall', { width: d.size.x, height: d.size.y, depth: d.size.z }, this.scene);
      wall.position = d.pos;
      wall.material = mat;
      this.addBoxCollider(d.pos, d.size.scale(0.5));
    }
  }

  private makeWallMaterial(): StandardMaterial {
    const mat = new StandardMaterial('wallMat', this.scene);
    mat.diffuseColor = new Color3(0.28, 0.3, 0.36);
    mat.specularColor = new Color3(0.05, 0.05, 0.06);
    return mat;
  }

  // ---------------------------------------------------------------- barriers

  private buildBarriers(): void {
    const mat = this.makeCrateMaterial();
    const defs: { pos: Vector3; size: Vector3 }[] = [
      // mid-field cover
      { pos: new Vector3(-8, 0.75, -6), size: new Vector3(4, 1.5, 1.2) },
      { pos: new Vector3(8, 0.75, -6), size: new Vector3(4, 1.5, 1.2) },
      { pos: new Vector3(0, 1, -14), size: new Vector3(6, 2, 1.2) },
      { pos: new Vector3(-14, 0.75, 6), size: new Vector3(1.2, 1.5, 4) },
      { pos: new Vector3(14, 0.75, 6), size: new Vector3(1.2, 1.5, 4) },
      { pos: new Vector3(-6, 0.75, 10), size: new Vector3(3, 1.5, 1) },
      { pos: new Vector3(6, 0.75, 10), size: new Vector3(3, 1.5, 1) },
      // stacked crates (corners)
      { pos: new Vector3(-18, 0.5, -18), size: new Vector3(1, 1, 1) },
      { pos: new Vector3(-18, 1.5, -18), size: new Vector3(1, 1, 1) },
      { pos: new Vector3(18, 0.5, 18), size: new Vector3(1, 1, 1) },
      { pos: new Vector3(18, 1.5, 18), size: new Vector3(1, 1, 1) },
      { pos: new Vector3(19, 0.5, 18), size: new Vector3(1, 1, 1) }
    ];

    for (const d of defs) {
      const box = MeshBuilder.CreateBox('barrier', { width: d.size.x, height: d.size.y, depth: d.size.z }, this.scene);
      box.position = d.pos;
      box.material = mat;
      this.addBoxCollider(d.pos, d.size.scale(0.5));
    }
  }

  private makeCrateMaterial(): StandardMaterial {
    const mat = new StandardMaterial('crateMat', this.scene);
    mat.diffuseColor = new Color3(0.45, 0.33, 0.2);
    mat.specularColor = new Color3(0.08, 0.06, 0.04);
    return mat;
  }

  // ------------------------------------------------------------------- props

  private buildProps(): void {
    // corner pillars
    const pillarMat = new StandardMaterial('pillarMat', this.scene);
    pillarMat.diffuseColor = new Color3(0.35, 0.37, 0.44);
    pillarMat.specularColor = new Color3(0.06, 0.06, 0.08);
    const pillarSpots: [number, number][] = [
      [-20, -20],
      [20, -20],
      [-20, 20],
      [20, 20]
    ];
    for (const [x, z] of pillarSpots) {
      const pillar = MeshBuilder.CreateCylinder('pillar', { diameter: 1.5, height: 5, tessellation: 16 }, this.scene);
      pillar.position.set(x, 2.5, z);
      pillar.material = pillarMat;
      this.addBoxCollider(new Vector3(x, 2.5, z), new Vector3(0.75, 2.5, 0.75));
    }

    // central landmark: glowing "cat eye" ring
    const ring = MeshBuilder.CreateTorus('catEyeRing', { diameter: 6, thickness: 0.35, tessellation: 48 }, this.scene);
    ring.position.y = 0.18;
    const ringMat = new StandardMaterial('catEyeRingMat', this.scene);
    ringMat.emissiveColor = new Color3(0.25, 0.95, 0.35);
    ringMat.diffuseColor = new Color3(0.05, 0.2, 0.08);
    ringMat.disableLighting = true;
    ring.material = ringMat;
  }
}
