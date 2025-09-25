'use client';

import React from 'react';
import Head from 'next/head';
import { useSettings } from '@notex/ui';
import { CardDetailContent } from '../../../components/CardDetailContent';

export default function CardDetailPage() {
  const { settings, loading: settingsLoading } = useSettings();

  // Generate metadata for SEO
  const generateMetadata = () => {
    if (settingsLoading || !settings?.SETUP?.language) {
      return {
        title: 'NoteX - Knowledge Card',
        description: 'View knowledge card details',
      };
    }

    // This would ideally be done in a server component or with proper metadata API
    // For now, we'll use basic metadata
    return {
      title: 'NoteX - Knowledge Card',
      description: 'View knowledge card details',
    };
  };

  const metadata = generateMetadata();

  return (
    <>
      <Head>
        <title>{metadata.title}</title>
        <meta name="description" content={metadata.description} />
        <meta property="og:title" content={metadata.title} />
        <meta property="og:description" content={metadata.description} />
        <meta property="og:type" content="article" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={metadata.title} />
        <meta name="twitter:description" content={metadata.description} />
      </Head>
      <CardDetailContent />
    </>
  );
}