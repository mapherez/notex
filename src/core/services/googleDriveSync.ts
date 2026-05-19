import {
  createJsonFile,
  deleteDriveFile,
  getJsonFile,
  listAppDataFiles,
  updateJsonFile,
  type DriveFileMetadata,
} from './googleDrive';
import { ensureSyncState, getDeviceName, noteKey, readLocalDeviceId, workspaceKey } from './syncQueue';
import { db, readAllKnowledge, readDeviceSessions, readSyncItems, readUserSettings, writeSyncState } from '../db/notexDb';
import { defaultUserSettings } from '../../config/appSettings';
import { hashStableJson } from '../utils/stableJson';
import type {
  ActivityItem,
  CloudManifestFile,
  CloudManifestNote,
  CloudNoteFile,
  CloudWorkspaceFile,
  Collection,
  DeviceSession,
  Note,
  SyncItem,
  SyncState,
  Tag,
  User,
  UserSettings,
} from '../models/models';

const MANIFEST_FILE_NAME = 'notex-manifest.json';
const WORKSPACE_FILE_NAME = 'notex-workspace.json';

export type GoogleDriveSyncResult = {
  syncState: SyncState;
  pendingCount: number;
  conflictCount: number;
};

export async function runGoogleDriveSync(accessToken: string): Promise<GoogleDriveSyncResult> {
  const now = new Date().toISOString();
  const existingState = await ensureSyncState();
  await writeSyncState({ ...existingState, lastSyncStartedAt: now, lastError: undefined, updatedAt: now });
  await touchCurrentDeviceSession();

  const files = await listAppDataFiles(accessToken);
  const fileByName = new Map(files.map((file) => [file.name, file]));
  const manifestFileId = existingState.manifestFileId ?? fileByName.get(MANIFEST_FILE_NAME)?.id;
  const workspaceFileId = existingState.workspaceFileId ?? fileByName.get(WORKSPACE_FILE_NAME)?.id;
  const remoteManifest = manifestFileId ? await readRemoteJson<CloudManifestFile>(accessToken, manifestFileId) : null;
  const remoteWorkspace = workspaceFileId ? await readRemoteJson<CloudWorkspaceFile>(accessToken, workspaceFileId) : null;

  await mergeWorkspace(remoteWorkspace);

  const manifestEntries = new Map((remoteManifest?.notes ?? []).map((entry) => [entry.id, entry]));
  await syncNotes(accessToken, manifestEntries);
  const workspace = await buildWorkspacePayload();
  const workspaceHash = await hashStableJson(workspace);
  const savedWorkspaceFile = await saveWorkspaceFile(accessToken, workspaceFileId, workspace, workspaceHash);

  const manifest: CloudManifestFile = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    workspace: {
      fileId: savedWorkspaceFile.id,
      hash: workspaceHash,
      updatedAt: workspace.exportedAt,
    },
    notes: [...manifestEntries.values()].sort((a, b) => a.id.localeCompare(b.id)),
  };
  const manifestHash = await hashStableJson(manifest);
  const savedManifestFile = await saveManifestFile(accessToken, manifestFileId, manifest, manifestHash);

  const finishedAt = new Date().toISOString();
  const latestState = await ensureSyncState();
  const updatedState: SyncState = {
    ...latestState,
    connected: true,
    workspaceFileId: savedWorkspaceFile.id,
    manifestFileId: savedManifestFile.id,
    lastSyncAt: finishedAt,
    lastSyncStartedAt: undefined,
    lastError: undefined,
    updatedAt: finishedAt,
  };
  await writeSyncState(updatedState);

  const [pendingCount, conflictCount] = await Promise.all([
    db.syncItems.where('status').anyOf(['pending', 'deleted']).count(),
    db.syncItems.where('status').equals('conflict').count(),
  ]);

  return {
    syncState: updatedState,
    pendingCount,
    conflictCount,
  };
}

export async function countSyncWork() {
  const [pendingCount, conflictCount] = await Promise.all([
    db.syncItems.where('status').anyOf(['pending', 'deleted']).count(),
    db.syncItems.where('status').equals('conflict').count(),
  ]);

  return {
    pendingCount,
    conflictCount,
  };
}

