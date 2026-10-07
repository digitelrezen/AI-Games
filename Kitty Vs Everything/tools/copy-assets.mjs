// copy-assets.mjs
// Copies ALL files from <AI-GAMES>\.assets\NEW into the active project
// asset folder <game root>\assets (resolved relative to this file).
// Raw file copy only — no code, manifest, or build changes.
//
// Usage: node tools/copy-assets.mjs

import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(__dirname, '..', '..', '.assets', 'NEW');
const DEST = path.resolve(__dirname, '..', 'assets');

if (!fs.existsSync(SRC)) {
  console.error(`Source folder not found: ${SRC}`);
  process.exit(1);
}

fs.mkdirSync(DEST, { recursive: true });

const files = fs.readdirSync(SRC).filter((f) => fs.statSync(path.join(SRC, f)).isFile());
let copied = 0;
for (const f of files) {
  fs.copyFileSync(path.join(SRC, f), path.join(DEST, f));
  copied++;
  console.log(`  copied: ${f}`);
}

console.log(`\nDone — ${copied} file(s) copied to ${DEST}`);
