'use client';

import React from 'react';
import { SettingsProvider } from '@notex/ui';

interface ClientSettingsProviderProps {
  children: React.ReactNode;
}

export function ClientSettingsProvider({ children }: ClientSettingsProviderProps) {
  return (
    <SettingsProvider>
      {children}
    </SettingsProvider>
  );
}