import { create } from 'zustand';
import { defaultUserSettings } from '../config/appSettings';
import { readUserSettings, writeUserSettings } from '../core/db/notexDb';
import type { Locale, PreferredLayout, ThemePreference, UserSettings } from '../core/models/models';

type AppStore = {
  settings: UserSettings;
  isHydrated: boolean;
  hydrateSettings: () => Promise<void>;
  setTheme: (theme: ThemePreference) => Promise<void>;
  setLanguage: (language: Locale) => Promise<void>;
  setPreferredLayout: (layout: PreferredLayout) => Promise<void>;
  setStartupPage: (startupPage: string) => Promise<void>;
  replaceSettings: (settings: UserSettings) => Promise<void>;
};

async function persist(settings: UserSettings) {
  await writeUserSettings({
    ...settings,
    updatedAt: new Date().toISOString(),
  });
}

export const useAppStore = create<AppStore>((set, get) => ({
  settings: defaultUserSettings,
  isHydrated: false,
  hydrateSettings: async () => {
    const stored = await readUserSettings(defaultUserSettings.id);
    set({
      settings: stored ?? defaultUserSettings,
      isHydrated: true,
    });
  },
  setTheme: async (theme) => {
    const settings = { ...get().settings, theme };
    set({ settings });
    await persist(settings);
  },
  setLanguage: async (language) => {
    const settings = { ...get().settings, language };
    set({ settings });
    await persist(settings);
  },
  setPreferredLayout: async (preferredLayout) => {
    const settings = { ...get().settings, preferredLayout };
    set({ settings });
    await persist(settings);
  },
  setStartupPage: async (startupPage) => {
    const settings = { ...get().settings, startupPage };
    set({ settings });
    await persist(settings);
  },
  replaceSettings: async (settings) => {
    set({ settings });
    await persist(settings);
  },
}));
