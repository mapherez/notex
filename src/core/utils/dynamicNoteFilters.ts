import { noteSettings } from '../../config/appSettings';
import type { DynamicNote } from '../models/models';
import type { NotesSortOrder } from './noteFilters';
import { richTextToPlainText } from './richText';

export type DynamicNotesFilter = {
  mode: 'all' | 'favorites' | 'recent' | 'trash';
  query?: string | null;
  tagId?: string | null;
  collectionId?: string | null;
  sortOrder?: NotesSortOrder | null;
  pinnedFirst?: boolean;
};

export const defaultDynamicNotesSortOrder = noteSettings.defaultSortOrder as NotesSortOrder;
export const recentDynamicNotesSortOrder = noteSettings.recentSortOrder as NotesSortOrder;

export function filterDynamicNotes(notes: DynamicNote[], filter: DynamicNotesFilter) {
  const query = filter.query?.trim().toLowerCase();

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

      return [
        richTextToPlainText(note.title),
        richTextToPlainText(note.subtitle),
        ...(note.blocks?.flatMap((block) => [richTextToPlainText(block.title), block.contentText]) ?? []),
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);
    })
    .sort((a, b) => compareDynamicNotes(a, b, filter.mode, filter.sortOrder ?? null, Boolean(filter.pinnedFirst)));
}

function compareDynamicNotes(
  a: DynamicNote,
  b: DynamicNote,
  mode: DynamicNotesFilter['mode'],
  sortOrder: NotesSortOrder | null,
  pinnedFirst: boolean,
) {
  if (pinnedFirst && a.isPinned !== b.isPinned) {
    return a.isPinned ? -1 : 1;
  }

  if (!sortOrder && mode === 'recent') {
    return (b.lastOpenedAt ?? b.updatedAt).localeCompare(a.lastOpenedAt ?? a.updatedAt) || compareDynamicNoteTitles(a, b);
  }

  switch (sortOrder ?? defaultDynamicNotesSortOrder) {
    case 'nameAsc':
      return compareDynamicNoteTitles(a, b);
    case 'nameDesc':
      return compareDynamicNoteTitles(b, a);
    case 'updatedAsc':
      return a.updatedAt.localeCompare(b.updatedAt) || compareDynamicNoteTitles(a, b);
    case 'updatedDesc':
    default:
      return b.updatedAt.localeCompare(a.updatedAt) || compareDynamicNoteTitles(a, b);
  }
}

function compareDynamicNoteTitles(a: Pick<DynamicNote, 'title'>, b: Pick<DynamicNote, 'title'>) {
  return richTextToPlainText(a.title).localeCompare(richTextToPlainText(b.title), undefined, { numeric: true, sensitivity: 'base' });
}
