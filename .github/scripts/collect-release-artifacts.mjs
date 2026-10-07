import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { collectReleaseArtifacts } from './release-artifacts.mjs';

const [platform, target, bundleDir, outputDir] = process.argv.slice(2);
if (!platform || !target || !bundleDir || !outputDir) {
  throw new Error('Usage: node .github/scripts/collect-release-artifacts.mjs <platform> <target> <bundle-dir> <output-dir>');
}
const config = JSON.parse(await readFile('src-tauri/tauri.conf.json', 'utf8'));
const manifest = await collectReleaseArtifacts({
  platform, target, bundleDir: path.resolve(bundleDir), outputDir: path.resolve(outputDir),
  version: config.version, commit: process.env.GITHUB_SHA,
  updaterPublicKey: config.plugins.updater.pubkey,
});
console.log(`Collected ${manifest.assets.length} release assets for ${platform}, target ${target}, version ${manifest.version}.`);
