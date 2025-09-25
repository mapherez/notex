'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSettings } from '@notex/ui';
import { KnowledgeCardRepository, type KnowledgeCard } from '@notex/database';
import { createLocalizeFunction, loadLocale } from '@notex/config';
import type { Locale } from '@notex/types';
import styles from '../app/cards/[slug]/page.module.scss';

export function CardDetailContent() {
  const router = useRouter();
  const pathname = usePathname();
  const slug = pathname.split('/cards/')[1];

  const [card, setCard] = useState<KnowledgeCard | null>(null);
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

  // Fetch card data
  useEffect(() => {
    async function fetchCard() {
      if (!localize || !slug) return;

      try {
        setLoading(true);
        setError(null);

        const fetchedCard = await KnowledgeCardRepository.getBySlug(slug);

        if (!fetchedCard) {
          setError(localize('CARD_NOT_FOUND'));
          return;
        }

        // Only show published cards
        if (fetchedCard.status !== 'published') {
          setError(localize('CARD_NOT_FOUND'));
          return;
        }

        setCard(fetchedCard);
      } catch (err) {
        console.error('Error fetching card:', err);
        setError(localize('CARD_ERROR', {
          error: err instanceof Error ? err.message : String(err)
        }));
      } finally {
        setLoading(false);
      }
    }

    fetchCard();
  }, [localize, slug]);

  if (settingsLoading || !localize) {
    return (
      <main className={styles.container}>
        <div className={styles.main}>
          <div className={styles.loading}>{settingsLoading ? 'Loading...' : 'Initializing...'}</div>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className={styles.container}>
        <div className={styles.main}>
          <h1>{localize('CARD_LOADING')}</h1>
          <div className={styles.loading}>{localize('LOADING')}</div>
        </div>
      </main>
    );
  }

  if (error || !card) {
    return (
      <main className={styles.container}>
        <div className={styles.main}>
          <h1>{localize('CARD_NOT_FOUND_TITLE')}</h1>
          <div className={styles.error}>{error || localize('CARD_NOT_FOUND')}</div>
          <button
            onClick={() => router.back()}
            className="button primary"
          >
            {localize('GO_BACK')}
          </button>
        </div>
      </main>
    );
  }

  const { title, category, content, metadata, created_at, updated_at } = card;

  // Parse content safely
  const summary = content?.summary || '';
  const body = content?.body || '';
  const examples = (content?.examples || []) as string[];
  const sources = (content?.sources || []) as string[];
  const difficulty = (metadata?.difficulty as string) || 'beginner';
  const tags = (metadata?.tags || []) as string[];

  // Format dates
  const createdDate = new Date(created_at).toLocaleDateString('pt-PT', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const updatedDate = new Date(updated_at).toLocaleDateString('pt-PT', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <main className={styles.container}>
      <div className={styles.main}>
        {/* Breadcrumb */}
        <nav className={styles.breadcrumb}>
          <button
            onClick={() => router.back()}
            className={styles.breadcrumbLink}
          >
            {localize('BACK')}
          </button>
          <span className={styles.breadcrumbSeparator}>›</span>
          <span className={styles.breadcrumbCurrent}>{title}</span>
        </nav>

        {/* Header */}
        <header className={styles.cardHeader}>
          <div className={styles.cardMeta}>
            <span className={`${styles.difficulty} ${styles[difficulty]}`}>{localize(difficulty.toUpperCase())}</span>
            <span className={styles.category}>{category}</span>
            <time dateTime={created_at} className={styles.date}>
              {localize('PUBLISHED_ON')} {createdDate}
            </time>
            {created_at !== updated_at && (
              <time dateTime={updated_at} className={styles.date}>
                {localize('UPDATED_ON')} {updatedDate}
              </time>
            )}
          </div>

          <h1 className={styles.cardTitle}>{title}</h1>

          {summary && (
            <p className={styles.cardSummary}>{summary}</p>
          )}
        </header>

        {/* Main Content */}
        <article className={styles.cardContent}>
          <div
            className={styles.cardBody}
            dangerouslySetInnerHTML={{ __html: body }}
          />

          {/* Examples */}
          {examples.length > 0 && (
            <section className={styles.cardExamples}>
              <h2>{localize('EXAMPLES')}</h2>
              <div className={styles.examplesList}>
                {examples.map((example, index) => (
                  <div key={index} className={styles.example}>
                    <code>{example}</code>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Sources */}
          {sources.length > 0 && (
            <section className={styles.cardSources}>
              <h2>{localize('SOURCES')}</h2>
              <ul className={styles.sourcesList}>
                {sources.map((source, index) => (
                  <li key={index}>
                    <a href={source} target="_blank" rel="noopener noreferrer">
                      {source}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>

        {/* Tags */}
        {tags.length > 0 && (
          <footer className={styles.cardFooter}>
            <div className={styles.tags}>
              {tags.map((tag, index) => (
                <span key={index} className={styles.tag}>
                  #{tag}
                </span>
              ))}
            </div>
          </footer>
        )}
      </div>
    </main>
  );
}