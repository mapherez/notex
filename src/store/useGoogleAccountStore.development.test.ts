import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  open: vi.fn(), cloudStart: vi.fn(), googleLogin: vi.fn(), knowledgeInitialize: vi.fn(),
}));
vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => false, invoke: vi.fn() }));
vi.mock('../core/storage/storageRuntime', () => ({ openBrowserLibrary: mock.open, closeBrowserLibrary: vi.fn() }));
vi.mock('../core/storage/desktopInvoke', () => ({ desktopInvoke: vi.fn(), selectDesktopLibrary: vi.fn(), pauseDesktopStorage: vi.fn() }));
vi.mock('../core/db/notexDb', () => ({ db: { userSettings: { get: async () => ({}) } } }));
vi.mock('../core/mcp/noteMutationCoordinator', () => ({ waitForNoteMutations: vi.fn() }));
vi.mock('../core/services/googleWebAuth', () => ({ loginGoogleWeb: mock.googleLogin, clearGoogleWebAuthorization: vi.fn() }));
vi.mock('./useAppStore', () => ({ useAppStore: {
  setState: vi.fn(), getState: () => ({ settings: { language: 'en' }, hydrateSettings: vi.fn() }),
} }));
vi.mock('./useKnowledgeStore', () => ({ useKnowledgeStore: {
  setState: vi.fn(), getState: () => ({ initialize: mock.knowledgeInitialize }),
} }));
vi.mock('./useNotesStore', () => ({ useNotesStore: { setState: vi.fn(), getState: () => ({ initialize: vi.fn() }) } }));
vi.mock('./useCloudStore', () => ({ useCloudStore: { getState: () => ({ start: mock.cloudStart, stop: vi.fn() }) } }));

beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); localStorage.clear();
  vi.stubEnv('DEV', true);
  vi.stubEnv('VITE_DEV_AUTH_BYPASS', 'true');
});
afterEach(() => { vi.unstubAllEnvs(); });

describe('browser development startup', () => {
  it('loads the default library and stays usable without Google login or Drive', async () => {
    const { useGoogleAccountStore } = await import('./useGoogleAccountStore');
    await useGoogleAccountStore.getState().initialize();
    expect(useGoogleAccountStore.getState()).toMatchObject({ status: 'ready', account: null, modalOpen: false });
    expect(mock.open).toHaveBeenCalledExactlyOnceWith('notex-dev-layouts');
    expect(mock.knowledgeInitialize).toHaveBeenCalledWith('en', { language: 'en' }, true);
    useGoogleAccountStore.getState().showLogin();
    await useGoogleAccountStore.getState().login();
    expect(useGoogleAccountStore.getState().modalOpen).toBe(false);
    expect(mock.googleLogin).not.toHaveBeenCalled();
    expect(mock.cloudStart).not.toHaveBeenCalled();
  });

  it('keeps normal account startup and Drive when bypass is disabled', async () => {
    vi.stubEnv('VITE_DEV_AUTH_BYPASS', 'false');
    const account = { id: 'real-account', email: 'user@gmail.com', name: 'User' };
    localStorage.setItem('notex.activeGoogleAccount', JSON.stringify(account));
    const { useGoogleAccountStore } = await import('./useGoogleAccountStore');
    await useGoogleAccountStore.getState().initialize();
    expect(useGoogleAccountStore.getState()).toMatchObject({ status: 'ready', account });
    expect(mock.open).toHaveBeenCalledExactlyOnceWith(account.id);
    expect(mock.knowledgeInitialize).toHaveBeenCalledWith('en', { language: 'en' }, false);
    expect(mock.cloudStart).toHaveBeenCalledWith(account.id);
    useGoogleAccountStore.getState().showLogin();
    expect(useGoogleAccountStore.getState().modalOpen).toBe(true);
  });
});
