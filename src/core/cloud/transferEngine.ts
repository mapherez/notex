import { db } from '../db/notexDb';
import { hasNoteMutations } from '../mcp/noteMutationCoordinator';
import { organizationFields } from '../storage/backupState';
import { backupContent, contentHash, digest, parseNoteBackup, type CatalogEntry, type DriveCatalog, type NoteBackup } from './backupFormat';
import type { CloudStorage, NoteSnapshot } from './cloudStorage';
import { DriveClient, DriveError } from './driveClient';
import { markCloudDeleted } from './cloudView';
import { appSettings } from '../../config/appSettings';
import { cleanOrphans } from './orphanCleanup';
const timing = appSettings.cloud;
type Publication = { revision: string; acknowledgements: Array<{ id: string; token: string }> };

export type TransferState = {
  phase: 'idle' | 'checking' | 'uploading' | 'downloading' | 'error';
  pending: number; downloads: number; completed: number; total: number; currentTitle: string;
  paused: boolean; error: string | null; conflicts: Array<{ id: string; title: string }>;
  catalog: DriveCatalog | null;
};
export const initialTransferState: TransferState = { phase: 'idle', pending: 0, downloads: 0, completed: 0, total: 0,
  currentTitle: '', paused: false, error: null, conflicts: [], catalog: null };

export class TransferEngine {
  private state = { ...initialTransferState };
  private catalogId?: string;
  private busy?: Promise<void>;
  private timer?: ReturnType<typeof setInterval>;
  private stopped = false;
  private first = true;
  private force = false;
  private priorities: string[] = [];
  private requested = new Set<string>();
  private choices = new Map<string, 'local' | 'remote'>();
  private lastRemoteCheck = 0;
  private retryAt = 0;
  private failures = 0;
  constructor(private readonly drive: DriveClient, private readonly storage: CloudStorage,
    private readonly update: (state: TransferState) => void, private readonly refresh: (noteId?: string) => Promise<void>) {}

  async start() {
    const queue = await this.storage.getState<{ paused: boolean; priorities: string[] }>('transferQueue');
    if (this.stopped) return;
    if (queue) { this.priorities = queue.priorities; this.patch({ paused: queue.paused }); }
    const catalog = await this.storage.getState<DriveCatalog>('catalog');
    if (this.stopped) return;
    if (catalog) {
      const local = new Set((await db.notes.toArray()).map((note) => note.id));
      this.patch({ catalog, downloads: Object.values(catalog.notes).filter((entry) => !entry.deleted && !local.has(entry.id)).length });
      await this.refresh();
    }
    this.timer = setInterval(() => { void this.tick(); }, timing.pollLocalMs);
    void this.tick(true);
  }
  async stop() {
    this.stopped = true;
    clearInterval(this.timer);
    await this.busy;
  }
  pause(paused: boolean) { this.patch({ paused }); this.persistQueue(); if (!paused) void this.tick(true); }
  prioritize(ids: string[]) { this.priorities = [...new Set([...ids, ...this.priorities])]; this.persistQueue(); void this.tick(true); }
  requestNote(id: string) { this.requested.add(id); this.prioritize([id]); }
  private persistQueue() {
    void this.storage.putState('transferQueue', { paused: this.state.paused, priorities: this.priorities })
      .catch((error) => this.patch({ error: error instanceof Error ? error.message : String(error) }));
  }
  async backupNow() { this.force = true; await this.busy; return this.tick(true); }
  resolve(id: string, choice: 'local' | 'remote') { this.choices.set(id, choice); this.force = true; void this.tick(true); }
  private patch(patch: Partial<TransferState>) {
    if (this.stopped) return;
    this.state = { ...this.state, ...patch }; this.update(this.state);
  }

  async tick(manual = false): Promise<void> {
    if (this.stopped || this.busy) return this.busy;
    this.busy = this.cycle(manual).catch((error) => {
      if (!this.stopped && !this.drive.signal.aborted) {
        const transient = error instanceof TypeError || (error instanceof DOMException && error.name === 'TimeoutError')
          || (error instanceof DriveError && (error.status >= 500 || error.status === 429
            || ['rateLimitExceeded', 'userRateLimitExceeded'].includes(error.reason)));
        this.retryAt = transient ? Date.now() + Math.min(300_000, 15_000 * 2 ** Math.min(this.failures++, 5)) : Infinity;
        this.patch({ phase: 'error', error: error instanceof Error ? error.message : String(error) });
      }
    }).finally(() => { this.busy = undefined; });
    return this.busy;
  }

