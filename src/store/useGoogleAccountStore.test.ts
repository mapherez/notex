import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGoogleAccountStore } from './useGoogleAccountStore';
const mock = vi.hoisted(() => ({ invoke: vi.fn(), cloudStart: vi.fn(), cloudStop: vi.fn(), select: vi.fn(), mcpStart: vi.fn(), mcpStop: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: mock.invoke, isTauri: () => true }));
vi.mock('../core/db/notexDb', () => ({ db: { userSettings: { get: async () => ({}) } } }));
vi.mock('../core/mcp/noteMutationCoordinator', () => ({ waitForNoteMutations: async () => {} }));
vi.mock('../core/services/storageBootstrap', () => ({ initializeStorage: vi.fn(), rememberWebAccount: vi.fn() }));
vi.mock('../core/services/googleWebAuth', () => ({ clearGoogleWebAuthorization: vi.fn(), loginGoogleWeb: vi.fn() }));
vi.mock('../core/storage/storageRuntime', () => ({ closeBrowserLibrary: vi.fn(), openBrowserLibrary: vi.fn() }));
vi.mock('../core/storage/desktopInvoke', () => ({ desktopInvoke: vi.fn(), pauseDesktopStorage: async () => {}, selectDesktopLibrary: mock.select }));
vi.mock('./useAppStore', () => ({ useAppStore: { setState: vi.fn(), getState: () => ({ settings: { language: 'en' }, hydrateSettings: async () => {} }) } }));
vi.mock('./useNotesStore', () => ({ useNotesStore: { setState: vi.fn(), getState: () => ({ initialize: async () => {} }) } }));
vi.mock('./useKnowledgeStore', () => ({ useKnowledgeStore: { setState: vi.fn(), getState: () => ({ initialize: async () => {} }) } }));
vi.mock('./useCloudStore', () => ({ useCloudStore: { getState: () => ({ start: mock.cloudStart, stop: mock.cloudStop }) } }));
vi.mock('./useLocalMcpStore', () => ({ useLocalMcpStore: { getState: () => ({ connection: { state: 'running' }, start: mock.mcpStart, stop: mock.mcpStop }) } }));
const account = { id: 'a', email: 'a@gmail.com', name: 'A' };
beforeEach(() => {
  vi.resetAllMocks();
  useGoogleAccountStore.setState({ account, status: 'ready', error: null, modalOpen: true, authorizing: false, pendingAccount: null, adoptionChoices: {} });
});
describe('desktop account transitions', () => {
  it('ignores authorization arriving after the login modal was cancelled', async () => {
    let finish!: (value: typeof account) => void;
    mock.invoke.mockImplementation((command) => command === 'notex_google_login' ? new Promise((resolve) => { finish = resolve; }) : Promise.resolve());
    const login = useGoogleAccountStore.getState().login();
    useGoogleAccountStore.getState().closeLogin();
    finish({ ...account, id: 'b' });
    await login;
    expect(useGoogleAccountStore.getState().account).toEqual(account);
    expect(mock.cloudStop).not.toHaveBeenCalled();
    expect(mock.invoke).not.toHaveBeenCalledWith('notex_google_activate', expect.anything());
  });
  it('restores the original account and services when logout fails', async () => {
    mock.invoke.mockRejectedValueOnce(new Error('Logout failed'));
    await useGoogleAccountStore.getState().logout();
    expect(useGoogleAccountStore.getState()).toMatchObject({ account, status: 'ready', authorizing: false });
    expect(mock.select).toHaveBeenCalledWith('a');
    expect(mock.cloudStart).toHaveBeenCalledWith('a');
    expect(mock.mcpStart).toHaveBeenCalledOnce();
  });
  it('keeps the verified candidate after an adoption conflict and accepts a later resolution', async () => {
    const next = { ...account, id: 'b' };
    mock.invoke.mockResolvedValueOnce(next).mockRejectedValueOnce(new Error('ACCOUNT_NOTE_CONFLICT:note'));
    await useGoogleAccountStore.getState().login();
    expect(useGoogleAccountStore.getState()).toMatchObject({ account, pendingAccount: next, status: 'ready' });
    expect(mock.mcpStart).toHaveBeenCalledOnce();
    useGoogleAccountStore.setState({ adoptionChoices: { note: 'local' } });
    mock.invoke.mockResolvedValueOnce(next);
    await useGoogleAccountStore.getState().login();
    expect(mock.invoke).toHaveBeenLastCalledWith('notex_google_activate', { libraryId: 'a', resolutions: { note: 'local' } });
    expect(useGoogleAccountStore.getState()).toMatchObject({ account: next, pendingAccount: null, status: 'ready', modalOpen: false });
  });
});
