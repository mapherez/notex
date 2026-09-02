import {
  Cable,
  EllipsisVertical,
  Loader2,
  LogIn,
  LogOut,
  ShieldOff,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useClickOutside } from '../../core/utils/useClickOutside';
import { useI18n } from '../../i18n/I18nProvider';
import { useMcpStore } from '../../store/useMcpStore';
import { useToastStore } from '../../store/useToastStore';

type Confirmation = 'revoke' | 'delete' | null;

export function McpProfileSection() {
  const { t } = useI18n();
  const connection = useMcpStore((state) => state.connection);
  const action = useMcpStore((state) => state.action);
  const startAuthorization = useMcpStore((state) => state.startAuthorization);
  const cancelAuthorization = useMcpStore((state) => state.cancelAuthorization);
  const logout = useMcpStore((state) => state.logout);
  const revokeAiAccess = useMcpStore((state) => state.revokeAiAccess);
  const deleteAccount = useMcpStore((state) => state.deleteAccount);
  const pushToast = useToastStore((state) => state.pushToast);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useClickOutside(menuRef, menuOpen, () => setMenuOpen(false));

  const online = connection.state === 'online';
  const authorizing = connection.state === 'authorizing';
  const hasDesktopSession =
    Boolean(connection.email) ||
    connection.state === 'connecting' ||
    connection.state === 'online' ||
    connection.state === 'offline';
  const busy = action !== null;

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  async function run(actionToRun: () => Promise<void>, successMessage?: string) {
    try {
      await actionToRun();
      if (successMessage) {
        pushToast(successMessage, 'success');
      }
    } catch {
      pushToast(t('profile.mcp.actionFailed'), 'warning');
    }
  }

  async function confirmAction() {
    const selected = confirmation;
    setConfirmation(null);
    if (selected === 'revoke') {
      await run(revokeAiAccess, t('profile.mcp.accessRevoked'));
    } else if (selected === 'delete') {
      await run(deleteAccount, t('profile.mcp.accountDeleted'));
    }
  }

  return (
    <section className="profile-section mcp-profile-section">
      <div className="profile-section-header mcp-profile-section__header">
        <h2 className="profile-section-title">{t('profile.mcp.title')}</h2>
        <span className={online ? 'mcp-status mcp-status--online' : 'mcp-status'}>
          <span className="mcp-status__dot" aria-hidden="true" />
          {t(`profile.mcp.states.${connection.state}`)}
        </span>
      </div>

      <div className="mcp-account-row">
        <Cable className="mcp-account-row__icon" aria-hidden="true" />
        <span>
          <span className="profile-row-label">{t('profile.mcp.account')}</span>
          <span className="profile-row-description mcp-account-email">
            {connection.email ?? t('profile.mcp.noAccount')}
          </span>
        </span>
      </div>

      {connection.errorCode ? (
        <p className="mcp-error" role="status">
          {t('profile.mcp.connectionError')}
        </p>
      ) : null}

      {authorizing ? (
        <button
          className="mcp-command-button"
          type="button"
          disabled={busy}
          onClick={() => void run(cancelAuthorization)}
        >
          <Loader2 className="mcp-command-button__spinner" />
          <span>{t('profile.mcp.cancel')}</span>
        </button>
      ) : hasDesktopSession ? (
        <div className="mcp-session-actions">
          <button
            className="mcp-command-button"
            type="button"
            disabled={busy}
            onClick={() => void run(logout, t('profile.mcp.loggedOut'))}
          >
            {action === 'logout' ? <Loader2 className="mcp-command-button__spinner" /> : <LogOut />}
            <span>{t('profile.mcp.logout')}</span>
          </button>
          <div className="mcp-overflow" ref={menuRef}>
            <button
              className="icon-button mcp-overflow__trigger"
              type="button"
              aria-label={t('profile.mcp.moreActions')}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              disabled={busy}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <EllipsisVertical />
            </button>
            {menuOpen ? (
              <div className="mcp-overflow__menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmation('revoke');
                  }}
                >
                  <ShieldOff />
                  <span>{t('profile.mcp.revokeAccess')}</span>
                </button>
                <button
                  className="danger"
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmation('delete');
                  }}
                >
                  <Trash2 />
                  <span>{t('profile.mcp.deleteAccount')}</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="mcp-auth-actions">
          <button
            className="mcp-command-button"
            type="button"
            disabled={busy}
            onClick={() => void run(() => startAuthorization('register'))}
          >
            {action === 'register' ? <Loader2 className="mcp-command-button__spinner" /> : <UserPlus />}
            <span>{t('profile.mcp.register')}</span>
          </button>
          <button
            className="mcp-command-button"
            type="button"
            disabled={busy}
            onClick={() => void run(() => startAuthorization('login'))}
          >
            {action === 'login' ? <Loader2 className="mcp-command-button__spinner" /> : <LogIn />}
            <span>{t('profile.mcp.login')}</span>
          </button>
        </div>
      )}

      {confirmation ? (
        <div className="modal-backdrop">
          <section
            className="choice-modal delete-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mcp-confirm-title"
          >
            <h2 id="mcp-confirm-title">
              {t(
                confirmation === 'revoke'
                  ? 'profile.mcp.revokeConfirmTitle'
                  : 'profile.mcp.deleteConfirmTitle',
              )}
            </h2>
            <p>
              {t(
                confirmation === 'revoke'
                  ? 'profile.mcp.revokeConfirmDescription'
                  : 'profile.mcp.deleteConfirmDescription',
              )}
            </p>
            <div className="choice-modal-actions two-column-actions">
              <button type="button" disabled={busy} onClick={() => setConfirmation(null)}>
                <X />
                <span>{t('common.cancel')}</span>
              </button>
              <button type="button" disabled={busy} onClick={() => void confirmAction()}>
                {confirmation === 'revoke' ? <ShieldOff /> : <Trash2 />}
                <span>
                  {t(
                    confirmation === 'revoke'
                      ? 'profile.mcp.revokeAccess'
                      : 'profile.mcp.deleteAccount',
                  )}
                </span>
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
