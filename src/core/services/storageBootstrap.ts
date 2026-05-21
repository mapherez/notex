import { invoke, isTauri } from '@tauri-apps/api/core';

export type StorageBackend = 'sqlite';

export type StorageBootstrapResult = {
  backend: StorageBackend;
  error?: string;
};

let bootstrapPromise: Promise<StorageBootstrapResult> | null = null;

export function initializeStorage() {
  bootstrapPromise ??= bootstrapStorage();
  return bootstrapPromise;
}

async function bootstrapStorage(): Promise<StorageBootstrapResult> {
  if (!isTauri()) {
    return {
      backend: 'sqlite',
      error: 'SQLite storage requires the NoteX desktop app.',
    };
  }

  try {
    await invoke('notex_sqlite_status');
    return { backend: 'sqlite' };
  } catch (error) {
    return {
      backend: 'sqlite',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
