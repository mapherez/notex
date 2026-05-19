import Dexie, { type Table } from 'dexie';
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

class NoteXDatabase extends Dexie {
  notes!: Table<Note, string>;
  tags!: Table<Tag, string>;
  collections!: Table<Collection, string>;
  users!: Table<User, string>;
  activities!: Table<ActivityItem, string>;
  userSettings!: Table<UserSettings, string>;
  syncState!: Table<SyncState, string>;
  syncItems!: Table<SyncItem, string>;
  deviceSessions!: Table<DeviceSession, string>;

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
  }
}

export const db = new NoteXDatabase();

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
