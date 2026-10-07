import { createReadStream } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

export const releaseTargets = Object.freeze({
  'windows-x86_64': 'x86_64-pc-windows-msvc',
  'darwin-aarch64': 'aarch64-apple-darwin',
});

export async function sha256(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

async function filesIn(directory) {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    return entries.filter(entry => entry.isFile()).map(entry => path.join(directory, entry.name));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

function only(files, suffix, label) {
  const matches = files.filter(file => file.toLowerCase().endsWith(suffix));
  if (matches.length !== 1) throw new Error(`Expected exactly one ${label}; found ${matches.length}.`);
  return matches[0];
}

function validatePlatform(platform, target) {
  if (!Object.hasOwn(releaseTargets, platform) || releaseTargets[platform] !== target) {
    throw new Error(`Unsupported release platform/target: ${platform} / ${target}.`);
  }
}

// Each build supplies its target explicitly. Filenames never determine architecture.
export async function collectReleaseArtifacts({ bundleDir, outputDir, platform, target, version, commit, updaterPublicKey }) {
  validatePlatform(platform, target);
  const copies = [];
  let updater;
  let installer;
  if (platform === 'windows-x86_64') {
    const nsis = await filesIn(path.join(bundleDir, 'nsis'));
    const msi = await filesIn(path.join(bundleDir, 'msi'));
    updater = installer = 'NoteX-windows-x86_64-setup.exe';
    copies.push([only(nsis, '.exe', 'Windows NSIS installer'), installer]);
    for (const file of msi.filter(file => file.toLowerCase().endsWith('.msi'))) {
      copies.push([file, 'NoteX-windows-x86_64.msi']);
    }
  } else {
    const macos = await filesIn(path.join(bundleDir, 'macos'));
    const dmg = await filesIn(path.join(bundleDir, 'dmg'));
    updater = 'NoteX-macos-arm64.app.tar.gz';
    installer = 'NoteX-macos-arm64.dmg';
    copies.push([only(macos, '.app.tar.gz', 'macOS updater archive'), updater]);
    copies.push([only(dmg, '.dmg', 'macOS DMG installer'), installer]);
  }

  const signedCopies = [];
  for (const [source, name] of copies) {
    signedCopies.push([source, name]);
    if (name.endsWith('.exe') || name.endsWith('.msi') || name.endsWith('.app.tar.gz')) {
      const signature = `${source}.sig`;
      if (!(await readFile(signature, 'utf8')).trim()) throw new Error(`Empty updater signature: ${signature}`);
      signedCopies.push([signature, `${name}.sig`]);
    }
  }
  const names = signedCopies.map(([, name]) => name);
  if (new Set(names).size !== names.length) throw new Error('Duplicate release asset names.');
  await mkdir(outputDir, { recursive: true });
  if ((await readdir(outputDir)).length) throw new Error(`Release output must be empty: ${outputDir}`);
  const assets = [];
  for (const [source, name] of signedCopies) {
    if ((await stat(source)).size === 0) throw new Error(`Empty release asset: ${source}`);
    const destination = path.join(outputDir, name);
    await copyFile(source, destination);
    assets.push({ name, sha256: await sha256(destination) });
  }
  const manifest = { schemaVersion: 1, platform, target, version, commit, updaterPublicKey, updater, installer, assets };
  await writeFile(path.join(outputDir, 'artifact-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

function safeName(name) {
  return typeof name === 'string' && /^[A-Za-z0-9._-]+$/.test(name) && name !== '.' && name !== '..';
}

export async function prepareRelease({ artifactDir, version, commit, updaterPublicKey, repository, tagName, notes = '', pubDate = new Date().toISOString() }) {
  const selected = [];
  const uploadAssets = [];
  const names = new Set();
  let releaseCommit = commit;
  for (const [platform, target] of Object.entries(releaseTargets)) {
    const directory = path.join(artifactDir, platform);
    const manifest = JSON.parse(await readFile(path.join(directory, 'artifact-manifest.json'), 'utf8'));
    validatePlatform(manifest.platform, manifest.target);
    if (manifest.schemaVersion !== 1 || manifest.platform !== platform || manifest.target !== target || manifest.version !== version) {
      throw new Error(`Release manifest does not match ${platform} / ${version}.`);
    }
    if (typeof manifest.commit !== 'string' || !manifest.commit.trim()) throw new Error(`Missing release commit for ${platform}.`);
    releaseCommit ??= manifest.commit;
    if (manifest.commit !== releaseCommit) throw new Error(`Release commit mismatch for ${platform}.`);
    if (!updaterPublicKey || manifest.updaterPublicKey !== updaterPublicKey) throw new Error(`Updater public key mismatch for ${platform}.`);
    const updaterSuffix = platform === 'windows-x86_64' ? '.exe' : '.app.tar.gz';
    const installerSuffix = platform === 'windows-x86_64' ? '.exe' : '.dmg';
    if (!safeName(manifest.updater) || !manifest.updater.endsWith(updaterSuffix) ||
        !safeName(manifest.installer) || !manifest.installer.endsWith(installerSuffix)) {
      throw new Error(`Invalid installer/updater roles for ${platform}.`);
    }
    if (!Array.isArray(manifest.assets) || !manifest.assets.length) throw new Error(`No assets for ${platform}.`);
    const listed = new Set(manifest.assets.map(asset => asset.name));
    for (const required of [manifest.installer, manifest.updater, `${manifest.updater}.sig`]) {
      if (!listed.has(required)) throw new Error(`Missing required release asset: ${required}`);
    }
    // A stale or unexpected file cannot silently be uploaded with this release.
    const actual = await readdir(directory);
    if (actual.length !== listed.size + 1 || actual.some(name => name !== 'artifact-manifest.json' && !listed.has(name))) {
      throw new Error(`Unexpected files in ${platform} release directory.`);
    }
    for (const asset of manifest.assets) {
      if (!safeName(asset.name) || names.has(asset.name) || !/^[a-f0-9]{64}$/.test(asset.sha256)) {
        throw new Error(`Invalid or duplicate release asset: ${asset.name}`);
      }
      names.add(asset.name);
      const file = path.join(directory, asset.name);
      if (!(await stat(file)).isFile() || (await stat(file)).size === 0 || await sha256(file) !== asset.sha256) {
        throw new Error(`Release asset integrity check failed: ${asset.name}`);
      }
      uploadAssets.push(file);
    }
    const signature = (await readFile(path.join(directory, `${manifest.updater}.sig`), 'utf8')).trim();
    if (!signature) throw new Error(`Empty updater signature for ${platform}.`);
    selected.push({ platform, uploadName: manifest.updater, signature });
  }
  return {
    commit: releaseCommit,
    selected,
    uploadAssets,
    latestJson: {
      version, notes, pub_date: pubDate,
      platforms: Object.fromEntries(selected.map(candidate => [candidate.platform, {
        signature: candidate.signature,
        url: `https://github.com/${repository}/releases/download/${encodeURIComponent(tagName)}/${encodeURIComponent(candidate.uploadName)}`,
      }])),
    },
  };
}
