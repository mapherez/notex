import { NavLink, Link } from 'react-router-dom';
import {
  Archive,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  Clock3,
  FileText,
  Folder,
  Home,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';
import clsx from 'clsx';
import { appSettings } from '../../config/appSettings';
import { useI18n } from '../../i18n/I18nProvider';
import { useKnowledgeStore } from '../../store/useKnowledgeStore';

const navItems = [
  { to: '/', labelKey: 'navigation.home', icon: Home },
  { to: '/notes', labelKey: 'navigation.notes', icon: FileText },
  { to: '/favorites', labelKey: 'navigation.favorites', icon: Star },
  { to: '/recent', labelKey: 'navigation.recent', icon: Clock3 },
  { to: '/trash', labelKey: 'navigation.trash', icon: Trash2 },
] as const;

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const collections = useKnowledgeStore((state) => state.collections);
  const user = useKnowledgeStore((state) => state.user);

  return (
    <>
      {open ? <button className="sidebar-backdrop" type="button" aria-label={t('common.close')} onClick={onClose} /> : null}
      <aside className={clsx('sidebar', open && 'open')}>
        <div className="sidebar-header">
          <Link className="brand" to="/" onClick={onClose}>
            <span className="logo-mark">{appSettings.productName.charAt(0)}</span>
            <span>{appSettings.productName}</span>
          </Link>
          <button className="icon-button" type="button" aria-label={t('navigation.collapse')} onClick={onClose}>
            <ChevronsLeft size={18} />
          </button>
        </div>

        <button className="primary-action" type="button">
          <span className="primary-action-main">
            <Plus size={20} />
            {t('navigation.newNote')}
          </span>
          <span className="primary-action-side">
            <ChevronDown size={18} />
          </span>
        </button>

        <nav className="sidebar-section" aria-label={t('navigation.notes')}>
          {navItems.map(({ to, labelKey, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => clsx('nav-item', isActive && 'active')}
              onClick={onClose}
            >
              <Icon size={21} strokeWidth={1.8} />
              <span>{t(labelKey)}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-section">
          <div className="sidebar-section-title">
            <span>{t('navigation.collections')}</span>
            <Plus size={16} />
          </div>
          {collections.map((collection) => (
            <NavLink
              key={collection.id}
              to="/collections"
              className={clsx('nav-item', `collection-${collection.color ?? 'neutral'}`)}
              onClick={onClose}
            >
              <Folder size={21} strokeWidth={1.8} />
              <span>{collection.name}</span>
            </NavLink>
          ))}
          <NavLink to="/collections" className="nav-item" onClick={onClose}>
            <Archive size={20} strokeWidth={1.8} />
            <span>{t('navigation.seeMore')}</span>
            <ChevronDown size={16} />
          </NavLink>
        </div>

        <div className="sidebar-spacer" />

        <section className="storage-card" aria-label={t('navigation.storage')}>
          <div className="storage-title">{t('navigation.storage')}</div>
          <div className="storage-track">
            <span className="storage-bar" />
          </div>
          <div className="storage-meta">
            <span>{t('navigation.storagePercent')}</span>
            <span>
              {t('navigation.storageUsed')} {t('navigation.storageLimit')}
            </span>
          </div>
        </section>

        <Link className="user-footer" to="/profile" onClick={onClose}>
          <span className="avatar">{initials(user?.name)}</span>
          <span className="user-meta">
            <span className="user-name">{user?.name}</span>
            <span className="user-email">{user?.email}</span>
          </span>
          <ChevronRight size={17} />
        </Link>
      </aside>
    </>
  );
}

function initials(name?: string) {
  return (name ?? appSettings.productName)
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
