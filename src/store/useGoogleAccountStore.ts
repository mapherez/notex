import { invoke, isTauri } from '@tauri-apps/api/core';
import { create } from 'zustand';
import { defaultUserSettings } from '../config/appSettings';
import { db } from '../core/db/notexDb';
import { waitForNoteMutations } from '../core/mcp/noteMutationCoordinator';
import type { GoogleAccount } from '../core/services/googleConfig';
import { clearGoogleWebAuthorization, loginGoogleWeb } from '../core/services/googleWebAuth';
import { initializeStorage, rememberWebAccount } from '../core/services/storageBootstrap';
import { desktopInvoke, pauseDesktopStorage, selectDesktopLibrary } from '../core/storage/desktopInvoke';
import { closeBrowserLibrary, openBrowserLibrary } from '../core/storage/storageRuntime';
import { useAppStore } from './useAppStore';
import { useKnowledgeStore } from './useKnowledgeStore';
import { useNotesStore } from './useNotesStore';
import { useCloudStore } from './useCloudStore';
import { beginLibraryTransition } from '../core/storage/libraryTransition';

type AccountState = {
  account: GoogleAccount | null;
  status: 'starting' | 'ready' | 'login-required' | 'switching' | 'error';
  error: string | null;
  modalOpen: boolean;
  authorizing: boolean;
  pendingAccount: GoogleAccount | null;
  adoptionChoices: Record<string, string>;
  initialize: () => Promise<void>;
  showLogin: () => void;
  closeLogin: () => void;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  resolveAdoption: (choice: 'local' | 'remote') => void;
};
let initialization: Promise<void> | undefined;
let loginAttempt = 0;

async function loadLibrary(seedDemo: boolean) {
  if (!seedDemo && !(await db.userSettings.get(defaultUserSettings.id))) {
    await db.userSettings.put({ ...useAppStore.getState().settings,
      primaryCollectionId: '', favoriteTagIds: [], pinnedNoteIds: [], quickPinNoteIds: [], noteHiddenPanelIds: [] });
  }
  await useAppStore.getState().hydrateSettings();
  const settings = useAppStore.getState().settings;
  await useKnowledgeStore.getState().initialize(settings.language, settings, seedDemo);
  await useNotesStore.getState().initialize();
}

function clearLibraryView() {
  useNotesStore.setState({ notes: [], isReady: false });
  useKnowledgeStore.setState({ tags: [], collections: [], activities: [], user: null, isReady: false });
  useAppStore.setState({ isHydrated: false });
}

async function prepareSwitch() {
  let restoreMcp = async () => {};
  try {
    await useCloudStore.getState().stop();
    if (isTauri()) {
      const { useLocalMcpStore } = await import('./useLocalMcpStore');
      if (useLocalMcpStore.getState().connection.state === 'running') {
        restoreMcp = () => useLocalMcpStore.getState().start();
        await useLocalMcpStore.getState().stop();
      }
    }
    await waitForNoteMutations();
    if (isTauri()) await pauseDesktopStorage();
    return restoreMcp;
  } catch (error) { await restoreMcp(); throw error; }
}

