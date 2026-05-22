import { themeSettings } from '../../config/appSettings';

export type ThemeIconName = 'moon' | 'sun';

export type ThemeRegistryItem = {
  icon: ThemeIconName;
  id: string;
  labelKey: string;
};

export const themeRegistry = themeSettings.available as ThemeRegistryItem[];

export type ThemePreference = ThemeRegistryItem['id'];

export function getNextTheme(current: ThemePreference): ThemePreference {
  const currentIndex = themeRegistry.findIndex((theme) => theme.id === current);
  const nextTheme = themeRegistry[(currentIndex + 1) % themeRegistry.length];

  return nextTheme?.id ?? getDefaultTheme();
}

export function getThemeIcon(current: ThemePreference): ThemeIconName {
  return themeRegistry.find((theme) => theme.id === current)?.icon ?? 'moon';
}

export function getDefaultTheme(): ThemePreference {
  return themeSettings.default;
}
