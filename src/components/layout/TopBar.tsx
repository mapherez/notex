import { ChevronDown, LogOut, Menu, Moon, Sun, UserRound } from 'lucide-react';
import clsx from 'clsx';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchBox } from '../ui/SearchBox';
import { useClickOutside } from '../../core/utils/useClickOutside';
import { useI18n } from '../../i18n/I18nProvider';
import { useAppStore } from '../../store/useAppStore';
import { useKnowledgeStore } from '../../store/useKnowledgeStore';
import { useSyncStore } from '../../store/useSyncStore';
import { useToastStore } from '../../store/useToastStore';

export function TopBar({
  heading,
  showSearch,
  onMenuClick,
}: {
  heading?: { title: string; subtitle: string };
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
  const syncState = useSyncStore((state) => state.syncState);
  const disconnectGoogle = useSyncStore((state) => state.disconnectGoogle);
  const pushToast = useToastStore((state) => state.pushToast);

  useClickOutside(actionsRef, accountOpen, () => {
    setAccountOpen(false);
  });

  return (
    <header className={clsx('topbar', showSearch && 'with-search')}>
      <button className="icon-button mobile-menu-button" type="button" aria-label={t('navigation.expand')} onClick={onMenuClick}>
        <Menu size={20} />
      </button>
      {showSearch ? (
        <div className="topbar-search-area">
          <SearchBox />
        </div>
      ) : heading ? (
        <div className="topbar-heading">
          <h1>{heading.title}</h1>
          <p>{heading.subtitle}</p>
        </div>
      ) : (
        <span />
      )}
      <div className="topbar-actions" ref={actionsRef}>
        <button
          className="icon-button"
          type="button"
          aria-label={t('topbar.theme')}
          onClick={() => {
            setAccountOpen(false);
            void setTheme(theme === 'dark' ? 'light' : 'dark');
          }}
        >
          {theme === 'dark' ? <Sun size={22} /> : <Moon size={22} />}
        </button>
        <button
          className="avatar-button"
          type="button"
          aria-label={t('topbar.account')}
          onClick={() => {
            setAccountOpen((value) => !value);
          }}
        >
          <span className={syncState?.connected && user?.avatarUrl ? 'avatar' : 'avatar avatar-placeholder'}>
            {syncState?.connected && user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />
            ) : (
              <UserRound size={20} strokeWidth={1.8} />
            )}
          </span>
          <ChevronDown size={18} color="var(--color-text-muted)" />
        </button>
        {accountOpen ? (
          <div className="floating-menu topbar-menu account-menu">
            {syncState?.connected ? (
              <>
                <strong>{user?.name}</strong>
                <span className="menu-muted">{syncState.email ?? user?.email}</span>
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
            {syncState?.connected ? (
              <button
                type="button"
                onClick={() => {
                  void disconnectGoogle().then(() => pushToast(t('sync.disconnected'), 'warning'));
                  setAccountOpen(false);
                }}
              >
                <LogOut size={16} />
                {t('profile.security.logout')}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}
