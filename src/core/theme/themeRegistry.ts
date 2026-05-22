export const themeRegistry = [
  {
    id: 'dark',
    labelKey: 'profile.preferences.dark',
    icon: 'sun',
  },
  {
    id: 'light',
    labelKey: 'profile.preferences.light',
    icon: 'moon',
  },
] as const;

export type ThemePreference = (typeof themeRegistry)[number]['id'];

export function getNextTheme(current: ThemePreference): ThemePreference {
  const currentIndex = themeRegistry.findIndex((theme) => theme.id === current);
  const nextTheme = themeRegistry[(currentIndex + 1) % themeRegistry.length];

  return nextTheme?.id ?? themeRegistry[0].id;
}
