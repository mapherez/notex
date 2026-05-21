import { invoke } from '@tauri-apps/api/core';
import Dexie, { type Table as DexieTable } from 'dexie';
import type {
  ActivityItem,
  Collection,
  DeviceSession,
  Note,
  NoteXExport,
  SyncItem,
  SyncState,
  Tag,
  User,
  UserSettings,
} from '../models/models';
import type { MockDataBundle } from '../data/createMockData';

const removedDefaultNoteIds = ['note-roadmap', 'note-product-ideas', 'note-terminal', 'note-japan', 'note-atomic-habits'];
const removedDefaultTagIds = [
  'tag-productivity',
  'tag-development',
  'tag-ideas',
  'tag-study',
  'tag-personal',
  'tag-portuguese',
  'tag-work',
  'tag-inspiration',
];
const removedDefaultCollectionIds = ['collection-studies', 'collection-projects', 'collection-ideas'];
const keptDefaultTagIds = ['tag-grammar', 'tag-doubt'];

class NoteXDatabase extends Dexie {
  notes!: DexieTable<Note, string>;
  tags!: DexieTable<Tag, string>;
  collections!: DexieTable<Collection, string>;
  users!: DexieTable<User, string>;
  activities!: DexieTable<ActivityItem, string>;
  userSettings!: DexieTable<UserSettings, string>;
  syncState!: DexieTable<SyncState, string>;
  syncItems!: DexieTable<SyncItem, string>;
  deviceSessions!: DexieTable<DeviceSession, string>;

