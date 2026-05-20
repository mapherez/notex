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
import { enqueueDeletedNoteSync, enqueueNoteSync, enqueueWorkspaceSync } from '../core/services/syncQueue';
import type {
  ActivityItem,
  Collection,
  Locale,
  NewNoteInput,
  Note,
  NoteThumbnail,
  NoteStats,
  NoteType,
  NoteXExport,
  RichTextBlock,
  Tag,
  TagColor,
  UsageExample,
  User,
  UserSettings,
} from '../core/models/models';

type MarkdownContentSection = 'explanation' | 'summary';

export type NoteEditDraft = {
  type?: NoteType;
  title: string;
  collectionId: string | null;
  intro: string;
  summaryMarkdown: string;
  explanationMarkdown: string;
  usageExamples: UsageExample[];
  tipTitle: string;
  tipBody: string;
  tagIds?: string[];
};

type KnowledgeStore = {
  notes: Note[];
  tags: Tag[];
  collections: Collection[];
  user: User | null;
  activities: ActivityItem[];
  isReady: boolean;
  initialize: (locale: Locale, userSettings?: UserSettings) => Promise<void>;
  refreshKnowledge: () => Promise<void>;
  setUser: (user: User) => Promise<void>;
  createDraftNote: (input: NewNoteInput) => Promise<Note>;
  createNoteFromDraft: (draft: NoteEditDraft) => Promise<Note | null>;
  createQuickNote: (content: string, title?: string) => Promise<Note | null>;
  toggleFavorite: (noteId: string) => Promise<void>;
  togglePinned: (noteId: string) => Promise<void>;
  markNoteOpened: (noteId: string) => Promise<void>;
  updateNoteTitle: (noteId: string, title: string) => Promise<void>;
  updateNoteIntro: (noteId: string, intro: string) => Promise<void>;
  updateNoteCollection: (noteId: string, collectionId: string | null) => Promise<void>;
  updateNoteThumbnail: (noteId: string, thumbnail: NoteThumbnail) => Promise<void>;
  saveNoteDraft: (noteId: string, draft: NoteEditDraft) => Promise<Note | null>;
  updateMarkdownSection: (noteId: string, section: MarkdownContentSection, markdown: string) => Promise<void>;
  updateNoteTip: (noteId: string, title: string, body: string) => Promise<void>;
  moveToTrash: (noteId: string) => Promise<void>;
  restoreNote: (noteId: string) => Promise<void>;
  clearTrash: () => Promise<void>;
  updateNoteTags: (noteId: string, tagIds: string[]) => Promise<void>;
  createCollection: (name: string, color?: TagColor) => Promise<Collection | null>;
  updateCollection: (collectionId: string, input: { name: string; color?: TagColor }) => Promise<void>;
  deleteCollection: (collectionId: string) => Promise<void>;
  createTag: (name: string, color?: TagColor) => Promise<Tag | null>;
  updateTag: (tagId: string, input: { name: string; color?: TagColor }) => Promise<void>;
  deleteTag: (tagId: string) => Promise<void>;
  addUsageExample: (noteId: string, input: Omit<UsageExample, 'id'>) => Promise<void>;
  updateUsageExample: (noteId: string, rowId: string, input: Omit<UsageExample, 'id'>) => Promise<void>;
  deleteUsageExample: (noteId: string, rowId: string) => Promise<void>;
  replaceUsageExamples: (noteId: string, rows: UsageExample[]) => Promise<void>;
  addAdditionalExample: (noteId: string, example: string) => Promise<void>;
  updateAdditionalExample: (noteId: string, index: number, example: string) => Promise<void>;
  deleteAdditionalExample: (noteId: string, index: number) => Promise<void>;
  addRelatedLink: (noteId: string, title: string, href: string) => Promise<void>;
  deleteRelatedLink: (noteId: string, linkId: string) => Promise<void>;
  addLinkedNote: (noteId: string, linkedNoteId: string) => Promise<void>;
  deleteLinkedNote: (noteId: string, linkedNoteId: string) => Promise<void>;
  duplicateNote: (noteId: string, title: string) => Promise<Note | null>;
  resetDemoData: (locale: Locale, settings: UserSettings) => Promise<void>;
  exportPayload: (settings: UserSettings) => NoteXExport;
  importPayload: (payload: NoteXExport) => Promise<UserSettings>;
};