async function syncNotes(accessToken: string, manifestEntries: Map<string, CloudManifestNote>) {
  await pullMissingRemoteNotes(accessToken, manifestEntries);

  const syncItems = new Map((await readSyncItems()).map((item) => [item.entityKey, item]));
  const notes = await db.notes.toArray();

  for (const note of notes) {
    const key = noteKey(note.id);
    const item = syncItems.get(key);
    const remoteEntry = manifestEntries.get(note.id);

    if (remoteEntry?.deletedAt) {
      if (item?.status === 'pending') {
        await createConflictCopy(accessToken, manifestEntries, remoteEntry);
      } else {
        await deleteLocalNote(note.id);
        await db.syncItems.put({
          ...buildBaseSyncItem(key, 'note', note.id),
          status: 'synced',
          remoteHash: remoteEntry.hash,
          remoteModifiedTime: remoteEntry.updatedAt,
          deletedAt: remoteEntry.deletedAt,
          lastSyncedAt: new Date().toISOString(),
        });
        continue;
      }
    }

    const localHash = await hashNote(note);
    if (!remoteEntry?.fileId) {
      const savedFile = await createJsonFile(accessToken, noteFileName(note.id), buildNotePayload(note), {
        entityType: 'note',
        entityId: note.id,
      });
      manifestEntries.set(note.id, toManifestNote(note, savedFile.id, localHash, savedFile.modifiedTime));
      await markNoteSynced(note, savedFile, localHash);
      continue;
    }

    const hasSyncHistory = Boolean(item?.localHash || item?.remoteHash);
    const locallyChanged =
      item?.status === 'pending' || (hasSyncHistory ? localHash !== item?.localHash : note.updatedAt > remoteEntry.updatedAt);
    const remotelyChanged = Boolean(item?.remoteHash && remoteEntry.hash !== item.remoteHash);

    if (locallyChanged) {
      if (remotelyChanged || (!hasSyncHistory && remoteEntry.hash !== localHash)) {
        await createConflictCopy(accessToken, manifestEntries, remoteEntry);
      }

      const savedFile = await updateJsonFile(accessToken, remoteEntry.fileId, buildNotePayload(note), {
        entityType: 'note',
        entityId: note.id,
      });
      manifestEntries.set(note.id, toManifestNote(note, remoteEntry.fileId, localHash, savedFile.modifiedTime));
      await markNoteSynced(note, savedFile, localHash);
      continue;
    }

    if (remoteEntry.hash !== localHash) {
      const remotePayload = await readRemoteJson<CloudNoteFile>(accessToken, remoteEntry.fileId);
      if (remotePayload?.note) {
        const remoteNote = { ...remotePayload.note, syncStatus: 'synced' } satisfies Note;
        await db.notes.put(remoteNote);
        await markNoteSynced(remoteNote, { id: remoteEntry.fileId, modifiedTime: remoteEntry.updatedAt }, remoteEntry.hash);
      }
      continue;
    }

    await markNoteSynced(note, { id: remoteEntry.fileId, modifiedTime: remoteEntry.updatedAt }, localHash);
  }

  await pushDeletedNotes(accessToken, manifestEntries, syncItems);
}

async function pullMissingRemoteNotes(accessToken: string, manifestEntries: Map<string, CloudManifestNote>) {
  const localNoteIds = new Set((await db.notes.toCollection().primaryKeys()) as string[]);
  const missingEntries = [...manifestEntries.values()].filter((entry) => !entry.deletedAt && !localNoteIds.has(entry.id));

  for (const entry of missingEntries) {
    const payload = await readRemoteJson<CloudNoteFile>(accessToken, entry.fileId);
    if (!payload?.note) {
      continue;
    }

    const note = { ...payload.note, syncStatus: 'synced' } satisfies Note;
    await db.notes.put(note);
    await db.syncItems.put({
      ...buildBaseSyncItem(noteKey(note.id), 'note', note.id),
      driveFileId: entry.fileId,
      localHash: entry.hash,
      remoteHash: entry.hash,
      remoteModifiedTime: entry.updatedAt,
      status: 'synced',
      lastSyncedAt: new Date().toISOString(),
    });
  }
}

