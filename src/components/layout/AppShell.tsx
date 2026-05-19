import { Outlet, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useI18n } from '../../i18n/I18nProvider';
import { useAppStore } from '../../store/useAppStore';

const searchRoutes = new Set(['/notes', '/favorites', '/recent', '/trash', '/collections', '/tags']);

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { t } = useI18n();
  const sidebarCollapsed = useAppStore((state) => state.settings.sidebarCollapsed);
  const showSearch = searchRoutes.has(location.pathname);
  const heading =
    location.pathname === '/'
      ? {
          title: t('dashboard.greeting'),
          subtitle: t('dashboard.subtitle'),
        }
      : undefined;

  return (
    <div className={sidebarCollapsed ? 'app-shell sidebar-collapsed' : 'app-shell'}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="main-shell">
        <TopBar heading={heading} showSearch={showSearch} onMenuClick={() => setSidebarOpen(true)} />
        <Outlet />
      </main>
    </div>
  );
}
