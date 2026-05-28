import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { CloudDataChoiceModal } from './components/sync/CloudDataChoiceModal';
import { SyncConflictReviewModal } from './components/sync/SyncConflictReviewModal';
import { AppUpdatePrompt } from './components/ui/AppUpdatePrompt';
import { ToastViewport } from './components/ui/ToastViewport';
import { cloudSyncEnabled } from './config/appSettings';
import { initializeStorage } from './core/services/storageBootstrap';
import { useSyncBootstrap } from './core/services/useSyncBootstrap';
import { I18nProvider } from './i18n/I18nProvider';
import { DashboardPage } from './pages/DashboardPage';
import { DynamicNoteDetailPage } from './pages/DynamicNoteDetailPage';
import { DynamicNotesListPage } from './pages/DynamicNotesListPage';
import { CollectionsPage, NotesListPage } from './pages/NotesListPage';
import { LegalPage } from './pages/LegalPage';
import { NoteDetailPage } from './pages/NoteDetailPage';
import { ProfilePage } from './pages/ProfilePage';
import { TagsPage } from './pages/TagsPage';
import { useAppStore } from './store/useAppStore';
import { useDynamicNotesStore } from './store/useDynamicNotesStore';
import { useKnowledgeStore } from './store/useKnowledgeStore';
import { useToastStore } from './store/useToastStore';

export function App() {
  const [isStorageReady, setIsStorageReady] = useState(false);
  const settings = useAppStore((state) => state.settings);
  const isHydrated = useAppStore((state) => state.isHydrated);
  const hydrateSettings = useAppStore((state) => state.hydrateSettings);
  const initialize = useKnowledgeStore((state) => state.initialize);
  const isReady = useKnowledgeStore((state) => state.isReady);
  const initializeDynamicNotes = useDynamicNotesStore((state) => state.initialize);
  const dynamicNotesReady = useDynamicNotesStore((state) => state.isReady);
  const pushToast = useToastStore((state) => state.pushToast);
  useSyncBootstrap(cloudSyncEnabled && isStorageReady && isHydrated && isReady);

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
    if (isStorageReady && isHydrated && !dynamicNotesReady) {
      void initializeDynamicNotes();
    }
  }, [dynamicNotesReady, initializeDynamicNotes, isHydrated, isStorageReady]);

  return (
    <I18nProvider locale={settings.language}>
      <BrowserRouter>
        <Routes>
            <Route element={<AppShell />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/notes" element={<DynamicNotesListPage mode="all" />} />
            <Route path="/notes/:id" element={<DynamicNoteDetailPage />} />
            <Route path="/classic-notes" element={<NotesListPage mode="all" />} />
            <Route path="/classic-notes/:id" element={<NoteDetailPage />} />
            <Route path="/favorites" element={<DynamicNotesListPage mode="favorites" />} />
            <Route path="/recent" element={<DynamicNotesListPage mode="recent" />} />
            <Route path="/tags" element={<TagsPage />} />
            <Route path="/trash" element={<DynamicNotesListPage mode="trash" />} />
            <Route path="/collections" element={<CollectionsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/privacy" element={<LegalPage kind="privacy" />} />
            <Route path="/terms" element={<LegalPage kind="terms" />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        {cloudSyncEnabled ? (
          <>
            <CloudDataChoiceModal />
            <SyncConflictReviewModal />
          </>
        ) : null}
        <AppUpdatePrompt enabled={isStorageReady && isHydrated && isReady && dynamicNotesReady} />
        <ToastViewport />
      </BrowserRouter>
    </I18nProvider>
  );
}
