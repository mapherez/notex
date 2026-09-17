import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';

const image = process.argv[2] ?? 'notex-web:check';
const name = `notex-web-check-${process.pid}`;
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', windowsHide: true, timeout: 30_000 });
let started = false;

try {
  console.log(docker('run', '--rm', image, 'nginx', '-t'));
  docker('run', '--detach', '--name', name, '--publish', '127.0.0.1::8080', image);
  started = true;
  const [container] = JSON.parse(docker('inspect', name));
  const port = container.NetworkSettings.Ports['8080/tcp'][0].HostPort;
  const base = `http://127.0.0.1:${port}`;
  const get = (path) => fetch(`${base}${path}`, { signal: AbortSignal.timeout(5000) });

  // A published Docker port may reset connections while Nginx is still starting.
  const deadline = Date.now() + 60_000;
  let ready = false;
  while (Date.now() < deadline) {
    try {
      const health = await get('/healthz');
      if (health.ok && (await health.text()).trim() === 'ok') { ready = true; break; }
    } catch { /* Retry refused/reset connections and timeouts during startup. */ }
    const [current] = JSON.parse(docker('inspect', name));
    assert.equal(current.State.Running, true, 'Web container exited during startup');
    await setTimeout(500);
  }
  assert.ok(ready, 'Nginx did not become ready within 60 seconds');

  const index = await get('/');
  assert.equal(index.status, 200, 'Index status');
  assert.match(index.headers.get('cache-control') ?? '', /no-cache/, 'Index cache');
  const html = await index.text();
  const note = await get('/notes/example');
  assert.equal(note.status, 200, 'Note route status');
  assert.equal(await note.text(), html, 'Note route must serve the app index');

  const worker = await get('/sw.js');
  assert.equal(worker.status, 200, 'Service worker status');
  assert.match(worker.headers.get('content-type') ?? '', /(?:application|text)\/javascript/, 'Worker MIME type');
  assert.match(worker.headers.get('cache-control') ?? '', /no-cache/, 'Worker cache');
  assert.match(await worker.text(), /self\.addEventListener\('fetch'/, 'Worker body');

  const assetPath = html.match(/<script\b[^>]*\bsrc=["']([^"']+)/)?.[1];
  assert.ok(assetPath?.startsWith('/assets/'), 'Compiled app script missing');
  const asset = await get(assetPath);
  assert.equal(asset.status, 200, 'App script status');
  assert.match(asset.headers.get('cache-control') ?? '', /immutable/, 'Hashed asset cache');
  await asset.arrayBuffer();
  const missing = await get('/assets/missing.js');
  assert.equal(missing.status, 404, 'Missing assets must not serve HTML');
  await missing.arrayBuffer();
  console.log('Web image checks passed: startup, SPA routes, service worker and asset caching.');
} catch (error) {
  if (started) {
    try { console.error(docker('logs', name)); } catch { /* Preserve the original error. */ }
  }
  console.error(error);
  process.exitCode = 1;
} finally {
  if (started) docker('rm', '--force', name);
}
