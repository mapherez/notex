import { Outlet, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { navigationSettings } from '../../config/appSettings';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

const searchRoutes = new Set(navigationSettings.searchEnabledRoutes);

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const showSearch = searchRoutes.has(location.pathname) || location.pathname.startsWith('/notes/');

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="main-shell">
        <TopBar showSearch={showSearch} onMenuClick={() => setSidebarOpen(true)} />
        <Outlet />
      </main>
    </div>
  );
}