async function pushDeletedNotes(
  accessToken: string,
  manifestEntries: Map<string, CloudManifestNote>,
  syncItems: Map<string, SyncItem>,
) {
  const deletedItems = [...syncItems.values()].filter((item) => item.entityType === 'note' && item.status === 'deleted');

  for (const item of deletedItems) {
    const remoteEntry = manifestEntries.get(item.entityId);
    const driveFileId = item.driveFileId ?? remoteEntry?.fileId;
    if (driveFileId) {
      await deleteDriveFile(accessToken, driveFileId);
    }

    const deletedAt = item.deletedAt ?? new Date().toISOString();
    manifestEntries.set(item.entityId, {
      id: item.entityId,
      fileId: driveFileId ?? '',
      hash: item.remoteHash ?? '',
      version: 0,
      updatedAt: deletedAt,
      deletedAt,
    });
    await db.syncItems.put({
      ...item,
      status: 'synced',
      deletedAt,
      lastSyncedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
}

async function mergeWorkspace(remoteWorkspace: CloudWorkspaceFile | null) {
  if (!remoteWorkspace) {
    return;
  }

  const [knowledge, settings, sessions] = await Promise.all([
    readAllKnowledge(),
    readUserSettings(defaultUserSettings.id),
    readDeviceSessions(),
  ]);
  const mergedSettings = pickLatestSettings(settings ?? defaultUserSettings, remoteWorkspace.userSettings);
  const mergedUser = mergeUser(knowledge.user, remoteWorkspace.user);

  await db.transaction('rw', [db.tags, db.collections, db.activities, db.users, db.userSettings, db.deviceSessions], async () => {
    await db.tags.bulkPut(mergeById(remoteWorkspace.tags, knowledge.tags));
    await db.collections.bulkPut(mergeById(remoteWorkspace.collections, knowledge.collections));
    await db.activities.bulkPut(mergeById(remoteWorkspace.activities, knowledge.activities));
    if (mergedUser) {
      await db.users.clear();
      await db.users.put(mergedUser);
    }
    await db.userSettings.put(mergedSettings);
    await db.deviceSessions.bulkPut(mergeSessions(remoteWorkspace.sessions, sessions));
  });
}

async function buildWorkspacePayload(): Promise<CloudWorkspaceFile> {
  const [knowledge, settings, sessions] = await Promise.all([
    readAllKnowledge(),
    readUserSettings(defaultUserSettings.id),
    readDeviceSessions(),
  ]);

  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    user: knowledge.user ?? null,
    userSettings: settings ?? defaultUserSettings,
    tags: knowledge.tags,
    collections: knowledge.collections,
    activities: knowledge.activities,
    sessions,
  };
}

async function saveWorkspaceFile(
  accessToken: string,
  fileId: string | undefined,
  workspace: CloudWorkspaceFile,
  workspaceHash: string,
) {
  const appProperties = { entityType: 'workspace', hash: workspaceHash };
  const savedFile = fileId
    ? await updateJsonFile(accessToken, fileId, workspace, appProperties)
    : await createJsonFile(accessToken, WORKSPACE_FILE_NAME, workspace, appProperties);

  await db.syncItems.put({
    ...buildBaseSyncItem(workspaceKey(), 'workspace', 'workspace'),
    driveFileId: savedFile.id,
    localHash: workspaceHash,
    remoteHash: workspaceHash,
    remoteModifiedTime: savedFile.modifiedTime,
    status: 'synced',
    lastSyncedAt: new Date().toISOString(),
  });

  return savedFile;
}

async function saveManifestFile(
  accessToken: string,
  fileId: string | undefined,
  manifest: CloudManifestFile,
  manifestHash: string,
) {
  const appProperties = { entityType: 'manifest', hash: manifestHash };
  return fileId
    ? updateJsonFile(accessToken, fileId, manifest, appProperties)
    : createJsonFile(accessToken, MANIFEST_FILE_NAME, manifest, appProperties);
}

async function createConflictCopy(
  accessToken: string,
  manifestEntries: Map<string, CloudManifestNote>,
  remoteEntry: CloudManifestNote,
) {
  const remotePayload = await readRemoteJson<CloudNoteFile>(accessToken, remoteEntry.fileId);
  if (!remotePayload?.note) {
    return;
  }

  const now = new Date().toISOString();
  const conflictNote: Note = {
    ...remotePayload.note,
    id: crypto.randomUUID(),
    title: `${remotePayload.note.title} (Conflict copy)`,
    createdAt: now,
    updatedAt: now,
    version: 1,
    syncStatus: 'conflict',
  };
  const hash = await hashNote(conflictNote);
  const savedFile = await createJsonFile(accessToken, noteFileName(conflictNote.id), buildNotePayload(conflictNote), {
    entityType: 'note',
    entityId: conflictNote.id,
  });

  await db.notes.put(conflictNote);
  manifestEntries.set(conflictNote.id, toManifestNote(conflictNote, savedFile.id, hash, savedFile.modifiedTime));
  await db.syncItems.put({
    ...buildBaseSyncItem(noteKey(conflictNote.id), 'note', conflictNote.id),
    driveFileId: savedFile.id,
    localHash: hash,
    remoteHash: hash,
    remoteModifiedTime: savedFile.modifiedTime,
    status: 'conflict',
    lastSyncedAt: new Date().toISOString(),
  });
}

async function markNoteSynced(note: Note, file: Pick<DriveFileMetadata, 'id' | 'modifiedTime'>, hash: string) {
  const syncedNote = { ...note, syncStatus: 'synced' } satisfies Note;
  await db.notes.put(syncedNote);
  await db.syncItems.put({
    ...buildBaseSyncItem(noteKey(note.id), 'note', note.id),
    driveFileId: file.id,
    localHash: hash,
    remoteHash: hash,
    remoteModifiedTime: file.modifiedTime,
    status: 'synced',
    lastSyncedAt: new Date().toISOString(),
  });
}

async function touchCurrentDeviceSession() {
  const session: DeviceSession = {
    id: readLocalDeviceId(),
    name: getDeviceName(),
    userAgent: navigator.userAgent,
    lastSeenAt: new Date().toISOString(),
  };

  await db.deviceSessions.put(session);
}

async function readRemoteJson<T>(accessToken: string, fileId: string): Promise<T | null> {
  try {
    return await getJsonFile<T>(accessToken, fileId);
  } catch {
    return null;
  }
}

async function deleteLocalNote(noteId: string) {
  await db.transaction('rw', [db.notes, db.activities], async () => {
    await db.notes.delete(noteId);
    await db.activities.where('noteId').equals(noteId).delete();
  });
}

function buildBaseSyncItem(entityKey: string, entityType: SyncItem['entityType'], entityId: string) {
  return {
    entityKey,
    entityType,
    entityId,
    updatedAt: new Date().toISOString(),
  };
}

function buildNotePayload(note: Note): CloudNoteFile {
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    note,
  };
}

async function hashNote(note: Note) {
  const { syncStatus: _syncStatus, ...hashableNote } = note;
  return hashStableJson(hashableNote);
}

function toManifestNote(note: Note, fileId: string, hash: string, modifiedTime?: string): CloudManifestNote {
  return {
    id: note.id,
    fileId,
    hash,
    version: note.version,
    updatedAt: modifiedTime ?? note.updatedAt,
  };
}

function noteFileName(noteId: string) {
  return `notex-note-${noteId}.json`;
}

function mergeById<T extends { id: string }>(remoteItems: T[], localItems: T[]) {
  return [...new Map([...remoteItems, ...localItems].map((item) => [item.id, item])).values()];
}

function mergeSessions(remoteSessions: DeviceSession[], localSessions: DeviceSession[]) {
  return mergeById(remoteSessions, localSessions).sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
}

function pickLatestSettings(localSettings: UserSettings, remoteSettings: UserSettings) {
  return remoteSettings.updatedAt > localSettings.updatedAt ? remoteSettings : localSettings;
}

function mergeUser(localUser?: User | null, remoteUser?: User | null) {
  if (localUser?.provider === 'google') {
    return localUser;
  }

  return remoteUser ?? localUser ?? null;
}
