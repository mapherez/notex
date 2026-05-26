import { noteSettings } from '../../config/appSettings';
import type { Note } from '../models/models';
import { stripInlineFormatting } from './inlineFormatting';

export type NotesSortOrder = 'nameAsc' | 'nameDesc' | 'updatedAsc' | 'updatedDesc';

export type NotesFilter = {
  mode: 'all' | 'favorites' | 'recent' | 'trash';
  query?: string | null;
  tagId?: string | null;
  collectionId?: string | null;
  sortOrder?: NotesSortOrder | null;
  pinnedFirst?: boolean;
};

export const defaultNotesSortOrder = noteSettings.defaultSortOrder as NotesSortOrder;
export const recentNotesSortOrder = noteSettings.recentSortOrder as NotesSortOrder;

export function normalizeNotesSortOrder(value?: string | null): NotesSortOrder {
  if (value === 'nameAsc' || value === 'nameDesc' || value === 'updatedAsc' || value === 'updatedDesc') {
    return value;
  }

  return defaultNotesSortOrder;
}

export function filterNotes(notes: Note[], filter: NotesFilter) {
  const query = filter.query?.trim().toLowerCase();
  const sortOrder = filter.sortOrder ?? null;

  return notes
    .filter((note) => {
      if (filter.mode === 'trash') {
        return note.isTrashed;
      }
      if (note.isTrashed) {
        return false;
      }
      if (filter.mode === 'favorites' && !note.isFavorite) {
        return false;
      }
      if (filter.tagId && !note.tagIds.includes(filter.tagId)) {
        return false;
      }
      if (filter.collectionId && note.collectionId !== filter.collectionId) {
        return false;
      }
      if (!query) {
        return true;
      }

      return stripInlineFormatting([note.title, note.content.intro, ...(note.content.summary?.map((block) => block.text) ?? [])].join(' '))
        .toLowerCase()
        .includes(query);
    })
    .sort((a, b) => compareNotes(a, b, filter.mode, sortOrder, Boolean(filter.pinnedFirst)));
}

function compareNotes(a: Note, b: Note, mode: NotesFilter['mode'], sortOrder: NotesSortOrder | null, pinnedFirst: boolean) {
  if (pinnedFirst && a.isPinned !== b.isPinned) {
    return a.isPinned ? -1 : 1;
  }

  if (!sortOrder && mode === 'recent') {
    return (b.lastOpenedAt ?? b.updatedAt).localeCompare(a.lastOpenedAt ?? a.updatedAt) || compareNoteTitles(a, b);
  }

  switch (sortOrder ?? defaultNotesSortOrder) {
    case 'nameAsc':
      return compareNoteTitles(a, b);
    case 'nameDesc':
      return compareNoteTitles(b, a);
    case 'updatedAsc':
      return a.updatedAt.localeCompare(b.updatedAt) || compareNoteTitles(a, b);
    case 'updatedDesc':
    default:
      return b.updatedAt.localeCompare(a.updatedAt) || compareNoteTitles(a, b);
  }
}

function compareNoteTitles(a: Pick<Note, 'title'>, b: Pick<Note, 'title'>) {
  return stripInlineFormatting(a.title).localeCompare(stripInlineFormatting(b.title), undefined, { numeric: true, sensitivity: 'base' });
}
