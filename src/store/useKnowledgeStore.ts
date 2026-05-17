import { create } from 'zustand';
import { defaultUserSettings } from '../config/appSettings';
import { createMockData } from '../core/data/createMockData';
import {
  db,
  readAllKnowledge,
  replaceKnowledge,
  resetKnowledge,
  seedDatabaseIfEmpty,
} from '../core/db/notexDb';
import type {
  ActivityItem,
  Collection,
  Locale,
  NewNoteInput,
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
  createDraftNote: (input: NewNoteInput) => Promise<Note>;
  createQuickNote: (content: string) => Promise<Note | null>;
  toggleFavorite: (noteId: string) => Promise<void>;
  togglePinned: (noteId: string) => Promise<void>;
  markNoteOpened: (noteId: string) => Promise<void>;
  moveToTrash: (noteId: string) => Promise<void>;
  restoreNote: (noteId: string) => Promise<void>;
  updateNoteTags: (noteId: string, tagIds: string[]) => Promise<void>;
  addAdditionalExample: (noteId: string, example: string) => Promise<void>;
  addRelatedLink: (noteId: string, title: string, href: string) => Promise<void>;
  duplicateNote: (noteId: string, title: string) => Promise<Note | null>;
  resetDemoData: (locale: Locale, settings: UserSettings) => Promise<void>;
  exportPayload: (settings: UserSettings) => NoteXExport;
  importPayload: (payload: NoteXExport) => Promise<UserSettings>;
};

