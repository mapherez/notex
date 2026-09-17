import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyCatalog, type DriveCatalog } from './backupFormat';
import { db } from '../db/notexDb';
import { IndexedDbStorage } from '../storage/indexedDbStorage';
import type { Note } from '../models/models';
import type { CloudStorage } from './cloudStorage';
import { DriveClient, DriveError } from './driveClient';
import { TransferEngine } from './transferEngine';

vi.mock('../db/notexDb', () => ({ db: { notes: { toArray: async () => [] } } }));
vi.mock('../mcp/noteMutationCoordinator', () => ({ hasNoteMutations: () => false }));

const opened: IndexedDbStorage[] = [];
afterEach(() => { for (const storage of opened.splice(0)) storage.close(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('transfer recovery', () => {
  function setup(error: Error) {
    const drive = new DriveClient(async () => '', new AbortController().signal);
    const catalog = vi.spyOn(drive, 'catalog').mockRejectedValue(error);
    const storage = { pending: vi.fn().mockResolvedValue([]), getState: vi.fn().mockResolvedValue(undefined) } as unknown as CloudStorage;
    const refresh = vi.fn().mockResolvedValue(undefined);
    const update = vi.fn();
    return { engine: new TransferEngine(drive, storage, update, refresh), catalog, storage, refresh, update };
  }

  it('retries a transient failure after a delay without another user action', async () => {
    vi.useFakeTimers();
    const { engine, catalog } = setup(new TypeError('Failed to fetch'));
    await engine.tick();
    await engine.tick();
    expect(catalog).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.now() + 15_001);
    await engine.tick();
    expect(catalog).toHaveBeenCalledTimes(2);
    await engine.stop();
  });

  it('does not repeatedly request Google authorization in the background', async () => {
    vi.useFakeTimers();
    const { engine, catalog } = setup(new DriveError(401, 'GOOGLE_REAUTHORIZE'));
    await engine.tick();
    vi.setSystemTime(Date.now() + 600_000);
    await engine.tick();
    expect(catalog).toHaveBeenCalledTimes(1);
    await engine.tick(true);
    expect(catalog).toHaveBeenCalledTimes(2);
    await engine.stop();
  });

  it('refreshes cached metadata before attempting to reach Drive', async () => {
    const { engine, storage, refresh, catalog, update } = setup(new TypeError('Offline'));
    const cached = emptyCatalog();
    vi.mocked(storage.getState).mockImplementation(async (key) => key === 'catalog' ? cached as never : undefined);
    refresh.mockImplementation(async () => { expect(catalog).not.toHaveBeenCalled(); });
    await engine.start();
    await engine.stop();
    expect(refresh).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ catalog: cached }));
  });
});

