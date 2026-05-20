import { create } from 'zustand';
import { defaultUserSettings } from '../config/appSettings';
import { db } from '../core/db/notexDb';
import { notifySyncQueued, queueWorkspaceSync, runLocalMutation } from '../core/services/syncQueue';
import type { Locale, PreferredLayout, ThemePreference, UserSettings } from '../core/models/models';

type AppStore = {
  settings: UserSettings;
  isHydrated: boolean;
  hydrateSettings: () => Promise<void>;
  setTheme: (theme: ThemePreference) => Promise<void>;
  setLanguage: (language: Locale) => Promise<void>;
  setPreferredLayout: (layout: PreferredLayout) => Promise<void>;
  setStartupPage: (startupPage: string) => Promise<void>;
  setPrimaryCollection: (primaryCollectionId: string) => Promise<void>;
  toggleFavoriteTag: (tagId: string) => Promise<void>;
  setQuickPinAt: (index: number, noteId: string | null) => Promise<void>;
  toggleQuickPin: (noteId: string) => Promise<void>;
  replaceSettings: (settings: UserSettings) => Promise<void>;
};

const maxQuickPins = 5;

async function persist(settings: UserSettings) {
  await runLocalMutation(() => db.transaction('rw', [db.userSettings, db.syncItems], async () => {
    await db.userSettings.put({
      ...settings,
      updatedAt: new Date().toISOString(),
    });
    await queueWorkspaceSync();
  }));
  notifySyncQueued();
}

function normalizeSettings(settings?: Partial<UserSettings> | null): UserSettings {
  const source = settings ?? {};

  return {
    ...defaultUserSettings,
    id: source.id ?? defaultUserSettings.id,
    theme: source.theme ?? defaultUserSettings.theme,
    language: source.language ?? defaultUserSettings.language,
    username: source.username ?? defaultUserSettings.username,
    startupPage: source.startupPage ?? defaultUserSettings.startupPage,
    preferredLayout: source.preferredLayout ?? defaultUserSettings.preferredLayout,
    primaryCollectionId: source.primaryCollectionId ?? defaultUserSettings.primaryCollectionId,
    favoriteTagIds: source.favoriteTagIds ?? defaultUserSettings.favoriteTagIds,
    quickPinNoteIds: source.quickPinNoteIds ?? defaultUserSettings.quickPinNoteIds,
    updatedAt: source.updatedAt ?? defaultUserSettings.updatedAt,
  };
}

async function updateSettings(set: (state: Partial<AppStore>) => void, next: UserSettings) {
  set({ settings: next });
  await persist(next);
}

export const useAppStore = create<AppStore>((set, get) => ({
  settings: defaultUserSettings,
  isHydrated: false,
  hydrateSettings: async () => {
    const stored = await db.userSettings.get(defaultUserSettings.id);
    set({
      settings: normalizeSettings(stored),
      isHydrated: true,
    });
  },
  setTheme: async (theme) => {
    const settings = { ...get().settings, theme };
    await updateSettings(set, settings);
  },
  setLanguage: async (language) => {
    const settings = { ...get().settings, language };
    await updateSettings(set, settings);
  },
  setPreferredLayout: async (preferredLayout) => {
    const settings = { ...get().settings, preferredLayout };
    await updateSettings(set, settings);
  },
  setStartupPage: async (startupPage) => {
    const settings = { ...get().settings, startupPage };
    await updateSettings(set, settings);
  },
  setPrimaryCollection: async (primaryCollectionId) => {
    const settings = { ...get().settings, primaryCollectionId };
    await updateSettings(set, settings);
  },
  toggleFavoriteTag: async (tagId) => {
    const current = get().settings.favoriteTagIds;
    const favoriteTagIds = current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId];
    const settings = { ...get().settings, favoriteTagIds };
    await updateSettings(set, settings);
  },
  setQuickPinAt: async (index, noteId) => {
    const nextSlots = [...get().settings.quickPinNoteIds.slice(0, maxQuickPins)];
    const normalizedIndex = Math.max(0, Math.min(maxQuickPins - 1, index));
    const dedupedSlots = noteId ? nextSlots.map((id) => (id === noteId ? '' : id)) : nextSlots;

    dedupedSlots[normalizedIndex] = noteId ?? '';
    const quickPinNoteIds = dedupedSlots.filter(Boolean).slice(0, maxQuickPins);
    const settings = { ...get().settings, quickPinNoteIds };
    await updateSettings(set, settings);
  },
  toggleQuickPin: async (noteId) => {
    const current = get().settings.quickPinNoteIds;
    const quickPinNoteIds = current.includes(noteId) ? current.filter((id) => id !== noteId) : [...current, noteId].slice(-maxQuickPins);
    const settings = { ...get().settings, quickPinNoteIds };
    await updateSettings(set, settings);
  },
  replaceSettings: async (settings) => {
    await updateSettings(set, normalizeSettings(settings));
  },
}));
