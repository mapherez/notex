import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthProvider } from '@/lib/auth';
import { ClientSettingsProvider } from '@/components/ClientSettingsProvider';
import { ThemeProvider } from '@notex/ui';
import type { Theme } from '@notex/ui';
import { AppLayout } from '@/components/AppLayout';
import defaultSettings from '@notex/config/src/settings/default.settings.json';
import '@/styles/globals.scss';

// Extract metadata from settings file
function getMetadataFromSettings(): Metadata {
  const metadata = defaultSettings.METADATA;
  return {
    title: metadata.title,
    description: metadata.description,
    keywords: metadata.keywords,
    authors: [{ name: metadata.author }],
    viewport: 'width=device-width, initial-scale=1',
    themeColor: [
      { media: '(prefers-color-scheme: light)', color: metadata.themeColor.light },
      { media: '(prefers-color-scheme: dark)', color: metadata.themeColor.dark },
    ],
  };
}

export const metadata: Metadata = getMetadataFromSettings();

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-PT" suppressHydrationWarning>
      <body>
        <AuthProvider>
          <ClientSettingsProvider>
            <ThemeProvider defaultTheme={defaultSettings.SETUP.theme as Theme}>
              <Suspense fallback={<div>Loading...</div>}>
                <AppLayout>
                  {children}
                </AppLayout>
              </Suspense>
            </ThemeProvider>
          </ClientSettingsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}