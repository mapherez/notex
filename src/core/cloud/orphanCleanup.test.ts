import { describe, expect, it, vi } from 'vitest';
import { emptyCatalog } from './backupFormat';
import type { DriveClient, DriveFile } from './driveClient';
import type { CloudStorage } from './cloudStorage';
import { cleanOrphans, orphanCandidates } from './orphanCleanup';

const now = Date.parse('2026-09-16T12:00:00Z');
function file(id: string, parent?: string, root = false): DriveFile {
  return { id, name: id, parents: parent ? [parent] : [], createdTime: '2026-09-10T12:00:00Z',
    ...(root ? { appProperties: { notexBackup: '1', noteId: 'note' } } : {}) };
}
const tree = () => [file('root', undefined, true), file('files', 'root'), file('attachment', 'files'), file('note-json', 'root')];

describe('orphan cleanup', () => {
  it('finds an abandoned tree without any local record and deletes children first', () => {
    const result = orphanCandidates([...tree(), file('unrelated')], emptyCatalog(), new Set(), now);
    expect(result).toHaveLength(4);
    expect(result.indexOf('attachment')).toBeLessThan(result.indexOf('files'));
    expect(result.indexOf('files')).toBeLessThan(result.indexOf('root'));
    expect(result).not.toContain('unrelated');
  });

  it('preserves reused attachments and their parent folders', () => {
    const catalog = emptyCatalog();
    catalog.notes.note = { id: 'note', version: 2, deleted: false, hash: 'hash',
      attachments: { attachment: { id: 'attachment', hash: 'hash', size: 1 } } };
    expect(orphanCandidates(tree(), catalog, new Set(), now)).toEqual(['note-json']);
  });

  it('preserves active uploads and recent or undated files with their parents', () => {
    expect(orphanCandidates(tree(), emptyCatalog(), new Set(['root']), now)).toEqual([]);
    const files = tree();
    files[2].createdTime = new Date(now).toISOString();
    files[3].createdTime = undefined;
    expect(orphanCandidates(files, emptyCatalog(), new Set(), now)).toEqual([]);
  });

  it('uses the latest catalog and leaves a failed cleanup eligible for retry', async () => {
    const catalog = emptyCatalog();
    const drive = { signal: new AbortController().signal, list: vi.fn().mockResolvedValue(tree()),
      catalog: vi.fn().mockResolvedValue({ id: 'catalog', catalog }), delete: vi.fn().mockRejectedValue(new Error('Offline')) };
    const storage = { getState: vi.fn().mockResolvedValue(undefined), putState: vi.fn() };
    await expect(cleanOrphans(drive as unknown as DriveClient, storage as unknown as CloudStorage, now)).rejects.toThrow('Offline');
    expect(drive.catalog).toHaveBeenCalledOnce();
    expect(storage.putState).not.toHaveBeenCalled();
    drive.delete.mockResolvedValue(undefined);
    await cleanOrphans(drive as unknown as DriveClient, storage as unknown as CloudStorage, now);
    expect(storage.putState).toHaveBeenCalledWith('orphanScanAt', now);
  });
});