  constructor() {
    super('notex-local-db');

    this.version(1).stores({
      notes: 'id, type, collectionId, isFavorite, isPinned, isArchived, isTrashed, updatedAt, lastOpenedAt',
      tags: 'id, name',
      collections: 'id, name',
      users: 'id, email',
      activities: 'id, noteId, createdAt',
      userSettings: 'id, language, theme, updatedAt',
    });

    this.version(2).stores({
      notes: 'id, type, collectionId, isFavorite, isPinned, isArchived, isTrashed, updatedAt, lastOpenedAt, syncStatus',
      tags: 'id, name',
      collections: 'id, name',
      users: 'id, email, googleSub',
      activities: 'id, noteId, createdAt',
      userSettings: 'id, language, theme, updatedAt',
      syncState: 'id, provider, connected, email, updatedAt, lastSyncAt',
      syncItems: 'entityKey, entityType, entityId, status, updatedAt',
      deviceSessions: 'id, lastSeenAt',
    });

    this.version(3)
      .stores({
        notes: 'id, type, collectionId, isFavorite, isPinned, isArchived, isTrashed, updatedAt, lastOpenedAt, syncStatus',
        tags: 'id, name',
        collections: 'id, name',
        users: 'id, email, googleSub',
        activities: 'id, noteId, createdAt',
        userSettings: 'id, language, theme, updatedAt',
        syncState: 'id, provider, connected, email, updatedAt, lastSyncAt',
        syncItems: 'entityKey, entityType, entityId, status, updatedAt',
        deviceSessions: 'id, lastSeenAt',
      })
      .upgrade(async (tx) => {
        const notes = tx.table<Note, string>('notes');
        const tags = tx.table<Tag, string>('tags');
        const collections = tx.table<Collection, string>('collections');
        const activities = tx.table<ActivityItem, string>('activities');
        const userSettings = tx.table<UserSettings, string>('userSettings');

        await notes.bulkDelete(removedDefaultNoteIds);
        await tags.bulkDelete(removedDefaultTagIds);
        await collections.bulkDelete(removedDefaultCollectionIds);
        await activities.where('noteId').anyOf(removedDefaultNoteIds).delete();

        const linguisticNote = await notes.get('note-linguistic');
        if (linguisticNote) {
          await notes.put({
            ...linguisticNote,
            collectionId: 'collection-work',
            tagIds: keptDefaultTagIds,
            linkedNoteIds: [],
            isFavorite: true,
            syncStatus: 'local',
            version: linguisticNote.version + 1,
            updatedAt: new Date().toISOString(),
          });
        }

        const allNotes = await notes.toArray();
        const cleanedNotes = allNotes
          .filter((note) => note.id !== 'note-linguistic')
          .map((note) => ({
            ...note,
            collectionId: removedDefaultCollectionIds.includes(note.collectionId ?? '') ? null : note.collectionId,
            tagIds: note.tagIds.filter((tagId) => !removedDefaultTagIds.includes(tagId)),
            linkedNoteIds: note.linkedNoteIds.filter((noteId) => !removedDefaultNoteIds.includes(noteId)),
          }));
        if (cleanedNotes.length) {
          await notes.bulkPut(cleanedNotes);
        }

        const settings = await userSettings.get('local-user-settings');
        if (settings) {
          const quickPinNoteIds = settings.quickPinNoteIds.filter((noteId) => !removedDefaultNoteIds.includes(noteId));
          const favoriteTagIds = settings.favoriteTagIds.filter((tagId) => keptDefaultTagIds.includes(tagId));
          await userSettings.put({
            ...settings,
            primaryCollectionId: removedDefaultCollectionIds.includes(settings.primaryCollectionId)
              ? 'collection-work'
              : settings.primaryCollectionId,
            favoriteTagIds: favoriteTagIds.length ? favoriteTagIds : keptDefaultTagIds,
            quickPinNoteIds: quickPinNoteIds.length ? quickPinNoteIds : ['note-linguistic'],
            updatedAt: new Date().toISOString(),
          });
        }
      });

    this.version(4)
      .stores({
        notes: 'id, type, collectionId, isFavorite, isPinned, isArchived, isTrashed, updatedAt, lastOpenedAt, syncStatus',
        tags: 'id, name',
        collections: 'id, name',
        users: 'id, email, googleSub',
        activities: 'id, noteId, createdAt',
        userSettings: 'id, language, theme, updatedAt',
        syncState: 'id, provider, connected, email, updatedAt, lastSyncAt',
        syncItems: 'entityKey, entityType, entityId, status, updatedAt',
        deviceSessions: 'id, lastSeenAt',
      })
      .upgrade(async (tx) => {
        const users = tx.table<User, string>('users');
        const syncState = tx.table<SyncState, string>('syncState');
        const [user, googleState] = await Promise.all([users.toArray(), syncState.get('google-drive')]);
        const currentUser = user[0];

        if (!googleState?.connected && currentUser?.provider !== 'google' && !currentUser?.googleSub) {
          await users.clear();
          await users.put({
            id: 'user-local',
            provider: 'local',
            name: 'Local user',
          });
        }
      });

    this.version(5)
      .stores({
        notes: 'id, type, collectionId, isFavorite, isPinned, isArchived, isTrashed, updatedAt, lastOpenedAt, syncStatus',
        tags: 'id, name',
        collections: 'id, name',
        users: 'id, email, googleSub',
        activities: 'id, noteId, createdAt',
        userSettings: 'id, language, theme, updatedAt',
        syncState: 'id, provider, connected, email, updatedAt, lastSyncAt',
        syncItems: 'entityKey, entityType, entityId, status, updatedAt',
        deviceSessions: 'id, lastSeenAt',
      })
      .upgrade(async (tx) => {
        const syncItems = tx.table<SyncItem, string>('syncItems');
        const items = await syncItems.toArray();
        const upgraded = items.flatMap((item) => {
          if (item.baseHash || !item.remoteHash) {
            return [];
          }

          return [
            {
              ...item,
              baseHash: item.remoteHash,
            },
          ];
        });

        if (upgraded.length) {
          await syncItems.bulkPut(upgraded);
        }
      });
  }
}

type TableName =
  | 'notes'
  | 'tags'
  | 'collections'
  | 'users'
  | 'activities'
  | 'userSettings'
  | 'syncState'
  | 'syncItems'
  | 'deviceSessions';

