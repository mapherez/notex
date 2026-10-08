import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import { collectReleaseArtifacts, prepareRelease, sha256 } from './release-artifacts.mjs';
import { publishRelease } from './tauri-release.mjs';

const config = JSON.parse(await readFile(new URL('../../src-tauri/tauri.conf.json', import.meta.url), 'utf8'));
const metadata = { version: config.version, commit: 'fixture-commit', updaterPublicKey: config.plugins.updater.pubkey };
const platformTargets = { 'windows-x86_64': 'x86_64-pc-windows-msvc', 'darwin-aarch64': 'aarch64-apple-darwin' };

async function fixture(t) {
  const tempParent = path.resolve(os.tmpdir());
  const root = await mkdtemp(path.join(tempParent, 'notex-release-test-'));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(root)), tempParent);
    assert.ok(path.basename(root).startsWith('notex-release-test-'));
    await rm(root, { recursive: true, force: true });
  });
  const raw = path.join(root, 'raw');
  for (const [name, content] of Object.entries({
    'windows/nsis/NoteX_setup.exe': 'windows installer',
    'windows/nsis/NoteX_setup.exe.sig': 'windows fixture signature',
    'windows/msi/NoteX.msi': 'msi installer',
    'windows/msi/NoteX.msi.sig': 'msi fixture signature',
    'macos/macos/NoteX.app.tar.gz': 'macos updater archive',
    'macos/macos/NoteX.app.tar.gz.sig': 'macos fixture signature',
    'macos/dmg/NoteX.dmg': 'macos installation disk image',
  })) {
    const file = path.join(raw, name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
  }
  const artifactDir = path.join(root, 'collected');
  for (const [platform, target] of Object.entries(platformTargets)) {
    await collectReleaseArtifacts({ ...metadata, platform, target,
      bundleDir: path.join(raw, platform === 'windows-x86_64' ? 'windows' : 'macos'),
      outputDir: path.join(artifactDir, platform) });
  }
  const prepare = () => prepareRelease({ ...metadata, artifactDir, repository: 'mapherez/notex', tagName: 'v-test', notes: 'Fixture notes', pubDate: '2026-10-07T00:00:00Z' });
  async function changeManifest(platform, modify) {
    const file = path.join(artifactDir, platform, 'artifact-manifest.json');
    const manifest = JSON.parse(await readFile(file, 'utf8'));
    modify(manifest);
    await writeFile(file, JSON.stringify(manifest));
  }
  return { root, raw, artifactDir, prepare, changeManifest };
}

test('explicit build targets produce both updater platforms and include an unsigned DMG', async t => {
  const { prepare } = await fixture(t);
  const { latestJson, uploadAssets } = await prepare();
  assert.deepEqual(Object.keys(latestJson.platforms).sort(), ['darwin-aarch64', 'windows-x86_64']);
  assert.equal(latestJson.platforms['darwin-aarch64'].signature, 'macos fixture signature');
  assert.ok(latestJson.platforms['darwin-aarch64'].url.endsWith('/NoteX-macos-arm64.app.tar.gz'));
  assert.ok(latestJson.platforms['windows-x86_64'].url.endsWith('/NoteX-windows-x86_64-setup.exe'));
  assert.ok(uploadAssets.some(file => file.endsWith('NoteX-macos-arm64.dmg')));
  assert.ok(uploadAssets.some(file => file.endsWith('NoteX-windows-x86_64.msi.sig')));
  assert.ok(!uploadAssets.some(file => file.endsWith('artifact-manifest.json')));
});

test('rejects mixed app versions before publishing', async t => {
  const f = await fixture(t);
  await f.changeManifest('darwin-aarch64', manifest => { manifest.version = '0.0.1'; });
  await assert.rejects(f.prepare, /does not match/);
});

