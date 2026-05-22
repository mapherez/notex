import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../src', import.meta.url));

const disallowedPatterns = [
  {
    label: 'React inline style prop',
    pattern: /style\s*=\s*\{/,
  },
  {
    label: 'Icon size prop',
    pattern: /\ssize\s*=\s*(?:\{?\d|["'])/,
  },
  {
    label: 'Visual color prop',
    pattern: /\scolor\s*=\s*(?:"(?:var\(|#|rgb|hsl)|\{[^}]*?(?:var\(|#|rgb|hsl)[^}]*\})/,
  },
  {
    label: 'Visual fill prop',
    pattern: /\sfill\s*=\s*(?:"(?:var\(|#|rgb|hsl|currentColor|transparent|[a-zA-Z])|\{)/,
  },
  {
    label: 'Tailwind utility leftover',
    pattern: /\b(?:min-w-0|mt-4|mt-3|h-5|w-5|text-xs)\b/,
  },
];

const sourceExtensions = new Set(['.tsx', '.ts']);
const ignoredDirectories = new Set(['styles']);
const failures = [];

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...await collectFiles(fullPath));
      }
      continue;
    }

    if ([...sourceExtensions].some((extension) => entry.name.endsWith(extension))) {
      files.push(fullPath);
    }
  }

  return files;
}

for (const file of await collectFiles(root)) {
  const text = await readFile(file, 'utf8');
  const lines = text.split(/\r?\n/);

  lines.forEach((line, index) => {
    for (const { label, pattern } of disallowedPatterns) {
      if (pattern.test(line)) {
        failures.push(`${file}:${index + 1}: ${label}`);
      }
    }
  });
}

if (failures.length) {
  console.error('Inline or utility styling found:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}
