import { db, readSyncState, writeSyncState } from '../db/notexDb';
import type { SyncItem, SyncState } from '../models/models';

export const NOTEX_SYNC_QUEUED = 'notex-sync-queued';
export const GOOGLE_SYNC_ID = 'google-drive';

const DEVICE_ID_KEY = 'notex-device-id';

export function notifySyncQueued() {
  window.dispatchEvent(new Event(NOTEX_SYNC_QUEUED));
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

export async function enqueueNoteSync(noteId: string) {
  const state = await readSyncState();
  if (!state?.connected) {
    return;
  }

  await putSyncItem({
    entityKey: noteKey(noteId),
    entityType: 'note',
    entityId: noteId,
    status: 'pending',
  });
  notifySyncQueued();
}

export async function enqueueDeletedNoteSync(noteId: string) {
  const state = await readSyncState();
  if (!state?.connected) {
    return;
  }

  await putSyncItem({
    entityKey: noteKey(noteId),
    entityType: 'note',
    entityId: noteId,
    status: 'deleted',
    deletedAt: new Date().toISOString(),
  });
  notifySyncQueued();
}

export async function enqueueWorkspaceSync() {
  const state = await readSyncState();
  if (!state?.connected) {
    return;
  }

  await putSyncItem({
    entityKey: workspaceKey(),
    entityType: 'workspace',
    entityId: 'workspace',
    status: 'pending',
  });
  notifySyncQueued();
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
    notifySyncQueued();
    return;
  }

  await db.syncItems.put({
    ...existing,
    ...input,
    conflict: undefined,
    error: undefined,
    updatedAt,
  });
}
