import type { ThemePreference } from '../theme/themeRegistry';

export type Locale = 'pt' | 'en';

export type { ThemePreference } from '../theme/themeRegistry';

export type PreferredLayout = 'list' | 'grid';

export type StartupPage = '/' | '/notes' | '/favorites' | '/recent' | '/tags' | '/collections' | '/profile';

export type NoteType = 'standard' | 'linguistic_doubt' | 'reference' | 'snippet';

export type SaveState = 'saved' | 'draft';

export type SyncStatus = 'local' | 'pending' | 'synced' | 'conflict';

export type SyncProvider = 'google-drive';

export type SyncEntityType = 'note' | 'workspace' | 'manifest';

export type SyncItemStatus = 'pending' | 'synced' | 'conflict' | 'deleted';

export type SyncConflictPayload = {
  detectedAt: string;
  baseHash?: string;
  localHash?: string;
  remoteHash?: string;
  localSnapshot?: Note | CloudWorkspaceFile | null;
  remoteSnapshot?: Note | CloudWorkspaceFile | null;
};

export type SyncConflictResolution = 'local' | 'remote' | 'duplicate' | 'manual';

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
  | 'red'
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
  firstName?: string;
  email?: string;
  avatarUrl?: string;
  handle?: string;
  googleSub?: string;
  provider?: 'local' | 'google';
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
  quickPinNoteIds: string[];
  updatedAt: string;
};

export type ActivityItem = {
  id: string;
  noteId: string;
  label: string;
  time: string;
  createdAt: string;
};

export type DeviceSession = {
  id: string;
  name: string;
  lastSeenAt: string;
  userAgent?: string;
};

export type SyncState = {
  id: SyncProvider;
  provider: SyncProvider;
  connected: boolean;
  googleSub?: string;
  email?: string;
  fullName?: string;
  firstName?: string;
  handle?: string;
  avatarUrl?: string;
  lastLoginAt?: string;
  lastSyncAt?: string;
  lastSyncStartedAt?: string;
  lastError?: string;
  deviceId: string;
  workspaceFileId?: string;
  manifestFileId?: string;
  updatedAt: string;
};

export type SyncItem = {
  entityKey: string;
  entityType: SyncEntityType;
  entityId: string;
  driveFileId?: string;
  baseHash?: string;
  localHash?: string;
  remoteHash?: string;
  remoteModifiedTime?: string;
  remoteVersion?: string;
  status: SyncItemStatus;
  conflict?: SyncConflictPayload;
  error?: string;
  deletedAt?: string;
  lastSyncedAt?: string;
  updatedAt: string;
};

export type CloudNoteFile = {
  schemaVersion: 1;
  exportedAt: string;
  note: Note;
};

export type CloudWorkspaceFile = {
  schemaVersion: 1;
  exportedAt: string;
  user?: User | null;
  userSettings: UserSettings;
  tags: Tag[];
  collections: Collection[];
  activities: ActivityItem[];
  sessions: DeviceSession[];
};

export type CloudManifestNote = {
  id: string;
  fileId?: string;
  hash: string;
  version: number;
  updatedAt: string;
  deletedAt?: string;
};

export type CloudManifestFile = {
  schemaVersion: 1;
  exportedAt: string;
  workspace?: {
    fileId: string;
    hash: string;
    updatedAt: string;
  };
  notes: CloudManifestNote[];
};

export type NewNoteInput = {
  type?: NoteType;
  title: string;
  intro: string;
  collectionId?: string | null;
  tagIds?: string[];
};
