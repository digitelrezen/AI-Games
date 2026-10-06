// Filename: ViewScaler.js
// Kitty Vs Everything — v3.13.0
// Scales the game canvas to fit the window with ZERO letterboxing on any
// aspect ratio (standard, ultra-wide, portrait):
//   • #game-root is sized to the LOGICAL viewport (viewW × viewH from
//     Viewport.js) and scaled uniformly via CSS `scale()` — the stage is
//     NEVER stretched/distorted; the logical area simply WIDENS (or
//     narrows) so the whole window is filled edge-to-edge.
//   • The canvas buffer is sized to viewW×q × viewH×q where q ≈ scale×DPR
//     (capped) — aspect-correct, never a forced uniform 16:9 buffer. The
//     native ultra-wide presets (3440×1440, 5120×1440) land exactly on
//     the display's native pixel size → crisp 1:1 rendering.
// The ctx transform is set to identity: all game math lives directly in
// viewport (game) coordinates; ctx.scale(q) is applied once per frame by
// Game.js around the world draw.
// v3.13.0: Rewritten — viewport fit math extracted to Viewport.js
// (computeViewport + ULTRA_WIDE_PRESETS); buffer is now aspect-correct.
// v3.12.0: canvas buffer + q scale (MAX_BUFFER_SCALE).
// v3.9.0:  CSS #game-root scale() (replaced canvas CSS size / DPR).
// v3.88.0: crisp pixel-art — onResize re-applies disableImageSmoothing
//          after the canvas buffer resize (a canvas.width assignment
//          resets the 2D context state).
export const VERSION = 'v3.88.1';
import { computeViewport } from './Viewport.js';
import { disableImageSmoothing } from './utils.js'; // v3.88.0: crisp pixel-art enforcement

class ViewScaler {
  constructor(canvas) {
    this.canvas = canvas;
    this.root = document.getElementById('game-root');
    this.viewW = 1280; // logical viewport width (game coords)
    this.viewH = 720;  // logical viewport height (game coords)
    this.q = 1;        // crisp buffer scale (≈ scale × DPR)
    this.preset = null; // matched native ultra-wide preset (or null)
    this.onResize();
    window.addEventListener('resize', () => this.onResize());
    // ─── v3.12.0: browser fullscreen (U key + dev panel button) ───
    // Restored in v3.13.0: DevPanel.js calls view.isFullscreen()/toggleFullscreen().
    window.addEventListener('keydown', (e) => {
      const tag = e.target && e.target.tagName;
      if (e.repeat || tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        this.toggleFullscreen();
      }
    });
    document.addEventListener('fullscreenchange', () => this.onResize());
  }

  onResize() {
    const dpr = window.devicePixelRatio || 1;
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    // v3.13.0: unified fit math (Viewport.js) — seamless on ANY aspect
    // ratio; exact native-pixel buffers on 3440×1440 / 5120×1440.
    const vp = computeViewport(winW, winH, dpr);
    this.viewW = vp.viewW;
    this.viewH = vp.viewH;
    this.q = vp.q;
    this.preset = vp.preset;

    // Logical stage size (game coords, 1:1) — the constrained axis stays
    // at its native GAME size, the other axis grows with the aspect.
    this.root.style.width = `${vp.viewW}px`;
    this.root.style.height = `${vp.viewH}px`;
    this.root.style.transform = `scale(${vp.scale})`;

    // Canvas buffer (crisp, aspect-correct): viewW×q × viewH×q.
    this.canvas.width = vp.bufW;
    this.canvas.height = vp.bufH;
    this.canvas.style.width = `${vp.viewW}px`;
    this.canvas.style.height = `${vp.viewH}px`;
    // No ctx transform here — Game.js applies ctx.scale(this.q) per frame
    // and all game code works in viewport (game) coordinates.
    // v3.88.0: crisp pixel-art — the canvas.width/height assignments above
    // reset the 2D context state, so re-apply nearest-neighbor smoothing
    // (same context instance Game.js holds).
    disableImageSmoothing(this.canvas.getContext('2d'));
  }

  // ─── v3.12.0: browser fullscreen (U key / dev panel) ───
  isFullscreen() {
    return !!document.fullscreenElement;
  }
  toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  }
}

export default ViewScaler;
