import { create } from 'zustand';
import { defaultNoteThumbnailVariant, defaultUserSettings, editorSettings } from '../config/appSettings';
import type {
  DynamicNote,
  DynamicNoteBlock,
  DynamicNoteFile,
  DynamicNoteFileKind,
  Note,
  NoteStats,
  RelatedLink,
  TiptapDocument,
  UsageExample,
} from '../core/models/models';
import { db } from '../core/storage/notexRepository';
import { parseMarkdown, type MarkdownBlock } from '../core/utils/markdown';
import { richTextToPlainText } from '../core/utils/richText';
import { deleteDynamicAttachment, importDynamicAttachment } from '../core/services/dynamicFiles';

type DynamicNoteInput = {
  collectionId?: string | null;
  title?: string;
};

type DynamicHeaderInput = {
  collectionId?: string | null;
  subtitle?: string;
  title?: string;
};

type DynamicBlockInput = {
  contentJson?: TiptapDocument | null;
  contentText?: string;
  kind?: DynamicNoteBlock['kind'];
  title?: string;
};

type TiptapNodeRecord = {
  attrs?: Record<string, unknown>;
  content?: unknown[];
  type?: string;
  [key: string]: unknown;
};

type DynamicNotesStore = {
  dynamicNotes: DynamicNote[];
  isReady: boolean;
  initialize: () => Promise<void>;
  refreshDynamicNotes: () => Promise<void>;
  createDynamicNote: (input?: DynamicNoteInput) => Promise<DynamicNote>;
  markDynamicNoteOpened: (noteId: string) => Promise<void>;
  updateDynamicNoteHeader: (noteId: string, input: DynamicHeaderInput) => Promise<void>;
  updateDynamicNoteTags: (noteId: string, tagIds: string[]) => Promise<void>;
  updateDynamicNoteThumbnail: (noteId: string, thumbnail: DynamicNote['thumbnail']) => Promise<void>;
  bulkUpdateDynamicNoteCollection: (noteIds: string[], collectionId: string | null) => Promise<void>;
  bulkUpdateDynamicNoteTag: (noteIds: string[], tagId: string, assigned: boolean) => Promise<void>;
  updateDynamicNoteLinkedNotes: (noteId: string, linkedNoteIds: string[]) => Promise<void>;
  addDynamicAdditionalExample: (noteId: string, example: string) => Promise<void>;
  updateDynamicAdditionalExample: (noteId: string, index: number, example: string) => Promise<void>;
  deleteDynamicAdditionalExample: (noteId: string, index: number) => Promise<void>;
  addDynamicRelatedLink: (noteId: string, title: string, href: string) => Promise<void>;
  deleteDynamicRelatedLink: (noteId: string, linkId: string) => Promise<void>;
  toggleDynamicFavorite: (noteId: string) => Promise<void>;
  toggleDynamicPinned: (noteId: string) => Promise<void>;
  addDynamicBlock: (noteId: string, input?: DynamicBlockInput) => Promise<DynamicNoteBlock | null>;
  updateDynamicBlock: (noteId: string, blockId: string, input: DynamicBlockInput) => Promise<void>;
  reorderDynamicBlocks: (noteId: string, blockIds: string[]) => Promise<void>;
  deleteDynamicBlock: (noteId: string, blockId: string) => Promise<void>;
  importFileForBlock: (sourcePath: string, noteId: string, blockId: string | null) => Promise<DynamicNoteFile | null>;
  deleteDynamicFile: (noteId: string, fileId: string) => Promise<void>;
  moveDynamicNoteToTrash: (noteId: string) => Promise<void>;
  restoreDynamicNote: (noteId: string) => Promise<void>;
  deleteDynamicNotesPermanently: (noteIds: string[]) => Promise<void>;
  clearDynamicTrash: () => Promise<void>;
  migrateClassicNote: (note: Note) => Promise<DynamicNote>;
};

export const emptyTiptapDocument: TiptapDocument = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

