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
  CloudManifestFile,
  CloudManifestNote,
  CloudNoteFile,
  CloudWorkspaceFile,
  DeviceSession,
  Note,
  SyncItem,
  SyncState,
} from '../models/models';

const MANIFEST_FILE_NAME = 'notex-manifest.json';
const WORKSPACE_FILE_NAME = 'notex-workspace.json';
type SyncFileEntityType = 'manifest' | 'workspace' | 'note';

export type GoogleDriveSyncResult = {
  syncState: SyncState;
  pendingCount: number;
  conflictCount: number;
};

export async function hasGoogleDriveCloudData(accessToken: string) {
  const files = await listNoteXCloudFiles(accessToken);
  return files.some((file) => file.name === MANIFEST_FILE_NAME || file.name === WORKSPACE_FILE_NAME || file.name.startsWith('notex-note-'));
}

export async function clearGoogleDriveCloudData(accessToken: string) {
  const files = await listNoteXCloudFiles(accessToken);
  await Promise.all(files.map((file) => deleteDriveFile(accessToken, file.id)));
  await db.syncItems.clear();

  const existingState = await ensureSyncState();
  await writeSyncState({
    ...existingState,
    workspaceFileId: undefined,
    manifestFileId: undefined,
    lastSyncAt: undefined,
    lastSyncStartedAt: undefined,
    lastError: undefined,
    updatedAt: new Date().toISOString(),
  });
}

export async function replaceGoogleDriveWithLocalData(accessToken: string): Promise<GoogleDriveSyncResult> {
  await clearGoogleDriveCloudData(accessToken);
  await touchCurrentDeviceSession();

  const manifestEntries = new Map<string, CloudManifestNote>();
  const notes = await db.notes.toArray();

  for (const note of notes) {
    const localHash = await hashNote(note);
    const savedFile = await createJsonFile(accessToken, noteFileName(note.id), buildNotePayload(note), {
      entityType: 'note',
      entityId: note.id,
    });
    manifestEntries.set(note.id, toManifestNote(note, savedFile.id, localHash, savedFile.modifiedTime));
    await markNoteSynced(note, savedFile, localHash);
  }

  const workspace = await buildWorkspacePayload();
  const workspaceHash = await hashStableJson(workspace);
  const savedWorkspaceFile = await saveWorkspaceFile(accessToken, undefined, workspace, workspaceHash);
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
  const savedManifestFile = await saveManifestFile(accessToken, undefined, manifest, manifestHash);
  const finishedAt = new Date().toISOString();
  const existingState = await ensureSyncState();
  const syncState: SyncState = {
    ...existingState,
    connected: true,
    workspaceFileId: savedWorkspaceFile.id,
    manifestFileId: savedManifestFile.id,
    lastSyncAt: finishedAt,
    lastSyncStartedAt: undefined,
    lastError: undefined,
    updatedAt: finishedAt,
  };
  await writeSyncState(syncState);

  return {
    syncState,
    pendingCount: 0,
    conflictCount: await db.syncItems.where('status').equals('conflict').count(),
  };
}

