import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fingerprintAssets } from './fingerprint.mjs';
import { cleanHtmlLinks, cleanPageLink, legacyRedirect, staticFile } from './urls.mjs';

test('page URLs retain queries and fragments without changing external links', () => {
  assert.equal(cleanPageLink('../index.html#features', '/docs/quickstart'), '/#features');
  assert.equal(cleanPageLink('./index.html', '/docs/quickstart'), '/docs/');
  assert.equal(cleanPageLink('quickstart.html?from=guide#first-note', '/docs/'), '/docs/quickstart?from=guide#first-note');
  assert.equal(cleanPageLink('https://example.com/index.html'), 'https://example.com/index.html');
  assert.equal(legacyRedirect('/docs/index.html'), '/docs/');
  assert.equal(legacyRedirect('/app/index.html'), null);
  assert.equal(staticFile('/docs/quickstart'), '/docs/quickstart.html');
  assert.equal(staticFile('/docs/'), '/docs/index.html');
  assert.equal(cleanHtmlLinks('<a href="./privacy.html">Privacy</a>', '/index.html'), '<a href="/privacy">Privacy</a>');
});

test('changed dependencies invalidate their parents while unrelated assets keep their URLs', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'notex-fingerprints-'));
  try {
    async function build(folder, font, search) {
      const directory = path.join(base, folder);
      await mkdir(directory, { recursive: true });
      await writeFile(path.join(directory, 'font.woff2'), font);
      await writeFile(path.join(directory, 'fonts.css'), '@font-face { src: url(./font.woff2); }');
      await writeFile(path.join(directory, 'site.js'), 'console.log("unchanged");');
      await writeFile(path.join(directory, 'search.json'), JSON.stringify(search));
      await writeFile(path.join(directory, 'index.html'), '<link href="./fonts.css"><script src="./site.js"></script><search data-index-url="./search.json"></search><a href="https://example.com/a.css">External</a>');
      return { directory, manifest: await fingerprintAssets(directory) };
    }
    const first = await build('first', 'font-v1', ['old']);
    const repeat = await build('repeat', 'font-v1', ['old']);
    const changed = await build('changed', 'font-v2', ['new']);
    assert.deepEqual(first.manifest, repeat.manifest, 'Identical inputs must generate identical URLs');
    assert.notEqual(first.manifest.get('/font.woff2'), changed.manifest.get('/font.woff2'));
    assert.notEqual(first.manifest.get('/fonts.css'), changed.manifest.get('/fonts.css'));
    assert.notEqual(first.manifest.get('/search.json'), changed.manifest.get('/search.json'));
    assert.equal(first.manifest.get('/site.js'), changed.manifest.get('/site.js'));
    const html = await readFile(path.join(changed.directory, 'index.html'), 'utf8');
    assert.ok(html.includes(`data-index-url="${changed.manifest.get('/search.json')}"`));
    assert.ok(html.includes('href="https://example.com/a.css"'));
    const css = await readFile(path.join(changed.directory, changed.manifest.get('/fonts.css')), 'utf8');
    assert.ok(css.includes(changed.manifest.get('/font.woff2')));
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});
