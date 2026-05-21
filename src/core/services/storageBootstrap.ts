import { invoke, isTauri } from '@tauri-apps/api/core';
import { defaultUserSettings } from '../../config/appSettings';
import {
  readIndexedDbMigrationSnapshot,
  useIndexedDbStorage,
  useSqliteStorage,
  type IndexedDbMigrationSnapshot,
} from '../db/notexDb';

export type StorageBackend = 'indexeddb' | 'sqlite';

export type StorageBootstrapResult = {
  backend: StorageBackend;
  migrated: boolean;
  error?: string;
};

type SqliteStatus = {
  initialized: boolean;
  migrationCompleted: boolean;
  databasePath: string;
  backupDirectory: string;
};

let bootstrapPromise: Promise<StorageBootstrapResult> | null = null;

export function initializeStorage() {
  bootstrapPromise ??= bootstrapStorage();
  return bootstrapPromise;
}

async function bootstrapStorage(): Promise<StorageBootstrapResult> {
  useIndexedDbStorage();

  if (!isTauri()) {
    return { backend: 'indexeddb', migrated: false };
  }

  try {
    const status = await invoke<SqliteStatus>('notex_sqlite_status');
    if (status.migrationCompleted) {
      useSqliteStorage();
      return { backend: 'sqlite', migrated: false };
    }

    const snapshot = await readIndexedDbMigrationSnapshot(defaultUserSettings);
    await invoke('notex_sqlite_migrate_from_indexeddb', { snapshot });
    useSqliteStorage();
    return { backend: 'sqlite', migrated: true };
  } catch (error) {
    useIndexedDbStorage();
    return {
      backend: 'indexeddb',
      migrated: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export type { IndexedDbMigrationSnapshot };
