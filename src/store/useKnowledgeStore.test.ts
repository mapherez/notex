import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../core/storage/notexRepository';
import { closeBrowserLibrary, currentBrowserStorage, openBrowserLibrary } from '../core/storage/storageRuntime';
import { emptyCatalog } from '../core/cloud/backupFormat';
import { useKnowledgeStore } from './useKnowledgeStore';
import { useNotesStore } from './useNotesStore';

vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => false, invoke: vi.fn() }));

let account: string;
beforeEach(async () => {
  account = `quick-access-${crypto.randomUUID()}`;
  await openBrowserLibrary(account);
  await db.collections.put({ id: 'collection', name: 'Work', color: 'blue' });
  await db.tags.put({ id: 'tag', name: 'Research', color: 'purple' });
  useNotesStore.setState({ notes: [] });
  await useKnowledgeStore.getState().refreshKnowledge();
});
afterEach(() => { vi.restoreAllMocks(); closeBrowserLibrary(); });

describe('pinned collections and tags', () => {
  it('persists both types across reopening and keeps pins when names and colors change', async () => {
    await useKnowledgeStore.getState().setCollectionPinned('collection', true);
    await useKnowledgeStore.getState().setTagPinned('tag', true);
    await useKnowledgeStore.getState().updateCollection('collection', { name: 'Projects', color: 'green' });
    await useKnowledgeStore.getState().updateTag('tag', { name: 'Reading', color: 'blue' });
    closeBrowserLibrary();
    await openBrowserLibrary(account);
    await useKnowledgeStore.getState().refreshKnowledge();
    expect(useKnowledgeStore.getState().collections).toEqual([
      { id: 'collection', name: 'Projects', color: 'green', isPinned: true },
    ]);
    expect(useKnowledgeStore.getState().tags[0]).toMatchObject({ name: 'Reading', isPinned: true });
    await useKnowledgeStore.getState().setTagPinned('tag', false);
    expect((await db.tags.get('tag'))?.isPinned).toBe(false);
  });

  it('queues organization backups for pin changes and restores pins from a catalog', async () => {
    const storage = currentBrowserStorage();
    for (const entry of await storage.pending()) await storage.acknowledge(entry.entityId, entry.changeToken);
    await useKnowledgeStore.getState().setTagPinned('tag', true);
    const pending = (await storage.pending())[0];
    expect(pending).toMatchObject({ entityId: '@library', kind: 'library' });
    await storage.acknowledge(pending.entityId, pending.changeToken);
    await useKnowledgeStore.getState().setTagPinned('tag', true);
    expect(await storage.pending()).toEqual([]);
    await storage.applyOrganization({ ...emptyCatalog(),
      tags: [{ id: 'remote-tag', name: 'Remote', isPinned: true }],
      collections: [{ id: 'remote-collection', name: 'Remote', isPinned: true }],
    });
    await useKnowledgeStore.getState().refreshKnowledge();
    expect(useKnowledgeStore.getState().tags[0].isPinned).toBe(true);
    expect(useKnowledgeStore.getState().collections[0].isPinned).toBe(true);
  });

  it('does not show a pin that failed to save or resurrect a deleted item', async () => {
    const put = vi.spyOn(currentBrowserStorage().db.tags, 'put').mockRejectedValueOnce(new Error('disk full'));
    await expect(useKnowledgeStore.getState().setTagPinned('tag', true)).rejects.toThrow('disk full');
    expect(useKnowledgeStore.getState().tags[0].isPinned).toBeUndefined();
    put.mockRestore();
    await useKnowledgeStore.getState().setTagPinned('tag', true);
    await useKnowledgeStore.getState().setCollectionPinned('collection', true);
    await useKnowledgeStore.getState().deleteTag('tag');
    await useKnowledgeStore.getState().deleteCollection('collection');
    await useKnowledgeStore.getState().setTagPinned('tag', true);
    await useKnowledgeStore.getState().setCollectionPinned('collection', true);
    expect(await db.tags.toArray()).toEqual([]);
    expect(await db.collections.toArray()).toEqual([]);
    expect(useKnowledgeStore.getState().tags).toEqual([]);
    expect(useKnowledgeStore.getState().collections).toEqual([]);
  });
});
