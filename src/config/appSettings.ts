import settings from './settings.json';
import type {
  NewNoteInput,
  NoteThumbnail,
  NoteType,
  StartupPage,
  TagColor,
  UserSettings,
} from '../core/models/models';

export type AppSettings = typeof settings;

export const appSettings: AppSettings = settings;
export const cloudSyncEnabled = settings.features.cloudSync;
export const appDefaults = settings.defaults;
export const themeSettings = settings.themes;
export const appLimits = settings.limits;
export const navigationSettings = settings.navigation;
export const noteSettings = settings.notes;
export const editorSettings = settings.editor;
export const demoSettings = settings.demo;
export const uiSettings = settings.ui;
export const updaterSettings = settings.updater;

export const tagColorOptions = settings.options.tagColors as TagColor[];
export const noteTypeOptions = settings.options.noteTypes as NoteType[];
export const thumbnailOptions = settings.options.thumbnailVariants as Array<{
  asset: string;
  id: NoteThumbnail['variant'];
}>;

export const defaultNewNoteType = noteSettings.defaultNewNoteType as NonNullable<NewNoteInput['type']>;
export const defaultNewTagColor = settings.defaults.newTagColor as TagColor;
export const defaultNewCollectionColor = settings.defaults.newCollectionColor as TagColor;
export const defaultNoteThumbnailVariant = settings.defaults.noteThumbnailVariant as NoteThumbnail['variant'];

const userSettingsDefaults = settings.defaults.userSettings;

export const defaultUserSettings: UserSettings = {
  id: 'local-user-settings',
  theme: userSettingsDefaults.theme as UserSettings['theme'],
  language: userSettingsDefaults.language as UserSettings['language'],
  username: userSettingsDefaults.username,
  startupPage: userSettingsDefaults.startupPage as StartupPage,
  preferredLayout: userSettingsDefaults.preferredLayout as UserSettings['preferredLayout'],
  primaryCollectionId: userSettingsDefaults.primaryCollectionId,
  favoriteTagIds: userSettingsDefaults.favoriteTagIds,
  pinnedNoteIds: userSettingsDefaults.pinnedNoteIds,
  quickPinNoteIds: userSettingsDefaults.quickPinNoteIds,
  dynamicNoteHiddenPanelIds: userSettingsDefaults.dynamicNoteHiddenPanelIds,
  updatedAt: new Date().toISOString(),
};
