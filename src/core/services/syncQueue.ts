import { cloudSyncEnabled } from '../../config/appSettings';
import { db, readSyncState, writeSyncState } from '../storage/notexRepository';
import type { SyncItem, SyncState } from '../models/models';

export const NOTEX_SYNC_QUEUED = 'notex-sync-queued';
export const GOOGLE_SYNC_ID = 'google-drive';

const DEVICE_ID_KEY = 'notex-device-id';
let localMutationDepth = 0;

export function notifySyncQueued() {
  if (!cloudSyncEnabled) {
    return;
  }

  window.dispatchEvent(new Event(NOTEX_SYNC_QUEUED));
}

export async function runLocalMutation<T>(operation: () => Promise<T>) {
  localMutationDepth += 1;
  try {
    return await operation();
  } finally {
    localMutationDepth = Math.max(0, localMutationDepth - 1);
  }
}

export function isLocalMutationActive() {
  return localMutationDepth > 0;
}

export function readLocalDeviceId() {
  const stored = localStorage.getItem(DEVICE_ID_KEY);
  if (stored) {
    return stored;
  }

  const created = crypto.randomUUID();
  localStorage.setItem(DEVICE_ID_KEY, created);
  return created;
}

export function getDeviceName() {
  const platform = navigator.platform || 'This browser';
  return `${platform} browser`;
}

export async function ensureSyncState() {
  const existing = await readSyncState();
  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const state: SyncState = {
    id: GOOGLE_SYNC_ID,
    provider: GOOGLE_SYNC_ID,
    connected: false,
    deviceId: readLocalDeviceId(),
    updatedAt: now,
  };

  await writeSyncState(state);
  return state;
}

export async function queueNoteSync(noteId: string) {
  if (!cloudSyncEnabled) {
    return;
  }

  await putSyncItem({
    entityKey: noteKey(noteId),
    entityType: 'note',
    entityId: noteId,
    status: 'pending',
  });
}

export async function queueDeletedNoteSync(noteId: string, deletedAt = new Date().toISOString()) {
  if (!cloudSyncEnabled) {
    return;
  }

  await putSyncItem({
    entityKey: noteKey(noteId),
    entityType: 'note',
    entityId: noteId,
    status: 'deleted',
    deletedAt,
  });
}

export async function queueWorkspaceSync() {
  if (!cloudSyncEnabled) {
    return;
  }

  await putSyncItem({
    entityKey: workspaceKey(),
    entityType: 'workspace',
    entityId: 'workspace',
    status: 'pending',
  });
}

export function noteKey(noteId: string) {
  return `note:${noteId}`;
}

export function workspaceKey() {
  return 'workspace:main';
}

async function putSyncItem(input: Omit<SyncItem, 'updatedAt'>) {
  const existing = await db.syncItems.get(input.entityKey);
  const updatedAt = new Date().toISOString();
  if (existing?.status === 'conflict') {
    await db.syncItems.put({
      ...existing,
      updatedAt,
    });
    return;
  }

  await db.syncItems.put({
    ...existing,
    ...input,
    conflict: undefined,
    deletedAt: input.status === 'deleted' ? input.deletedAt : undefined,
    error: undefined,
    updatedAt,
  });
}
