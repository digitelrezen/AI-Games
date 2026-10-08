// ═══════════════════════════════════════════════════════════
//  [6ak] v3.100.0 HACKER TERMINAL HANGAR — the start screen is a
//        terminal/console UI (charcoal + neon cyan/magenta/green,
//        CRT scanlines, monospace type).
//        (1) config.js: every PLAYER_THEMES entry carries a unique
//            hacker-terminal CALLSIGN (the roster-grid label).
//        (2) index.html: the terminal structure — header bar, ROSTER
//            panel (#hangar-roster grid container), TACTICAL PREVIEW
//            panel (#hangar-canvas 448×448 + #hangar-readout strip),
//            footer (mode buttons + #menu-mode-label + controls).
//        (3) main.js: renderRoster() generates one cell per
//            PLAYER_THEMES entry; hangarMove() grid-navigates with
//            wrap; TAB toggles the launch mode (CLASSIC ↔ SAR);
//            ENTER launches the active mode; the readout strip
//            updates per selection.
//        (4) style.css: the CRT scanline overlay, the monospace font
//            stack, the roster grid + active-cell neon, and the
//            preview scan sweep.
// ═══════════════════════════════════════════════════════════

import { ROOT, check, mod } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';

export default async function run() {
  console.log('\n[6ak] v3.100.0 hacker terminal hangar (roster grid + native 1:1 preview)');
  {
    const { PLAYER_THEMES } = await mod('js/core/config.js');
    const mainSrc = fs.readFileSync(path.join(ROOT, 'js/core/main.js'), 'utf8');
    const htmlSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const cssSrc = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');

    // ── (1) config: unique callsigns for all 9 themes ──
    const names = Object.keys(PLAYER_THEMES);
    check('config: PLAYER_THEMES has all 9 themes', names.length === 9, `got ${names.length}`);
    const callsigns = names.map((k) => PLAYER_THEMES[k].callsign);
    check('config: every theme carries a non-empty CALLSIGN',
      callsigns.every((c) => typeof c === 'string' && c.length > 0),
      `got ${JSON.stringify(callsigns)}`);
    check('config: callsigns are unique (roster grid labels)',
      new Set(callsigns).size === callsigns.length,
      `got ${JSON.stringify(callsigns)}`);
    check('config: callsigns are terminal-style (SCREAMING_SNAKE)',
      callsigns.every((c) => /^[A-Z0-9_]+$/.test(c)),
      `got ${JSON.stringify(callsigns)}`);

    // ── (2) index.html: the terminal structure ──
    check('index.html: terminal header bar present',
      htmlSrc.includes('id="menu-term-header"') && htmlSrc.includes('id="menu-term-title"') && htmlSrc.includes('id="menu-term-status"'));
    check('index.html: ROSTER panel + grid container present',
      htmlSrc.includes('id="menu-roster-panel"') && htmlSrc.includes('id="hangar-roster"'));
    check('index.html: TACTICAL PREVIEW panel + readout strip present',
      htmlSrc.includes('id="menu-preview-panel"') && htmlSrc.includes('id="hangar-readout"'));
    check('index.html: the preview canvas is the 448×448 native stage',
      /<canvas id="hangar-canvas" width="448" height="448">/.test(htmlSrc));
    check('index.html: footer mode row + mode label present',
      htmlSrc.includes('id="menu-term-footer"') && htmlSrc.includes('id="menu-mode-row"') && htmlSrc.includes('id="menu-mode-label"'));
    check('index.html: the old carousel controls are gone',
      !htmlSrc.includes('id="hangar-prev"') && !htmlSrc.includes('id="hangar-next"') && !htmlSrc.includes('id="hangar-dots"'));

    // ── (3) main.js: roster generation + grid nav + mode toggle ──
    check('main.js: renderRoster() generates one cell per theme',
      mainSrc.includes('function renderRoster()') && mainSrc.includes('roster-cell'));
    check('main.js: roster cells show the callsign + status',
      mainSrc.includes('roster-callsign') && mainSrc.includes('roster-status'));
    check('main.js: hangarMove() grid-navigates with wrap (3 columns)',
      mainSrc.includes('function hangarMove(dx, dy)') &&
      mainSrc.includes('const HANGAR_COLS = 3;') &&
      mainSrc.includes('col = (col + dx + HANGAR_COLS) % HANGAR_COLS;'));
    check('main.js: TAB toggles the launch mode (CLASSIC ↔ SAR)',
      mainSrc.includes("let launchMode = 'classic';") &&
      mainSrc.includes('function toggleLaunchMode()') &&
      mainSrc.includes("setLaunchMode(launchMode === 'classic' ? 'sard' : 'classic')"));
    check('main.js: ENTER launches the ACTIVE launch mode from the menu',
      mainSrc.includes("launchMode === 'sard' ? 'sard' : undefined"));
    check('main.js: the mode buttons set the launch mode on click',
      mainSrc.includes("setLaunchMode('classic'); game.start(selectedTheme)") &&
      mainSrc.includes("setLaunchMode('sard'); game.start(selectedTheme, { mode: 'sard' })"));
    check('main.js: the digital readout strip updates per selection',
      mainSrc.includes('hangarReadout') && mainSrc.includes('ro-field'));
    check('main.js: ←↑↓→ / WASD grid-nav wired to the menu state',
      mainSrc.includes("k === 'ArrowLeft' || k === 'KeyA'") &&
      mainSrc.includes("k === 'ArrowUp' || k === 'KeyW'") &&
      mainSrc.includes("k === 'Tab'") &&
      mainSrc.includes("game.state !== 'menu'"));

    // ── (4) style.css: the terminal aesthetic ──
    check('style.css: CRT scanline overlay on #menu-screen',
      /#menu-screen::before\s*{[^}]*repeating-linear-gradient/.test(cssSrc));
    check('style.css: CRT vignette on #menu-screen',
      /#menu-screen::after\s*{[^}]*radial-gradient/.test(cssSrc));
    check('style.css: monospace font stack on the terminal',
      /#menu-screen\s*{[^}]*font-family:\s*'Cascadia Mono'/.test(cssSrc));
    check('style.css: the roster grid is a 3-column grid',
      /\.hangar-roster\s*{[^}]*grid-template-columns:\s*repeat\(3, 1fr\)/.test(cssSrc));
    check('style.css: the active roster cell is neon-highlighted',
      /\.roster-cell\.active\s*{[^}]*border-color:\s*#00e5ff/.test(cssSrc));
    check('style.css: the preview scan sweep animates',
      /#hangar-stage::after\s*{[^}]*animation:\s*term-sweep/.test(cssSrc) &&
      /@keyframes term-sweep/.test(cssSrc));
    check('style.css: the active mode button is highlighted',
      cssSrc.includes('#start-btn.mode-active') && cssSrc.includes('#sard-btn.mode-active'));
  }
}