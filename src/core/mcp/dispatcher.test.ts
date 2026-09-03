import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommandOutput } from '@notex/mcp-contract';
import type { Note, NoteBlock } from '../models/models';
import { useKnowledgeStore } from '../../store/useKnowledgeStore';
import { useNotesStore } from '../../store/useNotesStore';
import { dispatchMcpCommand, type McpBridgeResponse } from './dispatcher';

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => path,
  invoke: invokeMock,
}));

const activeNote = createNote({
  id: 'note-active',
  title: '<p>Introdução à linguagem</p>',
  subtitle: '<p><em>Referência principal</em></p>',
  collectionId: 'collection-reference',
  tagIds: ['tag-grammar'],
  version: 4,
  blocks: [
    createBlock({ id: 'block-later', noteId: 'note-active', sortOrder: 2, title: 'Later', contentText: 'Second' }),
    createBlock({
      id: 'block-first',
      noteId: 'note-active',
      sortOrder: 0,
      title: '<p><strong>Summary</strong></p>',
      contentText: 'Body needle',
      contentJson: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Body needle' }] },
          {
            type: 'noteFile',
            attrs: { id: 'private-file', relativePath: 'files/private.pdf', checksum: 'private' },
          },
        ],
      },
    }),
  ],
});
const trashNote = createNote({
  id: 'note-trash',
  title: 'Deleted note',
  isTrashed: true,
  updatedAt: '2026-02-02T00:00:00.000Z',
  version: 2,
  blocks: [createBlock({ id: 'trash-block', noteId: 'note-trash', sortOrder: 0, contentText: 'Trash body' })],
});

describe('dispatchMcpCommand', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    useNotesStore.setState({ isReady: true, notes: [activeNote, trashNote] });
    useKnowledgeStore.setState({
      isReady: true,
      tags: [
        { id: 'tag-work', name: 'Trabalho' },
        { id: 'tag-grammar', name: 'Gramática', color: 'blue' },
      ],
      collections: [
        { id: 'collection-work', name: 'Projetos', color: 'green' },
        { id: 'collection-reference', name: 'Referência', color: 'amber' },
      ],
    });
  });

  it('reports online status and rejects expired or invalid requests', async () => {
    const status = successResult<'notex_status'>(
      await dispatchMcpCommand(request('notex_status', {}), '2.1.0'),
    );
    expect(status).toEqual({ state: 'online', appVersion: '2.1.0', protocolVersion: '1.0' });

    const expired = await dispatchMcpCommand(
      { ...request('search_notes', {}), deadlineAt: '2020-01-01T00:00:00.000Z' },
      '2.1.0',
    );
    expectFailure(expired, 'TIMEOUT');

    const invalid = await dispatchMcpCommand(request('search_notes', { limit: 0 }), '2.1.0');
    expectFailure(invalid, 'INVALID_INPUT');
  });

  it('searches active notes by default and exposes trash only when requested', async () => {
    const active = successResult<'search_notes'>(
      await dispatchMcpCommand(request('search_notes', { query: 'needle' }), '2.1.0'),
    );
    expect(active.results.map((item) => item.id)).toEqual(['note-active']);
    expect(active.results[0]).toMatchObject({
      title: 'Introdução à linguagem',
      isTrashed: false,
      version: 4,
    });

    const trash = successResult<'search_notes'>(
      await dispatchMcpCommand(
        request('search_notes', { query: '', location: 'trash', limit: 20 }),
        '2.1.0',
      ),
    );
    expect(trash.results.map((item) => item.id)).toEqual(['note-trash']);

    const all = successResult<'search_notes'>(
      await dispatchMcpCommand(request('search_notes', { query: '', location: 'all', limit: 20 }), '2.1.0'),
    );
    expect(all.results.map((item) => item.id)).toEqual(['note-trash', 'note-active']);
  });

  it('returns ordered note summaries and marks trash as read-only', async () => {
    const active = successResult<'get_note'>(
      await dispatchMcpCommand(request('get_note', { noteId: activeNote.id }), '2.1.0'),
    );
    expect(active.readOnly).toBe(false);
    expect(active.title).toEqual({ html: '<p>Introdução à linguagem</p>', text: 'Introdução à linguagem' });
    expect(active.blocks.map((block) => block.id)).toEqual(['block-first', 'block-later']);
    expect(active.blocks[0].contentPreview).toBe('Body needle');

    const trash = successResult<'get_note'>(
      await dispatchMcpCommand(request('get_note', { noteId: trashNote.id }), '2.1.0'),
    );
    expect(trash.readOnly).toBe(true);
    expect(trash.isTrashed).toBe(true);
  });

  it('returns exact block content without local file metadata', async () => {
    const block = successResult<'get_note_block'>(
      await dispatchMcpCommand(
        request('get_note_block', { noteId: activeNote.id, blockId: 'block-first' }),
        '2.1.0',
      ),
    );

    expect(block.noteVersion).toBe(4);
    expect(block.readOnly).toBe(false);
    expect(block.content.text).toBe('Body needle');
    expect(block.content.html).toContain('<p>Body needle</p>');
    expect(block.content.html).not.toContain('notex-file');
    expect(block.content.html).not.toContain('private.pdf');
  });

  it('filters and limits tags and collections with accent-insensitive queries', async () => {
    const tags = successResult<'list_tags'>(
      await dispatchMcpCommand(request('list_tags', { query: 'gramatica', limit: 1 }), '2.1.0'),
    );
    expect(tags.tags).toEqual([{ id: 'tag-grammar', name: 'Gramática', color: 'blue' }]);

    const collections = successResult<'list_collections'>(
      await dispatchMcpCommand(request('list_collections', { query: '', limit: 100 }), '2.1.0'),
    );
    expect(collections.collections).toEqual([
      { id: 'collection-work', name: 'Projetos', color: 'green' },
      { id: 'collection-reference', name: 'Referência', color: 'amber' },
    ]);
  });

  it('returns NOT_FOUND for mismatched IDs and never calls SQLite during reads', async () => {
    const missingNote = await dispatchMcpCommand(request('get_note', { noteId: 'missing' }), '2.1.0');
    expectFailure(missingNote, 'NOT_FOUND');

    const mismatchedBlock = await dispatchMcpCommand(
      request('get_note_block', { noteId: activeNote.id, blockId: 'trash-block' }),
      '2.1.0',
    );
    expectFailure(mismatchedBlock, 'NOT_FOUND');
    expect(invokeMock).not.toHaveBeenCalled();
  });
});

