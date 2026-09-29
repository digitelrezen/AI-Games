// build-grid.mjs — Everything Vs Kitty (sandbox scratchpad)
// Builds the 28×28 "Adopt Me!" WANTED-poster pixel grid.
// Shared by generate-poster.mjs (renders PNG) and test-poster.mjs (asserts).
//
// The sprite is 28×28 so it lines up EXACTLY with the PowerUp 'mini' hitbox
// (radius 14 → a 28×28 square centered on the drop's origin).

export const W = 28, H = 28;

// ─── Palette ────────────────────────────────────────────────────────────────
// '.' = transparent. Every other key maps to an RGBA tuple.
export const PALETTE = {
  '.': null,
  B: [78, 52, 46, 255],     // poster border — dark brown
  P: [232, 213, 163, 255],  // poster paper — aged cream
  W: [78, 52, 46, 255],     // "WANTED" ink — dark brown
  C: [255, 157, 59, 255],   // cat fur — orange (matches the old mini icon)
  E: [45, 27, 14, 255],     // cat eyes — near-black
  N: [141, 74, 58, 255],    // cat nose — dark rose
  R: [55, 71, 79, 255],     // cage bars — dark slate
  M: [198, 40, 40, 255],    // "ADOPT ME!" ink — red
};

// ─── 3×5 pixel font (proportional: '!' and space are 1px wide) ──────────────
export const FONT = {
  A: ['010', '101', '111', '101', '101'],
  D: ['110', '101', '101', '101', '110'],
  E: ['111', '100', '110', '100', '111'],
  M: ['101', '111', '111', '101', '101'],
  N: ['101', '111', '101', '101', '101'],
  O: ['010', '101', '101', '101', '010'],
  P: ['110', '101', '110', '100', '100'],
  T: ['111', '010', '010', '010', '010'],
  W: ['101', '101', '101', '111', '101'],
  '!': ['1', '1', '1', '0', '1'],
  ' ': [' ', ' ', ' ', ' ', ' '],
};

// Layout constants (rows/cols) — exported so the test can assert on them.
export const LAYOUT = {
  wanted: { y: 2, x: 5, text: 'WANTED' },        // rows 2–6
  cat: { y0: 8, y1: 17 },                        // rows 8–17
  bars: { cols: [6, 11, 16, 21], y0: 8, y1: 17 },
  adopt: { y: 19, x: 2, text: 'ADOPT ME!' },     // rows 19–23
};

export function buildGrid() {
  const grid = Array.from({ length: H }, () => Array(W).fill('.'));
  const set = (x, y, ch) => {
    if (x >= 0 && x < W && y >= 0 && y < H) grid[y][x] = ch;
  };
  const drawText = (str, x, y, ch) => {
    let cx = x;
    for (const c of str) {
      const glyph = FONT[c];
      if (!glyph) throw new Error('no glyph for ' + JSON.stringify(c));
      for (let gy = 0; gy < 5; gy++) {
        for (let gx = 0; gx < glyph[gy].length; gx++) {
          if (glyph[gy][gx] === '1') set(cx + gx, y + gy, ch);
        }
      }
      cx += glyph[0].length;
    }
    return cx;
  };

  // 1) Paper + border
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const edge = x === 0 || y === 0 || x === W - 1 || y === H - 1;
      set(x, y, edge ? 'B' : 'P');
    }
  }

  // 2) "WANTED" header (rows 2–6, centered)
  {
    const { text } = LAYOUT.wanted;
    const width = text.length * 3; // 18px
    const x0 = Math.floor((W - width) / 2);
    drawText(text, x0, LAYOUT.wanted.y, 'W');
  }

  // 3) Cat face (rows 8–17)
  {
    const headRows = [
      [6, 21], // row 10
      [5, 22], // row 11
      [5, 22], // row 12
      [5, 22], // row 13
      [5, 22], // row 14
      [5, 22], // row 15
      [6, 21], // row 16
      [7, 20], // row 17
    ];
    headRows.forEach(([x0, x1], i) => {
      const y = 10 + i;
      for (let x = x0; x <= x1; x++) set(x, y, 'C');
    });
    // ears (rows 8–9)
    for (let x = 7; x <= 9; x++) set(x, 9, 'C');
    for (let x = 18; x <= 20; x++) set(x, 9, 'C');
    set(8, 8, 'C');
    set(19, 8, 'C');
    // eyes (2×2) rows 11–12
    for (const ex of [8, 18]) {
      set(ex, 11, 'E'); set(ex + 1, 11, 'E');
      set(ex, 12, 'E'); set(ex + 1, 12, 'E');
    }
    // nose (2×1) row 14
    set(13, 14, 'N'); set(14, 14, 'N');
  }

  // 4) Cage bars (rows 8–17) — drawn OVER the cat, avoiding the eyes/nose.
  for (const bx of LAYOUT.bars.cols) {
    for (let y = LAYOUT.bars.y0; y <= LAYOUT.bars.y1; y++) set(bx, y, 'R');
  }

  // 5) "ADOPT ME!" footer (rows 19–23, centered)
  {
    const { text } = LAYOUT.adopt;
    // width: A D O P T (5×3) + space (1) + M E (2×3) + ! (1) = 24px
    const width = 24;
    const x0 = Math.floor((W - width) / 2);
    drawText(text, x0, LAYOUT.adopt.y, 'M');
  }

  return grid;
}
