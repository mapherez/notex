import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const root = new URL('../dist/', import.meta.url);
async function files(directory, prefix = '') {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = `${prefix}${entry.name}`;
    if (entry.isDirectory()) result.push(...await files(join(directory, entry.name), `${relative}/`));
    else if (entry.name !== 'sw.js') result.push(relative);
  }
  return result;
}
const { fileURLToPath } = await import('node:url');
const assets = await files(fileURLToPath(root));
const revision = createHash('sha256').update(await readFile(new URL('index.html', root))).digest('hex').slice(0, 16);
await writeFile(new URL('sw.js', root), `
const CACHE = 'notex-shell-${revision}';
const ASSETS = ${JSON.stringify(assets)};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS.map(path => new URL(path, self.registration.scope).href))));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('notex-shell-') && key !== CACHE).map(key => caches.delete(key)))));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  if (event.request.mode === 'navigate') {
    // Serve HTML from the same installed release as the cached JS/CSS. The
    // next worker takes over once old tabs close, without mixing releases.
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(new URL('index.html', self.registration.scope).href)) || fetch(event.request)));
    return;
  }
  event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(event.request)) || fetch(event.request)));
});
`);
