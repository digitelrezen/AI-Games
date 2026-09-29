import '@babylonjs/loaders'; // GLTF/OBJ/DDS loaders registered for future cat models & maps
import { Game } from './game/Game';
import { installScreenshotGuard } from './config/ScreenshotGuard';

// RULE 1 (mandatory): No-screenshot policy.
// The runtime guard blocks canvas.toDataURL / toBlob / screen capture before
// anything else can run. Agent/tooling loops must also never take screenshots.
installScreenshotGuard();

const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
if (!canvas) {
  throw new Error('renderCanvas element not found');
}

const game = new Game(canvas);
game.start();

// Exposed for the dev console / headless validation (never used for screenshots).
(window as unknown as { __game: Game }).__game = game;