test('rejects a different commit or updater public key', async t => {
  const f = await fixture(t);
  await f.changeManifest('darwin-aarch64', manifest => { manifest.commit = 'other'; });
  await assert.rejects(f.prepare, /commit mismatch/);
  await f.changeManifest('darwin-aarch64', manifest => { manifest.commit = metadata.commit; manifest.updaterPublicKey = 'rotated-key'; });
  await assert.rejects(f.prepare, /public key mismatch/);
});

test('rejects Intel macOS instead of guessing architecture from filenames', async t => {
  const f = await fixture(t);
  await f.changeManifest('darwin-aarch64', manifest => { manifest.target = 'x86_64-apple-darwin'; });
  await assert.rejects(f.prepare, /Unsupported release platform\/target/);
});

test('local preparation also requires both artefacts to come from the same commit', async t => {
  const f = await fixture(t);
  const options = { ...metadata, commit: undefined, artifactDir: f.artifactDir, repository: 'mapherez/notex', tagName: 'v-test' };
  assert.equal((await prepareRelease(options)).commit, metadata.commit);
  await f.changeManifest('darwin-aarch64', manifest => { manifest.commit = 'other-commit'; });
  await assert.rejects(() => prepareRelease(options), /commit mismatch/);
  await f.changeManifest('darwin-aarch64', manifest => { delete manifest.commit; });
  await assert.rejects(() => prepareRelease(options), /Missing release commit/);
});

test('requires both platforms, an installer and updater signatures', async t => {
  const f = await fixture(t);
  await f.changeManifest('darwin-aarch64', manifest => { manifest.assets = manifest.assets.filter(asset => !asset.name.endsWith('.dmg')); });
  await assert.rejects(f.prepare, /Missing required release asset/);
  const g = await fixture(t);
  await g.changeManifest('darwin-aarch64', manifest => { manifest.assets = manifest.assets.filter(asset => !asset.name.endsWith('.sig')); });
  await assert.rejects(g.prepare, /Missing required release asset/);
  const h = await fixture(t);
  await rm(path.join(h.artifactDir, 'darwin-aarch64/artifact-manifest.json'));
  await assert.rejects(h.prepare, /ENOENT/);
});

test('rejects tampering and unexpected stale files', async t => {
  const f = await fixture(t);
  await writeFile(path.join(f.artifactDir, 'darwin-aarch64/NoteX-macos-arm64.dmg'), 'changed');
  await assert.rejects(f.prepare, /integrity check failed/);
  const g = await fixture(t);
  await writeFile(path.join(g.artifactDir, 'darwin-aarch64/stale.sig'), 'stale');
  await assert.rejects(g.prepare, /Unexpected files/);
});

test('rejects archive/path traversal and using the DMG as an updater', async t => {
  const f = await fixture(t);
  await f.changeManifest('darwin-aarch64', manifest => { manifest.updater = '../outside.app.tar.gz'; });
  await assert.rejects(f.prepare, /Invalid installer\/updater roles/);
  await f.changeManifest('darwin-aarch64', manifest => { manifest.updater = 'NoteX-macos-arm64.dmg'; });
  await assert.rejects(f.prepare, /Invalid installer\/updater roles/);
});

test('collection rejects missing/empty signatures and ambiguous installers', async t => {
  const f = await fixture(t);
  await writeFile(path.join(f.raw, 'macos/macos/NoteX.app.tar.gz.sig'), '  \n');
  const options = { ...metadata, platform: 'darwin-aarch64', target: platformTargets['darwin-aarch64'], bundleDir: path.join(f.raw, 'macos'), outputDir: path.join(f.root, 'bad') };
  await assert.rejects(() => collectReleaseArtifacts(options), /Empty updater signature/);
  await rm(path.join(f.raw, 'macos/macos/NoteX.app.tar.gz.sig'));
  await assert.rejects(() => collectReleaseArtifacts(options), /ENOENT/);
  await writeFile(path.join(f.raw, 'windows/nsis/duplicate.exe'), 'duplicate');
  await assert.rejects(() => collectReleaseArtifacts({ ...options, platform: 'windows-x86_64', target: platformTargets['windows-x86_64'], bundleDir: path.join(f.raw, 'windows') }), /exactly one Windows NSIS installer/);
});

