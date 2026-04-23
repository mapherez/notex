# Data Model

## Note

```ts
type Note = {
  id: string;
  type: 'standard' | 'linguistic_doubt' | 'reference' | 'snippet';
  title: string;

  collectionId: string | null;
  tagIds: string[];
  linkedNoteIds: string[];

  isFavorite: boolean;
  isPinned: boolean;
  isArchived: boolean;
  isTrashed: boolean;
  saveState: 'saved' | 'draft';

  authorId?: string | null;

  createdAt: string;
  updatedAt: string;
  lastOpenedAt?: string | null;

  content: {
    intro?: string;
    summary?: RichTextBlock[];
    explanation?: RichTextBlock[];
    usageExamples?: UsageExampleSection | null;
    tip?: CalloutBlock | null;
    additionalExamples?: string[];
  };

  stats: {
    wordCount: number;
    characterCount: number;
    readingTimeMinutes: number;
  };

  relatedLinks?: RelatedLink[];

  version: number;
  syncStatus: 'local' | 'pending' | 'synced' | 'conflict';
};
```

## Tag

```ts
type Tag = {
  id: string;
  name: string;
  color?: string;
};
```

## Collection

```ts
type Collection = {
  id: string;
  name: string;
  icon?: string;
  color?: string;
};
```

## User

```ts
type User = {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
};
```
