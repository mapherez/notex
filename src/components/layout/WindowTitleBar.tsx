import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Copy, Minus, Square, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { appSettings } from '../../config/appSettings';
import { useI18n } from '../../i18n/I18nProvider';

export function WindowTitleBar() {
  const { t } = useI18n();
  const tauriAvailable = isTauri();
  const appWindow = useMemo(() => (tauriAvailable ? getCurrentWindow() : null), [tauriAvailable]);
  const [isMaximized, setIsMaximized] = useState(false);

  const syncMaximizedState = useCallback(async () => {
    if (!appWindow) {
      return;
    }

    setIsMaximized(await appWindow.isMaximized());
  }, [appWindow]);

  const runWindowAction = useCallback((action: () => Promise<void>) => {
    void action().catch((error) => {
      console.error('Window action failed', error);
    });
  }, []);

  useEffect(() => {
    if (!appWindow) {
      return undefined;
    }

    void syncMaximizedState().catch((error) => {
      console.error('Window state sync failed', error);
    });

    const unlisten = appWindow.onResized(() => {
      void syncMaximizedState().catch((error) => {
        console.error('Window state sync failed', error);
      });
    });

    return () => {
      void unlisten.then((unsubscribe) => unsubscribe());
    };
  }, [appWindow, syncMaximizedState]);

  if (!appWindow) {
    return null;
  }

  const maximizeLabel = isMaximized ? t('windowControls.restore') : t('windowControls.maximize');
  const MaximizeIcon = isMaximized ? Copy : Square;

  return (
    <header className="window-titlebar">
      <div className="window-titlebar__drag-region" data-tauri-drag-region>
        <img className="window-titlebar__logo" src="/assets/notex_logo_small.webp" alt={appSettings.productName} />
      </div>
      <div className="window-titlebar__controls">
        <button
          className="window-titlebar__control"
          type="button"
          aria-label={t('windowControls.minimize')}
          onClick={() => runWindowAction(() => appWindow.minimize())}
        >
          <Minus />
          <span className="window-titlebar__tooltip" role="tooltip">
            {t('windowControls.minimize')}
          </span>
        </button>
        <button
          className="window-titlebar__control"
          type="button"
          aria-label={maximizeLabel}
          onClick={() =>
            runWindowAction(async () => {
              await appWindow.toggleMaximize();
              await syncMaximizedState();
            })
          }
        >
          <MaximizeIcon />
          <span className="window-titlebar__tooltip" role="tooltip">
            {maximizeLabel}
          </span>
        </button>
        <button
          className="window-titlebar__control window-titlebar__control--close"
          type="button"
          aria-label={t('windowControls.close')}
          onClick={() => runWindowAction(() => appWindow.close())}
        >
          <X />
          <span className="window-titlebar__tooltip" role="tooltip">
            {t('windowControls.close')}
          </span>
        </button>
      </div>
    </header>
  );
}