function sortNotes(notes: Note[]) {
  return [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

const collectionOrder = ['collection-work', 'collection-personal'];

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

const initialKnowledge = createMockData(defaultUserSettings.language);

export const useKnowledgeStore = create<KnowledgeStore>((set, get) => ({
  notes: sortNotes(initialKnowledge.notes),
  tags: sortTags(initialKnowledge.tags),
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
      tags: sortTags(knowledge.tags),
      collections: sortCollections(knowledge.collections),
      activities: [...knowledge.activities].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      isReady: true,
    });
  },
  refreshKnowledge: async () => {
    const knowledge = await readAllKnowledge();
    set({
      ...knowledge,
      notes: sortNotes(knowledge.notes),
      tags: sortTags(knowledge.tags),
      collections: sortCollections(knowledge.collections),
      activities: [...knowledge.activities].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      isReady: true,
    });
  },
  setUser: async (user) => {
    await db.transaction('rw', [db.users], async () => {
      await db.users.clear();
      await db.users.put(user);
    });
    set({ user });
    void enqueueWorkspaceSync();
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

    void enqueueNoteSync(note.id);
    void enqueueWorkspaceSync();

    return note;
  },
  createNoteFromDraft: async (draft) => {
    const normalized = normalizeNoteEditDraft(draft);
    if (!normalized) {
      return null;
    }

    const note = buildLocalNoteFromDraft({
      draft: normalized,
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

    void enqueueNoteSync(note.id);
    void enqueueWorkspaceSync();

    return note;
  },
  createQuickNote: async (content, title = 'Quick capture') => {
    const trimmed = content.trim();
    if (!trimmed) {
      return null;
    }

    return get().createDraftNote({
      title,
      intro: trimmed,
      collectionId: defaultUserSettings.primaryCollectionId,
      tagIds: [],
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
    void enqueueNoteSync(noteId);
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
    void enqueueNoteSync(noteId);
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
    void enqueueNoteSync(noteId);
  },
  updateNoteTitle: async (noteId, title) => {
    const note = get().notes.find((item) => item.id === noteId);
    if (!note) {
      return;
    }

    const nextTitle = title.trim() || note.title;
    const updated = finalizeNoteUpdate({
      ...note,
      title: nextTitle,
    });

    await db.notes.put(updated);
    set((state) => ({
      notes: sortNotes(state.notes.map((item) => (item.id === noteId ? updated : item))),
    }));
    void enqueueNoteSync(noteId);
  },
  updateNoteIntro: async (noteId, intro) => {
    const note = get().notes.find((item) => item.id === noteId);
    if (!note) {
      return;
    }

    const updated = finalizeNoteUpdate({
      ...note,
      content: {
        ...note.content,
        intro: intro.trim(),
      },
    });

    await db.notes.put(updated);
    set((state) => ({
      notes: sortNotes(state.notes.map((item) => (item.id === noteId ? updated : item))),
    }));
    void enqueueNoteSync(noteId);
  },
  updateNoteCollection: async (noteId, collectionId) => {
    const note = get().notes.find((item) => item.id === noteId);
    if (!note) {
      return;
    }

    const updated = finalizeNoteUpdate({
      ...note,
      collectionId,
    });

    await db.notes.put(updated);
    set((state) => ({
      notes: sortNotes(state.notes.map((item) => (item.id === noteId ? updated : item))),
    }));
    void enqueueNoteSync(noteId);
  },
  updateNoteThumbnail: async (noteId, thumbnail) => {
    const note = get().notes.find((item) => item.id === noteId);
    if (!note) {
      return;
    }

    const updated = finalizeNoteUpdate({
      ...note,
      thumbnail,
    });

    await db.notes.put(updated);
    set((state) => ({
      notes: sortNotes(state.notes.map((item) => (item.id === noteId ? updated : item))),
    }));
    void enqueueNoteSync(noteId);
  },
  saveNoteDraft: async (noteId, draft) => {
    const note = get().notes.find((item) => item.id === noteId);
    const normalized = normalizeNoteEditDraft(draft);
    if (!note || !normalized) {
      return null;
    }

    const updated = finalizeNoteUpdate({
      ...note,
      type: normalized.type ?? note.type,
      title: normalized.title,
      collectionId: normalized.collectionId,
      content: {
        ...note.content,
        intro: normalized.intro,
        summary: markdownToBlocks(normalized.summaryMarkdown, `${note.id}-summary`),
        explanation: markdownToBlocks(normalized.explanationMarkdown, `${note.id}-explanation`),
        usageExamples: normalized.usageExamples.length ? { rows: normalized.usageExamples } : null,
        tip: normalized.tipBody || normalized.tipTitle
          ? {
              id: note.content.tip?.id ?? createId(),
              title: normalized.tipTitle || note.content.tip?.title || 'Tip',
              body: normalized.tipBody,
            }
          : null,
      },
    });

    await db.notes.put(updated);
    set((state) => ({
      notes: sortNotes(state.notes.map((item) => (item.id === noteId ? updated : item))),
    }));
    void enqueueNoteSync(noteId);

    return updated;
  },
  updateMarkdownSection: async (noteId, section, markdown) => {
    const note = get().notes.find((item) => item.id === noteId);
    if (!note) {
      return;
    }

    const updated = finalizeNoteUpdate({
      ...note,
      content: {
        ...note.content,
        [section]: markdownToBlocks(markdown, `${noteId}-${section}`),
      },
    });

    await db.notes.put(updated);
    set((state) => ({
      notes: sortNotes(state.notes.map((item) => (item.id === noteId ? updated : item))),
    }));
    void enqueueNoteSync(noteId);
  },
  updateNoteTip: async (noteId, title, body) => {
    const note = get().notes.find((item) => item.id === noteId);
    if (!note) {
      return;
    }

    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    const updated = finalizeNoteUpdate({
      ...note,
      content: {
        ...note.content,
        tip:
          trimmedTitle || trimmedBody
            ? {
                id: note.content.tip?.id ?? createId(),
                title: trimmedTitle || note.content.tip?.title || '',
                body: trimmedBody,
              }
            : null,
      },
    });

    await db.notes.put(updated);
    set((state) => ({
      notes: sortNotes(state.notes.map((item) => (item.id === noteId ? updated : item))),
    }));
    void enqueueNoteSync(noteId);
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
    void enqueueNoteSync(noteId);
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
    void enqueueNoteSync(noteId);
  },
  clearTrash: async () => {
    const trashedIds = get().notes.filter((note) => note.isTrashed).map((note) => note.id);
    if (!trashedIds.length) {
      return;
    }

    const trashedIdSet = new Set(trashedIds);
    const linkedNoteUpdates = get().notes
      .filter((note) => !trashedIdSet.has(note.id) && note.linkedNoteIds.some((linkedId) => trashedIdSet.has(linkedId)))
      .map((note) =>
        finalizeNoteUpdate({
          ...note,
          linkedNoteIds: note.linkedNoteIds.filter((linkedId) => !trashedIdSet.has(linkedId)),
        }),
      );

    await db.transaction('rw', [db.notes, db.activities], async () => {
      await db.notes.bulkDelete(trashedIds);
      if (linkedNoteUpdates.length) {
        await db.notes.bulkPut(linkedNoteUpdates);
      }
      await db.activities.where('noteId').anyOf(trashedIds).delete();
    });

    set((state) => {
      const linkedUpdateMap = new Map(linkedNoteUpdates.map((note) => [note.id, note]));
      const remainingNotes = state.notes
        .filter((note) => !trashedIdSet.has(note.id))
        .map((note) => linkedUpdateMap.get(note.id) ?? note);

      return {
        notes: sortNotes(remainingNotes),
        activities: state.activities.filter((activity) => !trashedIdSet.has(activity.noteId)),
      };
    });
    trashedIds.forEach((noteId) => void enqueueDeletedNoteSync(noteId));
    linkedNoteUpdates.forEach((note) => void enqueueNoteSync(note.id));
    void enqueueWorkspaceSync();
  },
  updateNoteTags: async (noteId, tagIds) => {
    const note = get().notes.find((item) => item.id === noteId);
    if (!note) {
      return;
    }

    const updated = finalizeNoteUpdate({ ...note, tagIds: uniqueIds(tagIds) });
    await db.notes.put(updated);
    set((state) => ({
      notes: sortNotes(state.notes.map((item) => (item.id === noteId ? updated : item))),
    }));
    void enqueueNoteSync(noteId);
  },
  createCollection: async (name, color = 'neutral') => {
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
    set((state) => ({
      collections: sortCollections([...state.collections, collection]),
    }));
    void enqueueWorkspaceSync();

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
    set((state) => ({
      collections: sortCollections(state.collections.map((item) => (item.id === collectionId ? updated : item))),
    }));
    void enqueueWorkspaceSync();
  },
  deleteCollection: async (collectionId) => {
    const collection = get().collections.find((item) => item.id === collectionId);
    if (!collection) {
      return;
    }

    const noteUpdates = get().notes
      .filter((note) => note.collectionId === collectionId)
      .map((note) => finalizeNoteUpdate({ ...note, collectionId: null }));

    await db.transaction('rw', [db.collections, db.notes], async () => {
      await db.collections.delete(collectionId);
      if (noteUpdates.length) {
        await db.notes.bulkPut(noteUpdates);
      }
    });

    set((state) => {
      const noteUpdateMap = new Map(noteUpdates.map((note) => [note.id, note]));

      return {
        collections: state.collections.filter((item) => item.id !== collectionId),
        notes: sortNotes(state.notes.map((note) => noteUpdateMap.get(note.id) ?? note)),
      };
    });
    void enqueueWorkspaceSync();
    noteUpdates.forEach((note) => void enqueueNoteSync(note.id));
  },
  createTag: async (name, color = 'neutral') => {
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
    set((state) => ({
      tags: sortTags([...state.tags, tag]),
    }));
    void enqueueWorkspaceSync();

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
    set((state) => ({
      tags: sortTags(state.tags.map((item) => (item.id === tagId ? updated : item))),
    }));
    void enqueueWorkspaceSync();
  },
  deleteTag: async (tagId) => {
    const noteUpdates = get().notes
      .filter((note) => note.tagIds.includes(tagId))
      .map((note) => finalizeNoteUpdate({ ...note, tagIds: note.tagIds.filter((id) => id !== tagId) }));

    await db.transaction('rw', [db.tags, db.notes], async () => {
      await db.tags.delete(tagId);
      if (noteUpdates.length) {
        await db.notes.bulkPut(noteUpdates);
      }
    });

    set((state) => {
      const updatedNotes = noteUpdates.length
        ? state.notes.map((note) => noteUpdates.find((updated) => updated.id === note.id) ?? note)
        : state.notes;

      return {
        tags: state.tags.filter((tag) => tag.id !== tagId),
        notes: sortNotes(updatedNotes),
      };
    });
    void enqueueWorkspaceSync();
    noteUpdates.forEach((note) => void enqueueNoteSync(note.id));
  },
  addUsageExample: async (noteId, input) => {
    const note = get().notes.find((item) => item.id === noteId);
    const row = normalizeUsageExampleInput(input);
    if (!note || !row) {
      return;
    }

    const updated = finalizeNoteUpdate({
      ...note,
      content: {
        ...note.content,
        usageExamples: {
          rows: [...(note.content.usageExamples?.rows ?? []), { id: createId(), ...row }],
        },
      },
    });

    await db.notes.put(updated);
    set((state) => ({
      notes: sortNotes(state.notes.map((item) => (item.id === noteId ? updated : item))),
    }));
    void enqueueNoteSync(noteId);
  },
  updateUsageExample: async (noteId, rowId, input) => {
    const note = get().notes.find((item) => item.id === noteId);
    const row = normalizeUsageExampleInput(input);
    if (!note || !row) {
      return;
    }

    const rows = note.content.usageExamples?.rows ?? [];
    const updated = finalizeNoteUpdate({
      ...note,
      content: {
        ...note.content,
        usageExamples: {
          rows: rows.map((item) => (item.id === rowId ? { id: rowId, ...row } : item)),
        },
      },
    });

    await db.notes.put(updated);
    set((state) => ({
      notes: sortNotes(state.notes.map((item) => (item.id === noteId ? updated : item))),
    }));
    void enqueueNoteSync(noteId);
  },
  deleteUsageExample: async (noteId, rowId) => {
    const note = get().notes.find((item) => item.id === noteId);
    if (!note) {
      return;
    }

    const rows = note.content.usageExamples?.rows.filter((row) => row.id !== rowId) ?? [];
    const updated = finalizeNoteUpdate({
      ...note,
      content: {
        ...note.content,
        usageExamples: rows.length ? { rows } : null,
      },
    });

    await db.notes.put(updated);
    set((state) => ({
      notes: sortNotes(state.notes.map((item) => (item.id === noteId ? updated : item))),
    }));
    void enqueueNoteSync(noteId);
  },
  replaceUsageExamples: async (noteId, rows) => {
    const note = get().notes.find((item) => item.id === noteId);
    if (!note) {
      return;
    }

    const normalizedRows = rows.flatMap((row) => {
      const normalized = normalizeUsageExampleInput(row);
      return normalized ? [{ id: row.id || createId(), ...normalized }] : [];
    });

    const updated = finalizeNoteUpdate({
      ...note,
      content: {
        ...note.content,
        usageExamples: normalizedRows.length ? { rows: normalizedRows } : null,
      },
    });

    await db.notes.put(updated);
    set((state) => ({
      notes: sortNotes(state.notes.map((item) => (item.id === noteId ? updated : item))),
    }));
    void enqueueNoteSync(noteId);
  },
  addAdditionalExample: async (noteId, example) => {
    const trimmed = example.trim();
    const note = get().notes.find((item) => item.id === noteId);
    if (!note || !trimmed) {
      return;
    }

    const updated = finalizeNoteUpdate({
      ...note,
      content: {
        ...note.content,
        additionalExamples: [...(note.content.additionalExamples ?? []), trimmed],
      },
    });

    await db.notes.put(updated);
    set((state) => ({
      notes: sortNotes(state.notes.map((item) => (item.id === noteId ? updated : item))),
    }));
    void enqueueNoteSync(noteId);
  },
  updateAdditionalExample: async (noteId, index, example) => {
    const trimmed = example.trim();
    const note = get().notes.find((item) => item.id === noteId);
    if (!note || !trimmed) {
      return;
    }

    const examples = [...(note.content.additionalExamples ?? [])];
    if (index < 0 || index >= examples.length) {
      return;
    }

    examples[index] = trimmed;
    const updated = finalizeNoteUpdate({
      ...note,
      content: {
        ...note.content,
        additionalExamples: examples,
      },
    });

    await db.notes.put(updated);
    set((state) => ({
      notes: sortNotes(state.notes.map((item) => (item.id === noteId ? updated : item))),
    }));
    void enqueueNoteSync(noteId);
  },
  deleteAdditionalExample: async (noteId, index) => {
    const note = get().notes.find((item) => item.id === noteId);
    if (!note) {
      return;
    }

    const examples = (note.content.additionalExamples ?? []).filter((_, itemIndex) => itemIndex !== index);
    const updated = finalizeNoteUpdate({
      ...note,
      content: {
        ...note.content,
        additionalExamples: examples,
      },
    });

    await db.notes.put(updated);
    set((state) => ({
      notes: sortNotes(state.notes.map((item) => (item.id === noteId ? updated : item))),
    }));
    void enqueueNoteSync(noteId);
  },
  addRelatedLink: async (noteId, title, href) => {
    const trimmedTitle = title.trim();
    const trimmedHref = href.trim();
    const note = get().notes.find((item) => item.id === noteId);
    if (!note || !trimmedTitle) {
      return;
    }

    const updated = finalizeNoteUpdate({
      ...note,
      relatedLinks: [
        ...(note.relatedLinks ?? []),
        {
          id: createId(),
          title: trimmedTitle,
          href: trimmedHref,
        },
      ],
    });

    await db.notes.put(updated);
    set((state) => ({
      notes: sortNotes(state.notes.map((item) => (item.id === noteId ? updated : item))),
    }));
    void enqueueNoteSync(noteId);
  },
  deleteRelatedLink: async (noteId, linkId) => {
    const note = get().notes.find((item) => item.id === noteId);
    if (!note) {
      return;
    }

    const updated = finalizeNoteUpdate({
      ...note,
      relatedLinks: (note.relatedLinks ?? []).filter((link) => link.id !== linkId),
    });

    await db.notes.put(updated);
    set((state) => ({
      notes: sortNotes(state.notes.map((item) => (item.id === noteId ? updated : item))),
    }));
    void enqueueNoteSync(noteId);
  },
  addLinkedNote: async (noteId, linkedNoteId) => {
    if (noteId === linkedNoteId) {
      return;
    }

    const note = get().notes.find((item) => item.id === noteId);
    const linkedNote = get().notes.find((item) => item.id === linkedNoteId);
    if (!note || !linkedNote) {
      return;
    }

    const updated = finalizeNoteUpdate({
      ...note,
      linkedNoteIds: uniqueIds([...note.linkedNoteIds, linkedNoteId]),
    });

    await db.notes.put(updated);
    set((state) => ({
      notes: sortNotes(state.notes.map((item) => (item.id === noteId ? updated : item))),
    }));
    void enqueueNoteSync(noteId);
  },
  deleteLinkedNote: async (noteId, linkedNoteId) => {
    const note = get().notes.find((item) => item.id === noteId);
    if (!note) {
      return;
    }

    const updated = finalizeNoteUpdate({
      ...note,
      linkedNoteIds: note.linkedNoteIds.filter((id) => id !== linkedNoteId),
    });

    await db.notes.put(updated);
    set((state) => ({
      notes: sortNotes(state.notes.map((item) => (item.id === noteId ? updated : item))),
    }));
    void enqueueNoteSync(noteId);
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
    void enqueueNoteSync(duplicate.id);
    void enqueueWorkspaceSync();
    return duplicate;
  },
  resetDemoData: async (locale, settings) => {
    const bundle = createMockData(locale);
    await resetKnowledge(bundle, settings);
    set({
      notes: sortNotes(bundle.notes),
      tags: sortTags(bundle.tags),
      collections: sortCollections(bundle.collections),
      user: bundle.user,
      activities: [...bundle.activities].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      isReady: true,
    });
    bundle.notes.forEach((note) => void enqueueNoteSync(note.id));
    void enqueueWorkspaceSync();
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
      tags: sortTags(payload.tags),
      collections: sortCollections(payload.collections),
    });
    payload.notes.forEach((note) => void enqueueNoteSync(note.id));
    void enqueueWorkspaceSync();
    return payload.userSettings;
  },
}));

function createId() {
  return crypto.randomUUID();
}

function createTagId(name: string) {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

  return `tag-${slug || 'label'}-${createId().slice(0, 8)}`;
}

function createCollectionId(name: string) {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

  return `collection-${slug || 'group'}-${createId().slice(0, 8)}`;
}

function uniqueIds(ids: string[]) {
  return [...new Set(ids)];
}

function normalizeUsageExampleInput(input: Omit<UsageExample, 'id'>) {
  const expression = input.expression.trim();
  const meaning = input.meaning.trim();
  const example = input.example.trim();

  if (!expression && !meaning && !example) {
    return null;
  }

  return {
    expression,
    meaning,
    example,
  };
}

function normalizeNoteEditDraft(input: NoteEditDraft): NoteEditDraft | null {
  const title = input.title.trim();
  if (!title) {
    return null;
  }

  const usageExamples = input.usageExamples.flatMap((row) => {
    const normalized = normalizeUsageExampleInput(row);
    return normalized ? [{ id: row.id || createId(), ...normalized }] : [];
  });

  return {
    ...input,
    title,
    collectionId: input.collectionId || null,
    intro: input.intro.trim(),
    summaryMarkdown: input.summaryMarkdown.trimEnd(),
    explanationMarkdown: input.explanationMarkdown.trimEnd(),
    usageExamples,
    tipTitle: input.tipTitle.trim(),
    tipBody: input.tipBody.trimEnd(),
    tagIds: input.tagIds ? uniqueIds(input.tagIds) : undefined,
  };
}

function markdownToBlocks(markdown: string, prefix: string): RichTextBlock[] {
  const text = markdown.trimEnd();
  if (!text) {
    return [];
  }

  return [{ id: `${prefix}-${createId()}`, text }];
}

function finalizeNoteUpdate(note: Note): Note {
  const updated = {
    ...note,
    saveState: 'saved',
    syncStatus: 'local',
    updatedAt: new Date().toISOString(),
    version: note.version + 1,
  } satisfies Note;

  return {
    ...updated,
    stats: calculateNoteStats(updated),
  };
}

function calculateNoteStats(note: Note): NoteStats {
  const text = [
    note.title,
    note.content.intro ?? '',
    ...(note.content.summary?.map((block) => block.text) ?? []),
    ...(note.content.explanation?.map((block) => block.text) ?? []),
    ...(note.content.usageExamples?.rows.flatMap((row) => [row.expression, row.meaning, row.example]) ?? []),
    note.content.tip?.title ?? '',
    note.content.tip?.body ?? '',
    ...(note.content.additionalExamples ?? []),
  ].join(' ');
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  return {
    wordCount,
    characterCount: text.length,
    readingTimeMinutes: Math.max(1, Math.ceil(wordCount / 180)),
  };
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

function buildLocalNoteFromDraft({ draft, authorId }: { draft: NoteEditDraft; authorId: string }): Note {
  const now = new Date().toISOString();
  const note: Note = {
    id: createId(),
    type: draft.type ?? 'standard',
    title: draft.title,
    collectionId: draft.collectionId ?? 'collection-ideas',
    tagIds: draft.tagIds ?? ['tag-ideas'],
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
      intro: draft.intro,
      summary: markdownToBlocks(draft.summaryMarkdown, `new-summary`),
      explanation: markdownToBlocks(draft.explanationMarkdown, `new-explanation`),
      usageExamples: draft.usageExamples.length ? { rows: draft.usageExamples } : null,
      tip: draft.tipBody || draft.tipTitle
        ? {
            id: createId(),
            title: draft.tipTitle || 'Tip',
            body: draft.tipBody,
          }
        : null,
      additionalExamples: [],
    },
    stats: {
      wordCount: 0,
      characterCount: 0,
      readingTimeMinutes: 1,
    },
    relatedLinks: [],
    thumbnail: { variant: 'text' },
    version: 1,
    syncStatus: 'local',
  };

  return {
    ...note,
    stats: calculateNoteStats(note),
  };
}