  private async cycle(manual: boolean) {
    let pending = await this.storage.pending();
    const excluded = new Set(await this.storage.getState<string[]>('excludedNotes') ?? []);
    const eligible = pending.filter((item) => !excluded.has(item.entityId));
    markCloudDeleted(pending.filter((item) => item.deleted).map((item) => item.entityId));
    this.patch({ pending: eligible.filter((item) => item.kind === 'note').length });
    if (this.state.error && !manual && !this.force && Date.now() < this.retryAt) return;
    if (!navigator.onLine) { this.patch({ phase: 'error', error: 'CLOUD_OFFLINE' }); return; }
    const now = Date.now();
    const due = this.first || this.force || eligible.some((item) => now - item.lastChangedAt >= timing.idleBackupMs || now - item.firstChangedAt >= timing.maxPendingMs);
    if (!due && !this.requested.size && (!this.state.downloads || this.state.paused) && !manual && now - this.lastRemoteCheck < timing.remoteCheckMs) return;
    this.force = false;
    this.patch({ phase: 'checking', error: null });
    const remote = await this.drive.catalog();
    this.lastRemoteCheck = Date.now();
    this.catalogId = remote.id;
    const catalog = structuredClone(remote.catalog);
    await this.confirmPublication(catalog);
    pending = await this.storage.pending();
    await this.drainCleanup(catalog);
    // Run even when the library is unchanged. Maintenance failure must not
    // prevent backups, and a failed scan remains eligible for the next cycle.
    await cleanOrphans(this.drive, this.storage).catch(() => undefined);
    const unchangedCatalog = this.state.catalog?.revision === catalog.revision;
    if (!due && unchangedCatalog && !this.state.downloads && !this.choices.size) { this.patch({ phase: 'idle' }); return; }
    const baseRevision = remote.id ? catalog.revision : null;
    await this.storage.putState('catalog', catalog);
    this.patch({ catalog: structuredClone(catalog) });
    await this.refresh();
    const localNotes = await db.notes.toArray();
    const localById = new Map(localNotes.map((note) => [note.id, note]));
    const pendingById = new Map(pending.map((item) => [item.entityId, item]));
    if (this.first && remote.id && !localNotes.length && !(await db.tags.count()) && !(await db.collections.count())) {
      const defaults = pendingById.get('@library');
      if (defaults) { await this.storage.acknowledge('@library', defaults.changeToken); pendingById.delete('@library'); }
    }
    const ids = [...new Set([...localNotes.map((note) => note.id), ...Object.keys(catalog.notes), ...pending.filter((item) => item.kind === 'note').map((item) => item.entityId)])];
    const upload: Array<{ id: string; snapshot: NoteSnapshot; deletedVersion?: number }> = [];
    const download: Array<{ entry: CatalogEntry; snapshot: NoteSnapshot }> = [];
    const conflicts: TransferState['conflicts'] = [];
    for (const id of ids) {
      if (this.stopped) return;
      const entry = catalog.notes[id];
      const change = pendingById.get(id);
      if (!this.first && unchangedCatalog && !change && entry && localById.get(id)?.version === entry.version && !this.choices.has(id) && !this.state.conflicts.some((conflict) => conflict.id === id)) continue;
      const snapshot = await this.storage.snapshot(id);
      if (change && change.changeToken !== snapshot.changeToken) continue;
      const localVersion = change?.deleted ? change.version : snapshot.version;
      if (excluded.has(id) && localVersion !== null) continue;
      if (hasNoteMutations(id)) continue;
      if (!entry) {
        if (snapshot.backup && due) upload.push({ id, snapshot });
        else if (change?.deleted && due) upload.push({ id, snapshot, deletedVersion: change.version });
        continue;
      }
      if (localVersion === null) {
        if (!entry.deleted) download.push({ entry, snapshot });
        else await this.storage.putState(`baseline:${id}`, entry);
        continue;
      }
      if (localVersion > entry.version) {
        if (due) upload.push({ id, snapshot, deletedVersion: change?.deleted ? change.version : undefined });
      } else if (localVersion < entry.version) download.push({ entry, snapshot });
      else {
        const hash = change?.deleted ? 'deleted' : snapshot.backup ? await contentHash(backupContent(snapshot.backup)) : '';
        if ((entry.deleted && change?.deleted) || (!entry.deleted && hash === entry.hash)) {
          if (change) await this.storage.acknowledge(id, change.changeToken);
          await this.storage.putState(`baseline:${id}`, entry);
        } else if (this.choices.get(id) === 'remote') {
          download.push({ entry, snapshot }); this.choices.delete(id);
        } else if (this.choices.get(id) === 'local') {
          if (snapshot.backup) {
            snapshot.backup.note.version = entry.version + 1;
            await db.notes.put(snapshot.backup.note);
            upload.push({ id, snapshot: await this.storage.snapshot(id) });
          } else upload.push({ id, snapshot, deletedVersion: entry.version + 1 });
          this.choices.delete(id);
        } else conflicts.push({ id, title: snapshot.backup?.note.title ?? entry.metadata?.title ?? id });
      }
    }
    this.patch({ conflicts, downloads: download.filter((item) => !item.entry.deleted).length, total: upload.length + download.length, completed: 0 });
    const acknowledgements: Array<{ id: string; token: string }> = [];
    const oldEntries: CatalogEntry[] = [];
    let uploaded = 0;
    for (const item of upload) {
      if (this.stopped) return;
      if ((await this.storage.getState<string[]>('excludedNotes'))?.includes(item.id)) continue;
      uploaded++;
      this.patch({ phase: 'uploading', currentTitle: item.snapshot.backup?.note.title ?? item.id });
      if (catalog.notes[item.id]) oldEntries.push(catalog.notes[item.id]);
      catalog.notes[item.id] = item.deletedVersion
        ? { id: item.id, version: item.deletedVersion, hash: 'deleted', deleted: true }
        : await this.uploadNote(item.snapshot.backup!, catalog.notes[item.id]);
      if (item.snapshot.changeToken) acknowledgements.push({ id: item.id, token: item.snapshot.changeToken });
    }
    const libraryPending = pendingById.get('@library');
    let libraryChanged = false;
    if (due && (libraryPending || !remote.id)) {
      const localTags = await db.tags.toArray();
      const localCollections = await db.collections.toArray();
      if (this.first && remote.id && !(await this.storage.getState<boolean>('organizationInitialized'))) {
        catalog.tags = [...new Map([...catalog.tags, ...localTags].map((tag) => [tag.id, tag])).values()];
        catalog.collections = [...new Map([...catalog.collections, ...localCollections].map((collection) => [collection.id, collection])).values()];
      } else { catalog.tags = localTags; catalog.collections = localCollections; }
      const settings = (await db.userSettings.toArray())[0];
      if (settings) catalog.organization = Object.fromEntries(organizationFields.map((key) => [key, settings[key]])) as DriveCatalog['organization'];
      libraryChanged = true;
    }
    if (uploaded || libraryChanged) {
      // Detect an intervening device before publishing. This is not a distributed
      // lock; the agreed product model remains one device at a time.
      const latest = await this.drive.catalog();
      if ((latest.id ? latest.catalog.revision : null) !== baseRevision) throw new Error('CLOUD_CHANGED_ON_ANOTHER_DEVICE');
      for (const old of oldEntries) await this.queueCleanup(old);
      catalog.revision = crypto.randomUUID(); catalog.updatedAt = new Date().toISOString();
      if (libraryChanged && libraryPending) acknowledgements.push({ id: '@library', token: libraryPending.changeToken });
      // Persist intent before sending: a lost response or a crash after Drive
      // commits must be recoverable without acknowledging later local edits.
      await this.storage.putState('publication', { revision: catalog.revision, acknowledgements } satisfies Publication);
      this.catalogId = await this.drive.uploadJson('metadata.json', catalog, 'appDataFolder', this.catalogId);
      await this.confirmPublication(catalog);
      this.patch({ completed: this.state.completed + uploaded });
      this.patch({ catalog });
      // Old content is removed only after the catalog points at complete uploads.
      await this.drainCleanup(catalog);
    }
    if (remote.id || this.catalogId) await this.adoptOrganization(catalog);
    await this.refresh();
    await this.storage.putState('organizationInitialized', true);
    this.first = false;
    download.sort((a, b) => this.priority(a.entry.id) - this.priority(b.entry.id));
    for (const item of download) {
      if (this.stopped) break;
      if (this.state.paused && !item.entry.deleted && !this.requested.has(item.entry.id)) continue;
      if (hasNoteMutations(item.entry.id)) continue;
      this.patch({ phase: 'downloading', currentTitle: item.entry.metadata?.title ?? item.entry.id });
      try {
        const backup = item.entry.deleted ? null : await this.downloadNote(item.entry, item.snapshot);
        if (hasNoteMutations(item.entry.id)) continue;
        await this.storage.apply(item.entry.id, backup, item.entry, item.snapshot);
      } catch (error) { if (error instanceof Error && error.message === 'LOCAL_NOTE_CHANGED') continue; throw error; }
      this.priorities = this.priorities.filter((id) => id !== item.entry.id);
      this.requested.delete(item.entry.id);
      this.persistQueue();
      this.patch({ completed: this.state.completed + 1, downloads: Math.max(0, this.state.downloads - Number(!item.entry.deleted)) });
      await this.refresh(item.entry.id);
      const changes = await this.storage.pending();
      if (changes.some((change) => !excluded.has(change.entityId) && (Date.now() - change.lastChangedAt >= timing.idleBackupMs || Date.now() - change.firstChangedAt >= timing.maxPendingMs))) break;
      // Re-sort the remaining queue after each note so priorities selected
      // during this transfer take effect without interrupting an attachment.
      const currentIndex = download.indexOf(item);
      const remaining = download.splice(currentIndex + 1);
      remaining.sort((a, b) => this.priority(a.entry.id) - this.priority(b.entry.id));
      download.push(...remaining);
    }
    this.failures = 0; this.retryAt = 0;
    this.patch({ phase: 'idle', currentTitle: '', pending: (await this.storage.pending()).filter((item) => item.kind === 'note' && !excluded.has(item.entityId)).length });
  }

