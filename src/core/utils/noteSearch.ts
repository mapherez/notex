import type { Collection, Note, Tag } from '../models/models';
import { stripInlineFormatting } from './inlineFormatting';
import { richTextToPlainText } from './richText';
import { sortTagsByName } from './tagSorting';

export type NoteSearchLocation = 'active' | 'trash' | 'all';

export type NoteSearchResult = {
  collectionName?: string;
  matchType: 'collection' | 'tag' | 'title';
  note: Note;
  snippet: string;
  tagNames: string[];
};

export function searchNotes({
  collections,
  limit,
  location = 'active',
  notes,
  query,
  tags,
}: {
  collections: Collection[];
  limit: number;
  location?: NoteSearchLocation;
  notes: Note[];
  query: string;
  tags: Tag[];
}): NoteSearchResult[] {
  const normalizedQuery = normalizeSearchValue(query);
  const tagById = new Map(tags.map((tag) => [tag.id, tag]));
  const collectionById = new Map(collections.map((collection) => [collection.id, collection]));

  return notes
    .flatMap((note) => {
      if (!matchesLocation(note, location)) {
        return [];
      }

      const noteTags = sortTagsByName(note.tagIds.flatMap((tagId) => tagById.get(tagId) ?? []));
      const collection = note.collectionId ? collectionById.get(note.collectionId) : undefined;
      const searchableFields = noteSearchableFields(note);
      const titleMatches =
        !normalizedQuery || normalizeSearchValue(searchableFields.join(' ')).includes(normalizedQuery);
      const matchedTags = normalizedQuery
        ? sortTagsByName(noteTags.filter((tag) => normalizeSearchValue(tag.name).includes(normalizedQuery)))
        : [];
      const collectionMatches = normalizedQuery && collection
        ? normalizeSearchValue(collection.name).includes(normalizedQuery)
        : false;

      if (!titleMatches && !matchedTags.length && !collectionMatches) {
        return [];
      }

      return [
        {
          collectionName: collection?.name,
          matchType: titleMatches ? 'title' : matchedTags.length ? 'tag' : 'collection',
          note,
          snippet: createSearchSnippet(searchableFields, normalizedQuery),
          tagNames: matchedTags.length ? matchedTags.map((tag) => tag.name) : noteTags.map((tag) => tag.name),
        } satisfies NoteSearchResult,
      ];
    })
    .sort(
      (left, right) =>
        searchResultScore(left) - searchResultScore(right) ||
        right.note.updatedAt.localeCompare(left.note.updatedAt) ||
        plainInlineText(left.note.title).localeCompare(plainInlineText(right.note.title), undefined, {
          numeric: true,
          sensitivity: 'base',
        }),
    )
    .slice(0, Math.max(0, Math.floor(limit)));
}

export function normalizeSearchValue(value: string) {
  return plainInlineText(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function plainInlineText(value: string | null | undefined) {
  return richTextToPlainText(stripInlineFormatting(value));
}

function matchesLocation(note: Note, location: NoteSearchLocation) {
  if (location === 'all') {
    return true;
  }
  return location === 'trash' ? note.isTrashed : !note.isTrashed;
}

function noteSearchableFields(note: Note) {
  return [
    plainInlineText(note.title),
    plainInlineText(note.subtitle),
    ...(note.blocks?.flatMap((block) => [plainInlineText(block.title), block.contentText]) ?? []),
  ];
}

function createSearchSnippet(fields: string[], normalizedQuery: string) {
  const normalizedFields = fields.map((field) => normalizeWhitespace(field));
  const matched = normalizedQuery
    ? normalizedFields.find((field) => normalizeSearchValue(field).includes(normalizedQuery))
    : normalizedFields.find((field, index) => index > 0 && Boolean(field));
  return truncateSnippet(matched ?? normalizedFields.find(Boolean) ?? '');
}

function truncateSnippet(value: string) {
  const maxLength = 240;
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 3).trimEnd()}...`;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function searchResultScore(result: NoteSearchResult) {
  if (result.matchType === 'title') {
    return 0;
  }
  if (result.matchType === 'tag') {
    return 1;
  }
  return 2;
}
