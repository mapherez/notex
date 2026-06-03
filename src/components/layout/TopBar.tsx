import { ChevronDown, Menu, Moon, Sun, UserRound } from 'lucide-react';
import clsx from 'clsx';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchBox } from '../ui/SearchBox';
import { getNextTheme, getThemeIcon } from '../../core/theme/themeRegistry';
import { useClickOutside } from '../../core/utils/useClickOutside';
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
  const [accountOpen, setAccountOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const user = useKnowledgeStore((state) => state.user);
  const theme = useAppStore((state) => state.settings.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const ThemeIcon = getThemeIcon(theme) === 'sun' ? Sun : Moon;

  useClickOutside(actionsRef, accountOpen, () => {
    setAccountOpen(false);
  });

  return (
    <header className={clsx('topbar', showSearch && 'topbar--with-search')}>
      <button className="icon-button mobile-menu-button" type="button" aria-label={t('navigation.expand')} onClick={onMenuClick}>
        <Menu />
      </button>
      {showSearch ? (
        <div className="topbar__search-area">
          <SearchBox />
        </div>
      ) : (
        <span />
      )}
      <div className="topbar__actions" ref={actionsRef}>
        <button
          className="icon-button"
          type="button"
          aria-label={t('topbar.theme')}
          onClick={() => {
            setAccountOpen(false);
            void setTheme(getNextTheme(theme));
          }}
        >
          <ThemeIcon />
        </button>
        <button
          className="avatar-button"
          type="button"
          aria-label={t('topbar.account')}
          aria-expanded={accountOpen}
          onClick={() => {
            setAccountOpen((value) => !value);
          }}
        >
          <span className={user?.avatarUrl ? 'avatar' : 'avatar avatar-placeholder'}>
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />
            ) : (
              <UserRound strokeWidth={1.8} />
            )}
          </span>
          <ChevronDown className="topbar__account-chevron" />
        </button>
        {accountOpen ? (
          <div className="floating-menu topbar-menu account-menu">
            {user ? (
              <>
                <strong>{user?.name}</strong>
                <span className="menu-muted">{user?.email ?? t('profile.localAccount')}</span>
              </>
            ) : (
              <span className="menu-muted">{t('profile.localUser')}</span>
            )}
            <button
              type="button"
              onClick={() => {
                navigate('/profile');
                setAccountOpen(false);
              }}
            >
              {t('topbar.profile')}
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}

