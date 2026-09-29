import { Color3, Mesh, MeshBuilder, Scene, StandardMaterial, TransformNode, Vector3 } from '@babylonjs/core';

/**
 * Procedural GM super-cat avatar — the visible test player model.
 * Built from primitives (no external assets): body, head, ears, eyes,
 * muzzle, legs, stripes and a wagging tail. Idle animation: tail wag + breathing.
 */
export class CatAvatar {
  readonly root: TransformNode;
  private scene: Scene;
  private tailRoot: TransformNode;
  private body: Mesh;
  private time = 0;

  constructor(scene: Scene, name: string, position: Vector3, scale = 1) {
    this.scene = scene;
    this.root = new TransformNode(name, scene);
    this.root.position = position;
    this.root.scaling.setAll(scale);
    this.tailRoot = new TransformNode(`${name}_tailRoot`, scene);
    this.body = MeshBuilder.CreateBox(`${name}_body`, { width: 0.5, height: 0.45, depth: 0.9 }, scene);
    this.build();
  }

  private mat(name: string, color: string, emissive?: string): StandardMaterial {
    const m = new StandardMaterial(name, this.scene);
    m.diffuseColor = Color3.FromHexString(color);
    if (emissive) m.emissiveColor = Color3.FromHexString(emissive);
    m.specularColor = new Color3(0.12, 0.12, 0.12);
    return m;
  }

  private build(): void {
    const fur = this.mat(`${this.root.name}_fur`, '#e8842c');
    const dark = this.mat(`${this.root.name}_dark`, '#b35a17');
    const white = this.mat(`${this.root.name}_white`, '#f5f0e6');
    const eyeMat = this.mat(`${this.root.name}_eyes`, '#101418', '#7cfc00');
    const noseMat = this.mat(`${this.root.name}_nose`, '#ff6b9d');

    // body (created in ctor, parented here)
    this.body.position.y = 0.5;
    this.body.material = fur;
    this.body.parent = this.root;

    // head
    const head = MeshBuilder.CreateBox(`${this.root.name}_head`, { width: 0.42, height: 0.4, depth: 0.4 }, this.scene);
    head.position.set(0, 0.95, 0.55);
    head.material = fur;
    head.parent = this.root;

    // ears
    for (const side of [-1, 1]) {
      const ear = MeshBuilder.CreateCylinder(`${this.root.name}_ear${side > 0 ? 'R' : 'L'}`, {
        diameterBottom: 0.18,
        diameterTop: 0,
        height: 0.22,
        tessellation: 12
      }, this.scene);
      ear.position.set(0.12 * side, 1.24, 0.55);
      ear.material = dark;
      ear.parent = this.root;
    }

    // eyes (glowing)
    for (const side of [-1, 1]) {
      const eye = MeshBuilder.CreateSphere(`${this.root.name}_eye${side > 0 ? 'R' : 'L'}`, { diameter: 0.08 }, this.scene);
      eye.position.set(0.1 * side, 1.0, 0.76);
      eye.material = eyeMat;
      eye.parent = this.root;
    }

    // muzzle + nose
    const muzzle = MeshBuilder.CreateBox(`${this.root.name}_muzzle`, { width: 0.18, height: 0.12, depth: 0.1 }, this.scene);
    muzzle.position.set(0, 0.88, 0.78);
    muzzle.material = white;
    muzzle.parent = this.root;
    const nose = MeshBuilder.CreateSphere(`${this.root.name}_nose`, { diameter: 0.05 }, this.scene);
    nose.position.set(0, 0.9, 0.84);
    nose.material = noseMat;
    nose.parent = this.root;

    // legs
    const legSpots: [number, number][] = [
      [-0.15, 0.3],
      [0.15, 0.3],
      [-0.15, -0.3],
      [0.15, -0.3]
    ];
    legSpots.forEach(([x, z], i) => {
      const leg = MeshBuilder.CreateBox(`${this.root.name}_leg${i}`, { width: 0.12, height: 0.3, depth: 0.12 }, this.scene);
      leg.position.set(x, 0.15, z);
      leg.material = fur;
      leg.parent = this.root;
    });

    // stripes
    for (let i = 0; i < 3; i++) {
      const stripe = MeshBuilder.CreateBox(`${this.root.name}_stripe${i}`, { width: 0.52, height: 0.08, depth: 0.1 }, this.scene);
      stripe.position.set(0, 0.5, -0.2 + i * 0.2);
      stripe.material = dark;
      stripe.parent = this.root;
    }

    // tail (segmented, wagging)
    this.tailRoot.position.set(0, 0.6, -0.45);
    this.tailRoot.parent = this.root;
    for (let i = 0; i < 4; i++) {
      const seg = MeshBuilder.CreateSphere(`${this.root.name}_tail${i}`, { diameter: 0.15 - i * 0.02 }, this.scene);
      seg.position.set(0, i * 0.13, -i * 0.09);
      seg.material = dark;
      seg.parent = this.tailRoot;
    }
  }

  update(dt: number): void {
    this.time += dt;
    // tail wag
    this.tailRoot.rotation.y = Math.sin(this.time * 3) * 0.45;
    // breathing
    const s = 1 + Math.sin(this.time * 2) * 0.012;
    this.body.scaling.set(s, 1, s);
  }

  dispose(): void {
    this.root.dispose();
  }
}