describe('publication consistency', () => {
  async function setup() {
    const { webcrypto } = await vi.importActual<{ webcrypto: Crypto }>('node:crypto');
    vi.stubGlobal('crypto', webcrypto);
    const storage = await IndexedDbStorage.open(crypto.randomUUID());
    opened.push(storage);
    Object.assign(db, storage.db);
    const note: Note = {
      id: 'note', title: 'Original', version: 1, subtitle: '', collectionId: '', tagIds: [], linkedNoteIds: [],
      isFavorite: false, isPinned: false, isArchived: false, isTrashed: false,
      saveState: 'saved', createdAt: '2026-01-01', updatedAt: '2026-01-01',
      stats: { wordCount: 1, characterCount: 8, readingTimeMinutes: 1 },
    };
    await storage.db.notes.put(note);
    let remote = emptyCatalog();
    let failResponse = false;
    let duringUpload: (() => Promise<void>) | undefined;
    const drive = new DriveClient(async () => '', new AbortController().signal);
    vi.spyOn(drive, 'catalog').mockImplementation(async () => ({ id: 'catalog', catalog: structuredClone(remote) }));
    const uploadedFiles = new Map<string, unknown>();
    vi.spyOn(drive, 'json').mockImplementation(async (id) => structuredClone(uploadedFiles.get(id)));
    vi.spyOn(drive, 'folder').mockImplementation(async () => crypto.randomUUID());
    vi.spyOn(drive, 'list').mockResolvedValue([]);
    const upload = vi.spyOn(drive, 'uploadJson').mockImplementation(async (name, value) => {
      if (name === 'note.json' && duringUpload) await duringUpload();
      if (name === 'metadata.json') {
        remote = structuredClone(value) as DriveCatalog;
        if (failResponse) { failResponse = false; throw new TypeError('Response lost after commit'); }
      }
      const id = name === 'metadata.json' ? 'catalog' : crypto.randomUUID();
      uploadedFiles.set(id, structuredClone(value));
      return id;
    });
    const create = () => new TransferEngine(drive, storage, vi.fn(), async () => {});
    return { storage, note, upload, create, remote: () => remote,
      loseResponse: () => { failResponse = true; }, onUpload: (action: () => Promise<void>) => { duringUpload = action; } };
  }

  it('recovers a committed catalog after a lost response without uploading the note again', async () => {
    const test = await setup();
    test.loseResponse();
    const engine = test.create();
    await engine.tick(); await engine.stop();
    expect(test.remote().notes.note.version).toBe(1);
    expect(await test.storage.pending()).toHaveLength(1);
    expect(await test.storage.getState('publication')).toBeTruthy();
    const resumed = test.create();
    await resumed.tick(); await resumed.stop();
    expect(await test.storage.pending()).toHaveLength(0);
    expect(await test.storage.getState('publication')).toBeNull();
    expect(test.upload.mock.calls.filter(([name]) => name === 'note.json')).toHaveLength(1);
  });

  it('preserves an edit made while the older snapshot is uploading', async () => {
    const test = await setup();
    test.onUpload(async () => { await test.storage.db.notes.put({ ...test.note, title: 'Edited during upload', version: 2 }); });
    const engine = test.create();
    await engine.tick(); await engine.stop();
    expect(test.remote().notes.note.version).toBe(1);
    expect((await test.storage.db.notes.get('note'))?.title).toBe('Edited during upload');
    expect(await test.storage.pending()).toEqual([expect.objectContaining({ entityId: 'note', version: 2 })]);
  });

  it('repeats local confirmation safely after acknowledgment fails', async () => {
    const test = await setup();
    const acknowledge = vi.spyOn(test.storage, 'acknowledge').mockRejectedValueOnce(new Error('Local write failed'));
    const engine = test.create();
    await engine.tick(); await engine.stop();
    expect(await test.storage.getState('publication')).toBeTruthy();
    const resumed = test.create();
    await resumed.tick(); await resumed.stop();
    expect(acknowledge).toHaveBeenCalledTimes(2);
    expect(await test.storage.pending()).toHaveLength(0);
    expect(test.upload.mock.calls.filter(([name]) => name === 'metadata.json')).toHaveLength(1);
  });

  it('keeps priorities paused but downloads an explicitly opened note without resuming the library', async () => {
    const test = await setup();
    await test.storage.db.notes.put({ ...test.note, id: 'other' });
    const publisher = test.create();
    await publisher.tick(); await publisher.stop();
    await test.storage.db.notes.delete('note');
    await test.storage.db.notes.delete('other');
    for (const pending of await test.storage.pending()) await test.storage.acknowledge(pending.entityId, pending.changeToken);
    const reader = test.create();
    reader.pause(true);
    reader.prioritize(['note']);
    await reader.tick();
    expect(await test.storage.db.notes.count()).toBe(0);
    reader.requestNote('note');
    await reader.tick();
    expect(await test.storage.db.notes.get('note')).toBeDefined();
    expect(await test.storage.db.notes.get('other')).toBeUndefined();
    await reader.stop();
  });
});
