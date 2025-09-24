import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/auth';
import { ClientSettingsProvider } from '@/components/ClientSettingsProvider';
import '@/styles/globals.scss';

// TODO: Static metadata - will be enhanced with dynamic settings in the future
export const metadata: Metadata = {
  title: 'NoteX - Knowledge Management',
  description: 'Modern knowledge management system with accessibility and i18n built-in',
  keywords: ['knowledge management', 'notes', 'accessibility', 'i18n'],
  authors: [{ name: 'mapherez' }],
  viewport: 'width=device-width, initial-scale=1',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
};

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
            <div id="root">
              {children}
            </div>
          </ClientSettingsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}