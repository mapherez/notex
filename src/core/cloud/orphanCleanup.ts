import { backupContent, contentHash, type DriveCatalog } from './backupFormat';
import type { CloudStorage } from './cloudStorage';
import type { DriveClient, DriveFile } from './driveClient';

const DAY = 24 * 60 * 60 * 1000;

// Only marked backup trees belong to this collector. Retain referenced files
// and their ancestors, including attachments reused from older note versions.
export function orphanCandidates(files: DriveFile[], catalog: DriveCatalog, active: Set<string>, now: number): string[] {
  const byId = new Map(files.map((file) => [file.id, file]));
  const children = new Map<string, string[]>();
  for (const file of files) for (const parent of file.parents ?? []) children.set(parent, [...children.get(parent) ?? [], file.id]);
  const owned = new Map<string, number>();
  const visit = (id: string, depth: number) => {
    if (owned.has(id)) return;
    owned.set(id, depth);
    for (const child of children.get(id) ?? []) visit(child, depth + 1);
  };
  for (const file of files) if (file.appProperties?.notexBackup === '1') visit(file.id, 0);
  const keep = new Set<string>();
  const retain = (id: string) => {
    if (keep.has(id)) return;
    keep.add(id);
    for (const parent of byId.get(id)?.parents ?? []) retain(parent);
  };
  const retainTree = (id: string) => { retain(id); for (const child of children.get(id) ?? []) retainTree(child); };
  for (const id of active) retainTree(id);
  for (const entry of Object.values(catalog.notes)) {
    for (const id of [entry.folderId, entry.noteFileId, entry.manifestFileId, ...Object.values(entry.attachments ?? {}).map((file) => file.id)]) {
      if (id) retain(id);
    }
  }
  for (const file of files) {
    const created = Date.parse(file.createdTime ?? '');
    if (!Number.isFinite(created) || now - created < DAY) retain(file.id);
  }
  return [...owned].filter(([id]) => !keep.has(id)).sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

export async function cleanOrphans(drive: DriveClient, storage: CloudStorage, now = Date.now()) {
  if (now - (await storage.getState<number>('orphanScanAt') ?? 0) < DAY) return;
  const files = await drive.list('trashed = false');
  const active = new Set<string>();
  for (const root of files.filter((file) => file.appProperties?.notexBackup === '1')) {
    const id = root.appProperties?.noteId;
    if (!id) { active.add(root.id); continue; }
    const progress = await storage.getState<{ folderId: string; hash: string }>(`upload:${id}`);
    if (progress?.folderId !== root.id) continue;
    const { backup } = await storage.snapshot(id);
    if (backup && await contentHash(backupContent(backup)) === progress.hash) active.add(root.id);
  }
  // Read after enumeration, never use an earlier cached catalog to delete.
  const current = await drive.catalog();
  if (!current.id) return;
  for (const id of orphanCandidates(files, current.catalog, active, now)) {
    drive.signal.throwIfAborted();
    await drive.delete(id);
  }
  await storage.putState('orphanScanAt', now);
}
