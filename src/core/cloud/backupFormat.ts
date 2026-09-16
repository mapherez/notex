import type { Collection, Note, NoteBlock, NoteFile, Tag, UserSettings } from '../models/models';
import { stableStringify } from '../utils/stableJson';

export type NoteBackup = {
  schemaVersion: 1; exportedAt: string; note: Note; blocks: NoteBlock[]; files: NoteFile[];
  tags: Tag[]; collection: Collection | null; linkedNotes: Array<{ id: string; title: string }>;
};
export type RemoteFile = { id: string; hash: string; size: number };
export type CatalogEntry = {
  id: string; version: number; hash: string; deleted: boolean;
  metadata?: Note; folderId?: string; noteFileId?: string; manifestFileId?: string;
  attachments?: Record<string, RemoteFile>;
};
export type Organization = Pick<UserSettings, 'primaryCollectionId' | 'favoriteTagIds' | 'pinnedNoteIds' | 'quickPinNoteIds' | 'noteHiddenPanelIds'>;
export type DriveCatalog = {
  schemaVersion: 1; revision: string; updatedAt: string;
  notes: Record<string, CatalogEntry>; tags: Tag[]; collections: Collection[];
  organization?: Organization;
};

export function emptyCatalog(): DriveCatalog {
  return { schemaVersion: 1, revision: crypto.randomUUID(), updatedAt: new Date().toISOString(), notes: {}, tags: [], collections: [] };
}

export async function contentHash(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(stableStringify(value));
  return digest(bytes);
}
export async function digest(bytes: BufferSource): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function backupContent(backup: NoteBackup) {
  const { lastOpenedAt: _visit, stats: _stats, updatedAt: _updated, blocks: _blocks, files: _files, ...note } = backup.note;
  const paths = new Map(backup.files.map((file) => [file.relativePath, `file:${file.id}`]));
  const normalizePaths = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(normalizePaths);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key, value]) => [key,
      key === 'relativePath' && typeof value === 'string' ? paths.get(value) ?? value : normalizePaths(value)]));
  };
  return { note,
    blocks: [...backup.blocks].sort((a, b) => a.id.localeCompare(b.id)).map(({ updatedAt: _time, ...block }) => normalizePaths(block)),
    files: [...backup.files].sort((a, b) => a.id.localeCompare(b.id)).map(({ relativePath: _path, ...file }) => file),
  };
}

function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function validNote(value: unknown): value is Note {
  if (!record(value)) return false;
  return typeof value.id === 'string' && Boolean(value.id) && typeof value.title === 'string'
    && typeof value.subtitle === 'string' && Number.isSafeInteger(value.version) && Number(value.version) > 0
    && Array.isArray(value.tagIds) && value.tagIds.every((id) => typeof id === 'string')
    && Array.isArray(value.linkedNoteIds) && value.linkedNoteIds.every((id) => typeof id === 'string')
    && ['isFavorite', 'isPinned', 'isArchived', 'isTrashed'].every((key) => typeof value[key] === 'boolean')
    && typeof value.createdAt === 'string' && typeof value.updatedAt === 'string'
    && (value.collectionId === null || typeof value.collectionId === 'string') && record(value.stats);
}
export function parseCatalog(value: unknown): DriveCatalog {
  if (!record(value) || value.schemaVersion !== 1 || typeof value.revision !== 'string' || !record(value.notes)
    || !Array.isArray(value.tags) || !Array.isArray(value.collections)) throw new Error('CLOUD_FORMAT_UNSUPPORTED');
  for (const [id, entry] of Object.entries(value.notes)) {
    if (!record(entry) || entry.id !== id || !Number.isSafeInteger(entry.version) || Number(entry.version) < 1
      || typeof entry.deleted !== 'boolean' || typeof entry.hash !== 'string'
      || (!entry.deleted && (!validNote(entry.metadata) || entry.metadata.id !== id || entry.metadata.version !== entry.version
        || typeof entry.noteFileId !== 'string' || !record(entry.attachments)))) throw new Error('CLOUD_CATALOG_INVALID');
  }
  for (const item of [...value.tags, ...value.collections]) {
    if (!record(item) || typeof item.id !== 'string' || typeof item.name !== 'string') throw new Error('CLOUD_CATALOG_INVALID');
  }
  return value as unknown as DriveCatalog;
}
export function parseNoteBackup(value: unknown, entry: CatalogEntry): NoteBackup {
  if (!record(value) || value.schemaVersion !== 1 || !validNote(value.note) || value.note.id !== entry.id || value.note.version !== entry.version
    || !Array.isArray(value.blocks) || !Array.isArray(value.files)) throw new Error('CLOUD_NOTE_INVALID');
  const blockIds = new Set<string>();
  for (const block of value.blocks) {
    if (!record(block) || typeof block.id !== 'string' || blockIds.has(block.id) || block.noteId !== entry.id
      || typeof block.contentText !== 'string' || !Number.isSafeInteger(block.sortOrder)
      || !['content', 'title'].includes(String(block.kind))) throw new Error('CLOUD_NOTE_INVALID');
    blockIds.add(block.id);
  }
  const fileIds = new Set<string>();
  for (const file of value.files) {
    if (!record(file) || typeof file.id !== 'string' || fileIds.has(file.id) || file.noteId !== entry.id
      || typeof file.relativePath !== 'string' || !safeFilePath(file.relativePath)
      || typeof file.checksum !== 'string' || typeof file.mimeType !== 'string' || typeof file.originalName !== 'string'
      || (file.blockId != null && !blockIds.has(String(file.blockId))) || !entry.attachments?.[file.id]) throw new Error('CLOUD_NOTE_INVALID');
    fileIds.add(file.id);
  }
  return value as unknown as NoteBackup;
}
export function safeFilePath(path: string) {
  return Boolean(path) && !path.includes('\\') && !path.includes(':') && !path.includes('\0')
    && path.split('/').every((part) => part && part !== '.' && part !== '..');
}
