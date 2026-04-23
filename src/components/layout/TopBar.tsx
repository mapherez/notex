import { Bell, ChevronDown, Menu, Moon, Search, Sun } from 'lucide-react';
import clsx from 'clsx';
import { useI18n } from '../../i18n/I18nProvider';
import { useAppStore } from '../../store/useAppStore';
import { useKnowledgeStore } from '../../store/useKnowledgeStore';

export function TopBar({
  showSearch,
  onMenuClick,
}: {
  showSearch: boolean;
  onMenuClick: () => void;
}) {
  const { t } = useI18n();
  const user = useKnowledgeStore((state) => state.user);
  const theme = useAppStore((state) => state.settings.theme);
  const setTheme = useAppStore((state) => state.setTheme);

  return (
    <header className={clsx('topbar', showSearch && 'with-search')}>
      <button className="icon-button mobile-menu-button" type="button" aria-label={t('navigation.expand')} onClick={onMenuClick}>
        <Menu size={20} />
      </button>
      {showSearch ? (
        <label className="search-box">
          <Search size={19} />
          <input type="search" placeholder={t('topbar.searchPlaceholder')} />
          <span className="kbd">{t('topbar.keyboardHint')}</span>
        </label>
      ) : (
        <span />
      )}
      <div className="topbar-actions">
        <button
          className="icon-button"
          type="button"
          aria-label={t('topbar.theme')}
          onClick={() => void setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? <Sun size={22} /> : <Moon size={22} />}
        </button>
        <button className="icon-button notification-button" type="button" aria-label={t('topbar.notifications')}>
          <Bell size={22} />
          <span className="notification-badge">3</span>
        </button>
        <span className="avatar" aria-label={t('topbar.account')}>
          {initials(user?.name)}
        </span>
        <ChevronDown size={18} color="var(--color-text-muted)" />
      </div>
    </header>
  );
}

function initials(name?: string) {
  return (name ?? 'NX')
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
