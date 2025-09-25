'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { AppSettings } from '@notex/types'
import { getMarketSettings, getEnvironmentSettings, validateSettings } from '@notex/config'

interface SettingsContextType {
  settings: AppSettings
  market: string
  updateMarket: (newMarket: string) => void
  updateSettings: (newSettings: Partial<AppSettings>) => void
  loading: boolean
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

interface SettingsProviderProps {
  children: React.ReactNode
  defaultMarket?: string
}

export function SettingsProvider({ children, defaultMarket }: SettingsProviderProps) {
  const [settings, setSettings] = useState<AppSettings>({} as AppSettings)
  const [market, setMarket] = useState<string>('')
  const [loading, setLoading] = useState(true)

    // Initialize settings from environment or default market
  useEffect(() => {
    async function initializeSettings() {
      try {
        const env = getEnvironmentSettings()
        const initialMarket = defaultMarket || env.market || 'pt-PT'
        const initialSettings = await getMarketSettings(initialMarket)
        
        setMarket(initialMarket)
        setSettings(initialSettings)
      } catch (error) {
        console.error('Failed to initialize settings:', error)
        // Fallback to basic settings
        setMarket('pt-PT')
        setSettings({
          SETUP: {
            language: 'pt-PT',
            currency: 'EUR',
            timezone: 'Europe/Lisbon',
            theme: 'auto',
            gitHubPages: 'https://github.com/mapherez/notex',
            languages: ['pt-PT', 'en-US'],
          },
          UI: {
            cardLayout: 'grid',
            cardsPerPage: 12,
            showDescriptions: true,
            compactMode: false,
          },
          SEARCH: {
            enableFullText: true,
            highlightMatches: true,
            maxSuggestions: 8,
            debounceMs: 300,
          },
          EDITOR: {
            autoSave: true,
            autoSaveDelay: 2000,
            confirmDelete: true,
            enableMarkdown: true,
          },
        } as AppSettings)
      } finally {
        setLoading(false)
      }
    }

    initializeSettings()
  }, [defaultMarket])

  const updateMarket = useCallback(async (newMarket: string) => {
    try {
      const newSettings = await getMarketSettings(newMarket)
      setMarket(newMarket)
      setSettings(newSettings)
    } catch (error) {
      console.error('Failed to update market:', error)
    }
  }, [])

  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setSettings(current => {
      const merged = {
        ...current,
        SETUP: { ...current.SETUP, ...(newSettings.SETUP || {}) },
        UI: { ...current.UI, ...(newSettings.UI || {}) },
        SEARCH: { ...current.SEARCH, ...(newSettings.SEARCH || {}) },
        EDITOR: { ...current.EDITOR, ...(newSettings.EDITOR || {}) },
      }
      return validateSettings(merged)
    })
  }, [])

  const value: SettingsContextType = {
    settings,
    market,
    updateMarket,
    updateSettings,
    loading,
  }

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  )
}

/**
 * Hook to use settings throughout the application
 * @returns Settings context with current settings and update functions
 */
export function useSettings(): SettingsContextType {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}

export type { SettingsContextType }