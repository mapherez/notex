import { create } from 'zustand';
import { defaultNewCollectionColor, defaultNewTagColor, defaultUserSettings, demoSettings } from '../config/appSettings';
import { createMockData } from '../core/data/createMockData';
import { db, readAllKnowledge, seedDatabaseIfEmpty } from '../core/storage/notexRepository';
import type { ActivityItem, Collection, Locale, Tag, TagColor, User, UserSettings } from '../core/models/models';
import { useNotesStore } from './useNotesStore';

type KnowledgeStore = {
  tags: Tag[];
  collections: Collection[];
  user: User | null;
  activities: ActivityItem[];
  isReady: boolean;
  initialize: (locale: Locale, userSettings?: UserSettings) => Promise<void>;
  refreshKnowledge: () => Promise<void>;
  setUser: (user: User) => Promise<void>;
  createCollection: (name: string, color?: TagColor) => Promise<Collection | null>;
  updateCollection: (collectionId: string, input: { name: string; color?: TagColor }) => Promise<void>;
  deleteCollection: (collectionId: string) => Promise<void>;
  createTag: (name: string, color?: TagColor) => Promise<Tag | null>;
  updateTag: (tagId: string, input: { name: string; color?: TagColor }) => Promise<void>;
  deleteTag: (tagId: string) => Promise<void>;
  resetDemoData: (locale: Locale, settings: UserSettings) => Promise<void>;
};

const collectionOrder = demoSettings.collectionOrder;
const initialKnowledge = createMockData(defaultUserSettings.language);