function sortNotes(notes: Note[]) {
  return [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

const collectionOrder = ['collection-work', 'collection-studies', 'collection-projects', 'collection-personal', 'collection-ideas'];

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

const initialKnowledge = createMockData(defaultUserSettings.language);

export const useKnowledgeStore = create<KnowledgeStore>((set, get) => ({
  notes: sortNotes(initialKnowledge.notes),
  tags: initialKnowledge.tags,
  collections: sortCollections(initialKnowledge.collections),
  user: initialKnowledge.user,
  activities: [...initialKnowledge.activities].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  isReady: false,
  initialize: async (locale, userSettings = defaultUserSettings) => {
    await seedDatabaseIfEmpty(createMockData(locale), userSettings);
    const knowledge = await readAllKnowledge();
    set({
      ...knowledge,
      notes: sortNotes(knowledge.notes),
      collections: sortCollections(knowledge.collections),
      activities: [...knowledge.activities].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      isReady: true,
    });
  },
  createDraftNote: async (input) => {
    const note = buildLocalNote({
      input,
      authorId: get().user?.id ?? 'user-local',
    });
    const activity = buildActivity(note.id, note.title);

    await db.transaction('rw', [db.notes, db.activities], async () => {
      await db.notes.put(note);
      await db.activities.put(activity);
    });

    set((state) => ({
      notes: sortNotes([note, ...state.notes]),
      activities: [activity, ...state.activities],
    }));

    return note;
  },
  createQuickNote: async (content) => {
    const trimmed = content.trim();
    if (!trimmed) {
      return null;
    }

    return get().createDraftNote({
      title: trimmed.length > 64 ? `${trimmed.slice(0, 61)}...` : trimmed,
      intro: trimmed,
      collectionId: 'collection-ideas',
      tagIds: ['tag-ideas'],
    });
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
  togglePinned: async (noteId) => {
    const note = get().notes.find((item) => item.id === noteId);
    if (!note) {
      return;
    }

    const updated = {
      ...note,
      isPinned: !note.isPinned,
      updatedAt: new Date().toISOString(),
    };

    await db.notes.put(updated);
    set((state) => ({
      notes: sortNotes(state.notes.map((item) => (item.id === noteId ? updated : item))),
    }));
  },
  markNoteOpened: async (noteId) => {
    const note = get().notes.find((item) => item.id === noteId);
    if (!note) {
      return;
    }

    const updated = {
      ...note,
      lastOpenedAt: new Date().toISOString(),
    };

    await db.notes.put(updated);
    set((state) => ({
      notes: state.notes.map((item) => (item.id === noteId ? updated : item)),
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
  updateNoteTags: async (noteId, tagIds) => {
    const note = get().notes.find((item) => item.id === noteId);
    if (!note) {
      return;
    }

    const updated = { ...note, tagIds, updatedAt: new Date().toISOString() };
    await db.notes.put(updated);
    set((state) => ({
      notes: sortNotes(state.notes.map((item) => (item.id === noteId ? updated : item))),
    }));
  },
  addAdditionalExample: async (noteId, example) => {
    const trimmed = example.trim();
    const note = get().notes.find((item) => item.id === noteId);
    if (!note || !trimmed) {
      return;
    }

    const updated = {
      ...note,
      content: {
        ...note.content,
        additionalExamples: [...(note.content.additionalExamples ?? []), trimmed],
      },
      updatedAt: new Date().toISOString(),
    };

    await db.notes.put(updated);
    set((state) => ({
      notes: sortNotes(state.notes.map((item) => (item.id === noteId ? updated : item))),
    }));
  },
  addRelatedLink: async (noteId, title, href) => {
    const trimmedTitle = title.trim();
    const trimmedHref = href.trim();
    const note = get().notes.find((item) => item.id === noteId);
    if (!note || !trimmedTitle) {
      return;
    }

    const updated = {
      ...note,
      relatedLinks: [
        ...(note.relatedLinks ?? []),
        {
          id: createId(),
          title: trimmedTitle,
          href: trimmedHref || `/notes/${noteId}`,
        },
      ],
      updatedAt: new Date().toISOString(),
    };

    await db.notes.put(updated);
    set((state) => ({
      notes: sortNotes(state.notes.map((item) => (item.id === noteId ? updated : item))),
    }));
  },
  duplicateNote: async (noteId, title) => {
    const note = get().notes.find((item) => item.id === noteId);
    if (!note) {
      return null;
    }

    const now = new Date().toISOString();
    const duplicate: Note = {
      ...note,
      id: createId(),
      title,
      isPinned: false,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
      version: 1,
      syncStatus: 'local',
    };
    const activity = buildActivity(duplicate.id, duplicate.title);

    await db.transaction('rw', [db.notes, db.activities], async () => {
      await db.notes.put(duplicate);
      await db.activities.put(activity);
    });

    set((state) => ({
      notes: sortNotes([duplicate, ...state.notes]),
      activities: [activity, ...state.activities],
    }));
    return duplicate;
  },
  resetDemoData: async (locale, settings) => {
    const bundle = createMockData(locale);
    await resetKnowledge(bundle, settings);
    set({
      notes: sortNotes(bundle.notes),
      tags: bundle.tags,
      collections: sortCollections(bundle.collections),
      user: bundle.user,
      activities: [...bundle.activities].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      isReady: true,
    });
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
      collections: sortCollections(payload.collections),
    });
    return payload.userSettings;
  },
}));

function createId() {
  return crypto.randomUUID();
}

function buildActivity(noteId: string, label: string): ActivityItem {
  const now = new Date().toISOString();
  return {
    id: createId(),
    noteId,
    label,
    time: new Date().toLocaleString(),
    createdAt: now,
  };
}

function buildLocalNote({ input, authorId }: { input: NewNoteInput; authorId: string }): Note {
  const now = new Date().toISOString();
  const intro = input.intro.trim();
  const title = input.title.trim();
  const wordCount = intro.split(/\s+/).filter(Boolean).length;

  return {
    id: createId(),
    type: input.type ?? 'standard',
    title,
    collectionId: input.collectionId ?? 'collection-ideas',
    tagIds: input.tagIds ?? ['tag-ideas'],
    linkedNoteIds: [],
    isFavorite: false,
    isPinned: false,
    isArchived: false,
    isTrashed: false,
    saveState: 'saved',
    authorId,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
    content: {
      intro,
      summary: [{ id: createId(), text: intro }],
      explanation: [],
      usageExamples: null,
      tip: null,
      additionalExamples: [],
    },
    stats: {
      wordCount,
      characterCount: intro.length,
      readingTimeMinutes: Math.max(1, Math.ceil(wordCount / 180)),
    },
    relatedLinks: [],
    thumbnail: { variant: 'text' },
    version: 1,
    syncStatus: 'local',
  };
}
