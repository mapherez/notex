import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import type { Note } from '../models/models';
import { IndexedDbStorage } from './indexedDbStorage';

const opened: IndexedDbStorage[] = [];
async function open(account = crypto.randomUUID()) {
  const storage = await IndexedDbStorage.open(account);
  opened.push(storage);
  return storage;
}
function note(id = 'note', title = 'Original', version = 1): Note {
  return {
    id, title, version, subtitle: '', collectionId: 'collection', tagIds: [], linkedNoteIds: [],
    isFavorite: false, isPinned: false, isArchived: false, isTrashed: false,
    saveState: 'saved', createdAt: '2026-01-01', updatedAt: '2026-01-01',
    stats: { wordCount: 1, characterCount: 8, readingTimeMinutes: 1 },
  };
}
afterEach(() => { for (const storage of opened.splice(0)) storage.close(); });

describe('IndexedDB account libraries', () => {
  it('requires an account and persists independently across closing and reopening', async () => {
    await expect(IndexedDbStorage.open('')).rejects.toThrow();
    const account = crypto.randomUUID();
    const first = await open(account);
    await first.db.notes.put(note());
    first.close();
    const resumed = await open(account);
    const other = await open();
    expect(await resumed.db.notes.get('note')).toEqual(note());
    expect(await other.db.notes.count()).toBe(0);
    expect(await resumed.pending()).toHaveLength(1);
  });

  it('rolls back records and pending backups together if a transaction fails', async () => {
    const storage = await open();
    await expect(storage.db.transaction('rw', [], async (db) => {
      await db.notes.put(note());
      expect(await db.notes.get('note')).toEqual(note());
      throw new Error('Simulated failure');
    })).rejects.toThrow('Simulated failure');
    expect(await storage.db.notes.count()).toBe(0);
    expect(await storage.pending()).toEqual([]);
  });

  it('acknowledges only the uploaded revision, ignores visits and records deletion', async () => {
    const storage = await open();
    await storage.db.notes.put(note());
    const original = (await storage.pending())[0];
    await storage.db.notes.put({ ...note(), lastOpenedAt: '2026-01-02' });
    expect((await storage.pending())[0].changeToken).toBe(original.changeToken);
    await storage.db.notes.put(note('note', 'Changed', 2));
    await storage.acknowledge('note', original.changeToken);
    expect(await storage.pending()).toHaveLength(1);
    const edited = (await storage.pending())[0];
    await storage.acknowledge('note', edited.changeToken);
    expect(await storage.pending()).toEqual([]);
    await storage.db.notes.delete('note');
    expect((await storage.pending())[0]).toMatchObject({ entityId: 'note', deleted: true, version: 3 });
  });

  it('does not enqueue visual preferences but records library organization', async () => {
    const storage = await open();
    const { defaultUserSettings } = await import('../../config/appSettings');
    await storage.db.userSettings.put(defaultUserSettings);
    const pending = (await storage.pending())[0];
    await storage.acknowledge(pending.entityId, pending.changeToken);
    await storage.db.userSettings.put({ ...defaultUserSettings, language: 'en', updatedAt: 'now' });
    expect(await storage.pending()).toEqual([]);
    await storage.db.userSettings.put({ ...defaultUserSettings, quickPinNoteIds: ['note'] });
    expect((await storage.pending())[0].kind).toBe('library');
  });

  it('backs up a block edit even when the parent header has not changed', async () => {
    const storage = await open();
    await storage.db.notes.put(note());
    const original = (await storage.pending())[0];
    await storage.acknowledge(original.entityId, original.changeToken);
    await storage.db.transaction('rw', [], async (db) => {
      await db.noteBlocks.put({ id: 'block', noteId: 'note', sortOrder: 0, kind: 'content',
        title: '', contentText: 'Edited body', contentJson: null, createdAt: '2026-01-01', updatedAt: '2026-01-02' });
      await db.notes.put({ ...note(), version: 2, updatedAt: '2026-01-02' });
    });
    expect((await storage.pending())[0]).toMatchObject({ entityId: 'note', version: 2, deleted: false });
  });

  it('supports indexed relations, boolean filters and atomic where deletion', async () => {
    const storage = await open();
    await storage.db.notes.bulkPut([note('a'), { ...note('b'), isFavorite: true }]);
    expect(await storage.db.notes.where('collectionId').equals('collection').count()).toBe(2);
    expect((await storage.db.notes.where('isFavorite').equals(true).toArray()).map((item) => item.id)).toEqual(['b']);
    await storage.db.notes.where('id').anyOf(['a', 'b']).delete();
    expect(await storage.db.notes.count()).toBe(0);
    expect((await storage.pending()).every((item) => item.deleted)).toBe(true);
  });
});
