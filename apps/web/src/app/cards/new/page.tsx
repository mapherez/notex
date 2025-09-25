'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Head from 'next/head';
import { CardEditor } from '@notex/ui';
import { KnowledgeCardRepository, type CreateKnowledgeCard, type UpdateKnowledgeCard } from '@notex/database';
import { useSettings } from '@notex/ui';
import { createLocalizeFunction, loadLocale } from '@notex/config';
import type { Locale } from '@notex/types';
import { useAuth } from '@/lib/auth';

export default function NewCardPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [localize, setLocalize] = useState<((key: string, params?: Record<string, string | number>) => string) | null>(null);
  const { settings, loading: settingsLoading } = useSettings();
  const { user, loading: authLoading } = useAuth();

  // Initialize localization
  React.useEffect(() => {
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

  const handleSave = async (data: CreateKnowledgeCard | UpdateKnowledgeCard) => {
    if (!localize) return;

    // Check if user is authenticated
    if (!user) {
      alert(localize('AUTH_REQUIRED', { action: localize('CREATE_CARD') }));
      return;
    }

    setIsLoading(true);
    try {
      // For new cards, ensure we have the required CreateKnowledgeCard fields
      const createData = data as CreateKnowledgeCard;
      const newCard = await KnowledgeCardRepository.create(createData);
      // Navigate to the new card's detail page
      router.push(`/cards/${newCard.slug}`);
    } catch (error) {
      console.error('Failed to create card:', error);
      alert(localize('CARD_CREATE_ERROR', {
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

  return (
    <>
      <Head>
        <title>{localize('CREATE_CARD')} - NoteX</title>
        <meta name="description" content={localize('CREATE_NEW_CARD_DESC')} />
      </Head>
      <CardEditor
        onSave={handleSave}
        onCancel={handleCancel}
        isLoading={isLoading}
      />
    </>
  );
}