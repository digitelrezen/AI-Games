import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 8787;
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png',
  '.js': 'text/plain; charset=utf-8',
  '.mjs': 'text/plain; charset=utf-8',
};
http
  .createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p === '/') p = '/preview.html';
      const file = normalize(join(__dirname, p));
      const data = await readFile(file);
      res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' });
      res.end(data);
    } catch (e) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found: ' + req.url);
    }
  })
  .listen(PORT, () => console.log('ship-preview listening on ' + PORT));
