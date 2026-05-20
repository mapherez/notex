import { useEffect } from 'react';
import { NOTEX_SYNC_QUEUED } from './syncQueue';
import { useSyncStore } from '../../store/useSyncStore';

export function useSyncBootstrap(enabled: boolean) {
  const hydrateSync = useSyncStore((state) => state.hydrateSync);
  const scheduleSync = useSyncStore((state) => state.scheduleSync);
  const refreshSyncMetadata = useSyncStore((state) => state.refreshSyncMetadata);
  const connected = useSyncStore((state) => Boolean(state.syncState?.connected));

  useEffect(() => {
    if (!enabled) {
      return;
    }

    void hydrateSync().then(() => {
      scheduleSync();
    });
  }, [enabled, hydrateSync, scheduleSync]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    function handleQueued() {
      void refreshSyncMetadata();
      scheduleSync();
    }

    function handleOnline() {
      scheduleSync();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void refreshSyncMetadata();
        scheduleSync();
      }
    }

    window.addEventListener(NOTEX_SYNC_QUEUED, handleQueued);
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener(NOTEX_SYNC_QUEUED, handleQueued);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, refreshSyncMetadata, scheduleSync]);

  useEffect(() => {
    if (!enabled || !connected) {
      return;
    }

    const events = new EventSource('/api/sync/events');
    events.addEventListener('sync-hint', () => {
      void refreshSyncMetadata();
      scheduleSync();
    });

    events.onerror = () => {
      events.close();
    };

    return () => {
      events.close();
    };
  }, [connected, enabled, refreshSyncMetadata, scheduleSync]);
}
