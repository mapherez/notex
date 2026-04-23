export type Locale = 'pt' | 'en';

export type ThemePreference = 'dark' | 'light';

export type PreferredLayout = 'list' | 'grid';

export type StartupPage = '/' | '/notes' | '/favorites' | '/recent' | '/collections' | '/profile';

export type NoteType = 'standard' | 'linguistic_doubt' | 'reference' | 'snippet';

export type SaveState = 'saved' | 'draft';

export type SyncStatus = 'local' | 'pending' | 'synced' | 'conflict';

export type RichTextBlock = {
  id: string;
  text: string;
};

export type UsageExample = {
  id: string;
  expression: string;
  meaning: string;
  example: string;
};

export type UsageExampleSection = {
  rows: UsageExample[];
};

export type CalloutBlock = {
  id: string;
  title: string;
  body: string;
};

export type RelatedLink = {
  id: string;
  title: string;
  href: string;
};

export type NoteStats = {
  wordCount: number;
  characterCount: number;
  readingTimeMinutes: number;
};

export type NoteThumbnail = {
  variant: 'purple' | 'paper' | 'terminal' | 'landscape' | 'book' | 'text';
};

export type Note = {
  id: string;
  type: NoteType;
  title: string;
  collectionId: string | null;
  tagIds: string[];
  linkedNoteIds: string[];
  isFavorite: boolean;
  isPinned: boolean;
  isArchived: boolean;
  isTrashed: boolean;
  saveState: SaveState;
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
  stats: NoteStats;
  relatedLinks?: RelatedLink[];
  thumbnail?: NoteThumbnail;
  version: number;
  syncStatus: SyncStatus;
};

export type TagColor =
  | 'blue'
  | 'green'
  | 'amber'
  | 'purple'
  | 'pink'
  | 'orange'
  | 'yellow'
  | 'neutral';

export type Tag = {
  id: string;
  name: string;
  color?: TagColor;
  count?: number;
};

export type Collection = {
  id: string;
  name: string;
  icon?: string;
  color?: TagColor;
};

export type User = {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  handle?: string;
};

export type UserSettings = {
  id: string;
  theme: ThemePreference;
  language: Locale;
  username: string;
  startupPage: StartupPage | string;
  preferredLayout: PreferredLayout;
  updatedAt: string;
};

export type ActivityItem = {
  id: string;
  noteId: string;
  label: string;
  time: string;
  createdAt: string;
};

export type NoteXExport = {
  version: 1;
  exportedAt: string;
  notes: Note[];
  tags: Tag[];
  collections: Collection[];
  userSettings: UserSettings;
};
