import { AppSettings, RawMarketSettings, EnvironmentSettings } from '@notex/types'
import { deepMerge } from './utils/object'
import defaultSettings from './settings/default.settings.json'
import env from './settings/env.json'

// Get environment configuration
const envSettings = env as EnvironmentSettings;

// Dynamically import market settings based on environment
async function importMarketSettings(market: string): Promise<RawMarketSettings | null> {
  try {
    const module = await import(`./settings/market/${market}.settings.json`);
    return module.default;
  } catch (error) {
    console.warn(`No market settings found for ${market}:`, error);
    return null;
  }
}

// Market settings cache
const marketSettingsCache = new Map<string, Promise<RawMarketSettings | null>>();

// Get market settings with caching
function getMarketSettingsModule(market: string): Promise<RawMarketSettings | null> {
  if (!marketSettingsCache.has(market)) {
    marketSettingsCache.set(market, importMarketSettings(market));
  }
  return marketSettingsCache.get(market)!;
}

// Cache market settings for performance
const MARKET_SETTINGS = new Map<string, AppSettings>()

/**
 * Transform raw market settings to ensure proper structure
 * @param raw Raw market settings from JSON file
 * @returns Transformed settings with proper defaults
 */
function transformRawSettings(raw: RawMarketSettings): Partial<AppSettings> {
  return {
    SETUP: {
      ...raw.SETUP,
      // Ensure language is from env if not specified
      language: raw.SETUP?.language || envSettings.language,
    },
    UI: raw.UI || {},
    SEARCH: raw.SEARCH || {},
    EDITOR: raw.EDITOR || {},
  }
}

/**
 * Get settings for a specific market, applying deep merge strategy
 * @param market Market identifier (e.g., 'pt-PT', 'en-US')
 * @returns Complete settings object for the market
 */
export async function getMarketSettings(market: string): Promise<AppSettings> {
  // Check cache first
  const cached = MARKET_SETTINGS.get(market)
  if (cached) {
    return cached
  }

  // Load market-specific settings dynamically
  const rawSettings = await getMarketSettingsModule(market)

  // Start with default settings and env values
  const baseSettings = deepMerge(defaultSettings as AppSettings, {
    SETUP: { language: envSettings.language },
  })

  // If we have market-specific settings, merge them on top
  const settings = validateSettings(
    rawSettings
      ? deepMerge(baseSettings, transformRawSettings(rawSettings))
      : baseSettings
  )

  MARKET_SETTINGS.set(market, settings)
  return settings
}

/**
 * Validate settings object, ensuring all required fields have fallback values
 * @param settings Settings object to validate
 * @returns Validated settings with defaults for any missing values
 */
export function validateSettings(settings: AppSettings): AppSettings {
  // Return a new settings object with any invalid values replaced with
  // defaults, preserving unknown keys
  const defaults = defaultSettings as AppSettings

  return {
    ...settings,
    SETUP: {
      language: settings.SETUP?.language || envSettings.language,
      currency: settings.SETUP?.currency || defaults.SETUP.currency,
      timezone: settings.SETUP?.timezone || defaults.SETUP.timezone,
      theme: settings.SETUP?.theme || defaults.SETUP.theme,
      languages: settings.SETUP?.languages || [envSettings.language],
      gitHubPages: settings.SETUP?.gitHubPages || defaults.SETUP.gitHubPages,
    },
    UI: {
      cardLayout: settings.UI?.cardLayout || defaults.UI?.cardLayout || 'grid',
      cardsPerPage: settings.UI?.cardsPerPage || defaults.UI?.cardsPerPage || 12,
      showDescriptions:
        settings.UI?.showDescriptions ?? defaults.UI?.showDescriptions ?? true,
      compactMode: settings.UI?.compactMode ?? defaults.UI?.compactMode ?? false,
    },
    SEARCH: {
      enableFullText:
        settings.SEARCH?.enableFullText ?? defaults.SEARCH?.enableFullText ?? true,
      highlightMatches:
        settings.SEARCH?.highlightMatches ?? defaults.SEARCH?.highlightMatches ?? true,
      maxSuggestions:
        settings.SEARCH?.maxSuggestions || defaults.SEARCH?.maxSuggestions || 8,
      debounceMs: settings.SEARCH?.debounceMs || defaults.SEARCH?.debounceMs || 300,
    },
    EDITOR: {
      autoSave: settings.EDITOR?.autoSave ?? defaults.EDITOR?.autoSave ?? true,
      autoSaveDelay:
        settings.EDITOR?.autoSaveDelay || defaults.EDITOR?.autoSaveDelay || 2000,
      confirmDelete:
        settings.EDITOR?.confirmDelete ?? defaults.EDITOR?.confirmDelete ?? true,
      enableMarkdown:
        settings.EDITOR?.enableMarkdown ?? defaults.EDITOR?.enableMarkdown ?? true,
    },
  }
}

/**
 * Get current environment settings
 * @returns Environment configuration
 */
export function getEnvironmentSettings(): EnvironmentSettings {
  return envSettings
}

/**
 * Get settings for the current environment's default market
 * @returns Settings for the environment's configured market
 */
export async function getCurrentMarketSettings(): Promise<AppSettings> {
  return getMarketSettings(envSettings.market);
}

/**
 * Clear the settings cache (useful for testing or hot reloading)
 */
export function clearSettingsCache(): void {
  MARKET_SETTINGS.clear()
}

export type { AppSettings, RawMarketSettings, EnvironmentSettings }