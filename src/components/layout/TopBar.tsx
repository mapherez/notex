import { ChevronDown, LogOut, Menu, Moon, Sun, UserRound } from 'lucide-react';
import clsx from 'clsx';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchBox } from '../ui/SearchBox';
import { cloudSyncEnabled } from '../../config/appSettings';
import { getNextTheme } from '../../core/theme/themeRegistry';
import { useClickOutside } from '../../core/utils/useClickOutside';
import { useI18n } from '../../i18n/I18nProvider';
import { useAppStore } from '../../store/useAppStore';
import { useKnowledgeStore } from '../../store/useKnowledgeStore';
import { useSyncStore } from '../../store/useSyncStore';
import { useToastStore } from '../../store/useToastStore';

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
  const syncState = useSyncStore((state) => state.syncState);
  const disconnectGoogle = useSyncStore((state) => state.disconnectGoogle);
  const pushToast = useToastStore((state) => state.pushToast);
  const accountConnected = cloudSyncEnabled && Boolean(syncState?.connected);

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
          {theme === 'dark' ? <Sun /> : <Moon />}
        </button>
        <button
          className="avatar-button"
          type="button"
          aria-label={t('topbar.account')}
          onClick={() => {
            setAccountOpen((value) => !value);
          }}
        >
          <span className={accountConnected && user?.avatarUrl ? 'avatar' : 'avatar avatar-placeholder'}>
            {accountConnected && user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />
            ) : (
              <UserRound strokeWidth={1.8} />
            )}
          </span>
          <ChevronDown className="topbar__account-chevron" />
        </button>
        {accountOpen ? (
          <div className="floating-menu topbar-menu account-menu">
            {accountConnected ? (
              <>
                <strong>{user?.name}</strong>
                <span className="menu-muted">{syncState?.email ?? user?.email}</span>
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
            {accountConnected ? (
              <button
                type="button"
                onClick={() => {
                  void disconnectGoogle().then(() => pushToast(t('sync.disconnected'), 'warning'));
                  setAccountOpen(false);
                }}
              >
                <LogOut />
                {t('profile.security.logout')}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}

