import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useNotesStore } from './useNotesStore';
import type { Note } from '../core/models/models';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@tauri-apps/api/core', () => ({ invoke, isTauri: () => true, convertFileSrc: (value: string) => value }));

function existingNote(): Note {
  return {
    id: 'note', title: 'Title', subtitle: 'Subtitle', collectionId: null,
    tagIds: ['tag'], linkedNoteIds: [], additionalExamples: ['Example'], relatedLinks: [],
    isFavorite: false, isPinned: false, isArchived: false, isTrashed: false,
    saveState: 'saved', createdAt: '2026-01-01', updatedAt: '2026-01-02', version: 7,
    stats: { wordCount: 1, characterCount: 4, readingTimeMinutes: 1 },
    blocks: [{ id: 'block', noteId: 'note', sortOrder: 0, kind: 'content', title: '',
      contentText: 'Body', contentJson: { type: 'doc', content: [{ type: 'paragraph' }] },
      createdAt: '2026-01-01', updatedAt: '2026-01-02' }], files: [],
  };
}

describe('note revision semantics', () => {
  beforeEach(() => {
    invoke.mockClear();
    useNotesStore.setState({ notes: [existingNote()], isReady: true });
  });

  it('does not write or increment revisions for unchanged values and absent removals', async () => {
    const store = useNotesStore.getState();
    await store.updateNoteHeader('note', { title: 'Title', subtitle: 'Subtitle', collectionId: null });
    await store.updateNoteTags('note', ['tag', 'tag']);
    await store.updateBlock('note', 'block', {
      contentText: 'Body', contentJson: { content: [{ type: 'paragraph' }], type: 'doc' },
    });
    await store.updateAdditionalExample('note', 0, ' Example ');
    await store.deleteAdditionalExample('note', 10);
    await store.deleteRelatedLink('note', 'absent');
    await store.deleteFile('note', 'absent');
    await store.restoreNote('note');
    expect(invoke).not.toHaveBeenCalled();
    expect(useNotesStore.getState().notes[0]).toEqual(existingNote());
  });

  it('records a visit without changing the editing date or version', async () => {
    await useNotesStore.getState().markNoteOpened('note');
    const note = useNotesStore.getState().notes[0];
    expect(note.lastOpenedAt).toBeTruthy();
    expect(note.updatedAt).toBe('2026-01-02');
    expect(note.version).toBe(7);
  });

  it('increments once for an actual edit and ignores saving the same edit again', async () => {
    await useNotesStore.getState().updateNoteHeader('note', { title: 'Changed' });
    await useNotesStore.getState().updateNoteHeader('note', { title: 'Changed' });
    expect(useNotesStore.getState().notes[0].version).toBe(8);
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('moving an already trashed note to trash is not another edit', async () => {
    await useNotesStore.getState().moveNoteToTrash('note');
    await useNotesStore.getState().moveNoteToTrash('note');
    expect(useNotesStore.getState().notes[0].version).toBe(8);
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});