function githubMock({ existing = null, failUpload = false, assets = [], tagObject = null,
  listedDraft = false, initialTag, completedTag, completedDraft, repairedTag } = {}) {
  const calls = [];
  const release = { id: 123, tag_name: 'v-test', draft: true,
    upload_url: 'https://uploads.github.com/repos/mapherez/notex/releases/123/assets{?name,label}' };
  const fetchImpl = async (input, options) => {
    const url = new URL(input);
    const body = typeof options.body === 'string' ? JSON.parse(options.body) : null;
    calls.push({ method: options.method, url: url.href, body });
    if (url.hostname === 'uploads.github.com') {
      for await (const ignored of options.body) void ignored;
      return new Response('{}', { status: failUpload ? 500 : 201 });
    }
    if (options.method === 'GET' && url.pathname.includes('/releases/tags/')) return existing && !listedDraft ? Response.json(existing) : new Response(null, { status: 404 });
    if (options.method === 'GET' && url.pathname.endsWith('/releases')) return Response.json(listedDraft ? [existing] : []);
    if (options.method === 'GET' && url.pathname.includes('/git/ref/tags/')) return tagObject ? Response.json({ object: tagObject }) : new Response(null, { status: 404 });
    if (options.method === 'POST' && url.pathname.endsWith('/git/refs')) return Response.json({ ref: body.ref, object: { type: 'commit', sha: body.sha } });
    if (options.method === 'GET' && url.pathname.includes('/git/tags/')) return Response.json({ object: { type: 'commit', sha: metadata.commit } });
    if (options.method === 'GET' && url.pathname.endsWith('/assets')) return Response.json(assets);
    if (options.method === 'DELETE') return new Response(null, { status: 204 });
    if (options.method === 'POST') Object.assign(release, body, initialTag === undefined ? {} : { tag_name: initialTag });
    if (options.method === 'PATCH') {
      Object.assign(release, body);
      if ('make_latest' in body) {
        if (completedTag !== undefined) release.tag_name = completedTag;
        if (completedDraft !== undefined) release.draft = completedDraft;
      } else if (repairedTag !== undefined) release.tag_name = repairedTag;
    }
    return Response.json(release);
  };
  return { calls, fetchImpl };
}

async function publishingFixture(t) {
  const f = await fixture(t);
  const { uploadAssets, latestJson } = await f.prepare();
  const manifest = path.join(f.root, 'latest.json');
  await writeFile(manifest, JSON.stringify(latestJson));
  return { repository: 'mapherez/notex', tagName: 'v-test', version: metadata.version, token: 'fixture-token', targetCommit: metadata.commit, uploadAssets: [...uploadAssets, manifest], log: () => {} };
}

test('creates a draft, uploads latest.json last and publishes only after all uploads', async t => {
  const options = await publishingFixture(t);
  const mock = githubMock();
  await publishRelease({ ...options, fetchImpl: mock.fetchImpl });
  const createTag = mock.calls.find(call => call.method === 'POST' && call.url.endsWith('/git/refs'));
  const create = mock.calls.find(call => call.method === 'POST' && call.url.endsWith('/releases'));
  assert.equal(createTag.body.ref, 'refs/tags/v-test');
  assert.equal(createTag.body.sha, metadata.commit);
  assert.ok(mock.calls.indexOf(createTag) < mock.calls.indexOf(create));
  assert.equal(create.body.tag_name, 'v-test');
  assert.equal(create.body.draft, true);
  assert.equal(create.body.target_commitish, metadata.commit);
  const uploads = mock.calls.filter(call => call.url.startsWith('https://uploads.github.com/'));
  assert.equal(new URL(uploads.at(-1).url).searchParams.get('name'), 'latest.json');
  assert.equal(uploads.length, options.uploadAssets.length);
  assert.equal(mock.calls.at(-1).method, 'PATCH');
  assert.equal(mock.calls.at(-1).body.draft, false);
  assert.equal(mock.calls.at(-1).body.make_latest, 'true');
  assert.equal(mock.calls.at(-1).body.tag_name, 'v-test');
  assert.equal(mock.calls.at(-1).body.target_commitish, metadata.commit);
});

