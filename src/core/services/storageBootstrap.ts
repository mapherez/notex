import { invoke, isTauri } from '@tauri-apps/api/core';
import { desktopInvoke, selectDesktopLibrary } from '../storage/desktopInvoke';
import type { GoogleAccount } from './googleConfig';
import { openBrowserLibrary } from '../storage/storageRuntime';
import { isDevAuthBypassEnabled } from './developmentAuth';

export type StorageBackend = 'sqlite' | 'indexeddb';

export type StorageBootstrapResult = {
  backend: StorageBackend;
  error?: string;
  account?: GoogleAccount | null;
  requiresLogin?: boolean;
  shouldSeedDemo?: boolean;
};

let bootstrapPromise: Promise<StorageBootstrapResult> | null = null;

export function initializeStorage() {
  bootstrapPromise ??= bootstrapStorage();
  return bootstrapPromise;
}

async function bootstrapStorage(): Promise<StorageBootstrapResult> {
  if (!isTauri()) {
    try {
      if (isDevAuthBypassEnabled()) {
        await openBrowserLibrary('notex-dev-layouts');
        return { backend: 'indexeddb', account: null, shouldSeedDemo: true };
      }
      const account = readRememberedWebAccount();
      if (!account) return { backend: 'indexeddb', requiresLogin: true };
      await openBrowserLibrary(account.id);
      return { backend: 'indexeddb', account, shouldSeedDemo: false };
    } catch (error) {
      return { backend: 'indexeddb', error: error instanceof Error ? error.message : String(error) };
    }
  }

  try {
    const account = await invoke<GoogleAccount | null>('notex_library_current');
    selectDesktopLibrary(account?.id ?? null);
    const status = await desktopInvoke<{ shouldSeedDemo: boolean }>('notex_sqlite_status');
    return { backend: 'sqlite', account, shouldSeedDemo: status.shouldSeedDemo };
  } catch (error) {
    return {
      backend: 'sqlite',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function rememberWebAccount(account: GoogleAccount | null) {
  if (account) localStorage.setItem('notex.activeGoogleAccount', JSON.stringify(account));
  else localStorage.removeItem('notex.activeGoogleAccount');
}

function readRememberedWebAccount(): GoogleAccount | null {
  const raw = localStorage.getItem('notex.activeGoogleAccount');
  if (!raw) return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!value || typeof value !== 'object' || !('id' in value) || typeof value.id !== 'string' || !value.id
    || !('email' in value) || typeof value.email !== 'string' || !('name' in value) || typeof value.name !== 'string') return null;
  return value as GoogleAccount;
}
