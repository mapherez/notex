#!/usr/bin/env node
import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareRelease } from './release-artifacts.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// Upload a complete release to a draft before making it visible to the updater.
export async function publishRelease({ repository, tagName, version, token, uploadAssets,
  releaseNotes = '', draft = false, prerelease = false, targetCommit, fetchImpl = fetch, log = console.log }) {
  if (typeof targetCommit !== 'string' || !targetCommit.trim()) throw new Error('Missing release commit.');
  if (typeof tagName !== 'string' || !tagName.trim() || tagName.startsWith('untagged-')) throw new Error('Invalid release tag.');
  async function request(method, suffix, body, allowNotFound = false) {
    const response = await fetchImpl(`https://api.github.com/repos/${repository}${suffix}`, {
      method, headers: {
        Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28',
      }, body: body ? JSON.stringify(body) : undefined,
    });
    if (allowNotFound && response.status === 404) return null;
    if (!response.ok) throw new Error(`GitHub API request failed: ${method} ${suffix} -> ${response.status} ${await response.text()}`);
    return response.status === 204 ? null : response.json();
  }
  let release = await request('GET', `/releases/tags/${encodeURIComponent(tagName)}`, undefined, true);
  if (release && !release.draft) throw new Error(`Release ${tagName} is already published. Use a new version/tag; published releases are not modified.`);
  // The tag lookup does not return drafts. Find a previous draft when retrying.
  if (!release) {
    for (let page = 1; ; page += 1) {
      const releases = await request('GET', `/releases?per_page=100&page=${page}`);
      release = releases.find(candidate => candidate.draft && candidate.tag_name === tagName);
      if (release || releases.length < 100) break;
    }
  }
  const existingAssets = [];
  if (release) {
    for (let page = 1; ; page += 1) {
      const assets = await request('GET', `/releases/${release.id}/assets?per_page=100&page=${page}`);
      existingAssets.push(...assets);
      if (assets.length < 100) break;
    }
  }
  const expectedNames = new Set(uploadAssets.map(file => path.basename(file)));
  if (existingAssets.some(asset => !expectedNames.has(asset.name))) throw new Error(`Draft ${tagName} contains unexpected assets; remove them or use a new tag.`);

  // Create the real Git tag before the draft, rather than relying on publication
  // to replace GitHub's temporary untagged-* identifier.
  let tag = await request('GET', `/git/ref/tags/${encodeURIComponent(tagName)}`, undefined, true);
  if (!tag) tag = await request('POST', '/git/refs', { ref: `refs/tags/${tagName}`, sha: targetCommit });
  let tagObject = tag.object;
  for (let depth = 0; tagObject?.type === 'tag' && depth < 10; depth += 1) {
    tagObject = (await request('GET', `/git/tags/${tagObject.sha}`)).object;
  }
  if (tagObject?.type !== 'commit' || tagObject.sha !== targetCommit) {
    throw new Error(`Tag ${tagName} does not point to release commit ${targetCommit}; existing tags are not moved.`);
  }
  if (!release) release = await request('POST', '/releases', {
    tag_name: tagName, name: `NoteX ${version}`, body: releaseNotes,
    target_commitish: targetCommit, draft: true, prerelease, make_latest: 'false',
  });
  // Bind the tag while still a draft if the API returned a placeholder.
  if (release.tag_name !== tagName) release = await request('PATCH', `/releases/${release.id}`, {
    tag_name: tagName, target_commitish: targetCommit, draft: true,
  });
  if (release.tag_name !== tagName || release.draft !== true) throw new Error(`GitHub did not retain draft tag ${tagName}.`);
  for (const assetPath of uploadAssets) {
    const assetName = path.basename(assetPath);
    const existing = existingAssets.find(asset => asset.name === assetName);
    if (existing) await request('DELETE', `/releases/assets/${existing.id}`);
    const url = new URL(release.upload_url.replace(/\{.*$/, ''));
    url.searchParams.set('name', assetName);
    const body = createReadStream(assetPath);
    let response;
    try {
      response = await fetchImpl(url, {
        method: 'POST', headers: {
          Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`,
          'Content-Length': String((await stat(assetPath)).size),
          'Content-Type': 'application/octet-stream', 'X-GitHub-Api-Version': '2022-11-28',
        }, body, duplex: 'half',
      });
    } finally { body.destroy(); }
    if (!response.ok) throw new Error(`GitHub upload failed for ${assetName}: ${response.status} ${await response.text()}`);
    log(`Uploaded ${assetName}`);
  }
  const completed = await request('PATCH', `/releases/${release.id}`, {
    tag_name: tagName, target_commitish: targetCommit,
    name: `NoteX ${version}`, body: releaseNotes, draft, prerelease,
    make_latest: !draft && !prerelease ? 'true' : 'false',
  });
  if (completed.tag_name !== tagName || completed.draft !== draft) throw new Error(`GitHub did not retain release tag/state for ${tagName}.`);
  return completed;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) { printHelp(); return; }
  const config = JSON.parse(await readFile(path.join(rootDir, 'src-tauri/tauri.conf.json'), 'utf8'));
  const packageJson = JSON.parse(await readFile(path.join(rootDir, 'package.json'), 'utf8'));
  const version = String(args.version ?? envValue('RELEASE_VERSION') ?? config.version).replace(/^v/, '');
  if (version !== config.version || version !== packageJson.version) throw new Error('Release version must match package.json and tauri.conf.json.');
  const repository = args.repo ?? envValue('GITHUB_REPOSITORY');
  if (!repository || !/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('Set GITHUB_REPOSITORY or pass --repo owner/name.');
  const tagName = args.tag ?? envValue('RELEASE_TAG') ?? `v${version}`;
  const artifactDir = path.resolve(rootDir, args['artifact-dir'] ?? envValue('TAURI_RELEASE_ARTIFACT_DIR') ?? 'output/release');
  const outputDir = path.resolve(rootDir, args['output-dir'] ?? envValue('TAURI_RELEASE_OUTPUT_DIR') ?? 'output/release-metadata');
  const releaseNotes = envValue('TAURI_RELEASE_NOTES') ?? envValue('RELEASE_NOTES') ?? '';
  const targetCommit = envValue('GITHUB_SHA');
  const result = await prepareRelease({
    artifactDir, version, repository, tagName, commit: targetCommit,
    updaterPublicKey: config.plugins.updater.pubkey, notes: releaseNotes,
    pubDate: envValue('TAURI_RELEASE_PUB_DATE'),
  });
  await mkdir(outputDir, { recursive: true });
  const latestJsonPath = path.join(outputDir, 'latest.json');
  await writeFile(latestJsonPath, `${JSON.stringify(result.latestJson, null, 2)}\n`);
  const uploadAssets = [...result.uploadAssets, latestJsonPath];
  console.log(`Prepared NoteX ${version}: ${repository}, tag ${tagName}`);
  for (const candidate of result.selected) console.log(`${candidate.platform}: ${candidate.uploadName}`);
  console.log(`Combined updater manifest: ${latestJsonPath}`);
  if (isTruthy(args['dry-run']) || isTruthy(args['skip-upload']) || isTruthy(args['no-upload']) ||
      isTruthy(process.env.DRY_RUN) || isTruthy(process.env.TAURI_RELEASE_SKIP_UPLOAD)) {
    console.log('Upload skipped; no GitHub API calls were made.');
    return;
  }
  const token = envValue('GITHUB_TOKEN') ?? envValue('GH_TOKEN');
  if (!token) throw new Error('Missing GITHUB_TOKEN or GH_TOKEN.');
  const release = await publishRelease({
    repository, tagName, version, token, targetCommit: result.commit, uploadAssets, releaseNotes,
    draft: isTruthy(process.env.RELEASE_DRAFT), prerelease: isTruthy(process.env.RELEASE_PRERELEASE),
  });
  console.log(`${release.draft ? 'Draft' : 'Release'} ready (tag ${release.tag_name}): ${release.html_url}`);
}
function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (!argv[index].startsWith('--')) throw new Error(`Unexpected argument: ${argv[index]}`);
    const [key, inline] = argv[index].slice(2).split('=', 2);
    if (inline !== undefined) parsed[key] = inline;
    else if (argv[index + 1] && !argv[index + 1].startsWith('--')) parsed[key] = argv[++index];
    else parsed[key] = true;
  }
  return parsed;
}
function isTruthy(value) { return value === true || ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase()); }
function envValue(name) { const value = process.env[name]; return value?.trim() ? value : undefined; }
function printHelp() {
  console.log(`Usage: node .github/scripts/tauri-release.mjs [options]

Requires collected windows-x86_64 and darwin-aarch64 artifact manifests.
Writes one latest.json; publishes a draft only after all assets succeed.
Published releases are never replaced. Use a new version/tag.

  --artifact-dir <path>  Both platform directories (default: output/release).
  --output-dir <path>    latest.json directory (default: output/release-metadata).
  --repo <owner/name>    Defaults to GITHUB_REPOSITORY.
  --tag <tag>            Defaults to RELEASE_TAG or v<version>.
  --version <version>    Must match the repository version.
  --dry-run             Write manifest without any GitHub API calls.
  --skip-upload         Alias for --dry-run.
  --help                Show this message.

Upload requires GITHUB_TOKEN. Optional: TAURI_RELEASE_NOTES, RELEASE_DRAFT,
RELEASE_PRERELEASE, GITHUB_SHA, TAURI_RELEASE_PUB_DATE.`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
