import { create } from 'zustand';
import { db, readDeviceSessions, readSyncState, writeSyncState } from '../core/db/notexDb';
import {
  getBrokerSession,
  logoutBrokerSession,
  removeBrokerSession,
  requestBrokerAccessToken,
  sendSyncHint,
  startGoogleBrokerLogin,
  type BrokerSession,
} from '../core/services/authBroker';
import {
  clearGoogleDriveCloudData,
  countSyncWork,
  hasGoogleDriveCloudData,
  readSyncConflicts,
  replaceGoogleDriveWithLocalData,
  replaceLocalDataWithGoogleDrive,
  resolveSyncConflict,
  runGoogleDriveSync,
} from '../core/services/googleDriveSync';
import { ensureSyncState, GOOGLE_SYNC_ID, readLocalDeviceId } from '../core/services/syncQueue';
import { buildGoogleUser } from '../core/utils/userProfile';
import type { DeviceSession, Note, SyncConflictResolution, SyncItem, SyncState, User } from '../core/models/models';
import { useAppStore } from './useAppStore';
import { useKnowledgeStore } from './useKnowledgeStore';

type TokenCache = {
  accessToken: string;
  expiresAt: number;
} | null;

type SyncStore = {
  syncState: SyncState | null;
  sessions: DeviceSession[];
  conflicts: SyncItem[];
  conflictReviewOpen: boolean;
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
  openConflictReview: () => void;
  closeConflictReview: () => void;
  resolveCloudChoice: (choice: 'local' | 'cloud') => Promise<void>;
  resolveConflict: (entityKey: string, resolution: SyncConflictResolution, manualNote?: Note) => Promise<void>;
  syncNow: () => Promise<void>;
  scheduleSync: () => void;
  refreshSyncMetadata: () => Promise<void>;
};

let tokenCache: TokenCache = null;
let syncTimeout: number | null = null;
let pendingGoogleUser: User | null = null;
let syncRequested = false;

