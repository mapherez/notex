import { create } from 'zustand';
import {
  checkForAppUpdate,
  closeAppUpdate,
  installAppUpdate,
  type AppUpdateInfo,
  type UpdateInstallProgress,
} from '../core/services/appUpdater';

export type AppUpdaterStatus = 'idle' | 'checking' | 'available' | 'installing';

type AppUpdaterStore = {
  progress: UpdateInstallProgress | null;
  status: AppUpdaterStatus;
  updateInfo: AppUpdateInfo | null;
  check: () => Promise<AppUpdateInfo | null>;
  dismiss: () => Promise<void>;
  install: () => Promise<void>;
};

let activeCheck: Promise<AppUpdateInfo | null> | null = null;

export const useAppUpdaterStore = create<AppUpdaterStore>((set, get) => ({
  progress: null,
  status: 'idle',
  updateInfo: null,
  check: async () => {
    const currentState = get();
    if (currentState.updateInfo) {
      return currentState.updateInfo;
    }
    if (activeCheck) {
      return activeCheck;
    }

    set({ status: 'checking' });
    activeCheck = checkForAppUpdate()
      .then((updateInfo) => {
        set({
          progress: null,
          status: updateInfo ? 'available' : 'idle',
          updateInfo,
        });
        return updateInfo;
      })
      .catch((error) => {
        set({ status: 'idle' });
        throw error;
      })
      .finally(() => {
        activeCheck = null;
      });

    return activeCheck;
  },
  dismiss: async () => {
    const update = get().updateInfo?.update;
    set({ progress: null, status: 'idle', updateInfo: null });
    if (update) {
      try {
        await closeAppUpdate(update);
      } catch {
        // Closing a dismissed updater resource is best-effort.
      }
    }
  },
  install: async () => {
    const updateInfo = get().updateInfo;
    if (!updateInfo || get().status === 'installing') {
      return;
    }

    set({ progress: null, status: 'installing' });
    try {
      await installAppUpdate(updateInfo.update, (progress) => set({ progress }));
    } catch (error) {
      set({ status: 'available' });
      throw error;
    }
  },
}));
