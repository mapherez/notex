import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useEffect, useRef, useState } from 'react';
import { cloudStorage } from '../../core/cloud/cloudStorage';
import { waitForNoteMutations } from '../../core/mcp/noteMutationCoordinator';
import { useI18n } from '../../i18n/I18nProvider';
import { useCloudStore } from '../../store/useCloudStore';
import { useGoogleAccountStore } from '../../store/useGoogleAccountStore';
import { AppModal } from './AppModal';

export function DesktopBackupCloseGuard() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [failed, setFailed] = useState(false);
  const allowed = useRef(false);
  const checking = useRef(false);
  const close = async () => {
    allowed.current = true;
    await getCurrentWindow().close().catch(() => { allowed.current = false; setFailed(true); });
  };
  useEffect(() => {
    if (!isTauri()) return;
    const listen = getCurrentWindow().onCloseRequested((event) => {
      const account = useGoogleAccountStore.getState().account;
      if (allowed.current || !account) return;
      event.preventDefault();
      if (checking.current) return;
      checking.current = true;
      void (async () => {
        try {
          await waitForNoteMutations();
          const pending = (await cloudStorage(account.id).pending()).filter((item) => !useCloudStore.getState().excludedNotes.includes(item.entityId));
          if (pending.length || useCloudStore.getState().phase === 'uploading') setOpen(true);
          else await close();
        } catch { setOpen(true); setFailed(true); }
        finally { checking.current = false; }
      })();
    });
    return () => { void listen.then((unlisten) => unlisten()); };
  }, []);
  const finishAndClose = async () => {
    setWaiting(true); setFailed(false);
    const cloud = useCloudStore.getState();
    const wasPaused = cloud.paused;
    cloud.pause(true);
    try {
      await waitForNoteMutations();
      await cloud.backupNow();
      const account = useGoogleAccountStore.getState().account;
      if (account && (await cloudStorage(account.id).pending()).some((item) => !useCloudStore.getState().excludedNotes.includes(item.entityId))) { setFailed(true); return; }
      await close();
    } catch { setFailed(true); }
    finally { useCloudStore.getState().pause(wasPaused); setWaiting(false); }
  };
  return <AppModal open={open} onClose={() => setOpen(false)} dismissible={!waiting} labelledBy="backup-close-title" className="choice-modal">
    <h2 id="backup-close-title">{t('cloud.closeTitle')}</h2><p>{t('cloud.closeDescription')}</p>
    {failed && <p role="status">{t('cloud.error')}</p>}
    <button type="button" className="primary-button" disabled={waiting} onClick={() => void finishAndClose()}>{t('cloud.waitClose')}</button>
    <button type="button" className="secondary-button" disabled={waiting} onClick={() => void close()}>{t('cloud.exitNow')}</button>
    <button type="button" className="secondary-button" disabled={waiting} onClick={() => setOpen(false)}>{t('cloud.cancel')}</button>
  </AppModal>;
}