export const useSyncStore = create<SyncStore>((set, get) => ({
  syncState: null,
  sessions: [],
  conflicts: [],
  conflictReviewOpen: false,
  cloudChoice: null,
  pendingCount: 0,
  conflictCount: 0,
  isSyncing: false,
  isConnecting: false,
  isResolvingCloudChoice: false,
  hydrateSync: async () => {
    const existingSyncState = await ensureSyncState();
    const [brokerSession, counts, conflicts] = await Promise.all([readBrokerSession(), countSyncWork(), readSyncConflicts()]);

    if (brokerSession.connected) {
      const { syncState, user, sessions } = await persistBrokerSession(existingSyncState, brokerSession);
      set({ syncState, sessions, conflicts, conflictReviewOpen: conflicts.length > 0, ...counts });

      const isNewConnection = !existingSyncState.connected || existingSyncState.googleSub !== user.googleSub;
      if (isNewConnection) {
        try {
          const accessToken = await getAccessToken();
          const cloudDataExists = await hasGoogleDriveCloudData(accessToken);
          if (cloudDataExists) {
            pendingGoogleUser = user;
            set({ cloudChoice: { email: user.email ?? brokerSession.profile.email } });
            return;
          }

          await get().syncNow();
        } catch (error) {
          await persistSyncError(error);
          const latestSyncState = await readSyncState();
          set({ syncState: latestSyncState ?? syncState });
        }
      }
      return;
    }

    if (existingSyncState.connected) {
      const syncState = await markSyncDisconnected(existingSyncState, 'Reconnect Google to keep syncing');
      set({ syncState, sessions: [], conflicts, conflictReviewOpen: conflicts.length > 0, ...counts });
      return;
    }

    const sessions = await readDeviceSessions();
    set({ syncState: existingSyncState, sessions, conflicts, conflictReviewOpen: conflicts.length > 0, ...counts });
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
      set({ pendingCount: 0, conflictCount: 0, conflicts: [], conflictReviewOpen: false, isSyncing: false });
    } catch (error) {
      await persistSyncError(error);
      const syncState = await readSyncState();
      set({ syncState: syncState ?? null, isSyncing: false });
      throw error;
    }
  },
  connectGoogle: async () => {
    set({ isConnecting: true });
    startGoogleBrokerLogin();
    await new Promise<void>(() => undefined);
  },
  disconnectGoogle: async () => {
    tokenCache = null;
    await logoutBrokerSession().catch(() => undefined);
    const existing = await ensureSyncState();
    const syncState: SyncState = {
      ...existing,
      connected: false,
      updatedAt: new Date().toISOString(),
    };
    await writeSyncState(syncState);
    await db.deviceSessions.clear();
    await useKnowledgeStore.getState().setUser({
      id: 'user-local',
      provider: 'local',
      name: 'Local user',
    });
    set({ syncState, sessions: [], conflicts: [], conflictReviewOpen: false });
  },
  removeDeviceSession: async (deviceId) => {
    await removeBrokerSession(deviceId);
    const brokerSession = await readBrokerSession();
    if (brokerSession.connected) {
      set({ sessions: mapBrokerSessions(brokerSession.sessions) });
      return;
    }

    set({ sessions: [] });
  },
  openConflictReview: () => set({ conflictReviewOpen: true }),
  closeConflictReview: () => set({ conflictReviewOpen: false }),
  resolveCloudChoice: async (choice) => {
    const googleUser = pendingGoogleUser ?? useKnowledgeStore.getState().user;
    if (!googleUser) {
      set({ cloudChoice: null });
      return;
    }

    set({ isResolvingCloudChoice: true });
    try {
      const accessToken = await getAccessToken();
      let result =
        choice === 'cloud'
          ? await replaceLocalDataWithGoogleDrive(accessToken)
          : await replaceGoogleDriveWithLocalData(accessToken);
      await db.transaction('rw', [db.users], async () => {
        await db.users.clear();
        await db.users.put(googleUser);
      });
      if (choice === 'cloud') {
        result = await runGoogleDriveSync(accessToken);
      }
      if (result.pushedChanges) {
        await sendSyncHint().catch(() => undefined);
      }
      await Promise.all([
        useKnowledgeStore.getState().refreshKnowledge(),
        useAppStore.getState().hydrateSettings(),
        get().refreshSyncMetadata(),
      ]);
      pendingGoogleUser = null;
      const conflicts = await readSyncConflicts();
      set({
        cloudChoice: null,
        syncState: result.syncState,
        pendingCount: result.pendingCount,
        conflictCount: result.conflictCount,
        conflicts,
        conflictReviewOpen: result.conflictCount > 0,
        isResolvingCloudChoice: false,
      });
    } catch (error) {
      await persistSyncError(error);
      const syncState = await readSyncState();
      set({ syncState: syncState ?? null, isResolvingCloudChoice: false });
      throw error;
    }
  },
  resolveConflict: async (entityKey, resolution, manualNote) => {
    await resolveSyncConflict(entityKey, resolution, manualNote);
    await Promise.all([
      useKnowledgeStore.getState().refreshKnowledge(),
      useAppStore.getState().hydrateSettings(),
      get().refreshSyncMetadata(),
    ]);
    await get().syncNow();
  },
  syncNow: async () => {
    const state = await ensureSyncState();
    if (!state.connected) {
      return;
    }

    if (get().isSyncing) {
      syncRequested = true;
      return;
    }

    set({ isSyncing: true });
    try {
      let result = await runSingleGoogleDriveSync();
      while (syncRequested) {
        syncRequested = false;
        result = await runSingleGoogleDriveSync();
      }
      const conflicts = await readSyncConflicts();
      set({
        syncState: result.syncState,
        pendingCount: result.pendingCount,
        conflictCount: result.conflictCount,
        conflicts,
        conflictReviewOpen: result.conflictCount > 0 || (get().conflictReviewOpen && conflicts.length > 0),
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
    if (!state?.connected || syncTimeout) {
      return;
    }

    syncTimeout = window.setTimeout(() => {
      syncTimeout = null;
      void get().syncNow().catch(() => undefined);
    }, 1500);
  },
  refreshSyncMetadata: async () => {
    const [syncState, brokerSession, counts, conflicts] = await Promise.all([
      readSyncState(),
      readBrokerSession(),
      countSyncWork(),
      readSyncConflicts(),
    ]);
    if (brokerSession.connected) {
      set({
        syncState: syncState ?? null,
        sessions: mapBrokerSessions(brokerSession.sessions),
        conflicts,
        ...counts,
      });
      return;
    }

    const sessions = syncState?.connected ? [] : await readDeviceSessions();
    set({
      syncState: syncState ?? null,
      sessions,
      conflicts,
      ...counts,
    });
  },
}));

async function runSingleGoogleDriveSync() {
  const accessToken = await getAccessToken();
  const result = await runGoogleDriveSync(accessToken);
  await Promise.all([
    useKnowledgeStore.getState().refreshKnowledge(),
    useAppStore.getState().hydrateSettings(),
    useSyncStore.getState().refreshSyncMetadata(),
  ]);
  if (result.pushedChanges) {
    await sendSyncHint().catch(() => undefined);
  }

  return result;
}

async function getAccessToken() {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.accessToken;
  }

  const connection = await requestBrokerAccessToken();
  tokenCache = {
    accessToken: connection.accessToken,
    expiresAt: connection.expiresAt,
  };
  return connection.accessToken;
}

async function readBrokerSession(): Promise<BrokerSession> {
  try {
    return await getBrokerSession();
  } catch {
    return { connected: false, sessions: [] };
  }
}

async function persistBrokerSession(existing: SyncState, brokerSession: Extract<BrokerSession, { connected: true }>) {
  const user = buildGoogleUser(brokerSession.profile, brokerSession.lastLoginAt);
  const now = new Date().toISOString();
  const syncState: SyncState = {
    ...existing,
    connected: true,
    googleSub: user.googleSub,
    email: user.email,
    fullName: user.name,
    firstName: user.firstName,
    handle: user.handle,
    avatarUrl: user.avatarUrl,
    lastLoginAt: brokerSession.lastLoginAt,
    deviceId: brokerSession.currentSessionId || readLocalDeviceId(),
    updatedAt: now,
    lastError: undefined,
  };

  await writeSyncState(syncState);
  await db.transaction('rw', [db.users], async () => {
    await db.users.clear();
    await db.users.put(user);
  });
  await useKnowledgeStore.getState().refreshKnowledge();

  return {
    syncState,
    user,
    sessions: mapBrokerSessions(brokerSession.sessions),
  };
}

async function markSyncDisconnected(existing: SyncState, lastError?: string) {
  const syncState: SyncState = {
    ...existing,
    connected: false,
    lastError,
    updatedAt: new Date().toISOString(),
  };
  await writeSyncState(syncState);
  return syncState;
}

function mapBrokerSessions(sessions: Extract<BrokerSession, { connected: true }>['sessions']): DeviceSession[] {
  return sessions.map((session) => ({
    id: session.id,
    name: session.name,
    userAgent: session.userAgent,
    lastSeenAt: session.lastSeenAt,
  }));
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
