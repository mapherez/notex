import { Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { isPrimaryShortcut } from '../../core/utils/keyboardShortcuts';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    function handleGlobalShortcut(event: KeyboardEvent) {
      if (isPrimaryShortcut(event, 'n')) {
        event.preventDefault();
        navigate('/notes/new');
      }
    }

    window.addEventListener('keydown', handleGlobalShortcut);
    return () => window.removeEventListener('keydown', handleGlobalShortcut);
  }, [navigate]);

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="main-shell">
        <TopBar showSearch onMenuClick={() => setSidebarOpen(true)} />
        <Outlet />
      </main>
    </div>
  );
}
