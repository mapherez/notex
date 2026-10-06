import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { updateNoxMcp } from './update-nox-mcp.mjs';

const latestUrl = 'https://github.com/mapherez/nox-mcp/releases/download/v9.0.0/nox-mcp.tgz';

async function fixture(t) {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'notex-nox-update-'));
  t.after(() => rm(rootDir, { recursive: true, force: true }));
  const manifests = {
    'package.json': { workspaces: ['backend', 'packages/*', 'landing'], dependencies: { '@nox/mcp': 'old', react: '^18.3.1' } },
    'backend/package.json': { dependencies: { '@nox/mcp': 'old', '@notex/mcp-contract': '0.1.0' } },
    'packages/notex-mcp-contract/package.json': { dependencies: { '@nox/mcp': 'old' } },
    'packages/dev-tools/package.json': { devDependencies: { '@nox/mcp': 'old' }, peerDependencies: { '@nox/mcp': 'old' } },
    'landing/package.json': { devDependencies: { marked: '18.0.13' } },
  };
  for (const [relative, manifest] of Object.entries(manifests)) {
    const file = path.join(rootDir, relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(manifest, null, 2) + '\n');
  }
  return { rootDir, manifests };
}

function latestRelease() {
  return { ok: true, json: async () => ({ tag_name: 'v9.0.0', assets: [{ name: 'nox-mcp.tgz', browser_download_url: latestUrl }] }) };
}

test('discovers latest, updates only consumers, and installs exactly once at root', async (t) => {
  const { rootDir, manifests } = await fixture(t);
  const installs = [];
  const result = await updateNoxMcp({
    rootDir,
    fetchRelease: async (url) => {
      assert.equal(url, 'https://api.github.com/repos/mapherez/nox-mcp/releases/latest');
      return latestRelease();
    },
    install: async (directory) => {
      installs.push(directory);
      // All consumers must be updated before installing.
      for (const [relative, original] of Object.entries(manifests)) {
        const actual = JSON.parse(await readFile(path.join(rootDir, relative), 'utf8'));
        const expected = structuredClone(original);
        for (const section of ['dependencies', 'devDependencies', 'peerDependencies']) {
          if (expected[section]?.['@nox/mcp']) expected[section]['@nox/mcp'] = latestUrl;
        }
        assert.deepEqual(actual, expected);
      }
    },
  });
  assert.deepEqual(installs, [rootDir]);
  assert.equal(result.updatedPackages.length, 4);
  const repeat = await updateNoxMcp({ rootDir, fetchRelease: async () => latestRelease(), install: async (directory) => installs.push(directory) });
  assert.deepEqual(repeat.updatedPackages, []);
  assert.deepEqual(installs, [rootDir, rootDir]);
});

test('failed release requests and missing assets leave manifests untouched and do not install', async (t) => {
  const { rootDir, manifests } = await fixture(t);
  for (const response of [{ ok: false, status: 503 }, { ok: true, json: async () => ({ assets: [] }) }]) {
    await assert.rejects(updateNoxMcp({
      rootDir,
      fetchRelease: async () => response,
      install: async () => assert.fail('Must not install without a valid release'),
    }));
  }
  for (const [relative, original] of Object.entries(manifests)) {
    assert.deepEqual(JSON.parse(await readFile(path.join(rootDir, relative), 'utf8')), original);
  }
});
