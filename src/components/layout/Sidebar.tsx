import { getVersion } from '@tauri-apps/api/app';
import { isTauri } from '@tauri-apps/api/core';
import { useEffect, useRef, useState } from 'react';
import { NavLink, Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Cloud,
  Clock3,
  FileText,
  Folder,
  Home,
  AlertTriangle,
  Plus,
  Star,
  Tag,
  Trash,
  Trash2,
} from 'lucide-react';
import clsx from 'clsx';
import { appSettings, cloudSyncEnabled, defaultNewNoteType, navigationSettings } from '../../config/appSettings';
import { useClickOutside } from '../../core/utils/useClickOutside';
import { useI18n } from '../../i18n/I18nProvider';
import { useAppStore } from '../../store/useAppStore';
import { useKnowledgeStore } from '../../store/useKnowledgeStore';
import { useSyncStore } from '../../store/useSyncStore';
import { useToastStore } from '../../store/useToastStore';
import type { NoteType } from '../../core/models/models';

const navIcons = {
  clock: Clock3,
  fileText: FileText,
  home: Home,
  star: Star,
  tag: Tag,
  trash: Trash,
} as const;

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const [newNoteOpen, setNewNoteOpen] = useState(false);
  const [appVersion, setAppVersion] = useState('');
  const newNoteRef = useRef<HTMLDivElement>(null);
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const settings = useAppStore((state) => state.settings);
  const collections = useKnowledgeStore((state) => state.collections);
  const hasTrashedNotes = useKnowledgeStore((state) => state.notes.some((note) => note.isTrashed));
  const syncState = useSyncStore((state) => state.syncState);
  const pendingCount = useSyncStore((state) => state.pendingCount);
  const conflictCount = useSyncStore((state) => state.conflictCount);
  const isConnecting = useSyncStore((state) => state.isConnecting);
  const isSyncing = useSyncStore((state) => state.isSyncing);
  const connectGoogle = useSyncStore((state) => state.connectGoogle);
  const openConflictReview = useSyncStore((state) => state.openConflictReview);
  const syncNow = useSyncStore((state) => state.syncNow);
  const pushToast = useToastStore((state) => state.pushToast);
  const activeCollectionId = searchParams.get('collection');

  useClickOutside(newNoteRef, newNoteOpen, () => setNewNoteOpen(false));

  useEffect(() => {
    if (!isTauri()) {
      return;
    }

    void getVersion()
      .then((version) => setAppVersion(version))
      .catch(() => setAppVersion(''));
  }, []);

  function createNote(type: NoteType = defaultNewNoteType) {
    setNewNoteOpen(false);
    onClose();
    navigate(`/notes/new?type=${type}&collection=${settings.primaryCollectionId}`);
  }

  function handleSyncClick() {
    if (conflictCount) {
      openConflictReview();
      return;
    }

    if (syncState?.connected) {
      void syncNow()
        .then(() => pushToast(t('sync.synced'), 'success'))
        .catch((error) => pushToast(error instanceof Error ? error.message : t('sync.failed'), 'warning'));
      return;
    }

    void connectGoogle()
      .then(() => pushToast(t('sync.connected'), 'success'))
      .catch((error) => pushToast(error instanceof Error ? error.message : t('sync.failed'), 'warning'));
  }

  return (
    <>
      {open ? (
        <button
          className="sidebar-backdrop"
          type="button"
          aria-label={t("common.close")}
          onClick={onClose}
        />
      ) : null}
      <aside className={clsx("sidebar", open && "open")}>
        <div className="sidebar-header">
          <Link className="brand" to="/" onClick={onClose}>
            <img className="logo-image" src="/assets/notex_logo.png" alt="" />
            <span>{appSettings.productName}</span>
          </Link>
        </div>

        <div className="primary-action">
          <button
            className="primary-action-main"
            type="button"
            onClick={() => createNote("standard")}
          >
            <Plus />
            {t("navigation.newNote")}
          </button>
        </div>

        <nav className="sidebar-section" aria-label={t("navigation.notes")}>
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

        <div className="sidebar-section">
          <div className="sidebar-section-title">
            <NavLink
              className={({ isActive }) =>
                clsx("sidebar-section-title-link", isActive && "active")
              }
              to="/collections"
              onClick={onClose}
            >
              <span>{t("navigation.collections")}</span>
              <Plus />
            </NavLink>
          </div>
          {collections.map((collection) => (
            <Link
              key={collection.id}
              to={`/notes?collection=${collection.id}`}
              className={clsx(
                "nav-item",
                `collection-${collection.color ?? "neutral"}`,
                location.pathname === "/notes" &&
                  activeCollectionId === collection.id &&
                  "active",
              )}
              onClick={onClose}
            >
              <Folder strokeWidth={1.8} />
              <span>{collection.name}</span>
            </Link>
          ))}
        </div>

        <div className="sidebar-spacer" />
        {cloudSyncEnabled ? (
          <button className="sidebar-sync-button" type="button" onClick={handleSyncClick}>
            <span className="sidebar-sync-icon">
              {conflictCount ? <AlertTriangle /> : <Cloud />}
              {pendingCount || conflictCount ? <span className="sidebar-sync-badge">{conflictCount || pendingCount}</span> : null}
            </span>
            <span>
              <span>{conflictCount ? t('sync.conflictReview') : syncState?.connected ? (isSyncing ? t('sync.syncing') : t('sync.syncNow')) : isConnecting ? t('sync.connecting') : t('sync.connect')}</span>
              <span className="sidebar-sync-sub">{conflictCount ? t('sync.conflictCount', { count: conflictCount }) : pendingCount ? t('sync.pendingCount', { count: pendingCount }) : syncState?.connected ? t('sync.upToDate') : t('sync.localOnly')}</span>
            </span>
          </button>
        ) : null}
        <nav className="sidebar-legal-links" aria-label={t('legal.navigationLabel')}>
          {navigationSettings.legalLinks.map((link) => (
            <NavLink className="sidebar-legal-link" key={link.to} to={link.to} onClick={onClose}>
              {t(link.labelKey)}
            </NavLink>
          ))}
        </nav>
        {appVersion ? <div className="sidebar-version">v{appVersion}</div> : null}
      </aside>
    </>
  );
}

