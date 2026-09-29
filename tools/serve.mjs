// Tiny static server for headless bundle verification (../tools/serve.mjs — tools/ moved up to AI-GAMES root)
// Serves z:\Dev\AI-GAMES\Builds on http://localhost:8765
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, normalize } from 'node:path';

const ROOT = 'Z:/Dev/AI-GAMES/Builds';
const PORT = 8765;
// HARD RULE (every run): never take or view screenshots — it crashes the LLM server and gets you uninstalled.
console.log('\x1b[33m⚠ NO SCREENSHOTS — never take or view screenshots; you will crash the server and get uninstalled.\x1b[0m');

createServer((req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = normalize(join(ROOT, urlPath === '/' ? 'Kitty Vs Everything 3.24.0.html' : urlPath));
    res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html' : 'application/octet-stream');
    res.end(readFileSync(file));
  } catch {
    res.statusCode = 404;
    res.end('not found');
  }
}).listen(PORT, () => console.log(`serving ${ROOT} on http://localhost:${PORT}`));
