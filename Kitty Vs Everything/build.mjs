// Filename: build.mjs
// Kitty Vs Everything — single-file build script
//
// Packages the whole project (index.html + style.css + the entire ES-module
// graph starting at main.js) into ONE self-contained
// "Kitty Vs Everything <version>.html" file in the external Builds folder
// (C:\AI-Games\Builds with the standard layout) — no server needed.
//
// Usage:
//   node build.mjs            → Builds\Kitty Vs Everything <ver>.html (readable)
//   node build.mjs --minify   → same, but minified (smaller file)
//
// How it works:
//   1. esbuild bundles main.js + every module it imports (transitively)
//      into a single IIFE in memory.
//   2. style.css is read and inlined into a <style> tag.
//   3. Both are spliced into a copy of index.html, replacing the
//      <link> and <script type="module"> tags.
//   4. The result is written to the Builds folder as
//      "Kitty Vs Everything <version>.html" — <version> is read from
//      package.json. The folder is created automatically if missing, so
//      the (large) standalone files never live in the project workspace.

import { build } from 'esbuild';
import { readFileSync, writeFileSync, statSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const ENTRY = 'js/core/main.js';
const HTML = 'index.html';
const CSS = 'style.css';
const minify = process.argv.includes('--minify');

// ── Output location: external Builds folder (kept OUT of the project) ──────
// Resolves to C:\AI-Games\Builds with the standard layout (the project lives
// at C:\AI-Games\Kitty Vs Everything). Created automatically if missing.
const BUILD_DIR = path.resolve(ROOT, '..', 'Builds');
// Version is pulled dynamically from package.json (the source of truth).
const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const OUT_NAME = `Kitty Vs Everything ${pkg.version}.html`;
const OUT = path.join(BUILD_DIR, OUT_NAME);
mkdirSync(BUILD_DIR, { recursive: true });

// ── 1) Bundle the ES module graph ─────────────────────────────────────────
const result = await build({
  entryPoints: [path.join(ROOT, ENTRY)],
  bundle: true,
  format: 'iife',        // one self-executing function — no module resolution needed
  write: false,          // keep output in memory
  minify,
  target: ['es2020'],    // anything evergreen; the game uses no newer features
  logLevel: 'warning',
});
const js = result.outputFiles[0].text;

// ── 2) Inline the CSS ─────────────────────────────────────────────────────
const css = readFileSync(path.join(ROOT, CSS), 'utf8');

// ── 3) Splice into a copy of index.html ───────────────────────────────────
let html = readFileSync(path.join(ROOT, HTML), 'utf8');

const cssTag = `<link rel="stylesheet" href="${CSS}" />`;
if (!html.includes(cssTag)) {
  throw new Error(`Could not find ${JSON.stringify(cssTag)} in ${HTML} — is the source layout unchanged?`);
}
html = html.replace(cssTag, `<style>\n${css}\n</style>`);

const scriptTag = `<script type="module" src="${ENTRY}"></script>`;
if (!html.includes(scriptTag)) {
  throw new Error(`Could not find ${JSON.stringify(scriptTag)} in ${HTML} — is the source layout unchanged?`);
}
html = html.replace(scriptTag, `<script>\n${js}\n</script>`);

// Stamp the output so it's obvious this file is generated.
html = html.replace(
  '<head>',
  `<head>\n  <!-- Built by build.mjs — single-file standalone build. Rebuild with: node build.mjs -->`
);

// ── 4) Write the standalone file (external Builds folder) ──────────────────
writeFileSync(OUT, html);

const kb = (bytes) => (bytes / 1024).toFixed(1) + ' KB';
console.log(`✔ Built ${OUT}`);
console.log(`  JS bundle : ${kb(Buffer.byteLength(js))}${minify ? ' (minified)' : ' (readable)'}`);
console.log(`  CSS       : ${kb(Buffer.byteLength(css))}`);
console.log(`  Total     : ${kb(statSync(OUT).size)}`);
console.log('  → Share this one file; it runs from a double-click, no server needed.');
