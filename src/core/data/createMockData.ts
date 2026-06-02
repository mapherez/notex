import { getLocaleValue } from '../../i18n/dictionaries';
import { defaultNoteThumbnailVariant, demoSettings, editorSettings } from '../../config/appSettings';
import type {
  ActivityItem,
  Collection,
  Note,
  NoteBlock,
  NoteFile,
  Locale,
  Tag,
  TiptapDocument,
  User,
} from '../models/models';

type LocalizedNoteCopy = {
  title: string;
  intro: string;
  summary: string[];
  explanation?: string[];
  usageExamples?: Array<{
    expression: string;
    meaning: string;
    example: string;
  }>;
  tip?: string;
  additionalExamples?: string[];
  relatedLinks?: string[];
};

type LocalizedMockData = {
  tags: Tag[];
  collections: Collection[];
  notes: {
    linguistic: LocalizedNoteCopy;
  };
  activities: Array<Pick<ActivityItem, 'noteId' | 'label' | 'time'>>;
};

export type MockDataBundle = {
  user: User;
  tags: Tag[];
  collections: Collection[];
  notes: Note[];
  noteBlocks: NoteBlock[];
  noteFiles: NoteFile[];
  activities: ActivityItem[];
};

const date = {
  createdPrimary: '2024-05-17T21:10:00.000Z',
  updatedPrimary: '2024-05-18T10:24:00.000Z',
};

export function createMockData(locale: Locale): MockDataBundle {
  const mock = getLocaleValue<LocalizedMockData>(locale, 'mock');
  const notesCopy = mock.notes;

  const user: User = {
    id: 'user-local',
    name: getLocaleValue<string>(locale, 'profile.localUser'),
  };

  const noteId = 'note-linguistic';
  const blocks = demoSettings.enabled ? createDefaultBlocks(noteId, notesCopy.linguistic, locale) : [];
  const notes: Note[] = demoSettings.enabled
    ? [
        {
          id: noteId,
          title: notesCopy.linguistic.title,
          subtitle: notesCopy.linguistic.intro,
          collectionId: 'collection-work',
          tagIds: ['tag-grammar', 'tag-doubt'],
          linkedNoteIds: [],
          additionalExamples: notesCopy.linguistic.additionalExamples ?? [],
          relatedLinks: (notesCopy.linguistic.relatedLinks ?? []).slice(0, 1).map((title) => ({
            id: 'related-1',
            title,
            href: '/notes?tag=tag-grammar',
          })),
          isFavorite: true,
          isPinned: false,
          isArchived: false,
          isTrashed: false,
          saveState: 'saved',
          authorId: user.id,
          createdAt: date.createdPrimary,
          updatedAt: date.updatedPrimary,
          lastOpenedAt: date.updatedPrimary,
          stats: statsFrom(notesCopy.linguistic, blocks),
          thumbnail: { variant: defaultNoteThumbnailVariant },
          version: 1,
          blocks,
          files: [],
        },
      ]
    : [];

  return {
    user,
    tags: demoSettings.enabled ? mock.tags.filter((tag) => demoSettings.defaultTagIds.includes(tag.id)) : [],
    collections: demoSettings.enabled ? mock.collections.filter((collection) => demoSettings.defaultCollectionIds.includes(collection.id)) : [],
    notes,
    noteBlocks: blocks,
    noteFiles: [],
    activities: demoSettings.enabled
      ? mock.activities.slice(0, 1).map((activity, index) => ({
          id: `activity-${index + 1}`,
          createdAt: date.updatedPrimary,
          ...activity,
        }))
      : [],
  };
}

function createDefaultBlocks(noteId: string, copy: LocalizedNoteCopy, locale: Locale): NoteBlock[] {
  const now = date.updatedPrimary;
  const blocks: Array<Omit<NoteBlock, 'id' | 'sortOrder'>> = [];

  if (copy.summary.length) {
    const text = copy.summary.join('\n\n');
    blocks.push(createBlock(noteId, now, 'Summary', paragraphsDocument(copy.summary), text));
  }

  if (copy.explanation?.length) {
    const text = copy.explanation.join('\n\n');
    blocks.push(createBlock(noteId, now, 'Explanation', paragraphsDocument(copy.explanation), text));
  }

  if (copy.usageExamples?.length) {
    blocks.push(
      createBlock(
        noteId,
        now,
        'Usage examples',
        tableDocument(
          ['Expression', 'Meaning', 'Example'],
          copy.usageExamples.map((row) => [row.expression, row.meaning, row.example]),
        ),
        copy.usageExamples.flatMap((row) => [row.expression, row.meaning, row.example]).join(' '),
      ),
    );
  }

  if (copy.tip) {
    const title = getLocaleValue<string>(locale, 'noteDetail.tip');
    blocks.push(createBlock(noteId, now, title, tipDocument(copy.tip), copy.tip));
  }

  return blocks.map((block, index) => ({
    ...block,
    id: `${noteId}-block-${index + 1}`,
    sortOrder: index,
  }));
}

function createBlock(
  noteId: string,
  now: string,
  title: string,
  contentJson: TiptapDocument,
  contentText: string,
): Omit<NoteBlock, 'id' | 'sortOrder'> {
  return {
    noteId,
    title,
    kind: 'content',
    contentJson,
    contentText,
    createdAt: now,
    updatedAt: now,
  };
}

function statsFrom(copy: LocalizedNoteCopy, blocks: NoteBlock[]) {
  const text = [
    copy.title,
    copy.intro,
    ...(copy.additionalExamples ?? []),
    ...(copy.relatedLinks ?? []),
    ...blocks.flatMap((block) => [block.title, block.contentText]),
  ].join(' ');
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  return {
    wordCount,
    characterCount: text.length,
    readingTimeMinutes: Math.max(1, Math.ceil(wordCount / editorSettings.readingWordsPerMinute)),
  };
}

function paragraphsDocument(lines: string[]): TiptapDocument {
  return {
    type: 'doc',
    content: lines.map((line) => ({ type: 'paragraph', content: textContent(line) })),
  };
}

function tipDocument(text: string): TiptapDocument {
  return {
    type: 'doc',
    content: [
      {
        type: 'noteTip',
        attrs: { title: 'Tip' },
        content: [{ type: 'paragraph', content: textContent(text) }],
      },
    ],
  };
}

function tableDocument(headers: string[], rows: string[][]): TiptapDocument {
  return {
    type: 'doc',
    content: [
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: headers.map((header) => ({ type: 'tableHeader', content: [{ type: 'paragraph', content: textContent(header) }] })),
          },
          ...rows.map((row) => ({
            type: 'tableRow',
            content: headers.map((_, index) => ({ type: 'tableCell', content: [{ type: 'paragraph', content: textContent(row[index] ?? '') }] })),
          })),
        ],
      },
    ],
  };
}

function textContent(text: string) {
  return text ? [{ type: 'text', text }] : undefined;
}
