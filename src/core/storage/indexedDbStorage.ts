import type { NoteXStorageDatabase, StorageTable } from '../db/notexDb';
import { hasBackupChange, type PendingBackup } from './backupState';
import type { CatalogEntry, DriveCatalog, NoteBackup } from '../cloud/backupFormat';
import type { NoteSnapshot } from '../cloud/cloudStorage';

const tables = ['notes', 'noteBlocks', 'noteFiles', 'tags', 'collections', 'users', 'activities', 'userSettings'] as const;
type TableName = typeof tables[number];
type StoredRecord = { id: string; [key: string]: unknown };
const stores = [...tables, 'cloudState', 'cloudOutbox', 'blobs'];
const indexes: Partial<Record<TableName, string[]>> = {
  notes: ['collectionId', 'updatedAt'], noteBlocks: ['noteId', 'sortOrder'],
  noteFiles: ['noteId', 'blockId'], activities: ['noteId'],
};

function request<T>(operation: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    operation.onsuccess = () => resolve(operation.result);
    operation.onerror = () => reject(operation.error ?? new Error('IndexedDB request failed'));
  });
}

function completion(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    transaction.onerror = () => { /* The abort event reports the final failure. */ };
  });
}

export class IndexedDbStorage {
  readonly db: NoteXStorageDatabase;
  private closed = false;

  private constructor(private readonly connection: IDBDatabase) {
    this.db = this.facade();
    connection.onversionchange = () => this.close();
  }

  static async open(accountId: string): Promise<IndexedDbStorage> {
    if (!accountId.trim()) throw new Error('A Google account is required for browser storage');
    const opening = indexedDB.open(`notex:account:${encodeURIComponent(accountId)}`, 1);
    opening.onupgradeneeded = () => {
      const connection = opening.result;
      for (const table of tables) {
        const store = connection.createObjectStore(table, { keyPath: 'id' });
        for (const index of indexes[table] ?? []) store.createIndex(index, index);
      }
      connection.createObjectStore('cloudState', { keyPath: 'id' });
      connection.createObjectStore('cloudOutbox', { keyPath: 'entityId' });
      connection.createObjectStore('blobs');
    };
    return new IndexedDbStorage(await request(opening));
  }

  close() {
    this.closed = true;
    this.connection.close();
  }

  private async run<T>(mode: IDBTransactionMode, scope: (tx: IDBTransaction) => Promise<T>) {
    if (this.closed) throw new Error('The account library is closed');
    const tx = this.connection.transaction(stores, mode);
    const done = completion(tx);
    // Attach immediately: a request may fail before the callback unwinds.
    void done.catch(() => undefined);
    try {
      const result = await scope(tx);
      await done;
      return result;
    } catch (error) {
      try { tx.abort(); } catch { /* It may already have aborted. */ }
      await done.catch(() => undefined);
      throw error;
    }
  }

  private facade(tx?: IDBTransaction): NoteXStorageDatabase {
    const result = Object.fromEntries(tables.map((name) => [name, this.table(name, tx)])) as unknown as NoteXStorageDatabase;
    result.transaction = async (mode, _tables, scope) => {
      if (tx) return scope(result);
      return this.run(mode === 'r' ? 'readonly' : 'readwrite', (transaction) => scope(this.facade(transaction)));
    };
    return result;
  }

