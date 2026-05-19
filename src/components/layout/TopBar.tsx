import { Bell, ChevronDown, Menu, Moon, Search, Sun } from 'lucide-react';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useClickOutside } from '../../core/utils/useClickOutside';
import { useI18n } from '../../i18n/I18nProvider';
import { useAppStore } from '../../store/useAppStore';
import { useKnowledgeStore } from '../../store/useKnowledgeStore';
import { useToastStore } from '../../store/useToastStore';

export function TopBar({
  showSearch,
  onMenuClick,
}: {
  showSearch: boolean;
  onMenuClick: () => void;
}) {
  const { t } = useI18n();
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useKnowledgeStore((state) => state.user);
  const theme = useAppStore((state) => state.settings.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const pushToast = useToastStore((state) => state.pushToast);
  const query = searchParams.get('q') ?? '';

  useClickOutside(actionsRef, notificationOpen || accountOpen, () => {
    setNotificationOpen(false);
    setAccountOpen(false);
  });

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  function setQuery(value: string) {
    const next = new URLSearchParams(searchParams);
    if (value.trim()) {
      next.set('q', value);
    } else {
      next.delete('q');
    }
    setSearchParams(next);
  }

  return (
    <header className={clsx('topbar', showSearch && 'with-search')}>
      <button className="icon-button mobile-menu-button" type="button" aria-label={t('navigation.expand')} onClick={onMenuClick}>
        <Menu size={20} />
      </button>
      {showSearch ? (
        <label className="search-box">
          <Search size={19} />
          <input
            ref={inputRef}
            type="search"
            placeholder={t('topbar.searchPlaceholder')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                pushToast(t('topbar.searchApplied'), 'success');
              }
            }}
          />
          <span className="kbd">{t('topbar.keyboardHint')}</span>
        </label>
      ) : (
        <span />
      )}
      <div className="topbar-actions" ref={actionsRef}>
        <button
          className="icon-button"
          type="button"
          aria-label={t('topbar.theme')}
          onClick={() => {
            setNotificationOpen(false);
            setAccountOpen(false);
            void setTheme(theme === 'dark' ? 'light' : 'dark');
          }}
        >
          {theme === 'dark' ? <Sun size={22} /> : <Moon size={22} />}
        </button>
        <button
          className="icon-button notification-button"
          type="button"
          aria-label={t('topbar.notifications')}
          onClick={() => {
            setAccountOpen(false);
            setNotificationOpen((value) => !value);
          }}
        >
          <Bell size={22} />
          <span className="notification-badge">3</span>
        </button>
        {notificationOpen ? (
          <div className="floating-menu topbar-menu notifications-menu">
            <strong>{t('topbar.notificationTitle')}</strong>
            {[t('topbar.notificationOne'), t('topbar.notificationTwo'), t('topbar.notificationThree')].map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  pushToast(label, 'info');
                  setNotificationOpen(false);
                }}
              >
                <Bell size={16} />
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                pushToast(t('topbar.markRead'), 'success');
                setNotificationOpen(false);
              }}
            >
              {t('topbar.markRead')}
            </button>
          </div>
        ) : null}
        <button
          className="avatar-button"
          type="button"
          aria-label={t('topbar.account')}
          onClick={() => {
            setNotificationOpen(false);
            setAccountOpen((value) => !value);
          }}
        >
          <span className="avatar">
            <img src="/assets/avatar-ricardo.svg" alt="" />
          </span>
          <ChevronDown size={18} color="var(--color-text-muted)" />
        </button>
        {accountOpen ? (
          <div className="floating-menu topbar-menu account-menu">
            <strong>{user?.name}</strong>
            <button
              type="button"
              onClick={() => {
                navigate('/profile');
                setAccountOpen(false);
              }}
            >
              {t('topbar.profile')}
            </button>
            <button
              type="button"
              onClick={() => {
                pushToast(t('topbar.localMode'), 'info');
                setAccountOpen(false);
              }}
            >
              {t('topbar.localMode')}
            </button>
            <button
              type="button"
              onClick={() => {
                pushToast(t('profile.actions.logout'), 'warning');
                setAccountOpen(false);
              }}
            >
              {t('profile.security.logout')}
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
