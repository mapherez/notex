import { create } from 'zustand';
import { readDeviceSessions, readSyncState, writeSyncState } from '../core/db/notexDb';
import { requestGoogleConnection } from '../core/services/googleIdentity';
import { countSyncWork, runGoogleDriveSync } from '../core/services/googleDriveSync';
import { ensureSyncState, GOOGLE_SYNC_ID, readLocalDeviceId } from '../core/services/syncQueue';
import { buildGoogleUser } from '../core/utils/userProfile';
import type { DeviceSession, SyncState } from '../core/models/models';
import { useAppStore } from './useAppStore';
import { useKnowledgeStore } from './useKnowledgeStore';

type TokenCache = {
  accessToken: string;
  expiresAt: number;
} | null;

type SyncStore = {
  syncState: SyncState | null;
  sessions: DeviceSession[];
  pendingCount: number;
  conflictCount: number;
  isSyncing: boolean;
  isConnecting: boolean;
  hydrateSync: () => Promise<void>;
  connectGoogle: () => Promise<void>;
  disconnectGoogle: () => Promise<void>;
  syncNow: () => Promise<void>;
  scheduleSync: () => void;
  refreshSyncMetadata: () => Promise<void>;
};

let tokenCache: TokenCache = null;
let syncTimeout: number | null = null;

export const useSyncStore = create<SyncStore>((set, get) => ({
  syncState: null,
  sessions: [],
  pendingCount: 0,
  conflictCount: 0,
  isSyncing: false,
  isConnecting: false,
  hydrateSync: async () => {
    const syncState = await ensureSyncState();
    const [sessions, counts] = await Promise.all([readDeviceSessions(), countSyncWork()]);
    set({
      syncState,
      sessions,
      ...counts,
    });
  },
  connectGoogle: async () => {
    set({ isConnecting: true });
    try {
      const connection = await requestGoogleConnection('consent');
      tokenCache = {
        accessToken: connection.accessToken,
        expiresAt: connection.expiresAt,
      };
      const now = new Date().toISOString();
      const user = buildGoogleUser(connection.profile, now);
      const existing = await ensureSyncState();
      const syncState: SyncState = {
        ...existing,
        connected: true,
        googleSub: user.googleSub,
        email: user.email,
        fullName: user.name,
        firstName: user.firstName,
        handle: user.handle,
        avatarUrl: user.avatarUrl,
        lastLoginAt: now,
        deviceId: readLocalDeviceId(),
        updatedAt: now,
        lastError: undefined,
      };

      await writeSyncState(syncState);
      await useKnowledgeStore.getState().setUser(user);
      set({ syncState, isConnecting: false });
      await get().syncNow();
    } catch (error) {
      await persistSyncError(error);
      const syncState = await readSyncState();
      set({ syncState: syncState ?? null, isConnecting: false });
      throw error;
    }
  },
  disconnectGoogle: async () => {
    tokenCache = null;
    const existing = await ensureSyncState();
    const syncState: SyncState = {
      ...existing,
      connected: false,
      updatedAt: new Date().toISOString(),
    };
    await writeSyncState(syncState);
    set({ syncState });
  },
  syncNow: async () => {
    const state = await ensureSyncState();
    if (!state.connected || get().isSyncing) {
      return;
    }

    set({ isSyncing: true });
    try {
      const accessToken = await getAccessToken();
      const result = await runGoogleDriveSync(accessToken);
      await Promise.all([
        useKnowledgeStore.getState().refreshKnowledge(),
        useAppStore.getState().hydrateSettings(),
        get().refreshSyncMetadata(),
      ]);
      set({
        syncState: result.syncState,
        pendingCount: result.pendingCount,
        conflictCount: result.conflictCount,
        isSyncing: false,
      });
    } catch (error) {
      await persistSyncError(error);
      const syncState = await readSyncState();
      set({ syncState: syncState ?? null, isSyncing: false });
      throw error;
    }
  },
  scheduleSync: () => {
    const state = get().syncState;
    if (!state?.connected || !tokenCache || Date.now() >= tokenCache.expiresAt || syncTimeout) {
      return;
    }

    syncTimeout = window.setTimeout(() => {
      syncTimeout = null;
      void get().syncNow().catch(() => undefined);
    }, 1500);
  },
  refreshSyncMetadata: async () => {
    const [syncState, sessions, counts] = await Promise.all([readSyncState(), readDeviceSessions(), countSyncWork()]);
    set({
      syncState: syncState ?? null,
      sessions,
      ...counts,
    });
  },
}));

async function getAccessToken() {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.accessToken;
  }

  const connection = await requestGoogleConnection('');
  tokenCache = {
    accessToken: connection.accessToken,
    expiresAt: connection.expiresAt,
  };
  return connection.accessToken;
}

async function persistSyncError(error: unknown) {
  const existing = await ensureSyncState();
  await writeSyncState({
    ...existing,
    id: GOOGLE_SYNC_ID,
    provider: GOOGLE_SYNC_ID,
    lastError: error instanceof Error ? error.message : 'Sync failed',
    lastSyncStartedAt: undefined,
    updatedAt: new Date().toISOString(),
  });
}
