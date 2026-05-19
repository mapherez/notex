import { Outlet, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { getDisplayFirstName } from '../../core/utils/userProfile';
import { useI18n } from '../../i18n/I18nProvider';
import { useAppStore } from '../../store/useAppStore';
import { useKnowledgeStore } from '../../store/useKnowledgeStore';

const searchRoutes = new Set(['/notes', '/favorites', '/recent', '/trash', '/collections', '/tags', '/profile']);

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { t } = useI18n();
  const sidebarCollapsed = useAppStore((state) => state.settings.sidebarCollapsed);
  const user = useKnowledgeStore((state) => state.user);
  const showSearch = searchRoutes.has(location.pathname) || location.pathname.startsWith('/notes/');
  const heading =
    location.pathname === '/'
      ? {
          title: t('dashboard.greeting', { name: getDisplayFirstName(user) }),
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
