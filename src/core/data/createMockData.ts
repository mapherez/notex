import { getLocaleValue } from '../../i18n/dictionaries';
import { defaultNoteThumbnailVariant, demoSettings, editorSettings } from '../../config/appSettings';
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
  activities: ActivityItem[];
};

const date = {
  createdPrimary: '2024-05-17T21:10:00.000Z',
  updatedPrimary: '2024-05-18T10:24:00.000Z',
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
    readingTimeMinutes: Math.max(1, Math.ceil(wordCount / editorSettings.readingWordsPerMinute)),
  };
}

export function createMockData(locale: Locale): MockDataBundle {
  const mock = getLocaleValue<LocalizedMockData>(locale, 'mock');
  const notesCopy = mock.notes;

  const user: User = {
    id: 'user-local',
    provider: 'local',
    name: getLocaleValue<string>(locale, 'profile.localUser'),
  };

  const notes: Note[] = demoSettings.enabled ? [
    {
      id: 'note-linguistic',
      type: 'linguistic_doubt',
      title: notesCopy.linguistic.title,
      collectionId: 'collection-work',
      tagIds: ['tag-grammar', 'tag-doubt'],
      linkedNoteIds: [],
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
      relatedLinks: (notesCopy.linguistic.relatedLinks ?? []).slice(0, 1).map((title) => ({
        id: 'related-1',
        title,
        href: '/notes?tag=tag-grammar',
      })),
      thumbnail: { variant: defaultNoteThumbnailVariant },
      version: 1,
      syncStatus: 'local',
    },
  ] : [];

  return {
    user,
    tags: demoSettings.enabled ? mock.tags.filter((tag) => demoSettings.defaultTagIds.includes(tag.id)) : [],
    collections: demoSettings.enabled ? mock.collections.filter((collection) => demoSettings.defaultCollectionIds.includes(collection.id)) : [],
    notes,
    activities: demoSettings.enabled ? mock.activities.slice(0, 1).map((activity, index) => ({
      id: `activity-${index + 1}`,
      createdAt: date.updatedPrimary,
      ...activity,
    })) : [],
  };
}
