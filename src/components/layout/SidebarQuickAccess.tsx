import { ChevronDown, ChevronUp, Folder, Hash } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { useKnowledgeStore } from '../../store/useKnowledgeStore';
import { useI18n } from '../../i18n/I18nProvider';

export function SidebarQuickAccess({ onNavigate }: { onNavigate: () => void }) {
  const { t } = useI18n();
  const collections = useKnowledgeStore((state) => state.collections);
  const tags = useKnowledgeStore((state) => state.tags);
  const location = useLocation();
  const [params] = useSearchParams();
  const id = useId();
  const [expanded, setExpanded] = useState(() => {
    try { return localStorage.getItem('notex.quickAccess.expanded') !== 'false'; }
    catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem('notex.quickAccess.expanded', String(expanded)); }
    catch { /* The disclosure remains usable when browser preferences are unavailable. */ }
  }, [expanded]);
  const pinnedCollections = collections.filter((collection) => collection.isPinned === true);
  const pinnedTags = tags.filter((tag) => tag.isPinned === true);
  const Chevron = expanded ? ChevronUp : ChevronDown;

  return (
    <section className={clsx('sidebar-quick-access', expanded && 'is-expanded')} aria-label={t('quickAccess.title')}>
      <button className="nav-item sidebar-quick-access-toggle" type="button" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded((value) => !value)}>
        <span>{t('quickAccess.title')}</span>
        <Chevron aria-hidden="true" />
      </button>
      <div className="sidebar-quick-access-content" id={id} hidden={!expanded}>
        <nav className="sidebar-quick-access-group" aria-label={t('navigation.collections')}>
          <div className="sidebar-section-title">{t('navigation.collections')}</div>
          {pinnedCollections.length ? pinnedCollections.map((collection) => {
            const active = location.pathname === '/notes' && params.get('collection') === collection.id;
            return (
              <Link key={collection.id} to={`/notes?collection=${encodeURIComponent(collection.id)}`} className={clsx('nav-item', `collection-${collection.color ?? 'neutral'}`, active && 'active')} aria-current={active ? 'page' : undefined} onClick={onNavigate}>
                <Folder strokeWidth={1.8} />
                <span>{collection.name}</span>
              </Link>
            );
          }) : <p className="sidebar-quick-access-empty">{t('quickAccess.emptyCollections')}</p>}
        </nav>
        <nav className="sidebar-quick-access-group" aria-label={t('navigation.tags')}>
          <div className="sidebar-section-title">{t('navigation.tags')}</div>
          {pinnedTags.length ? pinnedTags.map((tag) => {
            const active = location.pathname === '/notes' && params.get('tag') === tag.id;
            return (
              <Link key={tag.id} to={`/notes?tag=${encodeURIComponent(tag.id)}`} className={clsx('nav-item', `collection-${tag.color ?? 'neutral'}`, active && 'active')} aria-current={active ? 'page' : undefined} onClick={onNavigate}>
                <Hash strokeWidth={1.8} />
                <span>{tag.name}</span>
              </Link>
            );
          }) : <p className="sidebar-quick-access-empty">{t('quickAccess.emptyTags')}</p>}
        </nav>
      </div>
    </section>
  );
}
