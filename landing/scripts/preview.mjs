import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { immutableAsset, legacyRedirect, staticFile } from './urls.mjs';

const root = path.resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
try { await stat(path.join(root, 'index.html')); } catch { throw new Error('Build the website first: npm --prefix landing run build'); }
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain' };
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    const redirect = legacyRedirect(pathname);
    if (redirect) {
      response.writeHead(308, { Location: `${redirect}${url.search}`, 'Cache-Control': 'no-cache' }).end();
      return;
    }
    const filename = path.resolve(root, `.${staticFile(pathname)}`);
    if (!filename.startsWith(`${root}${path.sep}`) && filename !== path.join(root, 'index.html')) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    const data = await readFile(filename);
    response.writeHead(200, { 'Content-Type': types[path.extname(filename)] ?? 'application/octet-stream', 'Cache-Control': immutableAsset.test(pathname) ? 'public, max-age=31536000, immutable' : 'no-cache' }).end(data);
  } catch {
    response.writeHead(404).end('Page not found');
  }
});
server.listen(Number(process.env.PORT ?? 4174), '127.0.0.1', () => console.log(`NoteX website: http://127.0.0.1:${server.address().port}`));
