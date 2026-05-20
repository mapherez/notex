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
  NoteStats,
  SyncConflictResolution,
  SyncItem,
  SyncState,
} from '../models/models';

const MANIFEST_FILE_NAME = 'notex-manifest.json';
const WORKSPACE_FILE_NAME = 'notex-workspace.json';
const CONFLICT_COPY_SUFFIX = ' (local copy)';

type SyncFileEntityType = 'manifest' | 'workspace' | 'note';

type RemoteNoteRecord = {
  entry: CloudManifestNote;
  note: Note | null;
};

type NoteSyncWorkResult = {
  changed: boolean;
  pulled: boolean;
  pushed: boolean;
};

type WorkspaceSyncResult = {
  changed: boolean;
  pulled: boolean;
  pushed: boolean;
  fileId?: string;
  hash?: string;
  updatedAt?: string;
};

export type GoogleDriveSyncResult = {
  syncState: SyncState;
  pendingCount: number;
  conflictCount: number;
  pulledChanges?: boolean;
  pushedChanges?: boolean;
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
      hash: localHash,
    });
    manifestEntries.set(note.id, toManifestNote(note, savedFile, localHash));
    await markNoteSynced(note, savedFile, localHash);
  }

  const workspace = await buildWorkspacePayload();
  const workspaceHash = await hashWorkspace(workspace);
  const savedWorkspaceFile = await saveWorkspaceFile(accessToken, undefined, workspace, workspaceHash);
  const manifest = buildManifest(manifestEntries, savedWorkspaceFile.id, workspaceHash, workspace.exportedAt);
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
    pushedChanges: true,
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
  const manifestEntries = new Map((remoteManifest?.notes ?? []).map((entry) => [entry.id, entry]));
  await mergeRemoteNoteFilesIntoManifest(accessToken, files, manifestEntries);
  const noteRecords = remoteManifest ? await readRemoteNotes(accessToken, [...manifestEntries.values()]) : await readCloudNoteFiles(accessToken, files);
  const notes = noteRecords.flatMap((record) => (record.note ? [{ ...record.note, syncStatus: 'synced' } satisfies Note] : []));

  if (!remoteManifest && !remoteWorkspace && !notes.length) {
    throw new Error('No Google Drive data found');
  }

  const settings = remoteWorkspace?.userSettings ?? (await readUserSettings(defaultUserSettings.id)) ?? defaultUserSettings;
  const sessions = mergeSessions(remoteWorkspace?.sessions ?? [], [buildCurrentDeviceSession()]);

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

  for (const record of noteRecords) {
    if (record.entry.deletedAt) {
      await markNoteDeletedSynced(record.entry.id, record.entry);
      continue;
    }

    if (record.note) {
      const hash = record.entry.hash || (await hashNote(record.note));
      await markNoteSynced(record.note, { id: record.entry.fileId ?? '', modifiedTime: record.entry.updatedAt }, hash, record.entry);
    }
  }

  if (remoteWorkspace) {
    const workspaceHash = remoteManifest?.workspace?.hash ?? (await hashWorkspace(remoteWorkspace));
    await markWorkspaceSynced(workspaceFile?.id ?? remoteManifest?.workspace?.fileId, workspaceHash, workspaceFile?.modifiedTime ?? remoteWorkspace.exportedAt);
  }

  const finishedAt = new Date().toISOString();
  const latestState = await ensureSyncState();
  const syncState: SyncState = {
    ...latestState,
    connected: true,
    workspaceFileId: workspaceFile?.id ?? remoteManifest?.workspace?.fileId,
    manifestFileId: manifestFile?.id,
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
    pulledChanges: true,
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
  const manifestEntries = new Map((remoteManifest?.notes ?? []).map((entry) => [entry.id, entry]));
  const orphanNotesMerged = await mergeRemoteNoteFilesIntoManifest(accessToken, files, manifestEntries);

  const pullResult = await pullRemoteNoteChanges(accessToken, manifestEntries);
  const pushResult = await pushLocalNoteChanges(accessToken, manifestEntries);
  const workspaceResult = await syncWorkspace(accessToken, files, remoteManifest);
  let safetyPulled = false;
  const shouldSaveManifest = orphanNotesMerged || pullResult.changed || pushResult.changed || workspaceResult.changed || !manifestFile;
  let savedManifestFile = manifestFile;

  if (shouldSaveManifest) {
    const manifest = buildManifest(manifestEntries, workspaceResult.fileId, workspaceResult.hash, workspaceResult.updatedAt);
    const manifestHash = await hashStableJson(manifest);
    savedManifestFile = await saveManifestFile(accessToken, manifestFile?.id, manifest, manifestHash);
  }

  if (pushResult.pushed || workspaceResult.pushed) {
    const latestFiles = await listAppDataFiles(accessToken);
    const { payload: latestManifest } = await readLatestSyncJson<CloudManifestFile>(
      accessToken,
      latestFiles,
      MANIFEST_FILE_NAME,
      'manifest',
    );
    const latestEntries = new Map((latestManifest?.notes ?? []).map((entry) => [entry.id, entry]));
    const safetyMergedOrphans = await mergeRemoteNoteFilesIntoManifest(accessToken, latestFiles, latestEntries);
    const safetyResult = await pullRemoteNoteChanges(accessToken, latestEntries);
    safetyPulled = safetyResult.pulled;
    if (safetyMergedOrphans) {
      const manifest = buildManifest(latestEntries, workspaceResult.fileId, workspaceResult.hash, workspaceResult.updatedAt);
      const manifestHash = await hashStableJson(manifest);
      savedManifestFile = await saveManifestFile(accessToken, savedManifestFile?.id, manifest, manifestHash);
    }
  }

  const finishedAt = new Date().toISOString();
  const latestState = await ensureSyncState();
  const updatedState: SyncState = {
    ...latestState,
    connected: true,
    workspaceFileId: workspaceResult.fileId,
    manifestFileId: savedManifestFile?.id,
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
    pulledChanges: pullResult.pulled || workspaceResult.pulled || safetyPulled,
    pushedChanges: pushResult.pushed || workspaceResult.pushed || orphanNotesMerged,
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

export async function readSyncConflicts() {
  return db.syncItems.where('status').equals('conflict').toArray();
}

export async function resolveSyncConflict(entityKey: string, resolution: SyncConflictResolution, manualNote?: Note) {
  const item = await db.syncItems.get(entityKey);
  if (!item || item.status !== 'conflict') {
    return;
  }

  if (item.entityType === 'workspace') {
    await resolveWorkspaceConflict(item, resolution);
    return;
  }

  await resolveNoteConflict(item, resolution, manualNote);
}

async function pullRemoteNoteChanges(accessToken: string, manifestEntries: Map<string, CloudManifestNote>): Promise<NoteSyncWorkResult> {
  let changed = false;
  let pulled = false;
  const syncItems = new Map((await readSyncItems()).map((item) => [item.entityKey, item]));
  const localNotes = new Map((await db.notes.toArray()).map((note) => [note.id, note]));

  for (const remoteEntry of [...manifestEntries.values()]) {
    const key = noteKey(remoteEntry.id);
    const syncItem = syncItems.get(key);
    if (syncItem?.status === 'conflict') {
      continue;
    }

    const localNote = localNotes.get(remoteEntry.id);
    const localHash = localNote ? await hashNote(localNote) : undefined;
    const baseHash = getBaseHash(syncItem);
    const remoteHash = remoteEntry.hash;

    if (remoteEntry.deletedAt) {
      if (!localNote) {
        await markNoteDeletedSynced(remoteEntry.id, remoteEntry);
        changed = true;
        continue;
      }

      if (!baseHash || localHash === baseHash || syncItem?.status === 'synced') {
        await applyRemoteDeletion(remoteEntry.id, remoteEntry);
        changed = true;
        pulled = true;
        continue;
      }

      await recordNoteConflict({
        item: syncItem,
        noteId: remoteEntry.id,
        driveFileId: remoteEntry.fileId,
        baseHash,
        localHash,
        remoteHash,
        localSnapshot: localNote,
        remoteSnapshot: null,
      });
      changed = true;
      continue;
    }

    if (!localNote) {
      if (syncItem?.status === 'deleted' && baseHash && remoteHash !== baseHash) {
        const remoteNote = await readRemoteNote(accessToken, remoteEntry);
        await recordNoteConflict({
          item: syncItem,
          noteId: remoteEntry.id,
          driveFileId: remoteEntry.fileId,
          baseHash,
          localHash: undefined,
          remoteHash,
          localSnapshot: null,
          remoteSnapshot: remoteNote,
        });
        changed = true;
        continue;
      }

      const remoteNote = await readRemoteNote(accessToken, remoteEntry);
      if (remoteNote) {
        await applyRemoteNote(remoteNote, remoteEntry);
        changed = true;
        pulled = true;
      }
      continue;
    }

    if (localHash === remoteHash) {
      await markNoteSynced(localNote, { id: remoteEntry.fileId ?? '', modifiedTime: remoteEntry.updatedAt }, remoteHash, remoteEntry);
      continue;
    }

    if (baseHash && localHash === baseHash && remoteHash !== baseHash) {
      const remoteNote = await readRemoteNote(accessToken, remoteEntry);
      if (remoteNote) {
        await applyRemoteNote(remoteNote, remoteEntry);
        changed = true;
        pulled = true;
      }
      continue;
    }

    if (baseHash && localHash !== baseHash && remoteHash === baseHash) {
      continue;
    }

    if (!baseHash && syncItem?.status !== 'pending') {
      const remoteNote = await readRemoteNote(accessToken, remoteEntry);
      if (remoteNote) {
        await applyRemoteNote(remoteNote, remoteEntry);
        changed = true;
        pulled = true;
      }
      continue;
    }

    const remoteNote = await readRemoteNote(accessToken, remoteEntry);
    await recordNoteConflict({
      item: syncItem,
      noteId: remoteEntry.id,
      driveFileId: remoteEntry.fileId,
      baseHash,
      localHash,
      remoteHash,
      localSnapshot: localNote,
      remoteSnapshot: remoteNote,
    });
    changed = true;
  }

  return { changed, pulled, pushed: false };
}

async function pushLocalNoteChanges(accessToken: string, manifestEntries: Map<string, CloudManifestNote>): Promise<NoteSyncWorkResult> {
  let changed = false;
  let pushed = false;
  const syncItems = new Map((await readSyncItems()).map((item) => [item.entityKey, item]));
  const notes = await db.notes.toArray();

  for (const note of notes) {
    const key = noteKey(note.id);
    const syncItem = syncItems.get(key);
    if (syncItem?.status === 'conflict') {
      continue;
    }

    const remoteEntry = manifestEntries.get(note.id);
    const localHash = await hashNote(note);
    const baseHash = getBaseHash(syncItem);

    if (!remoteEntry || remoteEntry.deletedAt || !remoteEntry.fileId) {
      const savedFile = await createJsonFile(accessToken, noteFileName(note.id), buildNotePayload(note), {
        entityType: 'note',
        entityId: note.id,
        hash: localHash,
      });
      manifestEntries.set(note.id, toManifestNote(note, savedFile, localHash));
      await markNoteSynced(note, savedFile, localHash);
      changed = true;
      pushed = true;
      continue;
    }

    if (localHash === remoteEntry.hash) {
      await markNoteSynced(note, { id: remoteEntry.fileId, modifiedTime: remoteEntry.updatedAt, version: remoteEntry.version.toString() }, localHash, remoteEntry);
      continue;
    }

    if (!baseHash) {
      const remoteNote = await readRemoteNote(accessToken, remoteEntry);
      await recordNoteConflict({
        item: syncItem,
        noteId: note.id,
        driveFileId: remoteEntry.fileId,
        baseHash,
        localHash,
        remoteHash: remoteEntry.hash,
        localSnapshot: note,
        remoteSnapshot: remoteNote,
      });
      changed = true;
      continue;
    }

    if (baseHash && remoteEntry.hash !== baseHash) {
      const remoteNote = await readRemoteNote(accessToken, remoteEntry);
      await recordNoteConflict({
        item: syncItem,
        noteId: note.id,
        driveFileId: remoteEntry.fileId,
        baseHash,
        localHash,
        remoteHash: remoteEntry.hash,
        localSnapshot: note,
        remoteSnapshot: remoteNote,
      });
      changed = true;
      continue;
    }

    if (syncItem?.status === 'pending' || localHash !== baseHash) {
      const savedFile = await updateJsonFile(accessToken, remoteEntry.fileId, buildNotePayload(note), {
        entityType: 'note',
        entityId: note.id,
        hash: localHash,
      });
      manifestEntries.set(note.id, toManifestNote(note, savedFile, localHash));
      await markNoteSynced(note, savedFile, localHash);
      changed = true;
      pushed = true;
    }
  }

  const deletedResult = await pushDeletedNotes(accessToken, manifestEntries, syncItems);
  return {
    changed: changed || deletedResult.changed,
    pulled: false,
    pushed: pushed || deletedResult.pushed,
  };
}

async function pushDeletedNotes(
  accessToken: string,
  manifestEntries: Map<string, CloudManifestNote>,
  syncItems: Map<string, SyncItem>,
): Promise<NoteSyncWorkResult> {
  let changed = false;
  let pushed = false;
  const deletedItems = [...syncItems.values()].filter((item) => item.entityType === 'note' && item.status === 'deleted');

  for (const item of deletedItems) {
    const remoteEntry = manifestEntries.get(item.entityId);
    const baseHash = getBaseHash(item);

    if (remoteEntry && !remoteEntry.deletedAt && baseHash && remoteEntry.hash !== baseHash) {
      const remoteNote = await readRemoteNote(accessToken, remoteEntry);
      await recordNoteConflict({
        item,
        noteId: item.entityId,
        driveFileId: remoteEntry.fileId,
        baseHash,
        localHash: undefined,
        remoteHash: remoteEntry.hash,
        localSnapshot: null,
        remoteSnapshot: remoteNote,
      });
      changed = true;
      continue;
    }

    if (remoteEntry?.fileId) {
      await tryDeleteDriveFile(accessToken, remoteEntry.fileId);
    }

    const deletedAt = item.deletedAt ?? new Date().toISOString();
    const tombstoneHash = await hashTombstone(item.entityId, deletedAt);
    const tombstone: CloudManifestNote = {
      id: item.entityId,
      hash: tombstoneHash,
      version: remoteEntry?.version ?? 1,
      updatedAt: deletedAt,
      deletedAt,
    };
    manifestEntries.set(item.entityId, tombstone);
    await markNoteDeletedSynced(item.entityId, tombstone);
    changed = true;
    pushed = true;
  }

  return { changed, pulled: false, pushed };
}

async function syncWorkspace(
  accessToken: string,
  files: DriveFileMetadata[],
  remoteManifest: CloudManifestFile | null,
): Promise<WorkspaceSyncResult> {
  const { file: workspaceFile, payload: remoteWorkspace } = await readLatestSyncJson<CloudWorkspaceFile>(
    accessToken,
    files,
    WORKSPACE_FILE_NAME,
    'workspace',
  );
  const item = await db.syncItems.get(workspaceKey());
  const localWorkspace = await buildWorkspacePayload();
  const localHash = await hashWorkspace(localWorkspace);
  const remoteHash = remoteWorkspace ? remoteManifest?.workspace?.hash ?? (await hashWorkspace(remoteWorkspace)) : undefined;
  const baseHash = getBaseHash(item);
  const remoteFileId = workspaceFile?.id ?? remoteManifest?.workspace?.fileId;

  if (!remoteWorkspace || !remoteHash) {
    const savedFile = await saveWorkspaceFile(accessToken, remoteFileId, localWorkspace, localHash);
    return {
      changed: true,
      pulled: false,
      pushed: true,
      fileId: savedFile.id,
      hash: localHash,
      updatedAt: localWorkspace.exportedAt,
    };
  }

  if (localHash === remoteHash) {
    await markWorkspaceSynced(remoteFileId, remoteHash, workspaceFile?.modifiedTime ?? remoteWorkspace.exportedAt);
    return {
      changed: false,
      pulled: false,
      pushed: false,
      fileId: remoteFileId,
      hash: remoteHash,
      updatedAt: remoteWorkspace.exportedAt,
    };
  }

  if (baseHash && localHash === baseHash && remoteHash !== baseHash) {
    await applyRemoteWorkspace(remoteWorkspace);
    await markWorkspaceSynced(remoteFileId, remoteHash, workspaceFile?.modifiedTime ?? remoteWorkspace.exportedAt);
    return {
      changed: true,
      pulled: true,
      pushed: false,
      fileId: remoteFileId,
      hash: remoteHash,
      updatedAt: remoteWorkspace.exportedAt,
    };
  }

  if (baseHash && localHash !== baseHash && remoteHash === baseHash) {
    const savedFile = await saveWorkspaceFile(accessToken, remoteFileId, localWorkspace, localHash);
    return {
      changed: true,
      pulled: false,
      pushed: true,
      fileId: savedFile.id,
      hash: localHash,
      updatedAt: localWorkspace.exportedAt,
    };
  }

  await db.syncItems.put({
    ...buildBaseSyncItem(workspaceKey(), 'workspace', 'workspace'),
    driveFileId: remoteFileId,
    baseHash,
    localHash,
    remoteHash,
    remoteModifiedTime: workspaceFile?.modifiedTime ?? remoteWorkspace.exportedAt,
    remoteVersion: workspaceFile?.version,
    status: 'conflict',
    conflict: {
      detectedAt: new Date().toISOString(),
      baseHash,
      localHash,
      remoteHash,
      localSnapshot: localWorkspace,
      remoteSnapshot: remoteWorkspace,
    },
  });

  return {
    changed: true,
    pulled: false,
    pushed: false,
    fileId: remoteFileId,
    hash: remoteHash,
    updatedAt: remoteWorkspace.exportedAt,
  };
}

async function resolveNoteConflict(item: SyncItem, resolution: SyncConflictResolution, manualNote?: Note) {
  const localSnapshot = item.conflict?.localSnapshot as Note | null | undefined;
  const remoteSnapshot = item.conflict?.remoteSnapshot as Note | null | undefined;
  const remoteHash = item.remoteHash ?? item.conflict?.remoteHash;
  const now = new Date().toISOString();

  if (resolution === 'remote') {
    if (remoteSnapshot) {
      const remoteNote = { ...remoteSnapshot, syncStatus: 'synced' } satisfies Note;
      await db.notes.put(remoteNote);
      await markNoteSynced(remoteNote, { id: item.driveFileId ?? '', modifiedTime: item.remoteModifiedTime }, remoteHash ?? (await hashNote(remoteNote)));
      return;
    }

    await db.notes.delete(item.entityId);
    await db.activities.where('noteId').equals(item.entityId).delete();
    await db.syncItems.put({
      ...item,
      baseHash: remoteHash,
      localHash: remoteHash,
      remoteHash,
      status: 'synced',
      conflict: undefined,
      lastSyncedAt: now,
      updatedAt: now,
    });
    return;
  }

  if (resolution === 'duplicate' && localSnapshot && remoteSnapshot) {
    const remoteNote = { ...remoteSnapshot, syncStatus: 'synced' } satisfies Note;
    const remoteResolvedHash = remoteHash ?? (await hashNote(remoteNote));
    const duplicate = normalizeResolvedNote({
      ...localSnapshot,
      id: crypto.randomUUID(),
      title: `${localSnapshot.title}${CONFLICT_COPY_SUFFIX}`,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
      version: 1,
      syncStatus: 'local',
    });
    const duplicateHash = await hashNote(duplicate);
    await db.transaction('rw', [db.notes, db.syncItems], async () => {
      await db.notes.put(remoteNote);
      await db.notes.put(duplicate);
      await db.syncItems.put({
        ...item,
        baseHash: remoteResolvedHash,
        localHash: remoteResolvedHash,
        remoteHash: remoteResolvedHash,
        status: 'synced',
        conflict: undefined,
        lastSyncedAt: now,
        updatedAt: now,
      });
      await db.syncItems.put({
        ...buildBaseSyncItem(noteKey(duplicate.id), 'note', duplicate.id),
        baseHash: undefined,
        localHash: duplicateHash,
        status: 'pending',
      });
    });
    return;
  }

  const resolvedNote = resolution === 'manual' && manualNote ? manualNote : localSnapshot ?? (await db.notes.get(item.entityId));
  if (!resolvedNote) {
    await db.syncItems.put({
      ...item,
      baseHash: remoteHash,
      localHash: undefined,
      remoteHash,
      status: 'deleted',
      deletedAt: now,
      conflict: undefined,
      updatedAt: now,
    });
    return;
  }

  const note = normalizeResolvedNote({
    ...resolvedNote,
    id: item.entityId,
    updatedAt: now,
    version: resolvedNote.version + 1,
    syncStatus: 'local',
  });
  const localHash = await hashNote(note);
  await db.transaction('rw', [db.notes, db.syncItems], async () => {
    await db.notes.put(note);
    await db.syncItems.put({
      ...item,
      baseHash: remoteHash,
      localHash,
      remoteHash,
      status: 'pending',
      conflict: undefined,
      updatedAt: now,
    });
  });
}

async function resolveWorkspaceConflict(item: SyncItem, resolution: SyncConflictResolution) {
  const remoteSnapshot = item.conflict?.remoteSnapshot as CloudWorkspaceFile | null | undefined;
  const remoteHash = item.remoteHash ?? item.conflict?.remoteHash;
  const now = new Date().toISOString();

  if (resolution === 'remote' && remoteSnapshot) {
    await applyRemoteWorkspace(remoteSnapshot);
    await markWorkspaceSynced(item.driveFileId, remoteHash ?? (await hashWorkspace(remoteSnapshot)), item.remoteModifiedTime);
    return;
  }

  const localWorkspace = await buildWorkspacePayload();
  const localHash = await hashWorkspace(localWorkspace);
  await db.syncItems.put({
    ...item,
    baseHash: remoteHash,
    localHash,
    remoteHash,
    status: 'pending',
    conflict: undefined,
    updatedAt: now,
  });
}

async function readRemoteNotes(accessToken: string, entries: CloudManifestNote[]) {
  const records: RemoteNoteRecord[] = [];

  for (const entry of entries) {
    if (entry.deletedAt || !entry.fileId) {
      records.push({ entry, note: null });
      continue;
    }

    records.push({ entry, note: await readRemoteNote(accessToken, entry) });
  }

  return records;
}

async function readRemoteNote(accessToken: string, entry: CloudManifestNote) {
  if (!entry.fileId) {
    return null;
  }

  const payload = await readRemoteJson<CloudNoteFile>(accessToken, entry.fileId);
  return payload?.note ? ({ ...payload.note, syncStatus: 'synced' } satisfies Note) : null;
}

async function readCloudNoteFiles(accessToken: string, files: DriveFileMetadata[]) {
  const recordsById = new Map<string, RemoteNoteRecord>();
  const noteFiles = files
    .filter((file) => !file.trashed && (file.name.startsWith('notex-note-') || file.appProperties?.entityType === 'note'))
    .sort(compareDriveFilesByModifiedTime);

  for (const file of noteFiles) {
    const payload = await readRemoteJson<CloudNoteFile>(accessToken, file.id);
    if (!payload?.note || recordsById.has(payload.note.id)) {
      continue;
    }

    const hash = file.appProperties?.hash ?? (await hashNote(payload.note));
    recordsById.set(payload.note.id, {
      entry: toManifestNote(payload.note, file, hash),
      note: { ...payload.note, syncStatus: 'synced' },
    });
  }

  return [...recordsById.values()];
}

async function mergeRemoteNoteFilesIntoManifest(
  accessToken: string,
  files: DriveFileMetadata[],
  manifestEntries: Map<string, CloudManifestNote>,
) {
  let changed = false;
  const noteFiles = files
    .filter((file) => !file.trashed && (file.name.startsWith('notex-note-') || file.appProperties?.entityType === 'note'))
    .sort(compareDriveFilesByModifiedTime);

  for (const file of noteFiles) {
    const hintedNoteId = file.appProperties?.entityId;
    const existingById = hintedNoteId ? manifestEntries.get(hintedNoteId) : undefined;
    const fileAlreadyIndexed = [...manifestEntries.values()].some((entry) => entry.fileId === file.id);
    if (fileAlreadyIndexed) {
      continue;
    }

    if (existingById?.deletedAt && getDriveFileTime(file) <= new Date(existingById.updatedAt).getTime()) {
      continue;
    }

    const payload = await readRemoteJson<CloudNoteFile>(accessToken, file.id);
    if (!payload?.note) {
      continue;
    }

    const currentEntry = manifestEntries.get(payload.note.id);
    if (currentEntry?.deletedAt && getDriveFileTime(file) <= new Date(currentEntry.updatedAt).getTime()) {
      continue;
    }

    const hash = file.appProperties?.hash ?? (await hashNote(payload.note));
    manifestEntries.set(payload.note.id, toManifestNote(payload.note, file, hash));
    changed = true;
  }

  return changed;
}

async function applyRemoteNote(remoteNote: Note, remoteEntry: CloudManifestNote) {
  const syncedNote = { ...remoteNote, syncStatus: 'synced' } satisfies Note;
  await db.notes.put(syncedNote);
  await markNoteSynced(syncedNote, { id: remoteEntry.fileId ?? '', modifiedTime: remoteEntry.updatedAt }, remoteEntry.hash, remoteEntry);
}

async function applyRemoteDeletion(noteId: string, remoteEntry: CloudManifestNote) {
  await db.transaction('rw', [db.notes, db.activities], async () => {
    await db.notes.delete(noteId);
    await db.activities.where('noteId').equals(noteId).delete();
  });
  await markNoteDeletedSynced(noteId, remoteEntry);
}

async function recordNoteConflict({
  item,
  noteId,
  driveFileId,
  baseHash,
  localHash,
  remoteHash,
  localSnapshot,
  remoteSnapshot,
}: {
  item?: SyncItem;
  noteId: string;
  driveFileId?: string;
  baseHash?: string;
  localHash?: string;
  remoteHash?: string;
  localSnapshot?: Note | null;
  remoteSnapshot?: Note | null;
}) {
  const now = new Date().toISOString();
  if (localSnapshot) {
    await db.notes.put({ ...localSnapshot, syncStatus: 'conflict' });
  }

  await db.syncItems.put({
    ...buildBaseSyncItem(noteKey(noteId), 'note', noteId),
    ...item,
    driveFileId,
    baseHash,
    localHash,
    remoteHash,
    status: 'conflict',
    conflict: {
      detectedAt: now,
      baseHash,
      localHash,
      remoteHash,
      localSnapshot: localSnapshot ?? null,
      remoteSnapshot: remoteSnapshot ?? null,
    },
    updatedAt: now,
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

async function applyRemoteWorkspace(remoteWorkspace: CloudWorkspaceFile) {
  const currentSettings = await readUserSettings(defaultUserSettings.id);
  const settings = remoteWorkspace.userSettings ?? currentSettings ?? defaultUserSettings;
  const sessions = mergeSessions(remoteWorkspace.sessions ?? [], [buildCurrentDeviceSession()]);

  await db.transaction('rw', [db.tags, db.collections, db.activities, db.userSettings, db.deviceSessions], async () => {
    await db.tags.clear();
    await db.collections.clear();
    await db.activities.clear();
    await db.userSettings.clear();
    await db.deviceSessions.clear();
    await db.tags.bulkPut(remoteWorkspace.tags ?? []);
    await db.collections.bulkPut(remoteWorkspace.collections ?? []);
    await db.activities.bulkPut(remoteWorkspace.activities ?? []);
    await db.userSettings.put(settings);
    await db.deviceSessions.bulkPut(sessions);
  });
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

  await markWorkspaceSynced(savedFile.id, workspaceHash, savedFile.modifiedTime, savedFile.version);
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

async function markNoteSynced(
  note: Note,
  file: Pick<DriveFileMetadata, 'id' | 'modifiedTime' | 'version'>,
  hash: string,
  remoteEntry?: CloudManifestNote,
) {
  const syncedNote = { ...note, syncStatus: 'synced' } satisfies Note;
  await db.notes.put(syncedNote);
  await db.syncItems.put({
    ...buildBaseSyncItem(noteKey(note.id), 'note', note.id),
    driveFileId: file.id || remoteEntry?.fileId,
    baseHash: hash,
    localHash: hash,
    remoteHash: hash,
    remoteModifiedTime: file.modifiedTime ?? remoteEntry?.updatedAt,
    remoteVersion: file.version ?? remoteEntry?.version?.toString(),
    status: 'synced',
    conflict: undefined,
    lastSyncedAt: new Date().toISOString(),
  });
}

async function markNoteDeletedSynced(noteId: string, entry: CloudManifestNote) {
  await db.syncItems.put({
    ...buildBaseSyncItem(noteKey(noteId), 'note', noteId),
    driveFileId: entry.fileId,
    baseHash: entry.hash,
    localHash: entry.hash,
    remoteHash: entry.hash,
    remoteModifiedTime: entry.updatedAt,
    remoteVersion: entry.version.toString(),
    status: 'synced',
    deletedAt: entry.deletedAt,
    conflict: undefined,
    lastSyncedAt: new Date().toISOString(),
  });
}

async function markWorkspaceSynced(fileId: string | undefined, hash: string, modifiedTime?: string, version?: string) {
  await db.syncItems.put({
    ...buildBaseSyncItem(workspaceKey(), 'workspace', 'workspace'),
    driveFileId: fileId,
    baseHash: hash,
    localHash: hash,
    remoteHash: hash,
    remoteModifiedTime: modifiedTime,
    remoteVersion: version,
    status: 'synced',
    conflict: undefined,
    lastSyncedAt: new Date().toISOString(),
  });
}

async function touchCurrentDeviceSession() {
  await db.deviceSessions.put(buildCurrentDeviceSession());
}

function buildCurrentDeviceSession(): DeviceSession {
  return {
    id: readLocalDeviceId(),
    name: getDeviceName(),
    userAgent: navigator.userAgent,
    lastSeenAt: new Date().toISOString(),
  };
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

function selectSyncFileCandidates(files: DriveFileMetadata[], fileName: string, entityType: SyncFileEntityType) {
  return files
    .filter((file) => !file.trashed && (file.name === fileName || file.appProperties?.entityType === entityType))
    .sort(compareDriveFilesByModifiedTime);
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

function buildManifest(
  manifestEntries: Map<string, CloudManifestNote>,
  workspaceFileId?: string,
  workspaceHash?: string,
  workspaceUpdatedAt?: string,
): CloudManifestFile {
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    workspace: workspaceFileId && workspaceHash
      ? {
          fileId: workspaceFileId,
          hash: workspaceHash,
          updatedAt: workspaceUpdatedAt ?? new Date().toISOString(),
        }
      : undefined,
    notes: [...manifestEntries.values()].sort((a, b) => a.id.localeCompare(b.id)),
  };
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

async function hashWorkspace(workspace: CloudWorkspaceFile) {
  const { exportedAt: _exportedAt, sessions: _sessions, user: _user, ...hashableWorkspace } = workspace;
  return hashStableJson({
    ...hashableWorkspace,
    activities: [...hashableWorkspace.activities].sort((a, b) => a.id.localeCompare(b.id)),
    collections: [...hashableWorkspace.collections].sort((a, b) => a.id.localeCompare(b.id)),
    tags: [...hashableWorkspace.tags].sort((a, b) => a.id.localeCompare(b.id)),
  });
}

async function hashTombstone(noteId: string, deletedAt: string) {
  return hashStableJson({ deleted: true, deletedAt, noteId });
}

function toManifestNote(note: Note, file: Pick<DriveFileMetadata, 'id' | 'modifiedTime' | 'version'>, hash: string): CloudManifestNote {
  return {
    id: note.id,
    fileId: file.id,
    hash,
    version: Number(file.version ?? note.version) || note.version,
    updatedAt: file.modifiedTime ?? note.updatedAt,
  };
}

function noteFileName(noteId: string) {
  return `notex-note-${noteId}.json`;
}

function getBaseHash(item?: SyncItem) {
  return item?.baseHash ?? item?.remoteHash ?? item?.localHash;
}

async function tryDeleteDriveFile(accessToken: string, fileId: string) {
  try {
    await deleteDriveFile(accessToken, fileId);
  } catch {
    // A missing remote file should not block writing the tombstone manifest.
  }
}

function normalizeResolvedNote(note: Note): Note {
  const normalized = { ...note, saveState: 'saved' as const };
  return {
    ...normalized,
    stats: calculateNoteStats(normalized),
  };
}

function calculateNoteStats(note: Note): NoteStats {
  const text = [
    note.title,
    note.content.intro ?? '',
    ...(note.content.summary?.map((block) => block.text) ?? []),
    ...(note.content.explanation?.map((block) => block.text) ?? []),
    ...(note.content.usageExamples?.rows.flatMap((row) => [row.expression, row.meaning, row.example]) ?? []),
    note.content.tip?.title ?? '',
    note.content.tip?.body ?? '',
    ...(note.content.additionalExamples ?? []),
  ].join(' ');
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  return {
    wordCount,
    characterCount: text.length,
    readingTimeMinutes: Math.max(1, Math.ceil(wordCount / 180)),
  };
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
