import { glob, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const latestReleaseUrl = 'https://api.github.com/repos/mapherez/nox-mcp/releases/latest';
const dependencySections = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];

export async function updateNoxMcp({ rootDir = root, fetchRelease = fetch, install = installFromRoot } = {}) {
  const response = await fetchRelease(latestReleaseUrl, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'NoteX-nox-mcp-updater',
      ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`GitHub latest release request failed: ${response.status}`);
  const release = await response.json();
  const asset = release.assets?.find((item) => item.name === 'nox-mcp.tgz');
  const url = asset?.browser_download_url;
  if (!url?.startsWith('https://github.com/mapherez/nox-mcp/releases/download/')) {
    throw new Error('Latest NoX MCP release is missing the nox-mcp.tgz asset.');
  }

  const rootManifest = JSON.parse(await readFile(path.join(rootDir, 'package.json'), 'utf8'));
  const patterns = rootManifest.workspaces?.packages ?? rootManifest.workspaces;
  if (!Array.isArray(patterns)) throw new Error('Root package.json must declare npm workspaces.');
  const packageDirs = new Set([rootDir]);
  for (const pattern of patterns) {
    for await (const directory of glob(pattern, { cwd: rootDir })) {
      packageDirs.add(path.resolve(rootDir, directory));
    }
  }

  // Read and validate every manifest before changing any of them.
  const changes = [];
  for (const directory of packageDirs) {
    const file = path.join(directory, 'package.json');
    const original = await readFile(file, 'utf8');
    const manifest = JSON.parse(original);
    let changed = false;
    for (const section of dependencySections) {
      if (Object.hasOwn(manifest[section] ?? {}, '@nox/mcp') && manifest[section]['@nox/mcp'] !== url) {
        manifest[section]['@nox/mcp'] = url;
        changed = true;
      }
    }
    if (changed) {
      const newline = original.includes('\r\n') ? '\r\n' : '\n';
      changes.push({ file, updated: `${JSON.stringify(manifest, null, 2).replaceAll('\n', newline)}${newline}` });
    }
  }

  for (const change of changes) await writeFile(change.file, change.updated, 'utf8');
  // Also reconcile the canonical lockfile if all manifests already use latest.
  await install(rootDir);
  return { tag: release.tag_name, url, updatedPackages: changes.map(({ file }) => path.relative(rootDir, file) || 'package.json') };
}

function installFromRoot(rootDir) {
  const npmCli = process.env.npm_execpath ?? path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [npmCli, 'install'], { cwd: rootDir, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`Root npm install failed (exit ${code}).`)));
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  updateNoxMcp().then(({ tag, updatedPackages }) => {
    console.log(`NoX MCP ${tag}: updated ${updatedPackages.length} package manifest(s); root install complete.`);
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
