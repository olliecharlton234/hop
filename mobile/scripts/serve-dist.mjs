// Preview the production web build locally, with the same routing and caching rules as
// vercel.json: real files first, every other path falls back to index.html (so /outing/abc
// works on refresh). Usage: npm run build:web && npm run serve:web  → http://localhost:8099
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const port = Number(process.env.PORT || 8099);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.map': 'application/json' };
const cache = (p) => (p.startsWith('/_expo/static/') || p.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : p === '/sw.js' || p.endsWith('.html') ? 'no-cache' : 'public, max-age=3600');

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = normalize(join(root, path));
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html'); } catch { file = join(root, 'index.html'); }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': cache(file === join(root, 'index.html') ? '/index.html' : path) });
    res.end(body);
  } catch { res.writeHead(404).end('Not found'); }
}).listen(port, () => console.log(`HOP web build on http://localhost:${port}`));
