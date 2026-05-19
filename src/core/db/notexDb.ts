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
