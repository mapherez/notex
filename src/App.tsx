import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { ToastViewport } from './components/ui/ToastViewport';
import { I18nProvider } from './i18n/I18nProvider';
import { DashboardPage } from './pages/DashboardPage';
import { CollectionsPage, NotesListPage } from './pages/NotesListPage';
import { NoteDetailPage } from './pages/NoteDetailPage';
import { ProfilePage } from './pages/ProfilePage';
import { TagsPage } from './pages/TagsPage';
import { useAppStore } from './store/useAppStore';
import { useKnowledgeStore } from './store/useKnowledgeStore';

export function App() {
  const settings = useAppStore((state) => state.settings);
  const isHydrated = useAppStore((state) => state.isHydrated);
  const hydrateSettings = useAppStore((state) => state.hydrateSettings);
  const initialize = useKnowledgeStore((state) => state.initialize);
  const isReady = useKnowledgeStore((state) => state.isReady);

  useEffect(() => {
    void hydrateSettings();
  }, [hydrateSettings]);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.lang = settings.language;
  }, [settings.language, settings.theme]);

  useEffect(() => {
    if (isHydrated && !isReady) {
      void initialize(settings.language, settings);
    }
  }, [initialize, isHydrated, isReady, settings]);

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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        <ToastViewport />
      </BrowserRouter>
    </I18nProvider>
  );
}