type WhereQuery<T> = {
  delete: () => Promise<unknown>;
  count: () => Promise<number>;
  toArray: () => Promise<T[]>;
};

type WhereClause<T> = {
  equals: (value: unknown) => WhereQuery<T>;
  anyOf: (values: unknown[]) => WhereQuery<T>;
};

export type StorageTable<T> = {
  get: (key: string) => Promise<T | undefined>;
  put: (value: T) => Promise<unknown>;
  bulkPut: (values: T[]) => Promise<unknown>;
  delete: (key: string) => Promise<unknown>;
  bulkDelete: (keys: string[]) => Promise<unknown>;
  clear: () => Promise<unknown>;
  toArray: () => Promise<T[]>;
  count: () => Promise<number>;
  where: (index: string) => WhereClause<T>;
};

type NoteXStorageDatabase = {
  notes: StorageTable<Note>;
  tags: StorageTable<Tag>;
  collections: StorageTable<Collection>;
  users: StorageTable<User>;
  activities: StorageTable<ActivityItem>;
  userSettings: StorageTable<UserSettings>;
  syncState: StorageTable<SyncState>;
  syncItems: StorageTable<SyncItem>;
  deviceSessions: StorageTable<DeviceSession>;
  transaction: <T>(mode: string, tables: unknown[], scope: () => Promise<T>) => Promise<T>;
};

type SqliteOperation =
  | { table: TableName; kind: 'put'; value: unknown }
  | { table: TableName; kind: 'bulkPut'; values: unknown[] }
  | { table: TableName; kind: 'delete'; key: string }
  | { table: TableName; kind: 'bulkDelete'; keys: string[] }
  | { table: TableName; kind: 'clear' }
  | { table: TableName; kind: 'whereDelete'; index: string; values: unknown[] };

type SqliteTransactionContext = {
  operations: SqliteOperation[];
};

const indexedDb = new NoteXDatabase();
let sqliteTransactionContext: SqliteTransactionContext | null = null;

class DexieStorageAdapter implements NoteXStorageDatabase {
  notes = indexedDb.notes as unknown as StorageTable<Note>;
  tags = indexedDb.tags as unknown as StorageTable<Tag>;
  collections = indexedDb.collections as unknown as StorageTable<Collection>;
  users = indexedDb.users as unknown as StorageTable<User>;
  activities = indexedDb.activities as unknown as StorageTable<ActivityItem>;
  userSettings = indexedDb.userSettings as unknown as StorageTable<UserSettings>;
  syncState = indexedDb.syncState as unknown as StorageTable<SyncState>;
  syncItems = indexedDb.syncItems as unknown as StorageTable<SyncItem>;
  deviceSessions = indexedDb.deviceSessions as unknown as StorageTable<DeviceSession>;

  transaction<T>(mode: string, tables: unknown[], scope: () => Promise<T>) {
    return indexedDb.transaction(mode as Parameters<NoteXDatabase['transaction']>[0], tables as DexieTable<unknown, string>[], scope);
  }
}

class SqliteStorageAdapter implements NoteXStorageDatabase {
  notes = new SqliteTable<Note>('notes');
  tags = new SqliteTable<Tag>('tags');
  collections = new SqliteTable<Collection>('collections');
  users = new SqliteTable<User>('users');
  activities = new SqliteTable<ActivityItem>('activities');
  userSettings = new SqliteTable<UserSettings>('userSettings');
  syncState = new SqliteTable<SyncState>('syncState');
  syncItems = new SqliteTable<SyncItem>('syncItems');
  deviceSessions = new SqliteTable<DeviceSession>('deviceSessions');

  async transaction<T>(_mode: string, _tables: unknown[], scope: () => Promise<T>) {
    if (sqliteTransactionContext) {
      return scope();
    }

    const context: SqliteTransactionContext = { operations: [] };
    sqliteTransactionContext = context;
    try {
      const result = await scope();
      if (context.operations.length) {
        await invoke('notex_sqlite_transaction', { operations: context.operations });
      }
      return result;
    } finally {
      sqliteTransactionContext = null;
    }
  }
}