test('an upload failure leaves the release unpublished', async t => {
  const options = await publishingFixture(t);
  const mock = githubMock({ failUpload: true });
  await assert.rejects(() => publishRelease({ ...options, fetchImpl: mock.fetchImpl }), /GitHub upload failed/);
  assert.ok(!mock.calls.some(call => call.method === 'PATCH'));
});

test('refuses to modify a published release', async t => {
  const options = await publishingFixture(t);
  const mock = githubMock({ existing: { id: 123, draft: false } });
  await assert.rejects(() => publishRelease({ ...options, fetchImpl: mock.fetchImpl }), /already published/);
  assert.equal(mock.calls.length, 1);
  assert.equal(mock.calls[0].method, 'GET');
});

test('a retry replaces expected draft assets before publishing the complete set', async t => {
  const options = await publishingFixture(t);
  const existing = { id: 123, tag_name: 'v-test', draft: true, upload_url: 'https://uploads.github.com/repos/mapherez/notex/releases/123/assets{?name,label}' };
  const mock = githubMock({ existing, assets: [{ id: 456, name: 'latest.json' }] });
  await publishRelease({ ...options, fetchImpl: mock.fetchImpl });
  assert.ok(!mock.calls.some(call => call.method === 'POST' && call.url.endsWith('/releases')));
  const deletion = mock.calls.findIndex(call => call.method === 'DELETE');
  const upload = mock.calls.findIndex(call => call.url.includes('name=latest.json'));
  assert.ok(deletion > 0 && deletion < upload);
  assert.equal(mock.calls[deletion].url, 'https://api.github.com/repos/mapherez/notex/releases/assets/456');
  assert.equal(mock.calls.at(-1).body.draft, false);
});

test('unexpected assets in a draft stop publication without mutations', async t => {
  const options = await publishingFixture(t);
  const mock = githubMock({ existing: { id: 123, draft: true }, assets: [{ id: 456, name: 'old-intel.dmg' }] });
  await assert.rejects(() => publishRelease({ ...options, fetchImpl: mock.fetchImpl }), /unexpected assets/);
  assert.ok(mock.calls.every(call => call.method === 'GET'));
});

test('draft and prerelease runs do not mark the release latest', async t => {
  const options = await publishingFixture(t);
  for (const flags of [{ draft: true }, { prerelease: true }]) {
    const mock = githubMock();
    const release = await publishRelease({ ...options, ...flags, fetchImpl: mock.fetchImpl });
    assert.equal(mock.calls.at(-1).body.make_latest, 'false');
    assert.equal(mock.calls.at(-1).body.tag_name, 'v-test');
    assert.equal(release.tag_name, 'v-test');
    assert.equal(release.draft, flags.draft ?? false);
  }
});

test('reuses lightweight and annotated tags that point to the build commit', async t => {
  const options = await publishingFixture(t);
  for (const tagObject of [{ type: 'commit', sha: metadata.commit }, { type: 'tag', sha: 'annotated-tag' }]) {
    const mock = githubMock({ tagObject });
    await publishRelease({ ...options, fetchImpl: mock.fetchImpl });
    assert.ok(!mock.calls.some(call => call.method === 'POST' && call.url.endsWith('/git/refs')));
  }
});

test('refuses a tag pointing to a different commit without moving it or uploading', async t => {
  const options = await publishingFixture(t);
  const mock = githubMock({ tagObject: { type: 'commit', sha: 'another-commit' } });
  await assert.rejects(() => publishRelease({ ...options, fetchImpl: mock.fetchImpl }), /does not point to release commit/);
  assert.ok(mock.calls.every(call => call.method === 'GET'));
});

