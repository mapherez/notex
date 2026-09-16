import { isTauri } from '@tauri-apps/api/core';
import { useEffect, useState } from 'react';
import { googleConfig } from '../../core/services/googleConfig';
import { prepareGoogleWebLogin } from '../../core/services/googleWebAuth';
import { useI18n } from '../../i18n/I18nProvider';
import { useGoogleAccountStore } from '../../store/useGoogleAccountStore';
import { AppModal } from '../ui/AppModal';

export function GoogleAccountModal() {
  const { t } = useI18n();
  const { modalOpen, authorizing, account, status, error, login, closeLogin, resolveAdoption } = useGoogleAccountStore();
  const desktop = isTauri();
  const configured = Boolean(desktop ? googleConfig.desktopClientId : googleConfig.webClientId);
  const [prepared, setPrepared] = useState(desktop);
  const [preparationError, setPreparationError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!modalOpen || desktop || !configured) return;
    let current = true;
    setPreparationError(null);
    void prepareGoogleWebLogin().then(() => { if (current) setPrepared(true); })
      .catch((error: Error) => { if (current) setPreparationError(error.message); });
    return () => { current = false; };
  }, [modalOpen, desktop, configured, retry]);
  const reason = !configured ? 'GOOGLE_NOT_CONFIGURED' : preparationError ?? error;
  const code = reason?.split(':')[0];
  const errorKey = `google.errors.${code}`;
  const message = code ? (t(errorKey) === errorKey ? t('google.errors.generic') : t(errorKey)) : null;
  return <AppModal open={modalOpen} onClose={closeLogin} dismissible={status !== 'switching' && (desktop || Boolean(account))}
    labelledBy="google-login-title" describedBy="google-login-description" className="choice-modal google-account-modal">
    <h2 id="google-login-title">{t('google.title')}</h2>
    <p id="google-login-description">{t(desktop ? 'google.desktopDescription' : 'google.webDescription')}</p>
    {message && <p role="status">{message}</p>}
    {code === 'ACCOUNT_NOTE_CONFLICT' && <div className="cloud-transfer-banner__actions">
      <button type="button" className="secondary-button" disabled={authorizing} onClick={() => resolveAdoption('local')}>{t('cloud.keepLocal')}</button>
      <button type="button" className="secondary-button" disabled={authorizing} onClick={() => resolveAdoption('remote')}>{t('cloud.keepRemote')}</button>
    </div>}
    <button className="primary-button" type="button" disabled={!configured || !prepared || authorizing}
      onClick={() => void login()}>{t(authorizing ? 'google.connecting' : configured && !prepared && !preparationError ? 'google.preparing' : 'google.continue')}</button>
    {preparationError && <button className="secondary-button" type="button" onClick={() => setRetry((value) => value + 1)}>{t('google.retry')}</button>}
  </AppModal>;
}
