// Serveur local : sert www/ et exécute les fonctions de api/ comme le ferait Vercel.
// Usage : node scripts/serve.mjs [port]   (port 3000 par défaut)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import zlib from 'node:zlib';
import { loadEnv } from './env.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadEnv(root);
const www = path.join(root, 'www');
const port = Number(process.argv[2] || process.env.PORT || 3000);
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};

async function handleApi(req, res, url) {
  const name = url.pathname.replace(/^\/api\//, '').replace(/\/$/, '');
  const file = path.join(root, 'api', `${name}.js`);
  if (!/^[a-z0-9-]+$/.test(name) || !fs.existsSync(file)) return send(res, 404, 'Not found');
  const mod = await import(pathToFileURL(file).href);
  const handler = mod[req.method] || mod.default?.fetch;
  if (!handler) return send(res, 405, 'Method not allowed');
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);
  const request = new Request(`http://localhost:${port}${req.url}`, {
    method: req.method,
    headers: req.headers,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
  });
  const response = await handler(request);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}

function send(res, status, text) {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
  res.end(text);
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${port}`);
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    let p = decodeURIComponent(url.pathname);
    if (p.endsWith('/')) p += 'index.html';
    let file = path.normalize(path.join(www, p));
    if (!file.startsWith(www)) return send(res, 403, 'Forbidden');
    if (!fs.existsSync(file) && fs.existsSync(file + '.html')) file += '.html';
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, 'Not found');
    const ext = path.extname(file);
    const headers = { 'content-type': types[ext] || 'application/octet-stream', 'cache-control': 'no-cache' };
    // Compression comme sur Vercel (brotli/gzip) pour les textes, afin que les mesures soient réalistes.
    if (['.html', '.js', '.css', '.json', '.svg', '.webmanifest', '.txt'].includes(ext)) {
      const accept = String(req.headers['accept-encoding'] || '');
      const raw = fs.readFileSync(file);
      if (/\bbr\b/.test(accept)) { res.writeHead(200, { ...headers, 'content-encoding': 'br', vary: 'Accept-Encoding' }); return res.end(zlib.brotliCompressSync(raw)); }
      if (/\bgzip\b/.test(accept)) { res.writeHead(200, { ...headers, 'content-encoding': 'gzip', vary: 'Accept-Encoding' }); return res.end(zlib.gzipSync(raw)); }
    }
    res.writeHead(200, headers);
    fs.createReadStream(file).pipe(res);
  } catch (err) {
    console.error(err);
    send(res, 500, 'Server error');
  }
}).listen(port, () => console.log(`Tarikh local : http://localhost:${port}`));
