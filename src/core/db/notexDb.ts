import { invoke } from '@tauri-apps/api/core';
import type {
  ActivityItem,
  Collection,
  DeviceSession,
  Note,
  SyncItem,
  SyncState,
  Tag,
  User,
  UserSettings,
} from '../models/models';
import type { MockDataBundle } from '../data/createMockData';

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

let sqliteTransactionContext: SqliteTransactionContext | null = null;

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

export const db: NoteXStorageDatabase = new SqliteStorageAdapter();

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
