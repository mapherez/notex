import { getLocaleValue } from '../../i18n/dictionaries';
import type {
  ActivityItem,
  Collection,
  Locale,
  Note,
  RichTextBlock,
  Tag,
  UsageExample,
  User,
} from '../models/models';

type LocalizedTag = Tag & { count: number };

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
  tagline?: string;
};

type LocalizedMockData = {
  user: Pick<User, 'name' | 'email' | 'handle'>;
  tags: LocalizedTag[];
  collections: Collection[];
  notes: {
    linguistic: LocalizedNoteCopy;
    projectRoadmap: LocalizedNoteCopy;
    productIdeas: LocalizedNoteCopy;
    terminalCommands: LocalizedNoteCopy;
    japanTrip: LocalizedNoteCopy;
    atomicHabits: LocalizedNoteCopy;
  };
  activities: Array<Pick<ActivityItem, 'noteId' | 'label' | 'time'>>;
};

export type MockDataBundle = {
  user: User;
  tags: Tag[];
  collections: Collection[];
  notes: Note[];
  activities: ActivityItem[];
};

const date = {
  createdPrimary: '2024-05-17T21:10:00.000Z',
  updatedPrimary: '2024-05-18T10:24:00.000Z',
  today: '2024-05-18T10:24:00.000Z',
  yesterdayEvening: '2024-05-17T18:45:00.000Z',
  yesterdayMorning: '2024-05-17T09:15:00.000Z',
  previous: '2024-05-16T14:30:00.000Z',
};

function blocks(lines: string[], prefix: string): RichTextBlock[] {
  return lines.map((text, index) => ({ id: `${prefix}-${index + 1}`, text }));
}

function rows(items: NonNullable<LocalizedNoteCopy['usageExamples']>, prefix: string): UsageExample[] {
  return items.map((item, index) => ({
    id: `${prefix}-${index + 1}`,
    ...item,
  }));
}

function statsFrom(copy: LocalizedNoteCopy) {
  const text = [
    copy.title,
    copy.intro,
    ...copy.summary,
    ...(copy.explanation ?? []),
    ...(copy.additionalExamples ?? []),
    copy.tip ?? '',
  ].join(' ');
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  return {
    wordCount,
    characterCount: text.length,
    readingTimeMinutes: Math.max(1, Math.ceil(wordCount / 180)),
  };
}

export function createMockData(locale: Locale): MockDataBundle {
  const mock = getLocaleValue<LocalizedMockData>(locale, 'mock');
  const notesCopy = mock.notes;

  const user: User = {
    id: 'user-local',
    ...mock.user,
  };

  const notes: Note[] = [
    {
      id: 'note-linguistic',
      type: 'linguistic_doubt',
      title: notesCopy.linguistic.title,
      collectionId: 'collection-studies',
      tagIds: ['tag-grammar', 'tag-portuguese', 'tag-doubt'],
      linkedNoteIds: ['note-terminal', 'note-atomic-habits'],
      isFavorite: true,
      isPinned: false,
      isArchived: false,
      isTrashed: false,
      saveState: 'saved',
      authorId: user.id,
      createdAt: date.createdPrimary,
      updatedAt: date.updatedPrimary,
      lastOpenedAt: date.updatedPrimary,
      content: {
        intro: notesCopy.linguistic.intro,
        summary: blocks(notesCopy.linguistic.summary, 'linguistic-summary'),
        explanation: blocks(notesCopy.linguistic.explanation ?? [], 'linguistic-explanation'),
        usageExamples: {
          rows: rows(notesCopy.linguistic.usageExamples ?? [], 'linguistic-row'),
        },
        tip: notesCopy.linguistic.tip
          ? {
              id: 'linguistic-tip',
              title: getLocaleValue(locale, 'noteDetail.tip'),
              body: notesCopy.linguistic.tip,
            }
          : null,
        additionalExamples: notesCopy.linguistic.additionalExamples,
      },
      stats: statsFrom(notesCopy.linguistic),
      relatedLinks: (notesCopy.linguistic.relatedLinks ?? []).map((title, index) => ({
        id: `related-${index + 1}`,
        title,
        href: index === 0 ? '/notes?tag=tag-grammar' : '/notes?tag=tag-portuguese',
      })),
      thumbnail: { variant: 'text' },
      version: 1,
      syncStatus: 'local',
    },
    createStandardNote({
      id: 'note-roadmap',
      copy: notesCopy.projectRoadmap,
      collectionId: 'collection-work',
      tagIds: ['tag-work', 'tag-productivity'],
      isFavorite: true,
      isPinned: true,
      createdAt: date.today,
      updatedAt: date.today,
      thumbnail: 'purple',
      userId: user.id,
    }),
    createStandardNote({
      id: 'note-product-ideas',
      copy: notesCopy.productIdeas,
      collectionId: 'collection-ideas',
      tagIds: ['tag-ideas'],
      createdAt: date.yesterdayEvening,
      updatedAt: date.yesterdayEvening,
      thumbnail: 'paper',
      userId: user.id,
    }),
    createStandardNote({
      id: 'note-terminal',
      copy: notesCopy.terminalCommands,
      collectionId: 'collection-studies',
      tagIds: ['tag-development', 'tag-study'],
      createdAt: date.yesterdayMorning,
      updatedAt: date.yesterdayMorning,
      thumbnail: 'terminal',
      userId: user.id,
    }),
    createStandardNote({
      id: 'note-japan',
      copy: notesCopy.japanTrip,
      collectionId: 'collection-personal',
      tagIds: ['tag-personal'],
      createdAt: date.previous,
      updatedAt: date.previous,
      thumbnail: 'landscape',
      userId: user.id,
    }),
    createStandardNote({
      id: 'note-atomic-habits',
      copy: notesCopy.atomicHabits,
      collectionId: 'collection-studies',
      tagIds: ['tag-study'],
      isFavorite: true,
      createdAt: date.createdPrimary,
      updatedAt: date.createdPrimary,
      thumbnail: 'book',
      userId: user.id,
    }),
  ];

  return {
    user,
    tags: mock.tags,
    collections: mock.collections,
    notes,
    activities: mock.activities.map((activity, index) => ({
      id: `activity-${index + 1}`,
      createdAt: index === 0 ? date.today : index === 1 ? date.yesterdayEvening : date.yesterdayMorning,
      ...activity,
    })),
  };
}

function createStandardNote({
  id,
  copy,
  collectionId,
  tagIds,
  createdAt,
  updatedAt,
  thumbnail,
  userId,
  isFavorite = false,
  isPinned = false,
}: {
  id: string;
  copy: LocalizedNoteCopy;
  collectionId: string;
  tagIds: string[];
  createdAt: string;
  updatedAt: string;
  thumbnail: NonNullable<Note['thumbnail']>['variant'];
  userId: string;
  isFavorite?: boolean;
  isPinned?: boolean;
}): Note {
  return {
    id,
    type: 'standard',
    title: copy.title,
    collectionId,
    tagIds,
    linkedNoteIds: [],
    isFavorite,
    isPinned,
    isArchived: false,
    isTrashed: false,
    saveState: 'saved',
    authorId: userId,
    createdAt,
    updatedAt,
    lastOpenedAt: updatedAt,
    content: {
      intro: copy.tagline ?? copy.intro,
      summary: blocks(copy.summary, `${id}-summary`),
      explanation: [],
      usageExamples: null,
      tip: null,
      additionalExamples: [],
    },
    stats: statsFrom(copy),
    relatedLinks: [],
    thumbnail: { variant: thumbnail },
    version: 1,
    syncStatus: 'local',
  };
}
