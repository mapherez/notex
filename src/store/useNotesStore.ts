import { create } from 'zustand';
import { defaultNoteThumbnailVariant, defaultUserSettings, editorSettings } from '../config/appSettings';
import type {
  Note,
  NoteBlock,
  NoteFile,
  NoteFileKind,
  NoteStats,
  RelatedLink,
  TiptapDocument,
} from '../core/models/models';
import { db } from '../core/storage/notexRepository';
import { richTextToPlainText } from '../core/utils/richText';
import { deleteNoteAttachment, importNoteAttachment } from '../core/services/noteFiles';

type NoteInput = {
  collectionId?: string | null;
  title?: string;
};

type HeaderInput = {
  collectionId?: string | null;
  subtitle?: string;
  title?: string;
};

type BlockInput = {
  contentJson?: TiptapDocument | null;
  contentText?: string;
  kind?: NoteBlock['kind'];
  title?: string;
};

type TiptapNodeRecord = {
  attrs?: Record<string, unknown>;
  content?: unknown[];
  type?: string;
  [key: string]: unknown;
};

type NotesStore = {
  notes: Note[];
  isReady: boolean;
  initialize: () => Promise<void>;
  refreshNotes: () => Promise<void>;
  createNote: (input?: NoteInput) => Promise<Note>;
  markNoteOpened: (noteId: string) => Promise<void>;
  updateNoteHeader: (noteId: string, input: HeaderInput) => Promise<void>;
  updateNoteTags: (noteId: string, tagIds: string[]) => Promise<void>;
  updateNoteThumbnail: (noteId: string, thumbnail: Note['thumbnail']) => Promise<void>;
  bulkUpdateNoteCollection: (noteIds: string[], collectionId: string | null) => Promise<void>;
  bulkUpdateNoteTag: (noteIds: string[], tagId: string, assigned: boolean) => Promise<void>;
  updateNoteLinkedNotes: (noteId: string, linkedNoteIds: string[]) => Promise<void>;
  addAdditionalExample: (noteId: string, example: string) => Promise<void>;
  updateAdditionalExample: (noteId: string, index: number, example: string) => Promise<void>;
  deleteAdditionalExample: (noteId: string, index: number) => Promise<void>;
  addRelatedLink: (noteId: string, title: string, href: string) => Promise<void>;
  deleteRelatedLink: (noteId: string, linkId: string) => Promise<void>;
  toggleFavorite: (noteId: string) => Promise<void>;
  togglePinned: (noteId: string) => Promise<void>;
  addBlock: (noteId: string, input?: BlockInput) => Promise<NoteBlock | null>;
  updateBlock: (noteId: string, blockId: string, input: BlockInput) => Promise<void>;
  reorderBlocks: (noteId: string, blockIds: string[]) => Promise<void>;
  deleteBlock: (noteId: string, blockId: string) => Promise<void>;
  importFileForBlock: (sourcePath: string, noteId: string, blockId: string | null) => Promise<NoteFile | null>;
  deleteFile: (noteId: string, fileId: string) => Promise<void>;
  moveNoteToTrash: (noteId: string) => Promise<void>;
  restoreNote: (noteId: string) => Promise<void>;
  deleteNotesPermanently: (noteIds: string[]) => Promise<void>;
  clearTrash: () => Promise<void>;
};

export const emptyTiptapDocument: TiptapDocument = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

