import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const argumentsForTauri = process.argv.slice(2);
const mode = argumentsForTauri[0] === 'dev' ? 'development' : 'production';
if (argumentsForTauri[0] === 'dev') {
  argumentsForTauri.splice(1, 0, '--config', fileURLToPath(new URL('../src-tauri/tauri.dev.conf.json', import.meta.url)));
}
// Use the same loader and precedence as Vite. CI/shell values take precedence
// over .env files. Passing them to the CLI also reaches Cargo and the hooks.
const configuration = loadEnv(mode, root, ['VITE_GOOGLE_', 'GOOGLE_DESKTOP_']);
const environment = { ...process.env };
for (const name of [
  'VITE_GOOGLE_WEB_CLIENT_ID',
  'VITE_GOOGLE_DESKTOP_CLIENT_ID',
  'VITE_GOOGLE_WEB_ORIGIN',
  'GOOGLE_DESKTOP_CLIENT_SECRET',
]) {
  environment[name] = (configuration[name] ?? '').trim();
}

const cli = fileURLToPath(new URL('../node_modules/@tauri-apps/cli/tauri.js', import.meta.url));
const child = spawn(process.execPath, [cli, ...argumentsForTauri], {
  cwd: root,
  env: environment,
  stdio: 'inherit',
});
child.on('error', error => {
  console.error(`Could not start Tauri: ${error.message}`);
  process.exitCode = 1;
});
child.on('exit', code => { process.exitCode = code ?? 1; });