export async function replaceLocalDataWithGoogleDrive(accessToken: string): Promise<GoogleDriveSyncResult> {
  const now = new Date().toISOString();
  const existingState = await ensureSyncState();
  await writeSyncState({ ...existingState, lastSyncStartedAt: now, lastError: undefined, updatedAt: now });

  const files = await listAppDataFiles(accessToken);
  const { file: manifestFile, payload: remoteManifest } = await readLatestSyncJson<CloudManifestFile>(
    accessToken,
    files,
    MANIFEST_FILE_NAME,
    'manifest',
  );
  const { file: workspaceFile, payload: remoteWorkspace } = await readLatestSyncJson<CloudWorkspaceFile>(
    accessToken,
    files,
    WORKSPACE_FILE_NAME,
    'workspace',
  );
  const manifestFileId = manifestFile?.id;
  const workspaceFileId = workspaceFile?.id;
  const notes = remoteManifest ? await readCloudNotes(accessToken, remoteManifest) : await readCloudNoteFiles(accessToken, files);
  if (!remoteManifest && !remoteWorkspace && !notes.length) {
    throw new Error('No Google Drive data found');
  }
  const settings = remoteWorkspace?.userSettings ?? (await readUserSettings(defaultUserSettings.id)) ?? defaultUserSettings;
  const sessions = mergeSessions(remoteWorkspace?.sessions ?? [], [
    {
      id: readLocalDeviceId(),
      name: getDeviceName(),
      userAgent: navigator.userAgent,
      lastSeenAt: new Date().toISOString(),
    },
  ]);

  await db.transaction('rw', [db.notes, db.tags, db.collections, db.activities, db.userSettings, db.deviceSessions, db.syncItems], async () => {
    await db.notes.clear();
    await db.tags.clear();
    await db.collections.clear();
    await db.activities.clear();
    await db.userSettings.clear();
    await db.deviceSessions.clear();
    await db.syncItems.clear();
    await db.notes.bulkPut(notes);
    await db.tags.bulkPut(remoteWorkspace?.tags ?? []);
    await db.collections.bulkPut(remoteWorkspace?.collections ?? []);
    await db.activities.bulkPut(remoteWorkspace?.activities ?? []);
    await db.userSettings.put(settings);
    await db.deviceSessions.bulkPut(sessions);
  });

  for (const note of notes) {
    const entry = remoteManifest?.notes.find((item) => item.id === note.id);
    const hash = entry?.hash ?? (await hashNote(note));
    await db.syncItems.put({
      ...buildBaseSyncItem(noteKey(note.id), 'note', note.id),
      driveFileId: entry?.fileId,
      localHash: hash,
      remoteHash: hash,
      remoteModifiedTime: entry?.updatedAt,
      status: 'synced',
      lastSyncedAt: new Date().toISOString(),
    });
  }

  const finishedAt = new Date().toISOString();
  const latestState = await ensureSyncState();
  const syncState: SyncState = {
    ...latestState,
    connected: true,
    workspaceFileId,
    manifestFileId,
    lastSyncAt: finishedAt,
    lastSyncStartedAt: undefined,
    lastError: undefined,
    updatedAt: finishedAt,
  };
  await writeSyncState(syncState);

  return {
    syncState,
    pendingCount: 0,
    conflictCount: 0,
  };
}