  private table<T>(name: TableName, transaction?: IDBTransaction): StorageTable<T> {
    const run = <R>(mode: IDBTransactionMode, scope: (tx: IDBTransaction) => Promise<R>) =>
      transaction ? scope(transaction) : this.run(mode, scope);
    const readAll = (tx: IDBTransaction) => request<T[]>(tx.objectStore(name).getAll());
    const mutate = async (tx: IDBTransaction, value: T | undefined, key: string) => {
      const store = tx.objectStore(name);
      const before = await request<StoredRecord | undefined>(store.get(key));
      const after = value as StoredRecord | undefined;
      if (after === undefined) await request(store.delete(key));
      else await request(store.put(after));
      if (!['notes', 'tags', 'collections', 'userSettings'].includes(name) || !hasBackupChange(name, before, after)) return;
      const entityId = name === 'notes' ? key : '@library';
      const outbox = tx.objectStore('cloudOutbox');
      const pending = await request<PendingBackup | undefined>(outbox.get(entityId));
      const now = Date.now();
      await request(outbox.put({
        entityId, kind: name === 'notes' ? 'note' : 'library', changeToken: crypto.randomUUID(),
        version: name === 'notes' ? Number(after?.version ?? Number(before?.version ?? 0) + 1) : (pending?.version ?? 0) + 1,
        deleted: after === undefined && name === 'notes',
        firstChangedAt: pending?.firstChangedAt ?? now, lastChangedAt: now,
      } satisfies PendingBackup));
    };
    const table: StorageTable<T> = {
      get: (key) => run('readonly', (tx) => request<T | undefined>(tx.objectStore(name).get(key))),
      toArray: () => run('readonly', readAll),
      count: () => run('readonly', (tx) => request(tx.objectStore(name).count())),
      put: (value) => run('readwrite', (tx) => mutate(tx, value, (value as StoredRecord).id)),
      bulkPut: (values) => run('readwrite', async (tx) => { for (const value of values) await mutate(tx, value, (value as StoredRecord).id); }),
      delete: (key) => run('readwrite', (tx) => mutate(tx, undefined, key)),
      bulkDelete: (keys) => run('readwrite', async (tx) => { for (const key of keys) await mutate(tx, undefined, key); }),
      clear: () => run('readwrite', async (tx) => {
        const keys = await request(tx.objectStore(name).getAllKeys());
        for (const key of keys) await mutate(tx, undefined, String(key));
      }),
      where: (index) => {
        const query = (values: unknown[]) => {
          const matching = async (tx: IDBTransaction) => {
            if (!values.length) return [] as T[];
            const store = tx.objectStore(name);
            // Boolean fields cannot be IndexedDB keys, so use the record scan
            // for these small metadata filters; noteId queries use indexes.
            if (store.indexNames.contains(index) && values.every((value) => typeof value === 'string' || typeof value === 'number')) {
              const rows = await Promise.all(values.map((value) => request<T[]>(store.index(index).getAll(value as IDBValidKey))));
              return [...new Map(rows.flat().map((row) => [(row as StoredRecord).id, row])).values()];
            }
            return (await readAll(tx)).filter((row) => values.includes((row as StoredRecord)[index]));
          };
          return {
            toArray: () => run('readonly', matching),
            count: () => run('readonly', async (tx) => (await matching(tx)).length),
            delete: () => run('readwrite', async (tx) => {
              for (const row of await matching(tx)) await mutate(tx, undefined, (row as StoredRecord).id);
            }),
          };
        };
        return { equals: (value) => query([value]), anyOf: query };
      },
    };
    return table;
  }

  getState<T>(id: string) {
    return this.run('readonly', async (tx) => (await request<{ id: string; value: T } | undefined>(tx.objectStore('cloudState').get(id)))?.value);
  }

  snapshot(id: string): Promise<NoteSnapshot> {
    return this.run('readonly', async (tx) => {
      const db = this.facade(tx);
      const note = await db.notes.get(id);
      const pending = await request<PendingBackup | undefined>(tx.objectStore('cloudOutbox').get(id));
      let backup: NoteBackup | null = null;
      if (note) backup = { schemaVersion: 1, exportedAt: new Date().toISOString(), note,
        blocks: await db.noteBlocks.where('noteId').equals(id).toArray(),
        files: await db.noteFiles.where('noteId').equals(id).toArray(),
        tags: (await db.tags.toArray()).filter((tag) => note.tagIds.includes(tag.id)),
        collection: note.collectionId ? await db.collections.get(note.collectionId) ?? null : null, linkedNotes: [] };
      return { backup, version: note?.version ?? null, changeToken: pending?.changeToken ?? null };
    });
  }

