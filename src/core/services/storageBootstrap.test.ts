import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const open = vi.hoisted(() => vi.fn());
vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => false, invoke: vi.fn() }));
vi.mock('../storage/desktopInvoke', () => ({ desktopInvoke: vi.fn(), selectDesktopLibrary: vi.fn() }));
vi.mock('../storage/storageRuntime', () => ({ openBrowserLibrary: open }));
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); localStorage.clear();
  vi.stubEnv('DEV', true);
  vi.stubEnv('VITE_DEV_AUTH_BYPASS', 'false');
});
afterEach(() => { vi.unstubAllEnvs(); });
describe('web startup', () => {
  it('opens a separate development library with the default data without replacing the remembered account', async () => {
    vi.stubEnv('VITE_DEV_AUTH_BYPASS', 'true');
    const remembered = JSON.stringify({ id: 'real-account', email: 'user@gmail.com', name: 'User' });
    localStorage.setItem('notex.activeGoogleAccount', remembered);
    const { initializeStorage } = await import('./storageBootstrap');
    expect(await initializeStorage()).toEqual({ backend: 'indexeddb', account: null, shouldSeedDemo: true });
    expect(open).toHaveBeenCalledExactlyOnceWith('notex-dev-layouts');
    expect(localStorage.getItem('notex.activeGoogleAccount')).toBe(remembered);
  });
  it('ignores the bypass flag in production', async () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_DEV_AUTH_BYPASS', 'true');
    const { initializeStorage } = await import('./storageBootstrap');
    expect(await initializeStorage()).toMatchObject({ requiresLogin: true });
    expect(open).not.toHaveBeenCalled();
  });
  it('requires login without opening a guest database', async () => {
    const { initializeStorage } = await import('./storageBootstrap');
    expect(await initializeStorage()).toMatchObject({ requiresLogin: true });
    expect(open).not.toHaveBeenCalled();
  });
  it('reopens the remembered account without requiring a network request and removes access on logout', async () => {
    const { initializeStorage, rememberWebAccount } = await import('./storageBootstrap');
    const account = { id: 'account', email: 'user@gmail.com', name: 'User' };
    rememberWebAccount(account);
    expect(await initializeStorage()).toMatchObject({ account, shouldSeedDemo: false });
    expect(open).toHaveBeenCalledWith('account');
    rememberWebAccount(null);
    vi.resetModules();
    const restarted = await import('./storageBootstrap');
    expect(await restarted.initializeStorage()).toMatchObject({ requiresLogin: true });
  });
  it('returns to login if the remembered profile is malformed', async () => {
    localStorage.setItem('notex.activeGoogleAccount', '{invalid');
    const { initializeStorage } = await import('./storageBootstrap');
    expect(await initializeStorage()).toMatchObject({ requiresLogin: true });
    expect(open).not.toHaveBeenCalled();
  });
});