class SqliteTable<T> implements StorageTable<T> {
  constructor(private readonly table: TableName) {}

  async get(key: string) {
    return (await invoke<T | null>('notex_sqlite_get', { table: this.table, key })) ?? undefined;
  }

  async put(value: T) {
    await this.write({ table: this.table, kind: 'put', value });
  }

  async bulkPut(values: T[]) {
    if (!values.length) {
      return;
    }

    await this.write({ table: this.table, kind: 'bulkPut', values });
  }

  async delete(key: string) {
    await this.write({ table: this.table, kind: 'delete', key });
  }

  async bulkDelete(keys: string[]) {
    if (!keys.length) {
      return;
    }

    await this.write({ table: this.table, kind: 'bulkDelete', keys });
  }

  async clear() {
    await this.write({ table: this.table, kind: 'clear' });
  }

  async toArray() {
    return invoke<T[]>('notex_sqlite_read_table', { table: this.table });
  }

  async count() {
    return invoke<number>('notex_sqlite_count', { table: this.table });
  }

  where(index: string): WhereClause<T> {
    return new SqliteWhereClause<T>(this.table, index);
  }

  private async write(operation: SqliteOperation) {
    if (sqliteTransactionContext) {
      sqliteTransactionContext.operations.push(operation);
      return;
    }

    await invoke('notex_sqlite_transaction', { operations: [operation] });
  }
}

class SqliteWhereClause<T> implements WhereClause<T> {
  constructor(
    private readonly table: TableName,
    private readonly index: string,
  ) {}

  equals(value: unknown): WhereQuery<T> {
    return new SqliteWhereQuery<T>(this.table, this.index, [value]);
  }

  anyOf(values: unknown[]): WhereQuery<T> {
    return new SqliteWhereQuery<T>(this.table, this.index, values);
  }
}

class SqliteWhereQuery<T> implements WhereQuery<T> {
  constructor(
    private readonly table: TableName,
    private readonly index: string,
    private readonly values: unknown[],
  ) {}

  async delete() {
    if (!this.values.length) {
      return;
    }

    const operation: SqliteOperation = {
      table: this.table,
      kind: 'whereDelete',
      index: this.index,
      values: this.values,
    };

    if (sqliteTransactionContext) {
      sqliteTransactionContext.operations.push(operation);
      return;
    }

    await invoke('notex_sqlite_transaction', { operations: [operation] });
  }

  async count() {
    if (!this.values.length) {
      return 0;
    }

    return invoke<number>('notex_sqlite_where_count', {
      table: this.table,
      index: this.index,
      values: this.values,
    });
  }

  async toArray() {
    if (!this.values.length) {
      return [];
    }

    return invoke<T[]>('notex_sqlite_where_read', {
      table: this.table,
      index: this.index,
      values: this.values,
    });
  }
}

let activeStorage: NoteXStorageDatabase = new DexieStorageAdapter();

export function useIndexedDbStorage() {
  activeStorage = new DexieStorageAdapter();
}

export function useSqliteStorage() {
  activeStorage = new SqliteStorageAdapter();
}

export const db: NoteXStorageDatabase = {
  get notes() {
    return activeStorage.notes;
  },
  get tags() {
    return activeStorage.tags;
  },
  get collections() {
    return activeStorage.collections;
  },
  get users() {
    return activeStorage.users;
  },
  get activities() {
    return activeStorage.activities;
  },
  get userSettings() {
    return activeStorage.userSettings;
  },
  get syncState() {
    return activeStorage.syncState;
  },
  get syncItems() {
    return activeStorage.syncItems;
  },
  get deviceSessions() {
    return activeStorage.deviceSessions;
  },
  transaction(mode, tables, scope) {
    return activeStorage.transaction(mode, tables, scope);
  },
};