  private priority(id: string) { const index = this.priorities.indexOf(id); return index < 0 ? Number.MAX_SAFE_INTEGER : index; }

  private async confirmPublication(catalog: DriveCatalog) {
    const publication = await this.storage.getState<Publication | null>('publication');
    if (!publication) return;
    if (publication.revision === catalog.revision) {
      // Persist the confirmed catalog first. Each acknowledgement is conditional
      // on its original token and is safe to repeat after partial local failure.
      await this.storage.putState('catalog', catalog);
      for (const ack of publication.acknowledgements) {
        if (ack.id !== '@library') await this.storage.putState(`baseline:${ack.id}`, catalog.notes[ack.id]);
        await this.storage.acknowledge(ack.id, ack.token);
      }
    }
    // An unobserved publication leaves the outbox intact for reconciliation.
    await this.storage.putState('publication', null);
  }

  private async uploadNote(backup: NoteBackup, previous?: CatalogEntry): Promise<CatalogEntry> {
    const hash = await contentHash(backupContent(backup));
    const stagingKey = `upload:${backup.note.id}`;
    type UploadProgress = { hash: string; folderId: string; filesFolder?: string;
      attachments: NonNullable<CatalogEntry['attachments']>; noteFileId?: string; manifestFileId?: string };
    const saved = await this.storage.getState<UploadProgress>(stagingKey);
    if (saved && saved.hash !== hash) await this.queueCleanup({
      id: backup.note.id, version: 0, hash: saved.hash, deleted: false, folderId: saved.folderId,
      attachments: saved.attachments, noteFileId: saved.noteFileId, manifestFileId: saved.manifestFileId,
    });
    const progress: UploadProgress = saved?.hash === hash ? saved : {
      hash, folderId: await this.drive.folder(`${backup.note.id}-${crypto.randomUUID()}`, 'appDataFolder', backup.note.id), attachments: {},
    };
    await this.storage.putState(stagingKey, progress);
    const folderId = progress.folderId;
    if (!progress.filesFolder) {
      progress.filesFolder = await this.drive.folder('files', folderId);
      await this.storage.putState(stagingKey, progress);
    }
    const filesFolder = progress.filesFolder;
    const attachments = progress.attachments;
    for (const file of backup.files) {
      if (attachments[file.id]) continue;
      const blob = await this.storage.readBlob(file.relativePath);
      if (!blob) throw new Error('CLOUD_LOCAL_ATTACHMENT_MISSING');
      const hash = await digest(await blob.arrayBuffer());
      const old = previous?.attachments?.[file.id];
      attachments[file.id] = old?.hash === hash ? old : {
        id: await this.drive.upload(file.originalName, new Blob([blob], { type: file.mimeType }), filesFolder, undefined, hash), hash, size: blob.size,
      };
      await this.storage.putState(stagingKey, progress);
    }
    backup.exportedAt = new Date().toISOString();
    const noteFileId = progress.noteFileId ?? await this.drive.uploadJson('note.json', backup, folderId);
    progress.noteFileId = noteFileId;
    await this.storage.putState(stagingKey, progress);
    const manifestFileId = progress.manifestFileId ?? await this.drive.uploadJson('manifest.json', {
      packageType: 'notex-note', schemaVersion: 1, exportedAt: backup.exportedAt, note: 'note.json', filesDirectory: 'files',
      noteId: backup.note.id, version: backup.note.version, attachments,
    }, folderId);
    progress.manifestFileId = manifestFileId;
    await this.storage.putState(stagingKey, progress);
    const { blocks: _blocks, files: _files, additionalExamples: _examples, relatedLinks: _links, lastOpenedAt: _opened, ...metadata } = backup.note;
    return { id: backup.note.id, version: backup.note.version, hash: await contentHash(backupContent(backup)), deleted: false,
      metadata, folderId, noteFileId, manifestFileId, attachments };
  }

