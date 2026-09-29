import { Scene } from '@babylonjs/core';
import { AdvancedDynamicTexture, Container, Control, InputText, TextBlock } from '@babylonjs/gui';

type ConsoleCommand = (args: string[]) => string;

/**
 * Developer console (toggle with ` / Backquote).
 * GUI-based (Babylon GUI v8): a Container panel with an output TextBlock
 * and an InputText command line. Commands are registered by the game
 * (lives, respawn, pos, lan, gore, help, clear).
 * Opening the console releases pointer lock so the input is usable.
 */
export class DevConsole {
  private texture: AdvancedDynamicTexture;
  private root: Container;
  private output: TextBlock;
  private input: InputText;
  private visible = false;
  private commands = new Map<string, ConsoleCommand>();
  private canvas: HTMLCanvasElement;

  /** Fired with (isOpen) so the game can gate player input. */
  onToggle?: (isOpen: boolean) => void;

  constructor(scene: Scene, canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.texture = AdvancedDynamicTexture.CreateFullscreenUI('devConsole', undefined, scene);

    this.root = new Container('consoleRoot');
    this.root.width = '42%';
    this.root.height = '46%';
    this.root.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.root.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.root.background = '#000000aa';
    this.root.isVisible = false;
    this.texture.addControl(this.root);

    this.output = new TextBlock('consoleOutput', '');
    this.output.fontSize = 14;
    this.output.color = '#9fef9f';
    this.output.width = '100%';
    this.output.height = '82%';
    this.output.isPointerBlocker = false;
    this.root.addControl(this.output);

    this.input = new InputText('consoleInput', '');
    this.input.fontSize = 16;
    this.input.color = '#ffffff';
    this.input.width = '100%';
    this.input.height = '14%';
    this.root.addControl(this.input);
    this.input.onTextChangedObservable.add((ctl) => {
      const text = ctl.text;
      if (text === '') return;
      this.execute(text);
      this.input.text = '';
    });

    window.addEventListener('keydown', this.onKeyDown);
    this.print('Dev console ready. Type "help".');
  }

  registerCommand(name: string, handler: ConsoleCommand): void {
    this.commands.set(name.toLowerCase(), handler);
  }

  get isVisible(): boolean {
    return this.visible;
  }

  toggle(): void {
    this.visible = !this.visible;
    this.root.isVisible = this.visible;
    if (this.visible && document.pointerLockElement) {
      document.exitPointerLock();
    }
    this.onToggle?.(this.visible);
  }

  clear(): void {
    this.output.text = '';
  }

  print(line: string): void {
    const current = this.output.text;
    const next = current ? `${current}\n${line}` : line;
    // keep the log bounded
    const lines = next.split('\n');
    this.output.text = lines.slice(-40).join('\n');
  }

  private execute(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) return;
    this.print(`> ${trimmed}`);
    const [cmd, ...args] = trimmed.split(/\s+/);
    const handler = this.commands.get(cmd.toLowerCase());
    const result = handler ? handler(args) : `Unknown command: ${cmd}. Type "help".`;
    if (result) this.print(result);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'Backquote') {
      e.preventDefault();
      this.toggle();
    }
  };

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    this.texture.dispose();
  }
}
