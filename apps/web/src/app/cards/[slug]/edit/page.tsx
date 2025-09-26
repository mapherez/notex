'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Head from 'next/head';
import { CardEditor } from '@notex/ui';
import { KnowledgeCardRepository, type KnowledgeCard, type UpdateKnowledgeCard, type CreateKnowledgeCard } from '@notex/database';
import { useSettings } from '@notex/ui';
import { createLocalizeFunction, loadLocale } from '@notex/config';
import type { Locale } from '@notex/types';
import { useAuth } from '@/lib/auth';

export default function EditCardPage() {
  const router = useRouter();
  const params = useParams();
  const cardSlug = (params.slug as string).replace('/edit', '');

  const [card, setCard] = useState<KnowledgeCard | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCard, setIsLoadingCard] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localize, setLocalize] = useState<((key: string, params?: Record<string, string | number>) => string) | null>(null);
  const { settings, loading: settingsLoading } = useSettings();
  const { user, profile, loading: authLoading } = useAuth();

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

  // Load the card data
  useEffect(() => {
    async function loadCard() {
      if (!cardSlug || !localize) return;

      try {
        setIsLoadingCard(true);
        setError(null);
        const loadedCard = await KnowledgeCardRepository.getBySlug(cardSlug);

        if (!loadedCard) {
          setError(localize('CARD_NOT_FOUND'));
          return;
        }

        setCard(loadedCard);
      } catch (err) {
        console.error('Error loading card:', err);
        setError(localize('CARD_ERROR', {
          error: err instanceof Error ? err.message : String(err)
        }));
      } finally {
        setIsLoadingCard(false);
      }
    }

    loadCard();
  }, [cardSlug, localize]);

  const handleSave = async (data: CreateKnowledgeCard | UpdateKnowledgeCard) => {
    if (!localize || !card) return;

    // Check if user is authenticated
    if (!user) {
      alert(localize('AUTH_REQUIRED', { action: localize('EDIT_CARD') }));
      return;
    }

    setIsLoading(true);
    try {
      // For editing, the data doesn't include id since it's passed separately
      const updateData = data as Omit<UpdateKnowledgeCard, 'id'>;
      const updatedCard = await KnowledgeCardRepository.update(card.id, updateData);
      // Navigate back to the card's detail page
      router.push(`/cards/${updatedCard.slug}`);
    } catch (error) {
      console.error('Failed to update card:', error);
      alert(localize('CARD_UPDATE_ERROR', {
        error: error instanceof Error ? error.message : String(error)
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  if (settingsLoading || !localize || authLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (isLoadingCard) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>{localize('LOADING')}</p>
      </div>
    );
  }

  if (error || !card) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>{localize('ERROR')}</h1>
        <p>{error || localize('CARD_NOT_FOUND')}</p>
        <button
          onClick={() => router.back()}
          style={{
            padding: '0.5rem 1rem',
            background: 'var(--primary)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {localize('GO_BACK')}
        </button>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{localize('EDIT_CARD')} - {card.title} - NoteX</title>
        <meta name="description" content={localize('EDIT_CARD_DESC', { title: card.title })} />
      </Head>
      <CardEditor
        card={card}
        onSave={handleSave}
        onCancel={handleCancel}
        isLoading={isLoading}
        userProfile={profile}
      />
    </>
  );
}