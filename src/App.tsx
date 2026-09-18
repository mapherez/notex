import { lazy, Suspense, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { AppUpdatePrompt } from './components/ui/AppUpdatePrompt';
import { ToastViewport } from './components/ui/ToastViewport';
import { CloudTransferBanner } from './components/ui/CloudTransferBanner';
import { isTauri } from '@tauri-apps/api/core';
import { GoogleAccountModal } from './components/profile/GoogleAccountModal';
import { DesktopBackupCloseGuard } from './components/ui/DesktopBackupCloseGuard';
import { useGoogleAccountStore } from './store/useGoogleAccountStore';
import { I18nProvider, useI18n } from './i18n/I18nProvider';
import { DashboardPage } from './pages/DashboardPage';
import { CollectionsPage, NotesListPage } from './pages/NotesListPage';
import { ProfilePage } from './pages/ProfilePage';
import { TagsPage } from './pages/TagsPage';
import { useAppStore } from './store/useAppStore';




const NoteDetailPage = lazy(() =>
  import('./pages/NoteDetailPage').then((module) => ({ default: module.NoteDetailPage })),
);

export function App() {
  const settings = useAppStore((state) => state.settings);
  const status = useGoogleAccountStore((state) => state.status);
  const initialize = useGoogleAccountStore((state) => state.initialize);
  const appReady = status === 'ready';
  useEffect(() => { void initialize(); }, [initialize]);
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.lang = settings.language;
  }, [settings.language, settings.theme]);
  useEffect(() => {
    if (appReady && isTauri()) void import('./store/useLocalMcpStore').then(({ useLocalMcpStore }) => useLocalMcpStore.getState().initialize());
  }, [appReady]);
  return (
    <I18nProvider locale={settings.language}>
      <BrowserRouter basename={isTauri() ? '/' : import.meta.env.BASE_URL}>
        {appReady ? (
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/notes" element={<NotesListPage mode="all" />} />
              <Route
                path="/notes/:id"
                element={
                  <Suspense fallback={<RouteLoadingFallback />}>
                    <NoteDetailPage />
                  </Suspense>
                }
              />
              <Route path="/favorites" element={<NotesListPage mode="favorites" />} />
              <Route path="/recent" element={<NotesListPage mode="recent" />} />
              <Route path="/tags" element={<TagsPage />} />
              <Route path="/trash" element={<NotesListPage mode="trash" />} />
              <Route path="/collections" element={<CollectionsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/privacy" element={<Navigate to="/?modal=privacy" replace />} />
              <Route path="/terms" element={<Navigate to="/?modal=terms" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        ) : (
          <AppLoadingScreen failed={status === 'error'} waitingForLogin={status === 'login-required'} />
        )}
        <GoogleAccountModal />
        <DesktopBackupCloseGuard />
        <div className="notification-viewport">
          <AppUpdatePrompt enabled={appReady && isTauri()} />
          <CloudTransferBanner />
          <ToastViewport />
        </div>
      </BrowserRouter>
    </I18nProvider>
  );
}

function AppLoadingScreen({ failed, waitingForLogin }: { failed: boolean; waitingForLogin: boolean }) {
  const { t } = useI18n();
  return (
    <div className={failed ? 'app-loading-screen app-loading-screen--failed' : 'app-loading-screen'}
      aria-busy={!failed && !waitingForLogin} aria-label="NoteX" role="status">
      {failed ? (
        <section className="app-modal choice-modal" aria-labelledby="storage-error-title">
          <h2 id="storage-error-title">NoteX</h2>
          <p>{t('google.storageError')}</p>
          <div className="choice-modal-actions">
            <button type="button" className="secondary-button" onClick={() => window.location.reload()}>
              <RotateCcw aria-hidden="true" />
              <span>{t('google.retry')}</span>
            </button>
          </div>
        </section>
      ) : (
        <div className="app-loading-screen__content">
          {!waitingForLogin && <span className="app-loading-screen__spinner" aria-hidden="true" />}
          <span className="app-loading-screen__label">NoteX</span>
        </div>
      )}
    </div>
  );
}

function RouteLoadingFallback() {
  return (
    <div className="page-content route-loading-screen" aria-busy="true" aria-label="Loading note" role="status">
      <span className="route-loading-screen__spinner" aria-hidden="true" />
    </div>
  );
}