export const useNotesStore = create<NotesStore>((set, get) => ({
  notes: [],
  isReady: false,
  initialize: async () => {
    const notes = await readNotes();
    set({ notes: sortNotes(notes), isReady: true });
  },
  refreshNotes: async () => {
    const notes = await readNotes();
    set({ notes: sortNotes(notes), isReady: true });
  },
  createNote: async (input = {}) => {
    const now = new Date().toISOString();
    const note: Note = {
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
      blocks: [],
      files: [],
    };

    await db.notes.put(stripNoteRelations(note));
    set((state) => ({ notes: sortNotes([note, ...state.notes]), isReady: true }));
    return note;
  },
  markNoteOpened: async (noteId) => {
    const note = findNote(get().notes, noteId);
    if (!note) {
      return;
    }
    const updated = { ...note, lastOpenedAt: new Date().toISOString() };
    await db.notes.put(stripNoteRelations(updated));
    set((state) => ({ notes: state.notes.map((item) => (item.id === noteId ? updated : item)) }));
  },
  updateNoteHeader: async (noteId, input) => {
    const note = findNote(get().notes, noteId);
    if (!note) {
      return;
    }
    const updated = finalizeNote({
      ...note,
      title: input.title !== undefined ? input.title : note.title,
      subtitle: input.subtitle !== undefined ? input.subtitle : note.subtitle,
      collectionId: input.collectionId !== undefined ? input.collectionId : note.collectionId,
    });
    await persistNote(updated);
    set((state) => ({ notes: sortNotes(state.notes.map((item) => (item.id === noteId ? updated : item))) }));
  },
  updateNoteTags: async (noteId, tagIds) => {
    const note = findNote(get().notes, noteId);
    if (!note) {
      return;
    }
    const updated = finalizeNote({ ...note, tagIds: uniqueIds(tagIds) });
    await persistNote(updated);
    set((state) => ({ notes: sortNotes(state.notes.map((item) => (item.id === noteId ? updated : item))) }));
  },
  updateNoteThumbnail: async (noteId, thumbnail) => {
    const note = findNote(get().notes, noteId);
    if (!note || !thumbnail) {
      return;
    }
    const updated = finalizeNote({ ...note, thumbnail });
    await persistNote(updated);
    set((state) => ({ notes: sortNotes(state.notes.map((item) => (item.id === noteId ? updated : item))) }));
  },
  bulkUpdateNoteCollection: async (noteIds, collectionId) => {
    const noteIdSet = new Set(uniqueIds(noteIds));
    const noteUpdates = get().notes
      .filter((note) => noteIdSet.has(note.id) && note.collectionId !== collectionId)
      .map((note) => finalizeNote({ ...note, collectionId }));

    if (!noteUpdates.length) {
      return;
    }

    await db.notes.bulkPut(noteUpdates.map(stripNoteRelations));
    set((state) => {
      const updateMap = new Map(noteUpdates.map((note) => [note.id, note]));
      return { notes: sortNotes(state.notes.map((note) => updateMap.get(note.id) ?? note)) };
    });
  },
  bulkUpdateNoteTag: async (noteIds, tagId, assigned) => {
    const noteIdSet = new Set(uniqueIds(noteIds));
    const noteUpdates = get().notes
      .filter((note) => noteIdSet.has(note.id) && note.tagIds.includes(tagId) !== assigned)
      .map((note) => {
        const nextTagIds = assigned ? [...note.tagIds, tagId] : note.tagIds.filter((id) => id !== tagId);
        return finalizeNote({ ...note, tagIds: uniqueIds(nextTagIds) });
      });

    if (!noteUpdates.length) {
      return;
    }

    await db.notes.bulkPut(noteUpdates.map(stripNoteRelations));
    set((state) => {
      const updateMap = new Map(noteUpdates.map((note) => [note.id, note]));
      return { notes: sortNotes(state.notes.map((note) => updateMap.get(note.id) ?? note)) };
    });
  },
  updateNoteLinkedNotes: async (noteId, linkedNoteIds) => {
    const note = findNote(get().notes, noteId);
    if (!note) {
      return;
    }
    const updated = finalizeNote({ ...note, linkedNoteIds: uniqueIds(linkedNoteIds).filter((id) => id !== noteId) });
    await persistNote(updated);
    set((state) => ({ notes: sortNotes(state.notes.map((item) => (item.id === noteId ? updated : item))) }));
  },
  addAdditionalExample: async (noteId, example) => {
    const trimmed = example.trim();
    const note = findNote(get().notes, noteId);
    if (!note || !trimmed) {
      return;
    }
    const updated = finalizeNote({
      ...note,
      additionalExamples: [...(note.additionalExamples ?? []), trimmed],
    });
    await persistNote(updated);
    set((state) => ({ notes: sortNotes(state.notes.map((item) => (item.id === noteId ? updated : item))) }));
  },
  updateAdditionalExample: async (noteId, index, example) => {
    const trimmed = example.trim();
    const note = findNote(get().notes, noteId);
    if (!note || !trimmed) {
      return;
    }
    const examples = [...(note.additionalExamples ?? [])];
    if (index < 0 || index >= examples.length) {
      return;
    }
    examples[index] = trimmed;
    const updated = finalizeNote({ ...note, additionalExamples: examples });
    await persistNote(updated);
    set((state) => ({ notes: sortNotes(state.notes.map((item) => (item.id === noteId ? updated : item))) }));
  },
  deleteAdditionalExample: async (noteId, index) => {
    const note = findNote(get().notes, noteId);
    if (!note) {
      return;
    }
    const updated = finalizeNote({
      ...note,
      additionalExamples: (note.additionalExamples ?? []).filter((_, itemIndex) => itemIndex !== index),
    });
    await persistNote(updated);
    set((state) => ({ notes: sortNotes(state.notes.map((item) => (item.id === noteId ? updated : item))) }));
  },
  addRelatedLink: async (noteId, title, href) => {
    const trimmedTitle = title.trim();
    const trimmedHref = href.trim();
    const note = findNote(get().notes, noteId);
    if (!note || !trimmedTitle) {
      return;
    }
    const link: RelatedLink = {
      id: createId(),
      title: trimmedTitle,
      href: trimmedHref,
    };
    const updated = finalizeNote({ ...note, relatedLinks: [...(note.relatedLinks ?? []), link] });
    await persistNote(updated);
    set((state) => ({ notes: sortNotes(state.notes.map((item) => (item.id === noteId ? updated : item))) }));
  },
  deleteRelatedLink: async (noteId, linkId) => {
    const note = findNote(get().notes, noteId);
    if (!note) {
      return;
    }
    const updated = finalizeNote({
      ...note,
      relatedLinks: (note.relatedLinks ?? []).filter((link) => link.id !== linkId),
    });
    await persistNote(updated);
    set((state) => ({ notes: sortNotes(state.notes.map((item) => (item.id === noteId ? updated : item))) }));
  },
  toggleFavorite: async (noteId) => {
    const note = findNote(get().notes, noteId);
    if (!note) {
      return;
    }
    const updated = finalizeNote({ ...note, isFavorite: !note.isFavorite });
    await persistNote(updated);
    set((state) => ({ notes: sortNotes(state.notes.map((item) => (item.id === noteId ? updated : item))) }));
  },
  togglePinned: async (noteId) => {
    const note = findNote(get().notes, noteId);
    if (!note) {
      return;
    }
    const updated = finalizeNote({ ...note, isPinned: !note.isPinned });
    await persistNote(updated);
    set((state) => ({ notes: sortNotes(state.notes.map((item) => (item.id === noteId ? updated : item))) }));
  },
  addBlock: async (noteId, input = {}) => {
    const note = findNote(get().notes, noteId);
    if (!note) {
      return null;
    }
    const now = new Date().toISOString();
    const nextBlocks = note.blocks ?? [];
    const block: NoteBlock = {
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
    const updated = finalizeNote({ ...note, blocks: [...nextBlocks, block] });
    await db.transaction('rw', [db.notes, db.noteBlocks], async () => {
      await db.noteBlocks.put(block);
      await db.notes.put(stripNoteRelations(updated));
    });
    set((state) => ({ notes: sortNotes(state.notes.map((item) => (item.id === noteId ? updated : item))) }));
    return block;
  },
  updateBlock: async (noteId, blockId, input) => {
    const note = findNote(get().notes, noteId);
    if (!note) {
      return;
    }
    const blocks = note.blocks ?? [];
    const block = blocks.find((item) => item.id === blockId);
    if (!block) {
      return;
    }
    const updatedBlock: NoteBlock = {
      ...block,
      kind: input.kind ?? block.kind,
      title: input.title !== undefined ? input.title : block.title,
      contentJson: input.contentJson !== undefined ? input.contentJson : block.contentJson,
      contentText: input.contentText !== undefined ? input.contentText : block.contentText,
      updatedAt: new Date().toISOString(),
    };
    const updated = finalizeNote({
      ...note,
      blocks: blocks.map((item) => (item.id === blockId ? updatedBlock : item)),
    });
    await db.transaction('rw', [db.notes, db.noteBlocks], async () => {
      await db.noteBlocks.put(updatedBlock);
      await db.notes.put(stripNoteRelations(updated));
    });
    set((state) => ({ notes: sortNotes(state.notes.map((item) => (item.id === noteId ? updated : item))) }));
  },
  reorderBlocks: async (noteId, blockIds) => {
    const note = findNote(get().notes, noteId);
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
    const updated = finalizeNote({ ...note, blocks });
    await db.transaction('rw', [db.notes, db.noteBlocks], async () => {
      await db.noteBlocks.bulkPut(blocks);
      await db.notes.put(stripNoteRelations(updated));
    });
    set((state) => ({ notes: sortNotes(state.notes.map((item) => (item.id === noteId ? updated : item))) }));
  },
  deleteBlock: async (noteId, blockId) => {
    const note = findNote(get().notes, noteId);
    if (!note) {
      return;
    }
    const blocks = (note.blocks ?? [])
      .filter((block) => block.id !== blockId)
      .map((block, index) => ({ ...block, sortOrder: index }));
    const files = (note.files ?? []).filter((file) => file.blockId !== blockId);
    const updated = finalizeNote({ ...note, blocks, files });
    await db.transaction('rw', [db.notes, db.noteBlocks, db.noteFiles], async () => {
      await db.noteBlocks.delete(blockId);
      await db.noteFiles.where('blockId').equals(blockId).delete();
      await db.noteBlocks.bulkPut(blocks);
      await db.notes.put(stripNoteRelations(updated));
    });
    set((state) => ({ notes: sortNotes(state.notes.map((item) => (item.id === noteId ? updated : item))) }));
  },
  importFileForBlock: async (sourcePath, noteId, blockId) => {
    const note = findNote(get().notes, noteId);
    if (!note) {
      return null;
    }
    const imported = await importNoteAttachment(sourcePath, noteId, blockId);
    const file: NoteFile = {
      id: imported.id,
      noteId: imported.noteId,
      blockId: imported.blockId,
      kind: imported.kind as NoteFileKind,
      originalName: imported.originalName,
      mimeType: imported.mimeType,
      sizeBytes: imported.sizeBytes,
      checksum: imported.checksum,
      relativePath: imported.relativePath,
      createdAt: imported.createdAt,
    };
    const updated = finalizeNote({ ...note, files: [...(note.files ?? []), file] });
    await db.transaction('rw', [db.notes, db.noteFiles], async () => {
      await db.noteFiles.put(file);
      await db.notes.put(stripNoteRelations(updated));
    });
    set((state) => ({ notes: sortNotes(state.notes.map((item) => (item.id === noteId ? updated : item))) }));
    return file;
  },
  deleteFile: async (noteId, fileId) => {
    const note = findNote(get().notes, noteId);
    if (!note) {
      return;
    }
    const file = (note.files ?? []).find((item) => item.id === fileId);
    const changedBlocks: NoteBlock[] = [];
    const blocks = (note.blocks ?? []).map((block) => {
      const nextContentJson = removeNoteFileFromDocument(block.contentJson, fileId);
      if (nextContentJson === block.contentJson) {
        return block;
      }
      const updatedBlock = { ...block, contentJson: nextContentJson, updatedAt: new Date().toISOString() };
      changedBlocks.push(updatedBlock);
      return updatedBlock;
    });
    const updated = finalizeNote({
      ...note,
      blocks,
      files: (note.files ?? []).filter((file) => file.id !== fileId),
    });
    await db.transaction('rw', [db.notes, db.noteBlocks, db.noteFiles], async () => {
      if (changedBlocks.length) {
        await db.noteBlocks.bulkPut(changedBlocks);
      }
      await db.noteFiles.delete(fileId);
      await db.notes.put(stripNoteRelations(updated));
    });
    if (file) {
      await deleteNoteAttachment(file.relativePath);
    }
    set((state) => ({ notes: sortNotes(state.notes.map((item) => (item.id === noteId ? updated : item))) }));
  },
  moveNoteToTrash: async (noteId) => {
    const note = findNote(get().notes, noteId);
    if (!note) {
      return;
    }
    const updated = finalizeNote({ ...note, isTrashed: true });
    await persistNote(updated);
    set((state) => ({ notes: sortNotes(state.notes.map((item) => (item.id === noteId ? updated : item))) }));
  },
  restoreNote: async (noteId) => {
    const note = findNote(get().notes, noteId);
    if (!note) {
      return;
    }
    const updated = finalizeNote({ ...note, isTrashed: false });
    await persistNote(updated);
    set((state) => ({ notes: sortNotes(state.notes.map((item) => (item.id === noteId ? updated : item))) }));
  },
  deleteNotesPermanently: async (noteIds) => {
    const ids = uniqueIds(noteIds);
    if (!ids.length) {
      return;
    }
    await db.transaction('rw', [db.notes, db.noteBlocks, db.noteFiles], async () => {
      await db.notes.bulkDelete(ids);
      await db.noteBlocks.where('noteId').anyOf(ids).delete();
      await db.noteFiles.where('noteId').anyOf(ids).delete();
    });
    const idSet = new Set(ids);
    set((state) => ({ notes: state.notes.filter((note) => !idSet.has(note.id)) }));
  },
  clearTrash: async () => {
    await get().deleteNotesPermanently(get().notes.filter((note) => note.isTrashed).map((note) => note.id));
  },
}));

async function readNotes() {
  const [notes, blocks, files] = await Promise.all([
    db.notes.toArray(),
    db.noteBlocks.toArray(),
    db.noteFiles.toArray(),
  ]);
  const blocksByNote = groupBy(blocks, (block) => block.noteId);
  const filesByNote = groupBy(files, (file) => file.noteId);

  return notes.map((note) => ({
    ...note,
    blocks: (blocksByNote.get(note.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder),
    files: filesByNote.get(note.id) ?? [],
  }));
}

async function persistNote(note: Note) {
  await db.notes.put(stripNoteRelations(note));
}

function stripNoteRelations(note: Note): Note {
  const { blocks: _blocks, files: _files, ...baseNote } = note;
  return baseNote;
}

function finalizeNote(note: Note, incrementVersion = true): Note {
  const updated = {
    ...note,
    saveState: 'saved',
    updatedAt: new Date().toISOString(),
    version: incrementVersion ? note.version + 1 : note.version,
  } satisfies Note;

  return {
    ...updated,
    stats: calculateStats(updated),
  };
}

function calculateStats(note: Note): NoteStats {
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

function sortNotes(notes: Note[]) {
  return [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function findNote(notes: Note[], noteId: string) {
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

function removeNoteFileFromDocument(document: TiptapDocument | null, fileId: string) {
  if (!document?.content) {
    return document;
  }

  let changed = false;
  const content = removeNoteFileFromNodes(document.content, fileId, () => {
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

function removeNoteFileFromNodes(nodes: unknown[], fileId: string, onChanged: () => void): unknown[] {
  return nodes.flatMap((node) => {
    if (!isTiptapNodeRecord(node)) {
      return [node];
    }

    if (node.type === 'noteFile' && node.attrs?.id === fileId) {
      onChanged();
      return [];
    }

    if (!Array.isArray(node.content)) {
      return [node];
    }

    const nextContent: unknown[] = removeNoteFileFromNodes(node.content, fileId, onChanged);
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
