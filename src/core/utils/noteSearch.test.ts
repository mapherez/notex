import { describe, expect, it } from 'vitest';
import type { Note } from '../models/models';
import { searchNotes } from './noteSearch';

const tags = [
  { id: 'tag-grammar', name: 'Gramática', color: 'blue' as const },
  { id: 'tag-work', name: 'Trabalho', color: 'green' as const },
];
const collections = [
  { id: 'collection-reference', name: 'Referência', color: 'amber' as const },
  { id: 'collection-work', name: 'Projetos', color: 'violet' as const },
];

describe('searchNotes', () => {
  it('normalizes accents and searches note content, tags, and collections', () => {
    const notes = [
      note({ id: 'content', title: '<p>Introdução</p>', contentText: 'Conceitos linguísticos' }),
      note({ id: 'tag', title: 'Other', tagIds: ['tag-grammar'] }),
      note({ id: 'collection', title: 'Other', collectionId: 'collection-reference' }),
    ];

    expect(searchNotes({ collections, limit: 10, notes, query: 'introducao', tags }).map(resultId)).toEqual(['content']);
    expect(searchNotes({ collections, limit: 10, notes, query: 'gramatica', tags }).map(resultId)).toEqual(['tag']);
    expect(searchNotes({ collections, limit: 10, notes, query: 'referencia', tags }).map(resultId)).toEqual(['collection']);
  });

  it('uses active by default and supports trash and all explicitly', () => {
    const active = note({ id: 'active', title: 'Shared term', updatedAt: '2026-01-01T00:00:00.000Z' });
    const trash = note({ id: 'trash', title: 'Shared term', isTrashed: true, updatedAt: '2026-01-02T00:00:00.000Z' });

    expect(searchNotes({ collections, limit: 10, notes: [active, trash], query: 'shared', tags }).map(resultId)).toEqual(['active']);
    expect(
      searchNotes({ collections, limit: 10, location: 'trash', notes: [active, trash], query: 'shared', tags }).map(resultId),
    ).toEqual(['trash']);
    expect(
      searchNotes({ collections, limit: 10, location: 'all', notes: [active, trash], query: 'shared', tags }).map(resultId),
    ).toEqual(['trash', 'active']);
  });

  it('returns the most recently updated notes for an empty query and enforces the limit', () => {
    const notes = [
      note({ id: 'older', updatedAt: '2026-01-01T00:00:00.000Z' }),
      note({ id: 'newer', updatedAt: '2026-01-03T00:00:00.000Z' }),
      note({ id: 'middle', updatedAt: '2026-01-02T00:00:00.000Z' }),
    ];

    expect(searchNotes({ collections, limit: 2, notes, query: '', tags }).map(resultId)).toEqual(['newer', 'middle']);
  });

  it('preserves phrase matching across adjacent note fields', () => {
    const notes = [note({ id: 'cross-field', title: 'Project', subtitle: 'Atlas' })];

    expect(searchNotes({ collections, limit: 10, notes, query: 'project atlas', tags }).map(resultId)).toEqual([
      'cross-field',
    ]);
  });

  it('returns a bounded plain-text snippet', () => {
    const result = searchNotes({
      collections,
      limit: 1,
      notes: [note({ id: 'long', contentText: `needle ${'content '.repeat(60)}` })],
      query: 'needle',
      tags,
    })[0];

    expect(result.snippet).toContain('needle');
    expect(result.snippet.length).toBeLessThanOrEqual(240);
    expect(result.snippet.endsWith('...')).toBe(true);
  });
});

function resultId(result: { note: Note }) {
  return result.note.id;
}

function note({
  collectionId = null,
  contentText = '',
  id,
  isTrashed = false,
  subtitle = '',
  tagIds = [],
  title = 'Note',
  updatedAt = '2026-01-01T00:00:00.000Z',
}: {
  collectionId?: string | null;
  contentText?: string;
  id: string;
  isTrashed?: boolean;
  subtitle?: string;
  tagIds?: string[];
  title?: string;
  updatedAt?: string;
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
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt,
    stats: { wordCount: 0, characterCount: 0, readingTimeMinutes: 1 },
    version: 1,
    blocks: [
      {
        id: `${id}-block`,
        noteId: id,
        sortOrder: 0,
        title: '',
        kind: 'content',
        contentJson: { type: 'doc', content: [{ type: 'paragraph' }] },
        contentText,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt,
      },
    ],
    files: [],
  };
}
