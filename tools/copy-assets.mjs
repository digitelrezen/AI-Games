// copy-assets.mjs
// Copies ALL files from C:\Dev\AI-GAMES\.assets\NEW into the active
// project asset folder C:\Dev\AI-GAMES\Kitty Vs Everything\assets.
// Raw file copy only — no code, manifest, or build changes.
//
// Usage: node tools/copy-assets.mjs

import fs from 'node:fs';
import path from 'node:path';

const SRC = 'C:\\Dev\\AI-GAMES\\.assets\\NEW';
const DEST = 'C:\\Dev\\AI-GAMES\\Kitty Vs Everything\\assets';

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
