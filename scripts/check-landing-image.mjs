import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';

const image = process.argv[2] ?? 'notex-landing:check';
const name = `notex-landing-check-${process.pid}`;
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', windowsHide: true, timeout: 30_000 });
let started = false;

try {
  console.log(docker('run', '--rm', image, 'nginx', '-t'));
  docker('run', '--detach', '--name', name, '--publish', '127.0.0.1::8080', image);
  started = true;
  const [container] = JSON.parse(docker('inspect', name));
  const port = container.NetworkSettings.Ports['8080/tcp'][0].HostPort;
  const base = `http://127.0.0.1:${port}`;
  const get = (path, options = {}) => fetch(`${base}${path}`, { ...options, signal: AbortSignal.timeout(5000) });

  const deadline = Date.now() + 60_000;
  let ready = false;
  while (Date.now() < deadline) {
    try {
      const health = await get('/healthz');
      if (health.ok && (await health.text()).trim() === 'ok') { ready = true; break; }
    } catch { /* Retry while Nginx and the published port start. */ }
    const [current] = JSON.parse(docker('inspect', name));
    assert.equal(current.State.Running, true, 'Landing container exited during startup');
    await setTimeout(500);
  }
  assert.ok(ready, 'Nginx did not become ready within 60 seconds');

  for (const path of ['/', '/index.html', '/docs/', '/privacy.html', '/terms.html']) {
    const response = await get(path);
    assert.equal(response.status, 200, `Page status: ${path}`);
    assert.match(response.headers.get('content-type') ?? '', /text\/html/, `Page MIME: ${path}`);
    assert.match(response.headers.get('cache-control') ?? '', /no-cache/, `Page cache: ${path}`);
    const html = await response.text();
    assert.match(html, /<h1\b/, `Page content: ${path}`);
    if (path === '/') {
      assert.ok(html.includes('https://notex.mapherez.com/download'), 'Preserve worker download URL');
      assert.ok(html.includes('https://notex.mapherez.com/app/'), 'Preserve webapp URL');
    }
  }

  const redirect = await get('/docs', { redirect: 'manual' });
  assert.equal(redirect.status, 301, 'Docs directory redirect');
  assert.equal(redirect.headers.get('location'), '/docs/', 'Relative docs redirect behind HTTPS proxy');
  await redirect.arrayBuffer();

  const search = await get('/docs/search-index.json');
  assert.equal(search.status, 200, 'Search index status');
  const articles = await search.json();
  assert.ok(articles.length > 0, 'Search index must contain articles');
  for (const article of articles) {
    const response = await get(new URL(article.href, `${base}/docs/`).pathname);
    assert.equal(response.status, 200, `Article status: ${article.href}`);
    assert.match(await response.text(), /<h1\b/, `Article content: ${article.href}`);
  }

  for (const [path, mime] of [
    ['/styles.css', /text\/css/],
    ['/home.css', /text\/css/],
    ['/shell.css', /text\/css/],
    ['/site.js', /(?:application|text)\/javascript/],
    ['/theme.js', /(?:application|text)\/javascript/],
    ['/docs/docs.css', /text\/css/],
    ['/docs/docs.js', /(?:application|text)\/javascript/],
    ['/assets/brand/notex-light.svg', /image\/svg\+xml/],
    ['/assets/notex-mark.svg', /image\/svg\+xml/],
    ['/sitemap.xml', /(?:application|text)\/xml/],
    ['/robots.txt', /text\/plain/],
  ]) {
    const response = await get(path);
    assert.equal(response.status, 200, `Asset status: ${path}`);
    assert.match(response.headers.get('content-type') ?? '', mime, `Asset MIME: ${path}`);
    assert.match(response.headers.get('cache-control') ?? '', /no-cache/, `Asset cache: ${path}`);
    await response.arrayBuffer();
  }

  // Worker/app paths are deliberately absent at this independent origin.
  for (const path of ['/app', '/app/', '/app/notes/example', '/download', '/missing', '/docs/missing.html', '/assets/missing.js', '/50x.html']) {
    const response = await get(path);
    assert.equal(response.status, 404, `Missing route must not return landing HTML: ${path}`);
    await response.arrayBuffer();
  }
  console.log(`Landing image checks passed: ${articles.length} articles, assets, cache, redirects and independent routing.`);
} catch (error) {
  if (started) {
    try { console.error(docker('logs', name)); } catch { /* Preserve the original error. */ }
  }
  console.error(error);
  process.exitCode = 1;
} finally {
  if (started) docker('rm', '--force', name);
}
