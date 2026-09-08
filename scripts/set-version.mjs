#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = {
  packageJson: path.join(rootDir, 'package.json'),
  packageLock: path.join(rootDir, 'package-lock.json'),
  cargoToml: path.join(rootDir, 'src-tauri', 'Cargo.toml'),
  cargoLock: path.join(rootDir, 'src-tauri', 'Cargo.lock'),
  tauriConfig: path.join(rootDir, 'src-tauri', 'tauri.conf.json'),
};

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  printHelp();
  process.exit(0);
}

if (args.length > 1 || args[0]?.startsWith('-')) {
  fail('Expected a single version argument.');
}

const originals = Object.fromEntries(
  await Promise.all(
    Object.entries(files).map(async ([key, filePath]) => [key, await readFile(filePath, 'utf8')]),
  ),
);

const packageJson = parseJson(originals.packageJson, files.packageJson);
const currentVersion = packageJson.version;
let requestedVersion = args[0];

if (!requestedVersion) {
  if (!process.stdin.isTTY) {
    fail('No version provided. Run interactively or pass it after --.');
  }

  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    requestedVersion = await prompt.question(
      `Current NoteX version: ${currentVersion}\nNew version: `,
    );
  } finally {
    prompt.close();
  }
}

const nextVersion = normalizeVersion(requestedVersion);
if (!isSemver(nextVersion)) {
  fail(`Invalid semantic version: ${requestedVersion}`);
}

const packageLock = parseJson(originals.packageLock, files.packageLock);
const tauriConfig = parseJson(originals.tauriConfig, files.tauriConfig);

assertStringVersion(packageJson.version, 'package.json');
assertStringVersion(packageLock.version, 'package-lock.json');
assertStringVersion(packageLock.packages?.['']?.version, 'package-lock.json root package');
assertStringVersion(tauriConfig.version, 'src-tauri/tauri.conf.json');

const currentVersions = [
  packageJson.version,
  packageLock.version,
  packageLock.packages[''].version,
  readPackageVersion(originals.cargoToml, '[package]', 'src-tauri/Cargo.toml'),
  readCargoLockVersion(originals.cargoLock),
  tauriConfig.version,
];

for (const [index, version] of currentVersions.entries()) {
  assertStringVersion(version, `version source ${index + 1}`);
}

if (currentVersions.every((version) => normalizeVersion(version) === nextVersion)) {
  console.log(`NoteX is already at version ${nextVersion}.`);
  process.exit(0);
}

packageJson.version = nextVersion;
packageLock.version = nextVersion;
packageLock.packages[''].version = nextVersion;
tauriConfig.version = nextVersion;

const updated = {
  packageJson: formatJson(packageJson, originals.packageJson),
  packageLock: formatJson(packageLock, originals.packageLock),
  cargoToml: replacePackageVersion(
    originals.cargoToml,
    '[package]',
    'src-tauri/Cargo.toml',
    nextVersion,
  ),
  cargoLock: replaceCargoLockVersion(originals.cargoLock, nextVersion),
  tauriConfig: formatJson(tauriConfig, originals.tauriConfig),
};

if (Object.keys(files).every((key) => updated[key] === originals[key])) {
  console.log(`NoteX is already at version ${nextVersion}.`);
  process.exit(0);
}

const written = [];
try {
  for (const key of Object.keys(files)) {
    written.push(key);
    await writeFile(files[key], updated[key], 'utf8');
  }
} catch (error) {
  await Promise.allSettled(written.map((key) => writeFile(files[key], originals[key], 'utf8')));
  throw error;
}

console.log(`Updated NoteX from ${currentVersion} to ${nextVersion}:`);
for (const filePath of Object.values(files)) {
  console.log(`- ${path.relative(rootDir, filePath)}`);
}

