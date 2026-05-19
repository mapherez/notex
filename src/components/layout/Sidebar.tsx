import { useRef, useState } from 'react';
import { NavLink, Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Archive,
  ChevronDown,
  ChevronsLeft,
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
import { appSettings } from '../../config/appSettings';
import { useClickOutside } from '../../core/utils/useClickOutside';
import { useI18n } from '../../i18n/I18nProvider';
import { useAppStore } from '../../store/useAppStore';
import { useKnowledgeStore } from '../../store/useKnowledgeStore';
import type { NoteType } from '../../core/models/models';

const navItems = [
  { to: '/', labelKey: 'navigation.home', icon: Home },
  { to: '/notes', labelKey: 'navigation.notes', icon: FileText },
  { to: '/favorites', labelKey: 'navigation.favorites', icon: Star },
  { to: '/recent', labelKey: 'navigation.recent', icon: Clock3 },
  { to: '/tags', labelKey: 'navigation.tags', icon: Tag },
  { to: '/trash', labelKey: 'navigation.trash', icon: Trash },
] as const;

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const [newNoteOpen, setNewNoteOpen] = useState(false);
  const newNoteRef = useRef<HTMLDivElement>(null);
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const settings = useAppStore((state) => state.settings);
  const setSidebarCollapsed = useAppStore((state) => state.setSidebarCollapsed);
  const collections = useKnowledgeStore((state) => state.collections);
  const hasTrashedNotes = useKnowledgeStore((state) => state.notes.some((note) => note.isTrashed));
  const activeCollectionId = searchParams.get('collection');

  useClickOutside(newNoteRef, newNoteOpen, () => setNewNoteOpen(false));

  function createNote(type: NoteType = 'standard') {
    setNewNoteOpen(false);
    onClose();
    navigate(`/notes/new?type=${type}&collection=${settings.primaryCollectionId}`);
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
      <aside
        className={clsx(
          "sidebar",
          open && "open",
          settings.sidebarCollapsed && "collapsed",
        )}
      >
        <div className="sidebar-header">
          <Link className="brand" to="/" onClick={onClose}>
            <img className="logo-image" src="/assets/notex-logo.svg" alt="" />
            <span>{appSettings.productName}</span>
          </Link>
          <button
            className="icon-button"
            type="button"
            aria-label={t("navigation.collapse")}
            onClick={() => void setSidebarCollapsed(!settings.sidebarCollapsed)}
          >
            <ChevronsLeft size={18} />
          </button>
        </div>

        <div className="primary-action">
          <button
            className="primary-action-main"
            type="button"
            onClick={() => createNote("standard")}
          >
            <Plus size={20} />
            {t("navigation.newNote")}
          </button>
        </div>

        <nav className="sidebar-section" aria-label={t("navigation.notes")}>
          {navItems.map(({ to, labelKey, icon }) => {
            const Icon = to === '/trash' && hasTrashedNotes ? Trash2 : icon;

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
                <Icon size={21} strokeWidth={1.8} />
                <span>{t(labelKey)}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-section">
          <div className="sidebar-section-title">
            <span>{t("navigation.collections")}</span>
            <button
              className="inline-icon-button"
              type="button"
              onClick={() => navigate("/collections")}
              aria-label={t("common.add")}
            >
              <Plus size={16} />
            </button>
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
              <Folder size={21} strokeWidth={1.8} />
              <span>{collection.name}</span>
            </Link>
          ))}
        </div>

        <div className="sidebar-spacer" />
      </aside>
    </>
  );
}
