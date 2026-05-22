import { RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  checkForAppUpdate,
  closeAppUpdate,
  installAppUpdate,
  type AppUpdateInfo,
  type UpdateInstallProgress,
} from '../../core/services/appUpdater';
import { useI18n } from '../../i18n/I18nProvider';
import { useToastStore } from '../../store/useToastStore';

export function AppUpdatePrompt({ enabled }: { enabled: boolean }) {
  const { t } = useI18n();
  const pushToast = useToastStore((state) => state.pushToast);
  const checkStartedRef = useRef(false);
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState<UpdateInstallProgress | null>(null);

  useEffect(() => {
    if (!enabled || checkStartedRef.current) {
      return;
    }

    checkStartedRef.current = true;
    void checkForAppUpdate()
      .then((availableUpdate) => {
        setUpdateInfo(availableUpdate);
      })
      .catch((error) => {
        pushToast(error instanceof Error ? error.message : t('updater.checkFailed'), 'warning');
      });
  }, [enabled, pushToast, t]);

  if (!updateInfo) {
    return null;
  }

  async function dismissUpdate() {
    const update = updateInfo?.update;
    setUpdateInfo(null);
    setProgress(null);

    if (update) {
      try {
        await closeAppUpdate(update);
      } catch {
        // Closing the updater resource is best-effort after the user dismisses the prompt.
      }
    }
  }

  async function installUpdate() {
    if (!updateInfo || installing) {
      return;
    }

    setInstalling(true);
    setProgress(null);

    try {
      await installAppUpdate(updateInfo.update, setProgress);
    } catch (error) {
      setInstalling(false);
      pushToast(error instanceof Error ? error.message : t('updater.installFailed'), 'warning');
    }
  }

  return (
    <aside className="app-update-banner" role="status" aria-live="polite">
      <div className="app-update-icon">
        <RefreshCw className={installing ? 'spinning' : undefined} />
      </div>
      <div className="app-update-copy">
        <strong>{t('updater.title')}</strong>
        <span>
          {t('updater.versionLine', {
            current: updateInfo.currentVersion || t('updater.unknownVersion'),
            next: updateInfo.version || t('updater.unknownVersion'),
          })}
        </span>
        {installing ? (
          <>
            <span className="app-update-progress">
              {progress?.percent !== null && progress?.percent !== undefined
                ? t('updater.installingProgress', { percent: progress.percent })
                : t('updater.installing')}
            </span>
            <progress
              className={progress?.percent === null || progress?.percent === undefined ? 'app-update-progress-bar indeterminate' : 'app-update-progress-bar'}
              max={100}
              value={progress?.percent ?? undefined}
              aria-label={t('updater.installing')}
            />
          </>
        ) : null}
      </div>
      <div className="app-update-actions">
        <button type="button" onClick={() => void installUpdate()} disabled={installing}>
          {installing ? t('updater.installing') : t('updater.installNow')}
        </button>
        <button type="button" onClick={() => void dismissUpdate()} disabled={installing}>
          {t('updater.later')}
        </button>
      </div>
    </aside>
  );
}

