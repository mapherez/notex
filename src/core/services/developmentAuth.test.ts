import { afterEach, expect, it, vi } from 'vitest';
import { isDevAuthBypassEnabled } from './developmentAuth';

const runtime = vi.hoisted(() => ({ desktop: false }));
vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => runtime.desktop }));
afterEach(() => { vi.unstubAllEnvs(); runtime.desktop = false; });

it.each([
  { dev: true, flag: 'true', desktop: false, enabled: true },
  { dev: true, flag: undefined, desktop: false, enabled: false },
  { dev: true, flag: 'false', desktop: false, enabled: false },
  { dev: true, flag: 'TRUE', desktop: false, enabled: false },
  { dev: false, flag: 'true', desktop: false, enabled: false },
  { dev: true, flag: 'true', desktop: true, enabled: false },
])('limits development login bypass: $dev / $flag / desktop=$desktop', ({ dev, flag, desktop, enabled }) => {
  vi.stubEnv('DEV', dev);
  vi.stubEnv('VITE_DEV_AUTH_BYPASS', flag);
  runtime.desktop = desktop;
  expect(isDevAuthBypassEnabled()).toBe(enabled);
});
