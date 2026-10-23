import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { siteOrigin } from './urls.mjs';

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(entry => entry.isDirectory()
    ? filesIn(path.join(directory, entry.name)) : [path.join(directory, entry.name)]));
  return files.flat().sort();
}

// Hash dependencies before their parents: changing a font changes both its URL
// and the stylesheet that refers to it. Stable URLs stay available for old links.
export async function fingerprintAssets(directory) {
  const files = await filesIn(directory);
  const assetFiles = new Set(files.filter(file => /\.(?:css|js|json|woff2?|png|jpe?g|webp|svg|ico)$/.test(file)));
  const manifest = new Map();
  const visiting = new Set();
  const publicPath = file => `/${path.relative(directory, file).split(path.sep).join('/')}`;

  async function reference(value, from) {
    if (!value || value.startsWith('#')) return value;
    const url = new URL(value, `${siteOrigin}${publicPath(from)}`);
    if (url.origin !== siteOrigin) return value;
    const target = path.resolve(directory, `.${decodeURIComponent(url.pathname)}`);
    if (!assetFiles.has(target)) return value;
    const fingerprint = await emit(target);
    return `${value.startsWith(siteOrigin) ? siteOrigin : ''}${fingerprint}${url.search}${url.hash}`;
  }

  async function emit(file) {
    if (manifest.has(publicPath(file))) return manifest.get(publicPath(file));
    if (visiting.has(file)) throw new Error(`Circular asset reference: ${file}`);
    visiting.add(file);
    let content = await readFile(file);
    if (file.endsWith('.css')) {
      let css = content.toString('utf8');
      const matches = [...css.matchAll(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/g)];
      for (const match of matches.reverse()) {
        const replacement = `url("${await reference(match[2], file)}")`;
        css = css.slice(0, match.index) + replacement + css.slice(match.index + match[0].length);
      }
      content = Buffer.from(css);
    }
    const hash = createHash('sha256').update(content).digest('hex').slice(0, 12);
    const extension = path.extname(file);
    const output = `${file.slice(0, -extension.length)}.${hash}${extension}`;
    await writeFile(output, content);
    manifest.set(publicPath(file), publicPath(output));
    visiting.delete(file);
    return publicPath(output);
  }

  for (const file of assetFiles) await emit(file);
  for (const file of files.filter(file => file.endsWith('.html'))) {
    let html = await readFile(file, 'utf8');
    const matches = [...html.matchAll(/\b(href|src|content|data-icon-light|data-icon-dark|data-index-url)="([^"]*)"/g)];
    for (const match of matches.reverse()) {
      html = html.slice(0, match.index) + `${match[1]}="${await reference(match[2], file)}"` + html.slice(match.index + match[0].length);
    }
    await writeFile(file, html);
  }
  await writeFile(path.join(directory, 'asset-manifest.json'), JSON.stringify(Object.fromEntries([...manifest].sort()), null, 2) + '\n');
  return manifest;
}