export const useDynamicNotesStore = create<DynamicNotesStore>((set, get) => ({
  dynamicNotes: [],
  isReady: false,
  initialize: async () => {
    const dynamicNotes = await readDynamicNotes();
    set({ dynamicNotes: sortDynamicNotes(dynamicNotes), isReady: true });
  },
  refreshDynamicNotes: async () => {
    const dynamicNotes = await readDynamicNotes();
    set({ dynamicNotes: sortDynamicNotes(dynamicNotes), isReady: true });
  },
  createDynamicNote: async (input = {}) => {
    const now = new Date().toISOString();
    const note: DynamicNote = {
      id: createId(),
      title: input.title?.trim() || '',
      subtitle: '',
      collectionId: input.collectionId ?? defaultUserSettings.primaryCollectionId,
      tagIds: [],
      linkedNoteIds: [],
      additionalExamples: [],
      relatedLinks: [],
      isFavorite: false,
      isPinned: false,
      isArchived: false,
      isTrashed: false,
      saveState: 'saved',
      authorId: 'user-local',
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
      stats: emptyStats(),
      thumbnail: { variant: defaultNoteThumbnailVariant },
      version: 1,
      syncStatus: 'local',
      blocks: [],
      files: [],
    };

    await db.dynamicNotes.put(stripDynamicRelations(note));
    set((state) => ({ dynamicNotes: sortDynamicNotes([note, ...state.dynamicNotes]), isReady: true }));
    return note;
  },
  markDynamicNoteOpened: async (noteId) => {
    const note = findDynamicNote(get().dynamicNotes, noteId);
    if (!note) {
      return;
    }
    const updated = { ...note, lastOpenedAt: new Date().toISOString() };
    await db.dynamicNotes.put(stripDynamicRelations(updated));
    set((state) => ({ dynamicNotes: state.dynamicNotes.map((item) => (item.id === noteId ? updated : item)) }));
  },
  updateDynamicNoteHeader: async (noteId, input) => {
    const note = findDynamicNote(get().dynamicNotes, noteId);
    if (!note) {
      return;
    }
    const updated = finalizeDynamicNote({
      ...note,
      title: input.title !== undefined ? input.title : note.title,
      subtitle: input.subtitle !== undefined ? input.subtitle : note.subtitle,
      collectionId: input.collectionId !== undefined ? input.collectionId : note.collectionId,
    });
    await persistDynamicNote(updated);
    set((state) => ({ dynamicNotes: sortDynamicNotes(state.dynamicNotes.map((item) => (item.id === noteId ? updated : item))) }));
  },
  updateDynamicNoteTags: async (noteId, tagIds) => {
    const note = findDynamicNote(get().dynamicNotes, noteId);
    if (!note) {
      return;
    }
    const updated = finalizeDynamicNote({ ...note, tagIds: uniqueIds(tagIds) });
    await persistDynamicNote(updated);
    set((state) => ({ dynamicNotes: sortDynamicNotes(state.dynamicNotes.map((item) => (item.id === noteId ? updated : item))) }));
  },
  updateDynamicNoteThumbnail: async (noteId, thumbnail) => {
    const note = findDynamicNote(get().dynamicNotes, noteId);
    if (!note || !thumbnail) {
      return;
    }
    const updated = finalizeDynamicNote({ ...note, thumbnail });
    await persistDynamicNote(updated);
    set((state) => ({ dynamicNotes: sortDynamicNotes(state.dynamicNotes.map((item) => (item.id === noteId ? updated : item))) }));
  },
  bulkUpdateDynamicNoteCollection: async (noteIds, collectionId) => {
    const noteIdSet = new Set(uniqueIds(noteIds));
    const noteUpdates = get().dynamicNotes
      .filter((note) => noteIdSet.has(note.id) && note.collectionId !== collectionId)
      .map((note) => finalizeDynamicNote({ ...note, collectionId }));

    if (!noteUpdates.length) {
      return;
    }

    await db.dynamicNotes.bulkPut(noteUpdates.map(stripDynamicRelations));
    set((state) => {
      const updateMap = new Map(noteUpdates.map((note) => [note.id, note]));
      return { dynamicNotes: sortDynamicNotes(state.dynamicNotes.map((note) => updateMap.get(note.id) ?? note)) };
    });
  },
  bulkUpdateDynamicNoteTag: async (noteIds, tagId, assigned) => {
    const noteIdSet = new Set(uniqueIds(noteIds));
    const noteUpdates = get().dynamicNotes
      .filter((note) => noteIdSet.has(note.id) && note.tagIds.includes(tagId) !== assigned)
      .map((note) => {
        const nextTagIds = assigned ? [...note.tagIds, tagId] : note.tagIds.filter((id) => id !== tagId);
        return finalizeDynamicNote({ ...note, tagIds: uniqueIds(nextTagIds) });
      });

    if (!noteUpdates.length) {
      return;
    }

    await db.dynamicNotes.bulkPut(noteUpdates.map(stripDynamicRelations));
    set((state) => {
      const updateMap = new Map(noteUpdates.map((note) => [note.id, note]));
      return { dynamicNotes: sortDynamicNotes(state.dynamicNotes.map((note) => updateMap.get(note.id) ?? note)) };
    });
  },
  updateDynamicNoteLinkedNotes: async (noteId, linkedNoteIds) => {
    const note = findDynamicNote(get().dynamicNotes, noteId);
    if (!note) {
      return;
    }
    const updated = finalizeDynamicNote({ ...note, linkedNoteIds: uniqueIds(linkedNoteIds).filter((id) => id !== noteId) });
    await persistDynamicNote(updated);
    set((state) => ({ dynamicNotes: sortDynamicNotes(state.dynamicNotes.map((item) => (item.id === noteId ? updated : item))) }));
  },
  addDynamicAdditionalExample: async (noteId, example) => {
    const trimmed = example.trim();
    const note = findDynamicNote(get().dynamicNotes, noteId);
    if (!note || !trimmed) {
      return;
    }
    const updated = finalizeDynamicNote({
      ...note,
      additionalExamples: [...(note.additionalExamples ?? []), trimmed],
    });
    await persistDynamicNote(updated);
    set((state) => ({ dynamicNotes: sortDynamicNotes(state.dynamicNotes.map((item) => (item.id === noteId ? updated : item))) }));
  },
  updateDynamicAdditionalExample: async (noteId, index, example) => {
    const trimmed = example.trim();
    const note = findDynamicNote(get().dynamicNotes, noteId);
    if (!note || !trimmed) {
      return;
    }
    const examples = [...(note.additionalExamples ?? [])];
    if (index < 0 || index >= examples.length) {
      return;
    }
    examples[index] = trimmed;
    const updated = finalizeDynamicNote({ ...note, additionalExamples: examples });
    await persistDynamicNote(updated);
    set((state) => ({ dynamicNotes: sortDynamicNotes(state.dynamicNotes.map((item) => (item.id === noteId ? updated : item))) }));
  },
  deleteDynamicAdditionalExample: async (noteId, index) => {
    const note = findDynamicNote(get().dynamicNotes, noteId);
    if (!note) {
      return;
    }
    const updated = finalizeDynamicNote({
      ...note,
      additionalExamples: (note.additionalExamples ?? []).filter((_, itemIndex) => itemIndex !== index),
    });
    await persistDynamicNote(updated);
    set((state) => ({ dynamicNotes: sortDynamicNotes(state.dynamicNotes.map((item) => (item.id === noteId ? updated : item))) }));
  },
  addDynamicRelatedLink: async (noteId, title, href) => {
    const trimmedTitle = title.trim();
    const trimmedHref = href.trim();
    const note = findDynamicNote(get().dynamicNotes, noteId);
    if (!note || !trimmedTitle) {
      return;
    }
    const link: RelatedLink = {
      id: createId(),
      title: trimmedTitle,
      href: trimmedHref,
    };
    const updated = finalizeDynamicNote({ ...note, relatedLinks: [...(note.relatedLinks ?? []), link] });
    await persistDynamicNote(updated);
    set((state) => ({ dynamicNotes: sortDynamicNotes(state.dynamicNotes.map((item) => (item.id === noteId ? updated : item))) }));
  },
  deleteDynamicRelatedLink: async (noteId, linkId) => {
    const note = findDynamicNote(get().dynamicNotes, noteId);
    if (!note) {
      return;
    }
    const updated = finalizeDynamicNote({
      ...note,
      relatedLinks: (note.relatedLinks ?? []).filter((link) => link.id !== linkId),
    });
    await persistDynamicNote(updated);
    set((state) => ({ dynamicNotes: sortDynamicNotes(state.dynamicNotes.map((item) => (item.id === noteId ? updated : item))) }));
  },
  toggleDynamicFavorite: async (noteId) => {
    const note = findDynamicNote(get().dynamicNotes, noteId);
    if (!note) {
      return;
    }
    const updated = finalizeDynamicNote({ ...note, isFavorite: !note.isFavorite });
    await persistDynamicNote(updated);
    set((state) => ({ dynamicNotes: sortDynamicNotes(state.dynamicNotes.map((item) => (item.id === noteId ? updated : item))) }));
  },
  toggleDynamicPinned: async (noteId) => {
    const note = findDynamicNote(get().dynamicNotes, noteId);
    if (!note) {
      return;
    }
    const updated = finalizeDynamicNote({ ...note, isPinned: !note.isPinned });
    await persistDynamicNote(updated);
    set((state) => ({ dynamicNotes: sortDynamicNotes(state.dynamicNotes.map((item) => (item.id === noteId ? updated : item))) }));
  },
  addDynamicBlock: async (noteId, input = {}) => {
    const note = findDynamicNote(get().dynamicNotes, noteId);
    if (!note) {
      return null;
    }
    const now = new Date().toISOString();
    const nextBlocks = note.blocks ?? [];
    const block: DynamicNoteBlock = {
      id: createId(),
      noteId,
      sortOrder: nextBlocks.length,
      title: input.title ?? '',
      kind: input.kind ?? 'content',
      contentJson: input.contentJson === undefined ? emptyTiptapDocument : input.contentJson,
      contentText: input.contentText ?? '',
      createdAt: now,
      updatedAt: now,
    };
    const updated = finalizeDynamicNote({ ...note, blocks: [...nextBlocks, block] });
    await db.transaction('rw', [db.dynamicNotes, db.dynamicNoteBlocks], async () => {
      await db.dynamicNoteBlocks.put(block);
      await db.dynamicNotes.put(stripDynamicRelations(updated));
    });
    set((state) => ({ dynamicNotes: sortDynamicNotes(state.dynamicNotes.map((item) => (item.id === noteId ? updated : item))) }));
    return block;
  },
  updateDynamicBlock: async (noteId, blockId, input) => {
    const note = findDynamicNote(get().dynamicNotes, noteId);
    if (!note) {
      return;
    }
    const blocks = note.blocks ?? [];
    const block = blocks.find((item) => item.id === blockId);
    if (!block) {
      return;
    }
    const updatedBlock: DynamicNoteBlock = {
      ...block,
      kind: input.kind ?? block.kind,
      title: input.title !== undefined ? input.title : block.title,
      contentJson: input.contentJson !== undefined ? input.contentJson : block.contentJson,
      contentText: input.contentText !== undefined ? input.contentText : block.contentText,
      updatedAt: new Date().toISOString(),
    };
    const updated = finalizeDynamicNote({
      ...note,
      blocks: blocks.map((item) => (item.id === blockId ? updatedBlock : item)),
    });
    await db.transaction('rw', [db.dynamicNotes, db.dynamicNoteBlocks], async () => {
      await db.dynamicNoteBlocks.put(updatedBlock);
      await db.dynamicNotes.put(stripDynamicRelations(updated));
    });
    set((state) => ({ dynamicNotes: sortDynamicNotes(state.dynamicNotes.map((item) => (item.id === noteId ? updated : item))) }));
  },
  reorderDynamicBlocks: async (noteId, blockIds) => {
    const note = findDynamicNote(get().dynamicNotes, noteId);
    if (!note) {
      return;
    }
    const blockMap = new Map((note.blocks ?? []).map((block) => [block.id, block]));
    const usedIds = new Set<string>();
    const reordered = blockIds.flatMap((blockId, index) => {
      const block = blockMap.get(blockId);
      if (!block) {
        return [];
      }
      usedIds.add(blockId);
      return [{ ...block, sortOrder: index, updatedAt: new Date().toISOString() }];
    });
    const tail = (note.blocks ?? [])
      .filter((block) => !usedIds.has(block.id))
      .map((block, index) => ({ ...block, sortOrder: reordered.length + index }));
    const blocks = [...reordered, ...tail];
    const updated = finalizeDynamicNote({ ...note, blocks });
    await db.transaction('rw', [db.dynamicNotes, db.dynamicNoteBlocks], async () => {
      await db.dynamicNoteBlocks.bulkPut(blocks);
      await db.dynamicNotes.put(stripDynamicRelations(updated));
    });
    set((state) => ({ dynamicNotes: sortDynamicNotes(state.dynamicNotes.map((item) => (item.id === noteId ? updated : item))) }));
  },
  deleteDynamicBlock: async (noteId, blockId) => {
    const note = findDynamicNote(get().dynamicNotes, noteId);
    if (!note) {
      return;
    }
    const blocks = (note.blocks ?? [])
      .filter((block) => block.id !== blockId)
      .map((block, index) => ({ ...block, sortOrder: index }));
    const files = (note.files ?? []).filter((file) => file.blockId !== blockId);
    const updated = finalizeDynamicNote({ ...note, blocks, files });
    await db.transaction('rw', [db.dynamicNotes, db.dynamicNoteBlocks, db.dynamicNoteFiles], async () => {
      await db.dynamicNoteBlocks.delete(blockId);
      await db.dynamicNoteFiles.where('blockId').equals(blockId).delete();
      await db.dynamicNoteBlocks.bulkPut(blocks);
      await db.dynamicNotes.put(stripDynamicRelations(updated));
    });
    set((state) => ({ dynamicNotes: sortDynamicNotes(state.dynamicNotes.map((item) => (item.id === noteId ? updated : item))) }));
  },
  importFileForBlock: async (sourcePath, noteId, blockId) => {
    const note = findDynamicNote(get().dynamicNotes, noteId);
    if (!note) {
      return null;
    }
    const imported = await importDynamicAttachment(sourcePath, noteId, blockId);
    const file: DynamicNoteFile = {
      id: imported.id,
      noteId: imported.noteId,
      blockId: imported.blockId,
      kind: imported.kind as DynamicNoteFileKind,
      originalName: imported.originalName,
      mimeType: imported.mimeType,
      sizeBytes: imported.sizeBytes,
      checksum: imported.checksum,
      relativePath: imported.relativePath,
      createdAt: imported.createdAt,
    };
    const updated = finalizeDynamicNote({ ...note, files: [...(note.files ?? []), file] });
    await db.transaction('rw', [db.dynamicNotes, db.dynamicNoteFiles], async () => {
      await db.dynamicNoteFiles.put(file);
      await db.dynamicNotes.put(stripDynamicRelations(updated));
    });
    set((state) => ({ dynamicNotes: sortDynamicNotes(state.dynamicNotes.map((item) => (item.id === noteId ? updated : item))) }));
    return file;
  },
  deleteDynamicFile: async (noteId, fileId) => {
    const note = findDynamicNote(get().dynamicNotes, noteId);
    if (!note) {
      return;
    }
    const file = (note.files ?? []).find((item) => item.id === fileId);
    const changedBlocks: DynamicNoteBlock[] = [];
    const blocks = (note.blocks ?? []).map((block) => {
      const nextContentJson = removeDynamicFileFromDocument(block.contentJson, fileId);
      if (nextContentJson === block.contentJson) {
        return block;
      }
      const updatedBlock = { ...block, contentJson: nextContentJson, updatedAt: new Date().toISOString() };
      changedBlocks.push(updatedBlock);
      return updatedBlock;
    });
    const updated = finalizeDynamicNote({
      ...note,
      blocks,
      files: (note.files ?? []).filter((file) => file.id !== fileId),
    });
    await db.transaction('rw', [db.dynamicNotes, db.dynamicNoteBlocks, db.dynamicNoteFiles], async () => {
      if (changedBlocks.length) {
        await db.dynamicNoteBlocks.bulkPut(changedBlocks);
      }
      await db.dynamicNoteFiles.delete(fileId);
      await db.dynamicNotes.put(stripDynamicRelations(updated));
    });
    if (file) {
      await deleteDynamicAttachment(file.relativePath);
    }
    set((state) => ({ dynamicNotes: sortDynamicNotes(state.dynamicNotes.map((item) => (item.id === noteId ? updated : item))) }));
  },
  moveDynamicNoteToTrash: async (noteId) => {
    const note = findDynamicNote(get().dynamicNotes, noteId);
    if (!note) {
      return;
    }
    const updated = finalizeDynamicNote({ ...note, isTrashed: true });
    await persistDynamicNote(updated);
    set((state) => ({ dynamicNotes: sortDynamicNotes(state.dynamicNotes.map((item) => (item.id === noteId ? updated : item))) }));
  },
  restoreDynamicNote: async (noteId) => {
    const note = findDynamicNote(get().dynamicNotes, noteId);
    if (!note) {
      return;
    }
    const updated = finalizeDynamicNote({ ...note, isTrashed: false });
    await persistDynamicNote(updated);
    set((state) => ({ dynamicNotes: sortDynamicNotes(state.dynamicNotes.map((item) => (item.id === noteId ? updated : item))) }));
  },
  deleteDynamicNotesPermanently: async (noteIds) => {
    const ids = uniqueIds(noteIds);
    if (!ids.length) {
      return;
    }
    await db.transaction('rw', [db.dynamicNotes, db.dynamicNoteBlocks, db.dynamicNoteFiles], async () => {
      await db.dynamicNotes.bulkDelete(ids);
      await db.dynamicNoteBlocks.where('noteId').anyOf(ids).delete();
      await db.dynamicNoteFiles.where('noteId').anyOf(ids).delete();
    });
    const idSet = new Set(ids);
    set((state) => ({ dynamicNotes: state.dynamicNotes.filter((note) => !idSet.has(note.id)) }));
  },
  clearDynamicTrash: async () => {
    await get().deleteDynamicNotesPermanently(get().dynamicNotes.filter((note) => note.isTrashed).map((note) => note.id));
  },
  migrateClassicNote: async (classicNote) => {
    const now = new Date().toISOString();
    const dynamicNoteId = createId();
    const dynamicNote: DynamicNote = {
      id: dynamicNoteId,
      title: stripFallbackTitle(classicNote.title),
      subtitle: classicNote.content.intro ?? '',
      collectionId: classicNote.collectionId,
      tagIds: classicNote.tagIds,
      linkedNoteIds: [],
      additionalExamples: classicNote.content.additionalExamples ?? [],
      relatedLinks: classicNote.relatedLinks ?? [],
      isFavorite: classicNote.isFavorite,
      isPinned: classicNote.isPinned,
      isArchived: classicNote.isArchived,
      isTrashed: false,
      saveState: 'saved',
      authorId: classicNote.authorId,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
      stats: emptyStats(),
      thumbnail: classicNote.thumbnail,
      version: 1,
      syncStatus: 'local',
      blocks: buildBlocksFromClassicNote(classicNote, dynamicNoteId, now),
      files: [],
    };
    const finalized = finalizeDynamicNote(dynamicNote, false);
    await db.transaction('rw', [db.dynamicNotes, db.dynamicNoteBlocks], async () => {
      await db.dynamicNotes.put(stripDynamicRelations(finalized));
      await db.dynamicNoteBlocks.bulkPut(finalized.blocks ?? []);
    });
    set((state) => ({ dynamicNotes: sortDynamicNotes([finalized, ...state.dynamicNotes]), isReady: true }));
    return finalized;
  },
}));