  applyOrganization(catalog: DriveCatalog) {
    return this.run('readwrite', async (tx) => {
      if (await request(tx.objectStore('cloudOutbox').get('@library'))) return;
      await request(tx.objectStore('tags').clear());
      await request(tx.objectStore('collections').clear());
      for (const tag of catalog.tags) await request(tx.objectStore('tags').put(tag));
      for (const collection of catalog.collections) await request(tx.objectStore('collections').put(collection));
      if (catalog.organization) {
        const settings = await request<Record<string, unknown>[]>(tx.objectStore('userSettings').getAll());
        for (const value of settings) await request(tx.objectStore('userSettings').put({ ...value, ...catalog.organization }));
      }
    });
  }

  apply(id: string, backup: NoteBackup | null, entry: CatalogEntry, expected: NoteSnapshot): Promise<void> {
    return this.run('readwrite', async (tx) => {
      const db = this.facade(tx);
      const note = await db.notes.get(id);
      const pending = await request<PendingBackup | undefined>(tx.objectStore('cloudOutbox').get(id));
      if ((note?.version ?? null) !== expected.version || (pending?.changeToken ?? null) !== expected.changeToken) throw new Error('LOCAL_NOTE_CHANGED');
      if (backup) {
        if (backup.note.id !== id) throw new Error('CLOUD_NOTE_INVALID');
        for (const [table, records] of [['noteBlocks', backup.blocks], ['noteFiles', backup.files]] as const) {
          for (const record of records) {
            const old = await request<{ noteId: string } | undefined>(tx.objectStore(table).get(record.id));
            if (record.noteId !== id || (old && old.noteId !== id)) throw new Error('CLOUD_NOTE_INVALID');
          }
        }
        for (const file of backup.files) {
          if (!(await request(tx.objectStore('blobs').getKey(file.relativePath)))) throw new Error('Missing downloaded attachment');
        }
      }
      for (const table of ['noteBlocks', 'noteFiles'] as const) {
        const keys = await request(tx.objectStore(table).index('noteId').getAllKeys(id));
        for (const key of keys) await request(tx.objectStore(table).delete(key));
      }
      if (backup) {
        await request(tx.objectStore('notes').put(backup.note));
        for (const block of backup.blocks) await request(tx.objectStore('noteBlocks').put(block));
        for (const file of backup.files) await request(tx.objectStore('noteFiles').put(file));
      } else await request(tx.objectStore('notes').delete(id));
      await request(tx.objectStore('cloudOutbox').delete(id));
      await request(tx.objectStore('cloudState').put({ id: `baseline:${id}`, value: entry }));
    });
  }

  putState<T>(id: string, value: T) {
    return this.run('readwrite', async (tx) => { await request(tx.objectStore('cloudState').put({ id, value })); });
  }

  pending() {
    return this.run('readonly', (tx) => request<PendingBackup[]>(tx.objectStore('cloudOutbox').getAll()));
  }

  acknowledge(entityId: string, changeToken: string) {
    return this.run('readwrite', async (tx) => {
      const outbox = tx.objectStore('cloudOutbox');
      const current = await request<PendingBackup | undefined>(outbox.get(entityId));
      if (current?.changeToken === changeToken) await request(outbox.delete(entityId));
    });
  }

  readBlob(path: string) {
    return this.run('readonly', (tx) => request<Blob | undefined>(tx.objectStore('blobs').get(path)));
  }

  writeBlob(path: string, blob: Blob) {
    return this.run('readwrite', async (tx) => { await request(tx.objectStore('blobs').put(blob, path)); });
  }

  deleteBlob(path: string) {
    return this.run('readwrite', async (tx) => { await request(tx.objectStore('blobs').delete(path)); });
  }
}