  private async downloadNote(entry: CatalogEntry, snapshot: NoteSnapshot): Promise<NoteBackup> {
    const backup = parseNoteBackup(await this.drive.json(entry.noteFileId!), entry);
    if (await contentHash(backupContent(backup)) !== entry.hash) throw new Error('CLOUD_NOTE_INTEGRITY_ERROR');
    const paths = new Map<string, string>();
    const stagingKey = `download:${entry.id}`;
    const staged = await this.storage.getState<{ hash: string; files: Record<string, string> }>(stagingKey);
    const progress = staged?.hash === entry.hash ? staged : { hash: entry.hash, files: {} as Record<string, string> };
    for (const file of backup.files) {
      const remote = entry.attachments![file.id];
      const existing = snapshot.backup?.files.find((local) => local.id === file.id);
      const existingPath = progress.files[file.id] ?? existing?.relativePath;
      if (existingPath) {
        const localBlob = await this.storage.readBlob(existingPath).catch(() => undefined);
        if (localBlob && localBlob.size === remote.size && await digest(await localBlob.arrayBuffer()) === remote.hash) {
          paths.set(file.relativePath, existingPath); file.relativePath = existingPath; continue;
        }
      }
      const blob = await this.drive.blob(remote.id);
      if (blob.size !== remote.size || await digest(await blob.arrayBuffer()) !== remote.hash) throw new Error('CLOUD_ATTACHMENT_INTEGRITY_ERROR');
      const path = `cloud/${crypto.randomUUID()}/${encodeURIComponent(file.originalName).replace(/%/g, '_') || 'file'}`;
      await this.storage.writeBlob(path, new Blob([blob], { type: file.mimeType }));
      progress.files[file.id] = path;
      await this.storage.putState(stagingKey, progress);
      paths.set(file.relativePath, path); file.relativePath = path;
    }
    const remap = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(remap);
      if (!value || typeof value !== 'object') return value;
      return Object.fromEntries(Object.entries(value).map(([key, value]) => [key, key === 'relativePath' && typeof value === 'string' ? paths.get(value) ?? value : remap(value)]));
    };
    backup.blocks = remap(backup.blocks) as NoteBackup['blocks'];
    return backup;
  }

  private async adoptOrganization(catalog: DriveCatalog) {
    await this.storage.applyOrganization(catalog);
  }

  private async queueCleanup(entry: CatalogEntry) {
    if (!entry.folderId) return;
    const queue = await this.storage.getState<CatalogEntry[]>('cleanupQueue') ?? [];
    if (!queue.some((item) => item.folderId === entry.folderId)) {
      await this.storage.putState('cleanupQueue', [...queue, entry]);
    }
  }

  private async drainCleanup(catalog: DriveCatalog) {
    const queue = await this.storage.getState<CatalogEntry[]>('cleanupQueue') ?? [];
    if (!queue.length) return;
    const remaining: CatalogEntry[] = [];
    for (const entry of queue) {
      if (this.stopped) return;
      try { if (!(await this.cleanupOld(entry, catalog))) remaining.push(entry); }
      catch { remaining.push(entry); }
    }
    await this.storage.putState('cleanupQueue', remaining);
  }

  private async cleanupOld(old: CatalogEntry, catalog: DriveCatalog): Promise<boolean> {
    // A queued cleanup may survive a crash before catalog publication. Never
    // remove an entry still published, even when the queue calls it obsolete.
    if (Object.values(catalog.notes).some((entry) => entry.folderId === old.folderId)) return false;
    const retained = new Set(Object.values(catalog.notes).flatMap((entry) => Object.values(entry.attachments ?? {}).map((file) => file.id)));
    for (const file of Object.values(old.attachments ?? {})) if (!retained.has(file.id)) await this.drive.delete(file.id);
    if (old.noteFileId) await this.drive.delete(old.noteFileId);
    if (old.manifestFileId) await this.drive.delete(old.manifestFileId);
    // Keep parent folders while unchanged attachments still live in them.
    if (Object.values(old.attachments ?? {}).some((file) => retained.has(file.id))) return false;
    if (old.folderId) await this.drive.delete(old.folderId);
    return true;
  }
}
