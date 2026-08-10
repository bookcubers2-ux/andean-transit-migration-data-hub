/* Servidor estatico minimo, cero dependencias.  node tools/serve.mjs [puerto]
   El tablero tambien funciona abriendo dashboard/index.html directamente.
   Este servidor existe solo para revisarlo comodamente en el navegador. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dashboard');
const PORT = Number(process.argv[2] || 8642);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
               '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml' };

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(ROOT, url === '/' ? 'index.html' : url);
  if (!path.resolve(file).startsWith(path.resolve(ROOT))) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain' }).end('404 ' + url); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream',
                         'cache-control': 'no-cache' });
    res.end(buf);
  });
}).listen(PORT, () => console.log(`ATMDH -> http://localhost:${PORT}`));
