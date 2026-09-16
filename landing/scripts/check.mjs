import { readFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

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
for (const [file, source] of html) {
  if ((source.match(/<h1\b/g) ?? []).length !== 1) errors.push(`${file}: expected one page title`);
  const ids = [...source.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  if (new Set(ids).size !== ids.length) errors.push(`${file}: duplicate element ID`);
  for (const match of source.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    const value = match[1].replace(/&amp;/g, '&');
    if (/^(?:https?:|mailto:|tel:|data:)/.test(value)) continue;
    const [pathname, fragment] = value.split('#');
    let target = pathname ? path.resolve(path.dirname(file), decodeURIComponent(pathname.split('?')[0])) : file;
    if (pathname.endsWith('/')) target = path.join(target, 'index.html');
    try {
      await stat(target);
      if (fragment && html.has(target) && !html.get(target).includes(`id="${decodeURIComponent(fragment)}"`)) {
        errors.push(`${path.relative(root, file)}: missing anchor ${value}`);
      }
    } catch { errors.push(`${path.relative(root, file)}: broken local link ${value}`); }
  }
}
if (errors.length) throw new Error(errors.join('\n'));
const index = JSON.parse(await readFile(path.join(root, 'docs/search-index.json'), 'utf8'));
if (index.length !== files.filter(file => path.dirname(file) === path.join(root, 'docs')).length) throw new Error('Search index does not include every article');
console.log(`Checked ${files.length} pages: local links, assets, section anchors, page titles, and search index are valid.`);
