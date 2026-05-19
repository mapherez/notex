import { ChevronDown, Menu, Moon, Sun } from 'lucide-react';
import clsx from 'clsx';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchBox } from '../ui/SearchBox';
import { useClickOutside } from '../../core/utils/useClickOutside';
import { useI18n } from '../../i18n/I18nProvider';
import { useAppStore } from '../../store/useAppStore';
import { useKnowledgeStore } from '../../store/useKnowledgeStore';
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
        <SearchBox />
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
