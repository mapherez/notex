import { getVersion } from '@tauri-apps/api/app';
import { isTauri } from '@tauri-apps/api/core';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { NavLink, Link, useLocation, useSearchParams } from 'react-router-dom';
import {
  Clock3,
  FileText,
  Folder,
  Home,
  Plus,
  Star,
  Tag,
  Trash,
  Trash2,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { navigationSettings } from '../../config/appSettings';
import { BrandMark, BrandName } from '../ui/Brand';
import { useI18n } from '../../i18n/I18nProvider';
import { useNotesStore } from '../../store/useNotesStore';
import { SidebarQuickAccess } from './SidebarQuickAccess';
import { useLocalMcpStore } from '../../store/useLocalMcpStore';
import { latestPatchNoteVersion, PatchNotesModal } from '../ui/PatchNotesModal';
import { useSidebarDrawer } from '../../core/utils/useSidebarDrawer';
import { useDrawerSwipe } from '../../core/utils/useDrawerSwipe';

const navIcons = {
  clock: Clock3,
  fileText: FileText,
  folder: Folder,
  home: Home,
  star: Star,
  tag: Tag,
  trash: Trash,
} as const;

export function Sidebar({ open, onClose, onCreateNote, backgroundRef, triggerRef }: {
  open: boolean;
  onClose: () => void;
  onCreateNote: () => void;
  backgroundRef: RefObject<HTMLElement>;
  triggerRef: RefObject<HTMLButtonElement>;
}) {
  const { t } = useI18n();
  const { compact, sidebarRef } = useSidebarDrawer(open, onClose, backgroundRef, triggerRef);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const { dismiss } = useDrawerSwipe({ compact, open, onClose, scrollerRef, sheetRef: sidebarRef, side: 'left' });
  const [appVersion, setAppVersion] = useState(latestPatchNoteVersion);
  const [patchNotesOpen, setPatchNotesOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const hasTrashedNotes = useNotesStore((state) => state.notes.some((note) => note.isTrashed));
  const mcpOnline = useLocalMcpStore(
    (state) => state.connection.state === 'running' && state.connection.rendererReady,
  );

  useEffect(() => {
    if (!isTauri()) {
      return;
    }

    void getVersion()
      .then((version) => setAppVersion(version))
      .catch(() => setAppVersion(latestPatchNoteVersion));
  }, []);

  function createNote() {
    onClose();
    onCreateNote();
  }

  function openMcpProfile() {
    onClose();
    if (location.pathname === '/profile' && location.hash === '#mcp') {
      window.requestAnimationFrame(() => {
        document.getElementById('mcp')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
  }

  return (
    <>
      <div className={clsx('sidebar-drawer', compact && open && 'is-open')} aria-hidden={compact && !open || undefined}>
      {compact && open ? (
        <button
          className="sidebar-backdrop"
          type="button"
          aria-label={t("common.close")}
          tabIndex={-1}
          onClick={dismiss}
        />
      ) : null}
      <div ref={scrollerRef} className="sidebar-drawer-scroller" onClick={(event) => {
        if (compact && !sidebarRef.current?.contains(event.target as Node)) dismiss();
      }}>
      <aside
        id="app-sidebar"
        ref={sidebarRef}
        className={clsx("sidebar", open && "open")}
        role={compact ? 'dialog' : undefined}
        aria-modal={compact && open ? true : undefined}
        aria-label={t('navigation.notes')}
      >
        <div className="sidebar-content">
        <div className="sidebar-header">
          <button className="icon-button sidebar-close" type="button" aria-label={t('common.close')} onClick={dismiss}>
            <X />
          </button>
          <Link className="brand" to="/" onClick={onClose}>
            <BrandMark className="logo-image" />
            <BrandName />
          </Link>
        </div>

        <div className="primary-action">
          <button
            className="primary-action-main"
            type="button"
            onClick={createNote}
          >
            <Plus />
            {t("navigation.newNote")}
          </button>
        </div>

        <nav className="sidebar-section sidebar-main-nav" aria-label={t("navigation.notes")}>
          {navigationSettings.sidebarItems.map(({ to, labelKey, icon }) => {
            const Icon = to === "/trash" && hasTrashedNotes ? Trash2 : navIcons[icon as keyof typeof navIcons] ?? FileText;

            return (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  clsx("nav-item", isActive && "active")
                }
                onClick={onClose}
              >
                <Icon strokeWidth={1.8} />
                <span>{t(labelKey)}</span>
              </NavLink>
            );
          })}
        </nav>

        <hr className="sidebar-quick-access-separator" />
        <SidebarQuickAccess onNavigate={onClose} />
        </div>

        <footer className="sidebar-footer">
        <nav className="sidebar-legal-links" aria-label={t('legal.navigationLabel')}>
          {navigationSettings.legalLinks.map((link) => (
            <Link
              className={clsx('sidebar-legal-link', searchParams.get('modal') === link.modal && 'active')}
              key={link.modal}
              to={{
                pathname: location.pathname,
                search: buildLegalModalSearch(location.search, link.modal),
              }}
              onClick={onClose}
            >
              {t(link.labelKey)}
            </Link>
          ))}
        </nav>
        <div className="sidebar-runtime-status">
          {appVersion ? (
            <button
              className="sidebar-version"
              type="button"
              aria-label={t('patchNotes.open', { version: appVersion })}
              onClick={() => {
                onClose();
                setPatchNotesOpen(true);
              }}
            >
              v{appVersion}
            </button>
          ) : null}
          {isTauri() && <Link
            className={mcpOnline ? 'sidebar-mcp-status sidebar-mcp-status--online' : 'sidebar-mcp-status'}
            to="/profile#mcp"
            aria-label={t('profile.mcp.openSection', {
              status: t(mcpOnline ? 'profile.mcp.online' : 'profile.mcp.offline'),
            })}
            onClick={openMcpProfile}
          >
            <span className="sidebar-mcp-status__dot" aria-hidden="true" />
            {t(mcpOnline ? 'profile.mcp.online' : 'profile.mcp.offline')}
          </Link>}
        </div>
        </footer>
      </aside>
      {compact && <div className="sidebar-drawer-spacer" aria-hidden="true" />}
      </div>
      </div>
      <PatchNotesModal open={patchNotesOpen} onClose={() => setPatchNotesOpen(false)} />
    </>
  );
}

function buildLegalModalSearch(currentSearch: string, modal: string) {
  const searchParams = new URLSearchParams(currentSearch);
  searchParams.set('modal', modal);
  return `?${searchParams.toString()}`;
}

