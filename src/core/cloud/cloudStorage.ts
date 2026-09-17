import { isTauri } from '@tauri-apps/api/core';
import { desktopInvokeForLibrary } from '../storage/desktopInvoke';
import { currentBrowserStorage } from '../storage/storageRuntime';
import type { PendingBackup } from '../storage/backupState';
import type { CatalogEntry, DriveCatalog, NoteBackup } from './backupFormat';

export type NoteSnapshot = { backup: NoteBackup | null; version: number | null; changeToken: string | null };
export type CloudStorage = {
  getState: <T>(id: string) => Promise<T | undefined>;
  putState: <T>(id: string, value: T) => Promise<void>;
  pending: () => Promise<PendingBackup[]>;
  acknowledge: (id: string, token: string) => Promise<void>;
  snapshot: (id: string) => Promise<NoteSnapshot>;
  apply: (id: string, backup: NoteBackup | null, entry: CatalogEntry, expected: NoteSnapshot) => Promise<void>;
  applyOrganization: (catalog: DriveCatalog) => Promise<void>;
  readBlob: (path: string) => Promise<Blob | undefined>;
  writeBlob: (path: string, blob: Blob) => Promise<void>;
};

export function cloudStorage(accountId: string): CloudStorage {
  if (!isTauri()) return currentBrowserStorage();
  const call = <T>(action: string, input: Record<string, unknown> = {}) =>
    desktopInvokeForLibrary<T>(accountId, 'notex_cloud_storage', { action, input });
  return {
    getState: async <T>(id: string) => (await call<T | null>('state', { id })) ?? undefined,
    putState: (id, value) => call('putState', { id, value }),
    pending: () => call('pending'),
    acknowledge: (id, token) => call('acknowledge', { id, token }),
    snapshot: (id) => call('snapshot', { id }),
    apply: (id, backup, entry, expected) => call('apply', { id, backup, entry, expectedVersion: expected.version, expectedToken: expected.changeToken }),
    applyOrganization: (catalog) => call('applyOrganization', { catalog }),
    readBlob: async (id) => {
      const encoded = await call<string>('readBlob', { id });
      return new Blob([Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0))]);
    },
    writeBlob: async (id, blob) => {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      await call('writeBlob', { id, base64 });
    },
  };
}
