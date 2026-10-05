import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const source = fileURLToPath(new URL('../', import.meta.url));
const destination = resolve(process.argv[2] ?? 'output/nox-mcp');
if (destination.startsWith(resolve(source) + sep) || destination === resolve(source)) throw new Error('Export destination must be outside source.');
if (existsSync(destination)) throw new Error('Choose a new export directory; existing files are never deleted.');
const roots = ['.github', '.gitignore', 'LICENSE', 'README.md', 'UPLOAD.md', 'contracts', 'conformance', 'scripts', 'typescript', 'rust', 'go'];
const ignored = new Set(['node_modules','dist','target','.git','.release','coverage']);
const allowed = /(?:\.(?:ts|mjs|json|rs|toml|lock|go|mod|sum|md|yml)|(?:^|[\\/])(?:LICENSE|\.gitignore))$/;
mkdirSync(destination,{recursive:true});
function copy(from,to) { if (ignored.has(from.split(/[\\/]/).at(-1))) return; if (statSync(from).isDirectory()) { mkdirSync(to,{recursive:true});for (const name of readdirSync(from)) copy(resolve(from,name),resolve(to,name)); } else if(allowed.test(from)) cpSync(from,to); }
for (const name of roots) copy(resolve(source,name),resolve(destination,name));
console.log(destination);
