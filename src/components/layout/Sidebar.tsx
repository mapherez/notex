import { getVersion } from '@tauri-apps/api/app';
import { isTauri } from '@tauri-apps/api/core';
import { useEffect, useState } from 'react';
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
} from 'lucide-react';
import clsx from 'clsx';
import { appSettings, navigationSettings } from '../../config/appSettings';
import { useI18n } from '../../i18n/I18nProvider';
import { useNotesStore } from '../../store/useNotesStore';
import { useKnowledgeStore } from '../../store/useKnowledgeStore';
import { latestPatchNoteVersion, PatchNotesModal } from '../ui/PatchNotesModal';

const navIcons = {
  clock: Clock3,
  fileText: FileText,
  home: Home,
  star: Star,
  tag: Tag,
  trash: Trash,
} as const;

export function Sidebar({ open, onClose, onCreateNote }: { open: boolean; onClose: () => void; onCreateNote: () => void }) {
  const { t } = useI18n();
  const [appVersion, setAppVersion] = useState(latestPatchNoteVersion);
  const [patchNotesOpen, setPatchNotesOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const collections = useKnowledgeStore((state) => state.collections);
  const hasTrashedNotes = useNotesStore((state) => state.notes.some((note) => note.isTrashed));
  const activeCollectionId = searchParams.get('collection');

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
            <img className="logo-image" src="/assets/notex_logo_small.webp" alt="" />
            <span>{appSettings.productName}</span>
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

        <nav className="sidebar-section" aria-label={t("navigation.notes")}>
          {navigationSettings.sidebarItems.map(({ to, labelKey, icon }) => {
            const Icon = to === "/trash" && hasTrashedNotes ? Trash2 : navIcons[icon as keyof typeof navIcons] ?? FileText;

            return (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  clsx("sidebar-nav-item", isActive && "active")
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
                "sidebar-nav-item",
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
        <nav className="sidebar-legal-links" aria-label={t('legal.navigationLabel')}>
          {navigationSettings.legalLinks.map((link) => (
            <NavLink className="sidebar-legal-link" key={link.to} to={link.to} onClick={onClose}>
              {t(link.labelKey)}
            </NavLink>
          ))}
        </nav>
        {appVersion ? (
          <button
            className="sidebar-version"
            type="button"
            aria-label={t('patchNotes.open', { version: appVersion })}
            onClick={() => setPatchNotesOpen(true)}
          >
            v{appVersion}
          </button>
        ) : null}
      </aside>
      <PatchNotesModal open={patchNotesOpen} onClose={() => setPatchNotesOpen(false)} />
    </>
  );
}

