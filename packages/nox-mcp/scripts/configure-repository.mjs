import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const supplied = process.argv[2];
if (!supplied || !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?\/?$/.test(supplied)) {
  throw new Error('Usage: node scripts/configure-repository.mjs https://github.com/OWNER/REPO');
}
const url = supplied.replace(/\/$/, '').replace(/\.git$/, '');
const modulePath = url.replace('https://', '') + '/go';
const goMod = resolve(root, 'go/go.mod');
const original = readFileSync(goMod, 'utf8').match(/^module (.+)$/m)?.[1];
if (!original?.endsWith('/go')) throw new Error('Expected a Go module in the go/ subdirectory.');
function replace(path) {
  const content = readFileSync(path, 'utf8');
  writeFileSync(path, content.split(original).join(modulePath));
}
function walk(path) {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const child = resolve(path, entry.name);
    if (entry.isDirectory()) walk(child);
    else if (entry.name.endsWith('.go')) replace(child);
  }
}
walk(resolve(root, 'go'));
replace(goMod);
const oldRepository = 'https://' + original.slice(0, -3);
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const documentationPattern = new RegExp(`${escape(oldRepository)}|${escape(original)}`, 'g');
for (const relative of ['README.md', 'typescript/README.md', 'rust/README.md']) {
  const path = resolve(root, relative);
  writeFileSync(path, readFileSync(path, 'utf8').replace(documentationPattern, match => match === original ? modulePath : url));
}
const packageFile = resolve(root, 'typescript/package.json');
const pkg = JSON.parse(readFileSync(packageFile, 'utf8'));
pkg.repository.url = url + '.git';
writeFileSync(packageFile, JSON.stringify(pkg, null, 2) + '\n');
const cargoFile = resolve(root, 'rust/Cargo.toml');
writeFileSync(cargoFile, readFileSync(cargoFile, 'utf8').replace(/^repository = ".*"$/m, `repository = "${url}"`));
console.log('Repository metadata configured. Go module: ' + modulePath);
