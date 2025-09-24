'use client';

import React, { useEffect, useState } from 'react';
import { Card, useSettings } from '@notex/ui';
import { KnowledgeCardRepository, type KnowledgeCard } from '@notex/database';
import { createLocalizeFunction, loadLocale } from '@notex/config';
import type { Locale } from '@notex/types';

function CardsPageContent() {
  const [cards, setCards] = useState<KnowledgeCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localize, setLocalize] = useState<((key: string, params?: Record<string, string | number>) => string) | null>(null);
  const { settings, loading: settingsLoading } = useSettings();

  // Initialize localization
  useEffect(() => {
    async function initializeLocalization() {
      if (!settings?.SETUP?.language || settingsLoading) return;

      try {
        await loadLocale(settings.SETUP.language as Locale);
        const { localize: localizeFunc } = createLocalizeFunction(settings.SETUP.language as Locale);
        setLocalize(() => localizeFunc);
      } catch (error) {
        console.error('Failed to load locale:', error);
        // Fallback to identity function
        setLocalize(() => (key: string) => key);
      }
    }

    initializeLocalization();
  }, [settings?.SETUP?.language, settingsLoading]);

  useEffect(() => {
    async function fetchCards() {
      if (!localize) return; // Wait for localization to be ready

      try {
        setLoading(true);
        setError(null);
        
        // Fetch all published cards
        const fetchedCards = await KnowledgeCardRepository.list({
          status: 'published'
        }, 20);
        
        setCards(fetchedCards);
      } catch (err) {
        console.error('Error fetching cards:', err);
        console.error('Error details:', err instanceof Error ? err.message : String(err));
        setError(localize('CARDS_ERROR', { error: err instanceof Error ? err.message : String(err) }));
      } finally {
        setLoading(false);
      }
    }

    fetchCards();
  }, [localize]);

  if (settingsLoading || !localize) {
    return (
      <main className="container">
        <div className="main">
          <div className="loading">{settingsLoading ? 'Loading...' : 'Initializing...'}</div>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="container">
        <div className="main">
          <h1>{localize('CARDS_PAGE_TITLE')}</h1>
          <div className="loading">{localize('CARDS_LOADING')}</div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="container">
        <div className="main">
          <h1>{localize('CARDS_PAGE_TITLE')}</h1>
          <div className="error">{error}</div>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="main">
        <h1>{localize('CARDS_PAGE_TITLE')}</h1>
        <p>{localize('CARDS_PAGE_DESCRIPTION')}</p>
        
        {cards.length === 0 ? (
          <div className="error">{localize('CARDS_NO_RESULTS')}</div>
        ) : (
          <div className="cards-grid">
            {cards.map((card) => (
              <Card
                key={card.id}
                card={card}
                onClick={() => {
                  // TODO: Navigate to card detail page
                  console.log('Clicked card:', card.slug);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default function CardsPage() {
  return <CardsPageContent />;
}