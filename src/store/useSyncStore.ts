import { create } from 'zustand';
import { db, readDeviceSessions, readSyncState, writeSyncState } from '../core/db/notexDb';
import { requestGoogleConnection } from '../core/services/googleIdentity';
import {
  clearGoogleDriveCloudData,
  countSyncWork,
  hasGoogleDriveCloudData,
  replaceGoogleDriveWithLocalData,
  replaceLocalDataWithGoogleDrive,
  runGoogleDriveSync,
} from '../core/services/googleDriveSync';
import { ensureSyncState, GOOGLE_SYNC_ID, readLocalDeviceId } from '../core/services/syncQueue';
import { buildGoogleUser, type GoogleUserProfile } from '../core/utils/userProfile';
import type { DeviceSession, SyncState, User } from '../core/models/models';
import { useAppStore } from './useAppStore';
import { useKnowledgeStore } from './useKnowledgeStore';

type TokenCache = {
  accessToken: string;
  expiresAt: number;
} | null;

type SyncStore = {
  syncState: SyncState | null;
  sessions: DeviceSession[];
  cloudChoice: { email: string } | null;
  pendingCount: number;
  conflictCount: number;
  isSyncing: boolean;
  isConnecting: boolean;
  isResolvingCloudChoice: boolean;
  hydrateSync: () => Promise<void>;
  clearCloudData: () => Promise<void>;
  connectGoogle: () => Promise<void>;
  disconnectGoogle: () => Promise<void>;
  removeDeviceSession: (deviceId: string) => Promise<void>;
  resolveCloudChoice: (choice: 'local' | 'cloud') => Promise<void>;
  syncNow: () => Promise<void>;
  scheduleSync: () => void;
  refreshSyncMetadata: () => Promise<void>;
};

let tokenCache: TokenCache = null;
let syncTimeout: number | null = null;
let pendingConnection: ({ profile: GoogleUserProfile } & NonNullable<TokenCache>) | null = null;
let pendingGoogleUser: User | null = null;

export const useSyncStore = create<SyncStore>((set, get) => ({
  syncState: null,
  sessions: [],
  cloudChoice: null,
  pendingCount: 0,
  conflictCount: 0,
  isSyncing: false,
  isConnecting: false,
  isResolvingCloudChoice: false,
  hydrateSync: async () => {
    const syncState = await ensureSyncState();
    const [sessions, counts] = await Promise.all([readDeviceSessions(), countSyncWork()]);
    set({
      syncState,
      sessions,
      ...counts,
    });
  },
  clearCloudData: async () => {
    const state = await ensureSyncState();
    if (!state.connected) {
      return;
    }

    set({ isSyncing: true });
    try {
      const accessToken = await getAccessToken();
      await clearGoogleDriveCloudData(accessToken);
      await get().refreshSyncMetadata();
      set({ pendingCount: 0, conflictCount: 0, isSyncing: false });
    } catch (error) {
      await persistSyncError(error);
      const syncState = await readSyncState();
      set({ syncState: syncState ?? null, isSyncing: false });
      throw error;
    }
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
      const cloudDataExists = await hasGoogleDriveCloudData(connection.accessToken);
      if (cloudDataExists) {
        pendingConnection = {
          accessToken: connection.accessToken,
          expiresAt: connection.expiresAt,
          profile: connection.profile,
        };
        pendingGoogleUser = user;
        set({ syncState, cloudChoice: { email: user.email ?? connection.profile.email }, isConnecting: false });
        return;
      }

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
    await db.deviceSessions.clear();
    set({ syncState, sessions: [] });
  },
  removeDeviceSession: async (deviceId) => {
    await db.deviceSessions.delete(deviceId);
    const sessions = await readDeviceSessions();
    set({ sessions });
    await useAppStore.getState().replaceSettings(useAppStore.getState().settings);
  },
  resolveCloudChoice: async (choice) => {
    if (!pendingConnection || !pendingGoogleUser) {
      set({ cloudChoice: null });
      return;
    }

    const googleUser = pendingGoogleUser;
    set({ isResolvingCloudChoice: true });
    try {
      tokenCache = {
        accessToken: pendingConnection.accessToken,
        expiresAt: pendingConnection.expiresAt,
      };
      let result =
        choice === 'cloud'
          ? await replaceLocalDataWithGoogleDrive(pendingConnection.accessToken)
          : await replaceGoogleDriveWithLocalData(pendingConnection.accessToken);
      await db.transaction('rw', [db.users], async () => {
        await db.users.clear();
        await db.users.put(googleUser);
      });
      if (choice === 'cloud') {
        result = await runGoogleDriveSync(pendingConnection.accessToken);
      }
      await Promise.all([
        useKnowledgeStore.getState().refreshKnowledge(),
        useAppStore.getState().hydrateSettings(),
        get().refreshSyncMetadata(),
      ]);
      pendingConnection = null;
      pendingGoogleUser = null;
      set({
        cloudChoice: null,
        syncState: result.syncState,
        pendingCount: result.pendingCount,
        conflictCount: result.conflictCount,
        isResolvingCloudChoice: false,
      });
    } catch (error) {
      await persistSyncError(error);
      const syncState = await readSyncState();
      set({ syncState: syncState ?? null, isResolvingCloudChoice: false });
      throw error;
    }
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