export async function runGoogleDriveSync(accessToken: string): Promise<GoogleDriveSyncResult> {
  const now = new Date().toISOString();
  const existingState = await ensureSyncState();
  await writeSyncState({ ...existingState, lastSyncStartedAt: now, lastError: undefined, updatedAt: now });
  await touchCurrentDeviceSession();

  const files = await listAppDataFiles(accessToken);
  const { file: manifestFile, payload: remoteManifest } = await readLatestSyncJson<CloudManifestFile>(
    accessToken,
    files,
    MANIFEST_FILE_NAME,
    'manifest',
  );
  const workspaceFile = selectLatestSyncFile(files, WORKSPACE_FILE_NAME, 'workspace');
  const manifestFileId = manifestFile?.id;
  const workspaceFileId = workspaceFile?.id;

  const manifestEntries = new Map((remoteManifest?.notes ?? []).map((entry) => [entry.id, entry]));
  await pushLocalNotes(accessToken, manifestEntries);
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

async function pushLocalNotes(accessToken: string, manifestEntries: Map<string, CloudManifestNote>) {
  const syncItems = new Map((await readSyncItems()).map((item) => [item.entityKey, item]));
  const notes = await db.notes.toArray();
  const localNoteIds = new Set(notes.map((note) => note.id));

  for (const note of notes) {
    const key = noteKey(note.id);
    const item = syncItems.get(key);
    const remoteEntry = manifestEntries.get(note.id);
    const localHash = await hashNote(note);
    const shouldCreateRemoteFile = !remoteEntry?.fileId || remoteEntry.deletedAt;

    if (shouldCreateRemoteFile) {
      const savedFile = await createJsonFile(accessToken, noteFileName(note.id), buildNotePayload(note), {
        entityType: 'note',
        entityId: note.id,
      });
      manifestEntries.set(note.id, toManifestNote(note, savedFile.id, localHash, savedFile.modifiedTime));
      await markNoteSynced(note, savedFile, localHash);
      continue;
    }

    const locallyChanged = item?.status === 'pending' || item?.localHash !== localHash || remoteEntry.hash !== localHash;
    if (locallyChanged) {
      const savedFile = await updateJsonFile(accessToken, remoteEntry.fileId, buildNotePayload(note), {
        entityType: 'note',
        entityId: note.id,
      });
      manifestEntries.set(note.id, toManifestNote(note, remoteEntry.fileId, localHash, savedFile.modifiedTime));
      await markNoteSynced(note, savedFile, localHash);
      continue;
    }

    await markNoteSynced(note, { id: remoteEntry.fileId, modifiedTime: remoteEntry.updatedAt }, localHash);
  }

  await pushDeletedNotes(accessToken, manifestEntries, syncItems);
  await deleteRemoteNotesMissingLocally(accessToken, manifestEntries, localNoteIds);
}

async function readCloudNotes(accessToken: string, remoteManifest: CloudManifestFile | null) {
  const notes: Note[] = [];
  const noteEntries = (remoteManifest?.notes ?? []).filter((entry) => !entry.deletedAt && entry.fileId);

  for (const entry of noteEntries) {
    const payload = await readRemoteJson<CloudNoteFile>(accessToken, entry.fileId);
    if (payload?.note) {
      notes.push({ ...payload.note, syncStatus: 'synced' });
    }
  }

  return notes;
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
      await tryDeleteDriveFile(accessToken, driveFileId);
    }

    const deletedAt = item.deletedAt ?? new Date().toISOString();
    manifestEntries.delete(item.entityId);
    await db.syncItems.put({
      ...item,
      status: 'synced',
      deletedAt,
      lastSyncedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
}

async function deleteRemoteNotesMissingLocally(
  accessToken: string,
  manifestEntries: Map<string, CloudManifestNote>,
  localNoteIds: Set<string>,
) {
  const missingRemoteEntries = [...manifestEntries.values()].filter((entry) => !localNoteIds.has(entry.id));

  for (const entry of missingRemoteEntries) {
    if (entry.fileId) {
      await tryDeleteDriveFile(accessToken, entry.fileId);
    }
    manifestEntries.delete(entry.id);
    await db.syncItems.delete(noteKey(entry.id));
  }
}

async function tryDeleteDriveFile(accessToken: string, fileId: string) {
  try {
    await deleteDriveFile(accessToken, fileId);
  } catch {
    // Local data is the source of truth for normal sync. A missing remote file
    // should not block cleaning the manifest.
  }
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

async function readLatestSyncJson<T>(
  accessToken: string,
  files: DriveFileMetadata[],
  fileName: string,
  entityType: SyncFileEntityType,
): Promise<{ file?: DriveFileMetadata; payload: T | null }> {
  for (const file of selectSyncFileCandidates(files, fileName, entityType)) {
    const payload = await readRemoteJson<T>(accessToken, file.id);
    if (payload) {
      return { file, payload };
    }
  }

  return { payload: null };
}

function selectLatestSyncFile(files: DriveFileMetadata[], fileName: string, entityType: SyncFileEntityType) {
  return selectSyncFileCandidates(files, fileName, entityType)[0];
}

function selectSyncFileCandidates(files: DriveFileMetadata[], fileName: string, entityType: SyncFileEntityType) {
  return files
    .filter((file) => !file.trashed && (file.name === fileName || file.appProperties?.entityType === entityType))
    .sort(compareDriveFilesByModifiedTime);
}

async function readCloudNoteFiles(accessToken: string, files: DriveFileMetadata[]) {
  const notesById = new Map<string, Note>();
  const noteFiles = files
    .filter((file) => !file.trashed && (file.name.startsWith('notex-note-') || file.appProperties?.entityType === 'note'))
    .sort(compareDriveFilesByModifiedTime);

  for (const file of noteFiles) {
    const payload = await readRemoteJson<CloudNoteFile>(accessToken, file.id);
    if (payload?.note && !notesById.has(payload.note.id)) {
      notesById.set(payload.note.id, { ...payload.note, syncStatus: 'synced' });
    }
  }

  return [...notesById.values()];
}

function compareDriveFilesByModifiedTime(a: DriveFileMetadata, b: DriveFileMetadata) {
  return getDriveFileTime(b) - getDriveFileTime(a);
}

function getDriveFileTime(file: DriveFileMetadata) {
  const time = new Date(file.modifiedTime ?? '').getTime();
  return Number.isFinite(time) ? time : 0;
}

async function listNoteXCloudFiles(accessToken: string) {
  const files = await listAppDataFiles(accessToken);
  return files.filter((file) => {
    const entityType = file.appProperties?.entityType;
    return (
      file.name === MANIFEST_FILE_NAME ||
      file.name === WORKSPACE_FILE_NAME ||
      file.name.startsWith('notex-note-') ||
      entityType === 'manifest' ||
      entityType === 'workspace' ||
      entityType === 'note'
    );
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
  const activeAfter = Date.now() - 1000 * 60 * 60 * 24 * 30;
  return mergeById(remoteSessions, localSessions)
    .filter((session) => {
      const time = new Date(session.lastSeenAt).getTime();
      return Number.isFinite(time) && time >= activeAfter;
    })
    .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
}
