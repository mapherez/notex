'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button } from '@notex/ui';
import { KnowledgeCardRepository, type KnowledgeCard } from '@notex/database';
import { useSettings } from '@notex/ui';
import { createLocalizeFunction, loadLocale } from '@notex/config';
import type { Locale } from '@notex/types';
import { useSearchContext } from './AppLayout';

export function HomePageContent() {
  const router = useRouter();
  const [allCards, setAllCards] = useState<KnowledgeCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayCount, setDisplayCount] = useState(6);
  const [localize, setLocalize] = useState<((key: string, params?: Record<string, string | number>) => string) | null>(null);
  const { settings, loading: settingsLoading } = useSettings();
  const { searchQuery, filters } = useSearchContext();

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
        setLocalize(() => (key: string) => key);
      }
    }

    initializeLocalization();
  }, [settings?.SETUP?.language, settingsLoading]);

  // Fetch recent cards
  useEffect(() => {
    async function fetchRecentCards() {
      if (!localize) return;

      try {
        setLoading(true);
        setError(null);

        // Get recent cards (limit to a reasonable number initially)
        const recentCards = await KnowledgeCardRepository.list(
          { status: 'published' },
          50, // Fetch more than we need initially
          0
        );

        setAllCards(recentCards);
      } catch (err) {
        console.error('Error fetching recent cards:', err);
        setError(localize('ERROR_GENERIC'));
      } finally {
        setLoading(false);
      }
    }

    fetchRecentCards();
  }, [localize]);

  // Filter cards based on search query and filters
  const filteredCards = useMemo(() => {
    let filtered = allCards;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(card =>
        card.title.toLowerCase().includes(query) ||
        card.content?.summary?.toLowerCase().includes(query) ||
        card.category?.toLowerCase().includes(query) ||
        card.metadata?.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Filter by categories
    if (filters.categories && filters.categories.length > 0) {
      filtered = filtered.filter(card => filters.categories.includes(card.category));
    }

    // Filter by difficulty
    if (filters.difficulty && filters.difficulty.length > 0) {
      filtered = filtered.filter(card => 
        card.metadata?.difficulty && typeof card.metadata.difficulty === 'string' && 
        filters.difficulty.includes(card.metadata.difficulty)
      );
    }

    // Filter by tags
    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter(card =>
        card.metadata?.tags?.some(tag => filters.tags.includes(tag))
      );
    }

    // Filter by status
    if (filters.status && filters.status !== 'published') {
      filtered = filtered.filter(card => card.status === filters.status);
    }

    return filtered;
  }, [allCards, searchQuery, filters]);

  // Reset display count when filters change
  useEffect(() => {
    setDisplayCount(6);
  }, [searchQuery, filters]);

  const handleLoadMore = () => {
    setDisplayCount(prev => prev + 6);
  };

  const displayedCards = filteredCards.slice(0, displayCount);
  const hasMoreCards = filteredCards.length > displayCount;

  if (settingsLoading || !localize) {
    return (
      <div className="homepage-content">
        <div className="loading">{localize ? localize('HOMEPAGE_LOADING') : 'Loading...'}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="homepage-content">
        <div className="error">{error}</div>
      </div>
    );
  }

  return (
    <div className="homepage-content" data-content-type="text-heavy">
      {/* Recent Cards Section */}
      <div className="recent-cards">
        {loading ? (
          <div className="loading">{localize ? localize('HOMEPAGE_LOADING_CARDS') : 'Loading cards...'}</div>
        ) : filteredCards.length === 0 ? (
          <div className="no-cards">
            <p>{localize ? localize('HOMEPAGE_NO_CARDS') : 'No knowledge cards found. Create your first card to get started!'}</p>
          </div>
        ) : (
          <>
            <div className="placeholder-content">
              {displayedCards.map((card) => (
                <Card
                  key={card.id}
                  card={card}
                  onClick={() => {
                    router.push(`/cards/${card.slug}`);
                  }}
                />
              ))}
            </div>
            {hasMoreCards && (
              <div className="load-more-container">
                <Button
                  variant={settings?.HOMEPAGE?.buttons?.loadMore?.variant || 'secondary'}
                  size="large"
                  onClick={handleLoadMore}
                >
                  {localize(settings?.HOMEPAGE?.buttons?.loadMore?.labelKey || 'LOAD_MORE_CARDS')}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}