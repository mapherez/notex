import settings from './settings.json';
import type { UserSettings } from '../core/models/models';

export type AppSettings = typeof settings;

export const appSettings: AppSettings = settings;
export const cloudSyncEnabled = settings.features.cloudSync;

export const defaultUserSettings: UserSettings = {
  id: 'local-user-settings',
  theme: settings.defaultSettings.theme as UserSettings['theme'],
  language: settings.defaultSettings.language as UserSettings['language'],
  username: settings.defaultSettings.username,
  startupPage: settings.defaultSettings.startupPage,
  preferredLayout: settings.defaultSettings.preferredLayout as UserSettings['preferredLayout'],
  primaryCollectionId: settings.defaultSettings.primaryCollectionId,
  favoriteTagIds: settings.defaultSettings.favoriteTagIds,
  quickPinNoteIds: settings.defaultSettings.quickPinNoteIds,
  updatedAt: new Date().toISOString(),
};
