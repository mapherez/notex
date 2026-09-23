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
    invoke.mockReset();
    invoke.mockResolvedValue(undefined);
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

  it('associates images with their editor block and ordinary attachments only with the note', async () => {
    invoke.mockImplementation(async (command: string, args?: Record<string, unknown>) => {
      if (command !== 'notex_note_file_import') return undefined;
      const sourcePath = String(args?.sourcePath ?? 'file');
      const image = sourcePath.endsWith('.png');
      return {
        absolutePath: sourcePath,
        blockId: null,
        checksum: image ? 'image-checksum' : 'file-checksum',
        createdAt: '2026-01-03',
        id: image ? 'image-file' : 'document-file',
        kind: image ? 'image' : 'attachment',
        mimeType: image ? 'image/png' : 'application/pdf',
        noteId: 'note',
        originalName: sourcePath,
        relativePath: `note/${sourcePath}`,
        sizeBytes: 12,
      };
    });

    const image = await useNotesStore.getState().importFileForBlock('photo.png', 'note', 'block');
    const attachment = await useNotesStore.getState().importFileForBlock('report.pdf', 'note', 'block');

    expect(image?.blockId).toBe('block');
    expect(attachment?.blockId).toBeNull();
    expect(useNotesStore.getState().notes[0].files).toEqual([
      expect.objectContaining({ id: 'image-file', blockId: 'block', kind: 'image' }),
      expect.objectContaining({ id: 'document-file', blockId: null, kind: 'attachment' }),
    ]);
    expect(invoke.mock.calls.filter(([command]) => command === 'notex_note_file_import'))
      .toEqual(expect.arrayContaining([
        ['notex_note_file_import', expect.objectContaining({ blockId: null })],
      ]));
  });

  it('keeps an attachment visible when an automatic block save starts during its upload', async () => {
    let releaseUploadTransaction!: () => void;
    let reportUploadTransactionStarted!: () => void;
    const uploadTransactionStarted = new Promise<void>((resolve) => {
      reportUploadTransactionStarted = resolve;
    });
    let transactionCount = 0;

    invoke.mockImplementation(async (command: string) => {
      if (command === 'notex_note_file_import') {
        return {
          absolutePath: 'notes.txt', blockId: null, checksum: 'file-checksum',
          createdAt: '2026-01-03', id: 'document-file', kind: 'attachment',
          mimeType: 'text/plain', noteId: 'note', originalName: 'notes.txt',
          relativePath: 'note/notes.txt', sizeBytes: 12,
        };
      }
      if (command === 'notex_sqlite_transaction') {
        transactionCount += 1;
        if (transactionCount === 1) {
          reportUploadTransactionStarted();
          await new Promise<void>((resolve) => {
            releaseUploadTransaction = resolve;
          });
        }
      }
      return undefined;
    });

    const upload = useNotesStore.getState().importFileForBlock('notes.txt', 'note', 'block');
    await uploadTransactionStarted;
    const automaticSave = useNotesStore.getState().updateBlock('note', 'block', {
      contentText: 'Body changed while uploading',
    });

    await Promise.resolve();
    expect(transactionCount).toBe(1);
    releaseUploadTransaction();
    await Promise.all([upload, automaticSave]);

    const note = useNotesStore.getState().notes[0];
    expect(transactionCount).toBe(2);
    expect(note.files).toEqual([
      expect.objectContaining({ id: 'document-file', blockId: null, kind: 'attachment' }),
    ]);
    expect(note.blocks?.[0].contentText).toBe('Body changed while uploading');
  });

  it('deletes the stored binary before removing its record and editor node', async () => {
    const note = existingNote();
    const file = {
      id: 'image-file', noteId: 'note', blockId: 'block', kind: 'image' as const,
      originalName: 'photo.png', mimeType: 'image/png', sizeBytes: 12,
      checksum: 'checksum', relativePath: 'note/photo.png', createdAt: '2026-01-03',
    };
    note.files = [file];
    note.blocks![0].contentJson = {
      type: 'doc',
      content: [{ type: 'noteFile', attrs: { ...file, align: 'center', width: 420, wrap: 'none' } }],
    };
    useNotesStore.setState({ notes: [note], isReady: true });

    await useNotesStore.getState().deleteFile('note', 'image-file');

    const commands = invoke.mock.calls.map(([command]) => command);
    expect(commands.indexOf('notex_note_file_delete')).toBeGreaterThanOrEqual(0);
    expect(commands.indexOf('notex_note_file_delete')).toBeLessThan(commands.indexOf('notex_sqlite_transaction'));
    expect(useNotesStore.getState().notes[0].files).toEqual([]);
    expect(useNotesStore.getState().notes[0].blocks?.[0].contentJson?.content)
      .toEqual([{ type: 'paragraph' }]);
  });
});