export type IndexedDbMigrationSnapshot = {
  exportPayload: NoteXExport;
  users: User[];
  activities: ActivityItem[];
  syncState: SyncState | null;
  syncItems: SyncItem[];
  deviceSessions: DeviceSession[];
};

export async function readIndexedDbMigrationSnapshot(settingsFallback: UserSettings): Promise<IndexedDbMigrationSnapshot> {
  const [notes, tags, collections, users, activities, storedSettings, syncState, syncItems, deviceSessions] = await Promise.all([
    indexedDb.notes.toArray(),
    indexedDb.tags.toArray(),
    indexedDb.collections.toArray(),
    indexedDb.users.toArray(),
    indexedDb.activities.toArray(),
    indexedDb.userSettings.get(settingsFallback.id),
    indexedDb.syncState.get('google-drive'),
    indexedDb.syncItems.toArray(),
    indexedDb.deviceSessions.toArray(),
  ]);

  return {
    exportPayload: {
      version: 1,
      exportedAt: new Date().toISOString(),
      notes,
      tags,
      collections,
      userSettings: storedSettings ?? settingsFallback,
    },
    users,
    activities,
    syncState: syncState ?? null,
    syncItems,
    deviceSessions,
  };
}

export async function seedDatabaseIfEmpty(bundle: MockDataBundle, settings: UserSettings) {
  const notesCount = await db.notes.count();
  if (notesCount > 0) {
    return;
  }

  await db.transaction('rw', [db.notes, db.tags, db.collections, db.users, db.activities, db.userSettings], async () => {
    await db.notes.bulkPut(bundle.notes);
    await db.tags.bulkPut(bundle.tags);
    await db.collections.bulkPut(bundle.collections);
    await db.users.put(bundle.user);
    await db.activities.bulkPut(bundle.activities);
    await db.userSettings.put(settings);
  });
}

export async function readAllKnowledge() {
  const [notes, tags, collections, users, activities] = await Promise.all([
    db.notes.toArray(),
    db.tags.toArray(),
    db.collections.toArray(),
    db.users.toArray(),
    db.activities.toArray(),
  ]);

  return {
    notes,
    tags,
    collections,
    user: users[0],
    activities,
  };
}

export async function readUserSettings(id: string) {
  return db.userSettings.get(id);
}

export async function writeUserSettings(settings: UserSettings) {
  await db.userSettings.put(settings);
}

export async function readSyncState() {
  return db.syncState.get('google-drive');
}

export async function writeSyncState(state: SyncState) {
  await db.syncState.put(state);
}

export async function readSyncItems() {
  return db.syncItems.toArray();
}

export async function readDeviceSessions() {
  return db.deviceSessions.toArray();
}

export async function replaceKnowledge({
  notes,
  tags,
  collections,
  userSettings,
}: {
  notes: Note[];
  tags: Tag[];
  collections: Collection[];
  userSettings: UserSettings;
}) {
  await db.transaction('rw', [db.notes, db.tags, db.collections, db.userSettings], async () => {
    await db.notes.clear();
    await db.tags.clear();
    await db.collections.clear();
    await db.notes.bulkPut(notes);
    await db.tags.bulkPut(tags);
    await db.collections.bulkPut(collections);
    await db.userSettings.put(userSettings);
  });
}

export async function resetKnowledge(bundle: MockDataBundle, settings: UserSettings) {
  await db.transaction('rw', [db.notes, db.tags, db.collections, db.users, db.activities, db.userSettings], async () => {
    await db.notes.clear();
    await db.tags.clear();
    await db.collections.clear();
    await db.users.clear();
    await db.activities.clear();
    await db.userSettings.clear();
    await db.notes.bulkPut(bundle.notes);
    await db.tags.bulkPut(bundle.tags);
    await db.collections.bulkPut(bundle.collections);
    await db.users.put(bundle.user);
    await db.activities.bulkPut(bundle.activities);
    await db.userSettings.put(settings);
  });
}