test('finds a retry draft through the release list when tag lookup returns 404', async t => {
  const options = await publishingFixture(t);
  const mock = githubMock({ listedDraft: true, existing: {
    id: 123, tag_name: 'v-test', draft: true,
    upload_url: 'https://uploads.github.com/repos/mapherez/notex/releases/123/assets{?name,label}',
  } });
  await publishRelease({ ...options, fetchImpl: mock.fetchImpl });
  assert.ok(!mock.calls.some(call => call.method === 'POST' && call.url.endsWith('/releases')));
});

test('binds a placeholder to the real tag while still a draft before uploading', async t => {
  const options = await publishingFixture(t);
  const mock = githubMock({ initialTag: 'untagged-placeholder' });
  const release = await publishRelease({ ...options, fetchImpl: mock.fetchImpl });
  const repair = mock.calls.findIndex(call => call.method === 'PATCH');
  const upload = mock.calls.findIndex(call => call.url.startsWith('https://uploads.github.com/'));
  assert.ok(repair < upload);
  assert.equal(mock.calls[repair].body.tag_name, 'v-test');
  assert.equal(mock.calls[repair].body.draft, true);
  assert.equal(release.tag_name, 'v-test');
  assert.equal(release.draft, false);
});

test('fails before uploads if GitHub does not retain the draft tag', async t => {
  const options = await publishingFixture(t);
  const mock = githubMock({ initialTag: 'untagged-placeholder', repairedTag: 'untagged-placeholder' });
  await assert.rejects(() => publishRelease({ ...options, fetchImpl: mock.fetchImpl }), /did not retain draft tag/);
  assert.ok(!mock.calls.some(call => call.url.startsWith('https://uploads.github.com/')));
});

test('fails instead of reporting success when GitHub returns the wrong final tag or draft state', async t => {
  const options = await publishingFixture(t);
  for (const draft of [false, true]) {
    for (const response of [{ completedTag: 'untagged-placeholder' }, { completedDraft: !draft }]) {
      const mock = githubMock(response);
      await assert.rejects(() => publishRelease({ ...options, draft, fetchImpl: mock.fetchImpl }), /did not retain release tag\/state/);
    }
  }
});

test('rejects a missing build commit or placeholder tag before API calls', async t => {
  const options = await publishingFixture(t);
  for (const invalid of [{ targetCommit: undefined }, { tagName: 'untagged-placeholder' }]) {
    const mock = githubMock();
    await assert.rejects(() => publishRelease({ ...options, ...invalid, fetchImpl: mock.fetchImpl }), /Missing release commit|Invalid release tag/);
    assert.equal(mock.calls.length, 0);
  }
});

test('CLI dry run writes both platforms and does not use GitHub even with a token', async t => {
  const f = await fixture(t);
  const noNetwork = path.join(f.root, 'no-network.mjs');
  await writeFile(noNetwork, 'globalThis.fetch = () => { throw new Error("Network is forbidden in dry-run tests"); };');
  const cli = new URL('./tauri-release.mjs', import.meta.url);
  const output = path.join(f.root, 'metadata');
  const result = await promisify(execFile)(process.execPath, ['--import', pathToFileURL(noNetwork).href, fileURLToPath(cli), '--dry-run', '--repo', 'mapherez/notex', '--artifact-dir', f.artifactDir, '--output-dir', output], {
    env: { ...process.env, GITHUB_SHA: metadata.commit, GITHUB_TOKEN: 'fixture-token', RELEASE_VERSION: metadata.version },
  });
  assert.match(result.stdout, /no GitHub API calls/);
  const manifest = JSON.parse(await readFile(path.join(output, 'latest.json'), 'utf8'));
  assert.deepEqual(Object.keys(manifest.platforms).sort(), ['darwin-aarch64', 'windows-x86_64']);
  assert.equal(await sha256(path.join(f.artifactDir, 'darwin-aarch64/NoteX-macos-arm64.dmg')), (JSON.parse(await readFile(path.join(f.artifactDir, 'darwin-aarch64/artifact-manifest.json'), 'utf8'))).assets.find(asset => asset.name.endsWith('.dmg')).sha256);
});
