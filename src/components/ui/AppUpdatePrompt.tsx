import { RefreshCw } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { updaterSettings } from '../../config/appSettings';
import { useI18n } from '../../i18n/I18nProvider';
import { useAppUpdaterStore } from '../../store/useAppUpdaterStore';
import { useToastStore } from '../../store/useToastStore';

export function AppUpdatePrompt({ enabled }: { enabled: boolean }) {
  const { t } = useI18n();
  const pushToast = useToastStore((state) => state.pushToast);
  const checkStartedRef = useRef(false);
  const check = useAppUpdaterStore((state) => state.check);
  const dismiss = useAppUpdaterStore((state) => state.dismiss);
  const install = useAppUpdaterStore((state) => state.install);
  const progress = useAppUpdaterStore((state) => state.progress);
  const status = useAppUpdaterStore((state) => state.status);
  const updateInfo = useAppUpdaterStore((state) => state.updateInfo);
  const installing = status === 'installing';

  useEffect(() => {
    if (!enabled || !updaterSettings.checkOnStartup || checkStartedRef.current) {
      return;
    }

    checkStartedRef.current = true;
    void check()
      .catch((error) => {
        pushToast(error instanceof Error ? error.message : t('updater.checkFailed'), 'warning');
      });
  }, [check, enabled, pushToast, t]);

  if (!updateInfo) {
    return null;
  }

  async function dismissUpdate() {
    await dismiss();
  }

  async function installUpdate() {
    try {
      await install();
    } catch (error) {
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

