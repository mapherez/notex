import { ChevronDown, Menu, Moon, Sun, UserRound } from "lucide-react";
import clsx from "clsx";
import { useRef, useState, type RefObject } from "react";
import { useNavigate } from "react-router-dom";
import { SearchBox } from "../ui/SearchBox";
import { getNextTheme, getThemeIcon } from "../../core/theme/themeRegistry";
import { useClickOutside } from "../../core/utils/useClickOutside";
import { useMenuOptionFocus } from "../../core/utils/useMenuOptionFocus";
import { useI18n } from "../../i18n/I18nProvider";
import { useAppStore } from "../../store/useAppStore";
import { useKnowledgeStore } from "../../store/useKnowledgeStore";
import { useGoogleAccountStore } from "../../store/useGoogleAccountStore";

export function TopBar({
  showSearch,
  onMenuClick,
  sidebarOpen,
  menuTriggerRef,
}: {
  showSearch: boolean;
  onMenuClick: () => void;
  sidebarOpen: boolean;
  menuTriggerRef: RefObject<HTMLButtonElement>;
}) {
  const { t } = useI18n();
  const [accountOpen, setAccountOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const menu = useMenuOptionFocus(accountOpen, () => setAccountOpen(false));
  const navigate = useNavigate();
  const user = useKnowledgeStore((state) => state.user);
  const account = useGoogleAccountStore((state) => state.account);
  const avatar = account?.picture ?? user?.avatarUrl;
  const theme = useAppStore((state) => state.settings.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const ThemeIcon = getThemeIcon(theme) === "sun" ? Sun : Moon;

  useClickOutside(actionsRef, accountOpen, () => {
    setAccountOpen(false);
  });

  return (
    <header className={clsx("topbar", showSearch && "topbar--with-search")}>
      <button
        className="icon-button mobile-menu-button"
        type="button"
        ref={menuTriggerRef}
        aria-label={t("navigation.expand")}
        aria-expanded={sidebarOpen}
        aria-controls="app-sidebar"
        onClick={onMenuClick}
      >
        <Menu />
      </button>
      {showSearch ? (
        <div className="topbar__search-area">
          <SearchBox />
        </div>
      ) : (
        <span />
      )}
      <div
        className="topbar__actions"
        ref={actionsRef}
        onKeyDown={menu.onKeyDown}
      >
        <button
          className="icon-button"
          type="button"
          aria-label={t("topbar.theme")}
          onClick={() => {
            setAccountOpen(false);
            void setTheme(getNextTheme(theme));
          }}
        >
          <ThemeIcon />
        </button>
        <button
          className="avatar-button"
          ref={menu.triggerRef}
          type="button"
          aria-label={t("topbar.account")}
          aria-expanded={accountOpen}
          onClick={() => {
            setAccountOpen((value) => !value);
          }}
        >
          <span className={avatar ? "avatar" : "avatar avatar-placeholder"}>
            {avatar ? (
              <img src={avatar} alt="" referrerPolicy="no-referrer" />
            ) : (
              <UserRound strokeWidth={1.8} />
            )}
          </span>
          <ChevronDown className="topbar__account-chevron" />
        </button>
        {accountOpen ? (
          <div
            className="floating-menu topbar-menu account-menu"
            ref={menu.menuRef}
          >
            {account || user ? (
              <>
                <strong>{account?.name ?? user?.name}</strong>
                <span className="menu-muted">
                  {account?.email ?? user?.email ?? t("profile.localAccount")}
                </span>
              </>
            ) : (
              <span className="menu-muted">{t("profile.localUser")}</span>
            )}
            <button
              type="button"
              onClick={() => {
                navigate("/profile");
                menu.closeAndFocus();
              }}
            >
              {t("topbar.profile")}
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
