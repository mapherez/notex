import type { ThemePreference } from '../theme/themeRegistry';

export type Locale = 'pt' | 'en';

export type { ThemePreference } from '../theme/themeRegistry';

export type PreferredLayout = 'list' | 'grid';

export type StartupPage = '/' | '/notes' | '/favorites' | '/recent' | '/tags' | '/collections' | '/profile';

export type SaveState = 'saved' | 'draft';

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
  variant: 'purple' | 'paper' | 'terminal' | 'landscape' | 'book' | 'text' | 'correct' | 'wrong';
};

export type TiptapDocument = {
  type: 'doc';
  content?: unknown[];
};

export type NoteBlockKind = 'title' | 'content';

export type NoteBlock = {
  id: string;
  noteId: string;
  sortOrder: number;
  title: string;
  kind: NoteBlockKind;
  contentJson: TiptapDocument | null;
  contentText: string;
  createdAt: string;
  updatedAt: string;
};

export type NoteFileKind = 'image' | 'attachment';

export type NoteFile = {
  id: string;
  noteId: string;
  blockId?: string | null;
  kind: NoteFileKind;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  relativePath: string;
  createdAt: string;
};

export type Note = {
  id: string;
  title: string;
  subtitle: string;
  collectionId: string | null;
  tagIds: string[];
  linkedNoteIds: string[];
  additionalExamples?: string[];
  relatedLinks?: RelatedLink[];
  isFavorite: boolean;
  isPinned: boolean;
  isArchived: boolean;
  isTrashed: boolean;
  saveState: SaveState;
  authorId?: string | null;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt?: string | null;
  stats: NoteStats;
  thumbnail?: NoteThumbnail;
  version: number;
  blocks?: NoteBlock[];
  files?: NoteFile[];
};

export type TagColor =
  | 'amber'
  | 'blue'
  | 'brown'
  | 'cyan'
  | 'fuchsia'
  | 'green'
  | 'indigo'
  | 'lime'
  | 'mint'
  | 'neutral'
  | 'orange'
  | 'pink'
  | 'purple'
  | 'red'
  | 'rose'
  | 'sky'
  | 'slate'
  | 'teal'
  | 'violet'
  | 'yellow';

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
  firstName?: string;
  email?: string;
  avatarUrl?: string;
  handle?: string;
  lastLoginAt?: string;
};

export type UserSettings = {
  id: string;
  theme: ThemePreference;
  language: Locale;
  username: string;
  startupPage: StartupPage | string;
  preferredLayout: PreferredLayout;
  primaryCollectionId: string;
  favoriteTagIds: string[];
  pinnedNoteIds: string[];
  quickPinNoteIds: string[];
  noteHiddenPanelIds?: string[];
  confirmNoteExport: boolean;
  updatedAt: string;
};

export type ActivityItem = {
  id: string;
  noteId: string;
  label: string;
  time: string;
  createdAt: string;
};
