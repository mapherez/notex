import { create } from 'zustand';
import { defaultUserSettings } from '../config/appSettings';
import { createMockData } from '../core/data/createMockData';
import {
  db,
  readAllKnowledge,
  replaceKnowledge,
  seedDatabaseIfEmpty,
} from '../core/db/notexDb';
import type {
  ActivityItem,
  Collection,
  Locale,
  Note,
  NoteXExport,
  Tag,
  User,
  UserSettings,
} from '../core/models/models';

type KnowledgeStore = {
  notes: Note[];
  tags: Tag[];
  collections: Collection[];
  user: User | null;
  activities: ActivityItem[];
  isReady: boolean;
  initialize: (locale: Locale, userSettings?: UserSettings) => Promise<void>;
  createQuickNote: (content: string) => Promise<void>;
  toggleFavorite: (noteId: string) => Promise<void>;
  moveToTrash: (noteId: string) => Promise<void>;
  restoreNote: (noteId: string) => Promise<void>;
  exportPayload: (settings: UserSettings) => NoteXExport;
  importPayload: (payload: NoteXExport) => Promise<UserSettings>;
};

function sortNotes(notes: Note[]) {
  return [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export const useKnowledgeStore = create<KnowledgeStore>((set, get) => ({
  notes: [],
  tags: [],
  collections: [],
  user: null,
  activities: [],
  isReady: false,
  initialize: async (locale, userSettings = defaultUserSettings) => {
    await seedDatabaseIfEmpty(createMockData(locale), userSettings);
    const knowledge = await readAllKnowledge();
    set({
      ...knowledge,
      notes: sortNotes(knowledge.notes),
      activities: [...knowledge.activities].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      isReady: true,
    });
  },
  createQuickNote: async (content) => {
    const trimmed = content.trim();
    if (!trimmed) {
      return;
    }

    const now = new Date().toISOString();
    const note: Note = {
      id: createId(),
      type: 'standard',
      title: trimmed.length > 64 ? `${trimmed.slice(0, 61)}...` : trimmed,
      collectionId: 'collection-ideas',
      tagIds: ['tag-ideas'],
      linkedNoteIds: [],
      isFavorite: false,
      isPinned: false,
      isArchived: false,
      isTrashed: false,
      saveState: 'saved',
      authorId: get().user?.id ?? 'user-local',
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
      content: {
        intro: trimmed,
        summary: [{ id: createId(), text: trimmed }],
        explanation: [],
        usageExamples: null,
        tip: null,
        additionalExamples: [],
      },
      stats: {
        wordCount: trimmed.split(/\s+/).filter(Boolean).length,
        characterCount: trimmed.length,
        readingTimeMinutes: 1,
      },
      relatedLinks: [],
      thumbnail: { variant: 'text' },
      version: 1,
      syncStatus: 'local',
    };

    const activity: ActivityItem = {
      id: createId(),
      noteId: note.id,
      label: note.title,
      time: new Date().toLocaleString(),
      createdAt: now,
    };

    await db.transaction('rw', [db.notes, db.activities], async () => {
      await db.notes.put(note);
      await db.activities.put(activity);
    });

    set((state) => ({
      notes: sortNotes([note, ...state.notes]),
      activities: [activity, ...state.activities],
    }));
  },
  toggleFavorite: async (noteId) => {
    const note = get().notes.find((item) => item.id === noteId);
    if (!note) {
      return;
    }

    const updated = {
      ...note,
      isFavorite: !note.isFavorite,
      updatedAt: new Date().toISOString(),
    };

    await db.notes.put(updated);
    set((state) => ({
      notes: sortNotes(state.notes.map((item) => (item.id === noteId ? updated : item))),
    }));
  },
  moveToTrash: async (noteId) => {
    const note = get().notes.find((item) => item.id === noteId);
    if (!note) {
      return;
    }

    const updated = { ...note, isTrashed: true, updatedAt: new Date().toISOString() };
    await db.notes.put(updated);
    set((state) => ({
      notes: sortNotes(state.notes.map((item) => (item.id === noteId ? updated : item))),
    }));
  },
  restoreNote: async (noteId) => {
    const note = get().notes.find((item) => item.id === noteId);
    if (!note) {
      return;
    }

    const updated = { ...note, isTrashed: false, updatedAt: new Date().toISOString() };
    await db.notes.put(updated);
    set((state) => ({
      notes: sortNotes(state.notes.map((item) => (item.id === noteId ? updated : item))),
    }));
  },
  exportPayload: (settings) => ({
    version: 1,
    exportedAt: new Date().toISOString(),
    notes: get().notes,
    tags: get().tags,
    collections: get().collections,
    userSettings: settings,
  }),
  importPayload: async (payload) => {
    await replaceKnowledge(payload);
    set({
      notes: sortNotes(payload.notes),
      tags: payload.tags,
      collections: payload.collections,
    });
    return payload.userSettings;
  },
}));

function createId() {
  return crypto.randomUUID();
}
