import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { AppUpdatePrompt } from './components/ui/AppUpdatePrompt';
import { ToastViewport } from './components/ui/ToastViewport';
import { initializeStorage } from './core/services/storageBootstrap';
import { I18nProvider } from './i18n/I18nProvider';
import { DashboardPage } from './pages/DashboardPage';
import { NoteDetailPage } from './pages/NoteDetailPage';
import { CollectionsPage, NotesListPage } from './pages/NotesListPage';
import { LegalPage } from './pages/LegalPage';
import { ProfilePage } from './pages/ProfilePage';
import { TagsPage } from './pages/TagsPage';
import { useAppStore } from './store/useAppStore';
import { useNotesStore } from './store/useNotesStore';
import { useKnowledgeStore } from './store/useKnowledgeStore';
import { useToastStore } from './store/useToastStore';

export function App() {
  const [isStorageReady, setIsStorageReady] = useState(false);
  const settings = useAppStore((state) => state.settings);
  const isHydrated = useAppStore((state) => state.isHydrated);
  const hydrateSettings = useAppStore((state) => state.hydrateSettings);
  const initialize = useKnowledgeStore((state) => state.initialize);
  const isReady = useKnowledgeStore((state) => state.isReady);
  const initializeNotes = useNotesStore((state) => state.initialize);
  const notesReady = useNotesStore((state) => state.isReady);
  const pushToast = useToastStore((state) => state.pushToast);

  useEffect(() => {
    let cancelled = false;

    void initializeStorage().then((result) => {
      if (cancelled) {
        return;
      }

      if (result.error) {
        pushToast('SQLite storage could not be initialized.', 'warning');
        console.warn(result.error);
      }

      setIsStorageReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [pushToast]);

  useEffect(() => {
    if (isStorageReady) {
      void hydrateSettings();
    }
  }, [hydrateSettings, isStorageReady]);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.lang = settings.language;
  }, [settings.language, settings.theme]);

  useEffect(() => {
    if (isStorageReady && isHydrated && !isReady) {
      void initialize(settings.language, settings);
    }
  }, [initialize, isHydrated, isReady, isStorageReady, settings]);

  useEffect(() => {
    if (isStorageReady && isHydrated && !notesReady) {
      void initializeNotes();
    }
  }, [notesReady, initializeNotes, isHydrated, isStorageReady]);

  return (
    <I18nProvider locale={settings.language}>
      <BrowserRouter>
        <Routes>
            <Route element={<AppShell />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/notes" element={<NotesListPage mode="all" />} />
            <Route path="/notes/:id" element={<NoteDetailPage />} />
            <Route path="/favorites" element={<NotesListPage mode="favorites" />} />
            <Route path="/recent" element={<NotesListPage mode="recent" />} />
            <Route path="/tags" element={<TagsPage />} />
            <Route path="/trash" element={<NotesListPage mode="trash" />} />
            <Route path="/collections" element={<CollectionsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/privacy" element={<LegalPage kind="privacy" />} />
            <Route path="/terms" element={<LegalPage kind="terms" />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        <AppUpdatePrompt enabled={isStorageReady && isHydrated && isReady && notesReady} />
        <ToastViewport />
      </BrowserRouter>
    </I18nProvider>
  );
}
