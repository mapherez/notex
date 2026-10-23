import { readFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { cleanPageLink, pagePath, siteOrigin, staticFile, immutableAsset } from './urls.mjs';
import { createHash } from 'node:crypto';

const root = path.resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => entry.isDirectory()
    ? htmlFiles(path.join(directory, entry.name))
    : entry.name.endsWith('.html') ? [path.join(directory, entry.name)] : []));
  return nested.flat();
}
const files = await htmlFiles(root);
const html = new Map(await Promise.all(files.map(async file => [file, await readFile(file, 'utf8')])));
const errors = [];
const home = html.get(path.join(root, 'index.html'));
const shell = (source, tag) => source.match(new RegExp(`<${tag} class="site-${tag}"[\\s\\S]*?</${tag}>`))?.[0];
const shellLinks = (source, file) => [...source.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(([, href, label]) => ({
  href: new URL(href, `https://notex.mapherez.com/${path.relative(root, file).replaceAll(path.sep, '/')}`).href,
  label: label.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
}));
for (const [file, source] of html) {
  const route = pagePath(path.relative(root, file).replaceAll(path.sep, '/'));
  const visible = source.replace(/<(script|style|svg)\b[\s\S]*?<\/\1>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  if (/(?<![\d.])\d+\.\d+\.\d+(?![\d.])/.test(source)) errors.push(`${file}: keep product release numbers in patch notes, not evergreen pages`);
  if (/(?:For the desktop app|Improve this guide|Your notes\. Your computer\.|optional (?:Google )?Drive backups?|optional backups?|Drive backup is optional)/i.test(visible)) errors.push(`${file}: obsolete or repetitive site copy`);
  if (!/<html lang="en">/.test(source) || /\blang="(?!en")[^"]+"/.test(source)) errors.push(`${file}: public pages must be in English`);
  for (const tag of ['header', 'footer']) {
    const shared = shell(source, tag);
    const reference = shell(home, tag);
    if (!shared || !reference) errors.push(`${file}: missing shared ${tag}`);
    else if (JSON.stringify(shellLinks(shared, file)) !== JSON.stringify(shellLinks(reference, path.join(root, 'index.html')))) errors.push(`${file}: ${tag} navigation differs from the landing`);
  }
  if ((source.match(/data-theme-trigger\b/g) ?? []).length !== 1) errors.push(`${file}: expected one shared theme control`);
  if ((source.match(/<h1\b/g) ?? []).length !== 1) errors.push(`${file}: expected one page title`);
  const ids = [...source.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  if (new Set(ids).size !== ids.length) errors.push(`${file}: duplicate element ID`);
  for (const match of source.matchAll(/\b(?:href|src|data-icon-light|data-icon-dark|data-index-url)="([^"]+)"/g)) {
    const value = match[1].replace(/&amp;/g, '&');
    const url = new URL(value, `${siteOrigin}${route}`);
    if (url.origin !== siteOrigin || /^\/(?:app(?:\/|$)|download$)/.test(url.pathname)) continue;
    if (cleanPageLink(value, route) !== value) errors.push(`${file}: page link is not canonical: ${value}`);
    const target = path.resolve(root, `.${staticFile(decodeURIComponent(url.pathname))}`);
    try {
      await stat(target);
      if (url.hash && html.has(target) && !html.get(target).includes(`id="${decodeURIComponent(url.hash.slice(1))}"`)) {
        errors.push(`${path.relative(root, file)}: missing anchor ${value}`);
      }
    } catch { errors.push(`${path.relative(root, file)}: broken local link ${value}`); }
  }
}
if (errors.length) throw new Error(errors.join('\n'));
const index = JSON.parse(await readFile(path.join(root, 'docs/search-index.json'), 'utf8'));
if (index.length !== files.filter(file => path.dirname(file) === path.join(root, 'docs')).length) throw new Error('Search index does not include every article');
for (const article of index) {
  if (!article.href.startsWith('/docs/') || article.href.includes('.html')) throw new Error(`Non-canonical search result: ${article.href}`);
}
const manifest = JSON.parse(await readFile(path.join(root, 'asset-manifest.json'), 'utf8'));
for (const [original, fingerprint] of Object.entries(manifest)) {
  if (!immutableAsset.test(fingerprint)) throw new Error(`Asset is not fingerprinted: ${original}`);
  const content = await readFile(path.join(root, fingerprint));
  const hash = createHash('sha256').update(content).digest('hex').slice(0, 12);
  if (!fingerprint.includes(`.${hash}.`)) throw new Error(`Asset fingerprint does not match its content: ${fingerprint}`);
  if (fingerprint.endsWith('.css')) {
    for (const match of content.toString('utf8').matchAll(/url\("(\/[^"]+)"\)/g)) {
      const url = new URL(match[1], siteOrigin);
      await stat(path.join(root, url.pathname));
      if (!immutableAsset.test(url.pathname)) throw new Error(`Unversioned CSS dependency: ${match[1]}`);
    }
  }
}
for (const [file, source] of html) {
  for (const match of source.matchAll(/\b(?:href|src|data-icon-light|data-icon-dark|data-index-url)="([^"]+)"/g)) {
    const url = new URL(match[1], `${siteOrigin}${pagePath(path.relative(root, file).replaceAll(path.sep, '/'))}`);
    if (url.origin === siteOrigin && manifest[url.pathname]) throw new Error(`${file}: asset URL is not fingerprinted: ${match[1]}`);
  }
}
console.log(`Checked ${files.length} pages and ${Object.keys(manifest).length} fingerprinted assets: clean links, shared navigation, English and evergreen copy, anchors, search and asset hashes are valid.`);