function replacePackageVersion(contents, sectionName, label, version) {
  readPackageVersion(contents, sectionName, label);

  const sectionStart = contents.indexOf(sectionName);
  const nextSection = contents.indexOf('\n[', sectionStart + sectionName.length);
  const sectionEnd = nextSection === -1 ? contents.length : nextSection;
  const section = contents.slice(sectionStart, sectionEnd);
  const updatedSection = section.replace(
    /^version[ \t]*=[ \t]*"[^"]+"[ \t]*(\r?)$/m,
    `version = "${version}"$1`,
  );
  return contents.slice(0, sectionStart) + updatedSection + contents.slice(sectionEnd);
}

function readPackageVersion(contents, sectionName, label) {
  const sectionStart = contents.indexOf(sectionName);
  if (sectionStart === -1) {
    fail(`Could not find ${sectionName} in ${label}.`);
  }

  const nextSection = contents.indexOf('\n[', sectionStart + sectionName.length);
  const sectionEnd = nextSection === -1 ? contents.length : nextSection;
  const section = contents.slice(sectionStart, sectionEnd);
  const matches = [
    ...section.matchAll(/^version[ \t]*=[ \t]*"([^"]+)"[ \t]*(\r?)$/gm),
  ];

  if (matches.length !== 1) {
    fail(`Expected exactly one package version in ${label}.`);
  }

  return matches[0][1];
}

function replaceCargoLockVersion(contents, version) {
  readCargoLockVersion(contents);

  const blocks = contents.split(/(?=^\[\[package\]\][ \t]*\r?$)/m);
  const matchingIndexes = blocks
    .map((block, index) =>
      /^name[ \t]*=[ \t]*"NoteX"[ \t]*\r?$/m.test(block) ? index : -1,
    )
    .filter((index) => index !== -1);

  if (matchingIndexes.length !== 1) {
    fail('Expected exactly one NoteX package in src-tauri/Cargo.lock.');
  }

  const index = matchingIndexes[0];
  const matches = [
    ...blocks[index].matchAll(/^version[ \t]*=[ \t]*"[^"]+"[ \t]*(\r?)$/gm),
  ];
  if (matches.length !== 1) {
    fail('Expected exactly one NoteX version in src-tauri/Cargo.lock.');
  }

  blocks[index] = blocks[index].replace(
    /^version[ \t]*=[ \t]*"[^"]+"[ \t]*(\r?)$/m,
    `version = "${version}"$1`,
  );
  return blocks.join('');
}

function readCargoLockVersion(contents) {
  const blocks = contents.split(/(?=^\[\[package\]\][ \t]*\r?$)/m);
  const matchingBlocks = blocks.filter((block) =>
    /^name[ \t]*=[ \t]*"NoteX"[ \t]*\r?$/m.test(block),
  );

  if (matchingBlocks.length !== 1) {
    fail('Expected exactly one NoteX package in src-tauri/Cargo.lock.');
  }

  const matches = [
    ...matchingBlocks[0].matchAll(/^version[ \t]*=[ \t]*"([^"]+)"[ \t]*(\r?)$/gm),
  ];
  if (matches.length !== 1) {
    fail('Expected exactly one NoteX version in src-tauri/Cargo.lock.');
  }

  return matches[0][1];
}

function parseJson(contents, filePath) {
  try {
    return JSON.parse(contents);
  } catch (error) {
    fail(`Could not parse ${path.relative(rootDir, filePath)}: ${error.message}`);
  }
}

function formatJson(value, original) {
  const newline = original.includes('\r\n') ? '\r\n' : '\n';
  return `${JSON.stringify(value, null, 2).replaceAll('\n', newline)}${newline}`;
}

function assertStringVersion(value, label) {
  if (typeof value !== 'string' || !isSemver(normalizeVersion(value))) {
    fail(`Invalid or missing version in ${label}.`);
  }
}

function normalizeVersion(value) {
  return String(value ?? '').trim().replace(/^v/i, '');
}

function isSemver(value) {
  return /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(
    value,
  );
}

function printHelp() {
  console.log(`
Usage:
  npm run version:set
  npm run version:set -- <version>

Updates the NoteX application version in package.json, package-lock.json,
src-tauri/Cargo.toml, src-tauri/Cargo.lock, and src-tauri/tauri.conf.json.
`);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
