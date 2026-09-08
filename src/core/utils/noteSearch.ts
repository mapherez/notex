import type { Collection, Note, Tag } from '../models/models';
import { stripInlineFormatting } from './inlineFormatting';
import { richTextToPlainText } from './richText';
import { sortTagsByName } from './tagSorting';

export type NoteSearchLocation = 'active' | 'trash' | 'all';

export type NoteSearchResult = {
  collectionName?: string;
  matchType: 'collection' | 'tag' | 'title';
  matchedTermCount: number;
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
  const queryTerms = tokenizeSearchQuery(query);
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
      const normalizedFields = searchableFields.map(normalizeSearchValue);
      const noteMatchedTerms = matchedTerms(normalizedFields, queryTerms);
      const matchedTags = queryTerms.length
        ? sortTagsByName(noteTags.filter((tag) => matchesAnyTerm(normalizeSearchValue(tag.name), queryTerms)))
        : [];
      const tagMatchedTerms = matchedTerms(matchedTags.map((tag) => normalizeSearchValue(tag.name)), queryTerms);
      const collectionMatchedTerms = collection
        ? matchedTerms([normalizeSearchValue(collection.name)], queryTerms)
        : [];
      const allMatchedTerms = new Set([...noteMatchedTerms, ...tagMatchedTerms, ...collectionMatchedTerms]);

      if (queryTerms.length && !allMatchedTerms.size) {
        return [];
      }

      return [
        {
          collectionName: collection?.name,
          matchType: !queryTerms.length || noteMatchedTerms.length ? 'title' : matchedTags.length ? 'tag' : 'collection',
          matchedTermCount: allMatchedTerms.size,
          note,
          snippet: createSearchSnippet(searchableFields, queryTerms),
          tagNames: matchedTags.length ? matchedTags.map((tag) => tag.name) : noteTags.map((tag) => tag.name),
        } satisfies NoteSearchResult,
      ];
    })
    .sort(
      (left, right) =>
        right.matchedTermCount - left.matchedTermCount ||
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

export function tokenizeSearchQuery(value: string) {
  const normalized = normalizeSearchValue(value);
  const words = normalized.match(/[\p{L}\p{N}]+(?:[+#.][\p{L}\p{N}+#.]*)*/gu);
  return [...new Set(words?.length ? words : normalized ? [normalized] : [])];
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

function matchedTerms(fields: string[], terms: string[]) {
  return terms.filter((term) => fields.some((field) => field.includes(term)));
}

function matchesAnyTerm(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

function createSearchSnippet(fields: string[], queryTerms: string[]) {
  const normalizedFields = fields.map((field) => normalizeWhitespace(field));
  const matched = queryTerms.length
    ? normalizedFields.find((field) => matchesAnyTerm(normalizeSearchValue(field), queryTerms))
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