function request(command: string, input: unknown) {
  return {
    requestId: '11d29c3b-14f1-4878-aab9-65f901d62aba',
    command,
    input,
    deadlineAt: new Date(Date.now() + 60_000).toISOString(),
  };
}

function successResult<T extends keyof CommandOutputMap>(response: McpBridgeResponse): CommandOutputMap[T] {
  if (!response.ok) {
    throw new Error(`Expected success, received ${response.error.code}`);
  }
  return response.result as CommandOutputMap[T];
}

type CommandOutputMap = {
  [Name in 'notex_status' | 'search_notes' | 'get_note' | 'get_note_block' | 'list_tags' | 'list_collections']:
    CommandOutput<Name>;
};

function expectFailure(response: McpBridgeResponse, code: string) {
  expect(response.ok).toBe(false);
  if (!response.ok) {
    expect(response.error.code).toBe(code);
  }
}

function createNote({
  blocks,
  collectionId = null,
  id,
  isTrashed = false,
  subtitle = '',
  tagIds = [],
  title,
  updatedAt = '2026-02-01T00:00:00.000Z',
  version,
}: {
  blocks: NoteBlock[];
  collectionId?: string | null;
  id: string;
  isTrashed?: boolean;
  subtitle?: string;
  tagIds?: string[];
  title: string;
  updatedAt?: string;
  version: number;
}): Note {
  return {
    id,
    title,
    subtitle,
    collectionId,
    tagIds,
    linkedNoteIds: [],
    isFavorite: false,
    isPinned: false,
    isArchived: false,
    isTrashed,
    saveState: 'saved',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt,
    stats: { wordCount: 0, characterCount: 0, readingTimeMinutes: 1 },
    version,
    blocks,
    files: [],
  };
}

function createBlock({
  contentJson = { type: 'doc', content: [{ type: 'paragraph' }] },
  contentText = '',
  id,
  noteId,
  sortOrder,
  title = '',
}: {
  contentJson?: NoteBlock['contentJson'];
  contentText?: string;
  id: string;
  noteId: string;
  sortOrder: number;
  title?: string;
}): NoteBlock {
  return {
    id,
    noteId,
    sortOrder,
    title,
    kind: 'content',
    contentJson,
    contentText,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
  };
}