export const useKnowledgeStore = create<KnowledgeStore>((set, get) => ({
  tags: sortTags(initialKnowledge.tags),
  collections: sortCollections(initialKnowledge.collections),
  user: initialKnowledge.user,
  activities: sortActivities(initialKnowledge.activities),
  isReady: false,
  initialize: async (locale, userSettings = defaultUserSettings) => {
    await seedDatabaseIfEmpty(createMockData(locale), userSettings);
    const knowledge = await readAllKnowledge();
    set({
      tags: sortTags(knowledge.tags),
      collections: sortCollections(knowledge.collections),
      user: knowledge.user,
      activities: sortActivities(knowledge.activities),
      isReady: true,
    });
  },
  refreshKnowledge: async () => {
    const knowledge = await readAllKnowledge();
    set({
      tags: sortTags(knowledge.tags),
      collections: sortCollections(knowledge.collections),
      user: knowledge.user,
      activities: sortActivities(knowledge.activities),
      isReady: true,
    });
  },
  setUser: async (user) => {
    await db.transaction('rw', [db.users], async () => {
      await db.users.clear();
      await db.users.put(user);
    });
    set({ user });
  },
  createCollection: async (name, color = defaultNewCollectionColor) => {
    const trimmed = name.trim();
    if (!trimmed) {
      return null;
    }

    const existing = get().collections.find((collection) => collection.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      return existing;
    }

    const collection: Collection = {
      id: createCollectionId(trimmed),
      name: trimmed,
      color,
      icon: 'folder',
    };

    await db.collections.put(collection);
    set((state) => ({ collections: sortCollections([...state.collections, collection]) }));
    return collection;
  },
  updateCollection: async (collectionId, input) => {
    const collection = get().collections.find((item) => item.id === collectionId);
    const trimmed = input.name.trim();
    if (!collection || !trimmed) {
      return;
    }

    const updated: Collection = {
      ...collection,
      name: trimmed,
      color: input.color ?? collection.color ?? 'neutral',
    };

    await db.collections.put(updated);
    set((state) => ({ collections: sortCollections(state.collections.map((item) => (item.id === collectionId ? updated : item))) }));
  },
  deleteCollection: async (collectionId) => {
    const collection = get().collections.find((item) => item.id === collectionId);
    if (!collection) {
      return;
    }

    const affectedNoteIds = useNotesStore
      .getState()
      .notes.filter((note) => note.collectionId === collectionId)
      .map((note) => note.id);

    if (affectedNoteIds.length) {
      await useNotesStore.getState().bulkUpdateNoteCollection(affectedNoteIds, null);
    }

    await db.collections.delete(collectionId);
    set((state) => ({ collections: state.collections.filter((item) => item.id !== collectionId) }));
  },
  createTag: async (name, color = defaultNewTagColor) => {
    const trimmed = name.trim();
    if (!trimmed) {
      return null;
    }

    const existing = get().tags.find((tag) => tag.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      return existing;
    }

    const tag: Tag = {
      id: createTagId(trimmed),
      name: trimmed,
      color,
      count: 0,
    };

    await db.tags.put(tag);
    set((state) => ({ tags: sortTags([...state.tags, tag]) }));
    return tag;
  },
  updateTag: async (tagId, input) => {
    const tag = get().tags.find((item) => item.id === tagId);
    const trimmed = input.name.trim();
    if (!tag || !trimmed) {
      return;
    }

    const updated: Tag = {
      ...tag,
      name: trimmed,
      color: input.color ?? tag.color ?? 'neutral',
    };

    await db.tags.put(updated);
    set((state) => ({ tags: sortTags(state.tags.map((item) => (item.id === tagId ? updated : item))) }));
  },
  deleteTag: async (tagId) => {
    const affectedNoteIds = useNotesStore
      .getState()
      .notes.filter((note) => note.tagIds.includes(tagId))
      .map((note) => note.id);

    if (affectedNoteIds.length) {
      await useNotesStore.getState().bulkUpdateNoteTag(affectedNoteIds, tagId, false);
    }

    await db.tags.delete(tagId);
    set((state) => ({ tags: state.tags.filter((tag) => tag.id !== tagId) }));
  },
  resetDemoData: async (locale, settings) => {
    const bundle = createMockData(locale);
    await db.transaction(
      'rw',
      [db.notes, db.noteBlocks, db.noteFiles, db.tags, db.collections, db.users, db.activities, db.userSettings],
      async () => {
        await db.notes.clear();
        await db.noteBlocks.clear();
        await db.noteFiles.clear();
        await db.tags.clear();
        await db.collections.clear();
        await db.users.clear();
        await db.activities.clear();
        await db.userSettings.clear();
        await db.notes.bulkPut(bundle.notes.map(stripNoteRelations));
        await db.noteBlocks.bulkPut(bundle.noteBlocks);
        await db.noteFiles.bulkPut(bundle.noteFiles);
        await db.tags.bulkPut(bundle.tags);
        await db.collections.bulkPut(bundle.collections);
        await db.users.put(bundle.user);
        await db.activities.bulkPut(bundle.activities);
        await db.userSettings.put(settings);
      },
    );
    await useNotesStore.getState().refreshNotes();
    set({
      tags: sortTags(bundle.tags),
      collections: sortCollections(bundle.collections),
      user: bundle.user,
      activities: sortActivities(bundle.activities),
      isReady: true,
    });
  },
}));

function sortCollections(collections: Collection[]) {
  return [...collections].sort((a, b) => {
    const aIndex = collectionOrder.indexOf(a.id);
    const bIndex = collectionOrder.indexOf(b.id);
    if (aIndex === -1 || bIndex === -1) {
      return a.name.localeCompare(b.name);
    }
    return aIndex - bIndex;
  });
}

function sortTags(tags: Tag[]) {
  return [...tags].sort((a, b) => a.name.localeCompare(b.name));
}

function sortActivities(activities: ActivityItem[]) {
  return [...activities].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function createId() {
  return crypto.randomUUID();
}

function createTagId(name: string) {
  const slug = createSlug(name);
  return `tag-${slug || 'label'}-${createId().slice(0, 8)}`;
}

function createCollectionId(name: string) {
  const slug = createSlug(name);
  return `collection-${slug || 'group'}-${createId().slice(0, 8)}`;
}

function createSlug(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function stripNoteRelations<T extends { blocks?: unknown; files?: unknown }>(note: T): Omit<T, 'blocks' | 'files'> {
  const { blocks: _blocks, files: _files, ...baseNote } = note;
  return baseNote;
}