export const useGoogleAccountStore = create<AccountState>((set, get) => ({
  account: null, status: 'starting', error: null, modalOpen: false, authorizing: false, pendingAccount: null, adoptionChoices: {},
  initialize: async () => {
    initialization ??= (async () => {
      const result = await initializeStorage();
      if (result.error) throw new Error(result.error);
      if (result.requiresLogin) { set({ status: 'login-required', modalOpen: true }); return; }
      await loadLibrary(result.shouldSeedDemo ?? false);
      set({ status: 'ready', account: result.account ?? null });
      if (result.account) await useCloudStore.getState().start(result.account.id);
    })().catch((error) => { set({ status: 'error', error: String(error instanceof Error ? error.message : error) }); });
    await initialization;
  },
  showLogin: () => set({ modalOpen: true, error: null }),
  closeLogin: () => {
    if (get().status === 'switching' || (get().authorizing && get().pendingAccount)) return;
    loginAttempt++;
    if (isTauri()) void invoke('notex_google_cancel_login');
    else clearGoogleWebAuthorization();
    set({ modalOpen: !isTauri() && !get().account, authorizing: false, error: null, pendingAccount: null, adoptionChoices: {} });
  },
  login: async () => {
    if (get().authorizing || get().status === 'switching') return;
    const previousAccount = get().account;
    const previousStatus = get().status;
    const attempt = ++loginAttempt;
    set({ modalOpen: true, authorizing: true, error: null });
    let activated = false;
    let prepared = false;
    let release: (() => void) | undefined;
    let restoreMcp: (() => Promise<void>) | undefined;
    try {
      release = beginLibraryTransition();
      // The web call must happen in this click's stack, before any await.
      const authorized = get().pendingAccount ?? (isTauri() ? await invoke<GoogleAccount>('notex_google_login') : await loginGoogleWeb());
      if (attempt !== loginAttempt) return;
      set({ pendingAccount: authorized });
      prepared = true;
      restoreMcp = await prepareSwitch();
      set({ status: 'switching' });
      const account = isTauri()
        ? await invoke<GoogleAccount>('notex_google_activate', { libraryId: previousAccount?.id ?? null, resolutions: get().adoptionChoices })
        : authorized;
      activated = true;
      clearLibraryView();
      if (isTauri()) selectDesktopLibrary(account.id);
      else { await openBrowserLibrary(account.id); rememberWebAccount(account); }
      set({ account });
      await loadLibrary(false);
      set({ status: 'ready', modalOpen: false, pendingAccount: null, adoptionChoices: {} });
      await useCloudStore.getState().start(account.id);
    } catch (error) {
      if (attempt !== loginAttempt) return;
      if (!activated && prepared && isTauri()) selectDesktopLibrary(previousAccount?.id ?? null);
      set({ status: activated ? 'error' : previousStatus, error: error instanceof Error ? error.message : String(error) });
      if (!activated && prepared && previousAccount) await useCloudStore.getState().start(previousAccount.id);
      if (!activated) await restoreMcp?.();
    } finally { release?.(); if (attempt === loginAttempt) set({ authorizing: false }); }
  },
  resolveAdoption: (choice) => {
    const error = get().error;
    if (!error?.startsWith('ACCOUNT_NOTE_CONFLICT:')) return;
    const id = error.slice('ACCOUNT_NOTE_CONFLICT:'.length);
    set({ adoptionChoices: { ...get().adoptionChoices, [id]: choice } });
    void get().login();
  },
  logout: async () => {
    if (get().authorizing || get().status !== 'ready') return;
    const previous = get().account;
    if (!previous) return;
    set({ authorizing: true, error: null });
    let loggedOut = false;
    let prepared = false;
    let release: (() => void) | undefined;
    let restoreMcp: (() => Promise<void>) | undefined;
    try {
      release = beginLibraryTransition();
      prepared = true;
      restoreMcp = await prepareSwitch();
      set({ status: 'switching' });
      if (isTauri()) {
        await invoke('notex_library_logout', { libraryId: previous.id });
        selectDesktopLibrary(null);
      } else {
        rememberWebAccount(null);
        clearGoogleWebAuthorization();
        closeBrowserLibrary();
      }
      loggedOut = true;
      clearLibraryView();
      set({ account: null });
      if (isTauri()) {
        const status = await desktopInvoke<{ shouldSeedDemo: boolean }>('notex_sqlite_status');
        await loadLibrary(status.shouldSeedDemo);
        set({ status: 'ready' });
      } else set({ status: 'login-required', modalOpen: true });
    } catch (error) {
      if (!loggedOut && prepared && isTauri()) selectDesktopLibrary(previous.id);
      set({ status: loggedOut ? 'error' : 'ready', error: error instanceof Error ? error.message : String(error) });
      if (!loggedOut && prepared) await useCloudStore.getState().start(previous.id);
      if (!loggedOut) await restoreMcp?.();
    } finally { release?.(); set({ authorizing: false }); }
  },
}));
