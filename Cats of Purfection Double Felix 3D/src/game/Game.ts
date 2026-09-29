import { Color3, Color4, Engine, Scene, Vector3 } from '@babylonjs/core';
import { DebugOverlay } from '../admin/DebugOverlay';
import { DevConsole } from '../admin/DevConsole';
import { LanHooks } from '../admin/LanHooks';
import { GameConfig } from './GameConfig';
import { EventBus, GameEvents } from '../events/EventBus';
import { GoreSystem } from '../effects/gore/GoreSystem';
import { TestArena } from '../maps/TestArena';
import { Player } from '../entities/player/Player';
import { HUD } from '../ui/HUD';
import { TestPistol } from '../weapons/TestPistol';
import { WeaponSlots } from '../weapons/WeaponSlots';

/**
 * Game orchestrator: owns the engine, scene, map, player, weapons, HUD
 * and admin tools. Runs the render loop and per-frame updates.
 *
 * Display & scaling: the canvas fills the window (CSS 100%); on window
 * resize the engine resizes its render buffer to the canvas client size.
 * Babylon derives camera aspect from the viewport, so any resolution —
 * 1080p, 1440p, 3440x1440 ultrawide — renders without distortion.
 */
export class Game {
  readonly engine: Engine;
  readonly scene: Scene;
  readonly eventBus = new EventBus();
  readonly lan = new LanHooks();
  private canvas: HTMLCanvasElement;
  private map!: TestArena;
  private player!: Player;
  private weapons!: WeaponSlots;
  private hud!: HUD;
  private debug!: DebugOverlay;
  private devConsole!: DevConsole;
  private gore!: GoreSystem;
  private lastTime = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.engine = new Engine(canvas, true, {
      antialias: true,
      stencil: true,
      powerPreference: 'high-performance'
    });
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.05, 0.06, 0.09, 1);
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.006;
    this.scene.fogColor = new Color3(0.05, 0.06, 0.09);

    // Fullscreen / ultrawide scaling hook
    window.addEventListener('resize', () => this.engine.resize());

    this.buildWorld();
  }

  private buildWorld(): void {
    // map
    this.map = new TestArena(this.scene);
    this.map.build();

    // player
    const spawn = new Vector3(0, GameConfig.player.eyeHeight, 12);
    this.player = new Player(this.scene, this.eventBus, this.canvas, this.map.getColliders(), spawn);

    // weapons
    this.weapons = new WeaponSlots(this.scene, this.eventBus);
    const pistol = new TestPistol(this.scene, this.eventBus);
    pistol.buildViewModel();
    pistol.attachToCamera(this.player.controller.camera);
    this.weapons.equip(0, pistol);

    // gore (scaffold)
    this.gore = new GoreSystem(this.scene);

    // ui + admin
    this.hud = new HUD(this.scene, this.canvas, this.eventBus, () => this.weapons.currentWeapon?.name ?? '—');
    this.debug = new DebugOverlay(this.scene, this.canvas, this.engine, () => this.debugInfo());
    this.devConsole = new DevConsole(this.scene, this.canvas);
    this.devConsole.onToggle = (open) => {
      this.player.controller.inputEnabled = !open;
      this.eventBus.emit(GameEvents.ConsoleToggled, open);
    };
    this.registerConsoleCommands();

    // firing input (left mouse while pointer-locked)
    this.canvas.addEventListener('mousedown', this.onMouseDown);

    this.lan.onStatusChanged(() => this.eventBus.emit(GameEvents.LanStatusChanged, this.lan.status));

    this.eventBus.emit(GameEvents.GameStarted);
  }

  private debugInfo(): string {
    const p = this.player.controller.position;
    return `pos ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)} | lives ${this.player.lives.lives}`;
  }

  private registerConsoleCommands(): void {
    this.devConsole.registerCommand('help', () => 'commands: help | lives [n] | respawn | pos | clear | lan | gore');
    this.devConsole.registerCommand('lives', (args) => {
      if (args.length > 0) {
        const n = parseInt(args[0], 10);
        if (Number.isNaN(n)) return 'usage: lives [0-9]';
        this.player.lives.setLives(n);
        return `lives set to ${this.player.lives.lives}`;
      }
      return `lives: ${this.player.lives.lives}/${GameConfig.lives.max}`;
    });
    this.devConsole.registerCommand('respawn', () => {
      this.player.respawn();
      return 'respawned at spawn';
    });
    this.devConsole.registerCommand('pos', () => {
      const p = this.player.controller.position;
      return `pos: ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}`;
    });
    this.devConsole.registerCommand('clear', () => {
      this.devConsole.clear();
      return '';
    });
    this.devConsole.registerCommand('lan', () => `LAN: ${this.lan.status} (max ${this.lan.maxPlayers} players, relay in step 4)`);
    this.devConsole.registerCommand('gore', () => `gore system: ${this.gore.isEnabled ? 'enabled' : 'disabled'} (scaffold — effects land in step 2/3)`);
  }

  private onMouseDown = (e: MouseEvent): void => {
    if (e.button !== 0 || !this.player.controller.isLocked) return;
    const origin = this.player.controller.camera.position.clone();
    const dir = this.player.controller.forward;
    if (this.weapons.currentWeapon?.fire(origin, dir)) {
      this.player.controller.addRecoil(0.006);
    }
  };

  start(): void {
    this.lastTime = performance.now();
    this.engine.runRenderLoop(() => {
      const now = performance.now();
      const dt = Math.min((now - this.lastTime) / 1000, 0.1);
      this.lastTime = now;
      this.update(dt);
      this.scene.render();
    });
  }

  private update(dt: number): void {
    this.player.update(dt);
    this.weapons.update(dt);
    this.gore.update(dt);
    this.hud.update(dt);
    this.debug.update(dt);
  }

  dispose(): void {
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    this.player.dispose();
    this.weapons.dispose();
    this.hud.dispose();
    this.debug.dispose();
    this.devConsole.dispose();
    this.eventBus.clear();
    this.scene.dispose();
    this.engine.dispose();
  }
}
