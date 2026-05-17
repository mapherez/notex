import type { Note } from '../models/models';

export type NotesFilter = {
  mode: 'all' | 'favorites' | 'recent' | 'trash';
  query?: string | null;
  tagId?: string | null;
  collectionId?: string | null;
};

export function filterNotes(notes: Note[], filter: NotesFilter) {
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

      return [note.title, note.content.intro, ...(note.content.summary?.map((block) => block.text) ?? [])]
        .join(' ')
        .toLowerCase()
        .includes(query);
    })
    .sort((a, b) => {
      if (filter.mode === 'recent') {
        return (b.lastOpenedAt ?? b.updatedAt).localeCompare(a.lastOpenedAt ?? a.updatedAt);
      }
      return b.updatedAt.localeCompare(a.updatedAt);
    });
}
