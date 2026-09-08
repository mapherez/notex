import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkForAppUpdate,
  closeAppUpdate,
  installAppUpdate,
  type AppUpdateInfo,
} from '../core/services/appUpdater';
import { useAppUpdaterStore } from './useAppUpdaterStore';

vi.mock('../core/services/appUpdater', () => ({
  checkForAppUpdate: vi.fn(),
  closeAppUpdate: vi.fn(),
  installAppUpdate: vi.fn(),
}));

const updateInfo = {
  currentVersion: '2.1.0',
  update: {},
  version: '2.2.0',
} as AppUpdateInfo;

beforeEach(() => {
  vi.clearAllMocks();
  useAppUpdaterStore.setState({
    progress: null,
    status: 'idle',
    updateInfo: null,
  });
});

describe('useAppUpdaterStore', () => {
  it('shares one active update check between callers', async () => {
    vi.mocked(checkForAppUpdate).mockResolvedValue(updateInfo);

    const firstCheck = useAppUpdaterStore.getState().check();
    const secondCheck = useAppUpdaterStore.getState().check();
    const results = await Promise.all([firstCheck, secondCheck]);

    expect(checkForAppUpdate).toHaveBeenCalledTimes(1);
    expect(results).toEqual([updateInfo, updateInfo]);
    expect(useAppUpdaterStore.getState()).toMatchObject({
      status: 'available',
      updateInfo,
    });
  });

  it('dismisses and releases the available update', async () => {
    useAppUpdaterStore.setState({ status: 'available', updateInfo });

    await useAppUpdaterStore.getState().dismiss();

    expect(closeAppUpdate).toHaveBeenCalledWith(updateInfo.update);
    expect(useAppUpdaterStore.getState()).toMatchObject({
      progress: null,
      status: 'idle',
      updateInfo: null,
    });
  });

  it('makes the available update actionable again after an install failure', async () => {
    vi.mocked(installAppUpdate).mockRejectedValue(new Error('install failed'));
    useAppUpdaterStore.setState({ status: 'available', updateInfo });

    await expect(useAppUpdaterStore.getState().install()).rejects.toThrow('install failed');

    expect(useAppUpdaterStore.getState()).toMatchObject({
      status: 'available',
      updateInfo,
    });
  });
});