async function readDynamicNotes() {
  const [notes, blocks, files] = await Promise.all([
    db.dynamicNotes.toArray(),
    db.dynamicNoteBlocks.toArray(),
    db.dynamicNoteFiles.toArray(),
  ]);
  const blocksByNote = groupBy(blocks, (block) => block.noteId);
  const filesByNote = groupBy(files, (file) => file.noteId);

  return notes.map((note) => ({
    ...note,
    blocks: (blocksByNote.get(note.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder),
    files: filesByNote.get(note.id) ?? [],
  }));
}

async function persistDynamicNote(note: DynamicNote) {
  await db.dynamicNotes.put(stripDynamicRelations(note));
}

function stripDynamicRelations(note: DynamicNote): DynamicNote {
  const { blocks: _blocks, files: _files, ...baseNote } = note;
  return baseNote;
}

function finalizeDynamicNote(note: DynamicNote, incrementVersion = true): DynamicNote {
  const updated = {
    ...note,
    saveState: 'saved',
    syncStatus: 'local',
    updatedAt: new Date().toISOString(),
    version: incrementVersion ? note.version + 1 : note.version,
  } satisfies DynamicNote;

  return {
    ...updated,
    stats: calculateDynamicStats(updated),
  };
}

function calculateDynamicStats(note: DynamicNote): NoteStats {
  const text = [
    richTextToPlainText(note.title),
    richTextToPlainText(note.subtitle),
    ...(note.additionalExamples ?? []),
    ...(note.relatedLinks?.flatMap((link) => [link.title, link.href]) ?? []),
    ...(note.blocks?.flatMap((block) => [richTextToPlainText(block.title), block.contentText]) ?? []),
    ...(note.files?.map((file) => file.originalName) ?? []),
  ].join(' ');
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  return {
    wordCount,
    characterCount: text.length,
    readingTimeMinutes: Math.max(1, Math.ceil(wordCount / editorSettings.readingWordsPerMinute)),
  };
}

function buildBlocksFromClassicNote(note: Note, dynamicNoteId: string, now: string): DynamicNoteBlock[] {
  const blocks: Array<Omit<DynamicNoteBlock, 'id' | 'sortOrder'>> = [];

  const summary = note.content.summary?.map((block) => block.text).filter(Boolean).join('\n\n') ?? '';
  if (summary.trim()) {
    blocks.push(buildClassicBlock(dynamicNoteId, now, 'Summary', markdownToTiptapDocument(summary), summary));
  }

  const explanation = note.content.explanation?.map((block) => block.text).filter(Boolean).join('\n\n') ?? '';
  if (explanation.trim()) {
    blocks.push(buildClassicBlock(dynamicNoteId, now, 'Explanation', markdownToTiptapDocument(explanation), explanation));
  }

  const rows = note.content.usageExamples?.rows ?? [];
  if (rows.length) {
    blocks.push(buildClassicBlock(dynamicNoteId, now, 'Usage examples', usageExamplesToTiptapDocument(rows), rows.flatMap((row) => [row.expression, row.meaning, row.example]).join(' ')));
  }

  if (note.content.tip?.title || note.content.tip?.body) {
    blocks.push(buildClassicBlock(dynamicNoteId, now, note.content.tip?.title || 'Tip', markdownToTiptapDocument(note.content.tip?.body ?? ''), note.content.tip?.body ?? ''));
  }

  (note.content.additionalExamples ?? []).forEach((example, index) => {
    blocks.push(buildClassicBlock(dynamicNoteId, now, `Additional example ${index + 1}`, textToTiptapDocument(example), example));
  });

  if (!blocks.length && note.content.intro?.trim()) {
    blocks.push(buildClassicBlock(dynamicNoteId, now, 'Intro', textToTiptapDocument(note.content.intro), note.content.intro));
  }

  return blocks.map((block, index) => ({
    ...block,
    id: createId(),
    sortOrder: index,
  }));
}

function buildClassicBlock(noteId: string, now: string, title: string, contentJson: TiptapDocument, contentText: string): Omit<DynamicNoteBlock, 'id' | 'sortOrder'> {
  return {
    noteId,
    title,
    kind: 'content',
    contentJson,
    contentText,
    createdAt: now,
    updatedAt: now,
  };
}

function markdownToTiptapDocument(markdown: string): TiptapDocument {
  const blocks = parseMarkdown(markdown);
  if (!blocks.length) {
    return textToTiptapDocument(markdown);
  }

  return {
    type: 'doc',
    content: blocks.flatMap(markdownBlockToTiptapNodes),
  };
}

function markdownBlockToTiptapNodes(block: MarkdownBlock): unknown[] {
  switch (block.type) {
    case 'heading':
      return [{ type: 'heading', attrs: { level: Math.min(block.level, 3) }, content: textContent(block.text) }];
    case 'blockquote':
      return [{ type: 'blockquote', content: [{ type: 'paragraph', content: textContent(block.lines.join('\n')) }] }];
    case 'code':
      return [{ type: 'codeBlock', attrs: { language: block.language ?? null }, content: textContent(block.code) }];
    case 'ordered-list':
      return [{ type: 'orderedList', content: block.items.map((item) => ({ type: 'listItem', content: [{ type: 'paragraph', content: textContent(item.text) }] })) }];
    case 'unordered-list':
      if (block.items.every((item) => item.checked !== undefined)) {
        return [{ type: 'taskList', content: block.items.map((item) => ({ type: 'taskItem', attrs: { checked: Boolean(item.checked) }, content: [{ type: 'paragraph', content: textContent(item.text) }] })) }];
      }
      return [{ type: 'bulletList', content: block.items.map((item) => ({ type: 'listItem', content: [{ type: 'paragraph', content: textContent(item.text) }] })) }];
    case 'table':
      return [tableToTiptapNode(block.headers, block.rows)];
    case 'horizontal-rule':
      return [{ type: 'horizontalRule' }];
    case 'paragraph':
    default:
      return [{ type: 'paragraph', content: textContent(block.lines.join(' ')) }];
  }
}

function usageExamplesToTiptapDocument(rows: UsageExample[]): TiptapDocument {
  return {
    type: 'doc',
    content: [tableToTiptapNode(['Expression', 'Meaning', 'Example'], rows.map((row) => [row.expression, row.meaning, row.example]))],
  };
}

function tableToTiptapNode(headers: string[], rows: string[][]) {
  return {
    type: 'table',
    content: [
      {
        type: 'tableRow',
        content: headers.map((header) => ({ type: 'tableHeader', content: [{ type: 'paragraph', content: textContent(header) }] })),
      },
      ...rows.map((row) => ({
        type: 'tableRow',
        content: headers.map((_, index) => ({ type: 'tableCell', content: [{ type: 'paragraph', content: textContent(row[index] ?? '') }] })),
      })),
    ],
  };
}

function textToTiptapDocument(text: string): TiptapDocument {
  return {
    type: 'doc',
    content: text.trim()
      ? text.split(/\n{2,}/).map((paragraph) => ({ type: 'paragraph', content: textContent(paragraph.trim()) }))
      : [{ type: 'paragraph' }],
  };
}

function textContent(text: string) {
  return text ? [{ type: 'text', text }] : undefined;
}

function stripFallbackTitle(title: string) {
  return title.trim() || 'Untitled note';
}

function sortDynamicNotes(notes: DynamicNote[]) {
  return [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function findDynamicNote(notes: DynamicNote[], noteId: string) {
  return notes.find((note) => note.id === noteId);
}

function emptyStats(): NoteStats {
  return {
    wordCount: 0,
    characterCount: 0,
    readingTimeMinutes: 1,
  };
}

function uniqueIds(ids: string[]) {
  return [...new Set(ids)];
}

function removeDynamicFileFromDocument(document: TiptapDocument | null, fileId: string) {
  if (!document?.content) {
    return document;
  }

  let changed = false;
  const content = removeDynamicFileFromNodes(document.content, fileId, () => {
    changed = true;
  });

  if (!changed) {
    return document;
  }

  return {
    ...document,
    content: content.length ? content : [{ type: 'paragraph' }],
  } satisfies TiptapDocument;
}

function removeDynamicFileFromNodes(nodes: unknown[], fileId: string, onChanged: () => void): unknown[] {
  return nodes.flatMap((node) => {
    if (!isTiptapNodeRecord(node)) {
      return [node];
    }

    if (node.type === 'dynamicFile' && node.attrs?.id === fileId) {
      onChanged();
      return [];
    }

    if (!Array.isArray(node.content)) {
      return [node];
    }

    const nextContent: unknown[] = removeDynamicFileFromNodes(node.content, fileId, onChanged);
    if (nextContent === node.content) {
      return [node];
    }

    return [{ ...node, content: nextContent }];
  });
}

function isTiptapNodeRecord(value: unknown): value is TiptapNodeRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  const grouped = new Map<string, T[]>();
  items.forEach((item) => {
    const itemKey = key(item);
    grouped.set(itemKey, [...(grouped.get(itemKey) ?? []), item]);
  });
  return grouped;
}

function createId() {
  return crypto.randomUUID();
}
