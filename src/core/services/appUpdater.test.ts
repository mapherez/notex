import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installAppUpdate } from './appUpdater';
import type { Update } from '@tauri-apps/plugin-updater';

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), exit: vi.fn(), relaunch: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke, isTauri: () => true }));
vi.mock('@tauri-apps/plugin-process', () => ({ exit: mocks.exit, relaunch: mocks.relaunch }));

beforeEach(() => vi.resetAllMocks());

describe('update relaunch', () => {
  it('relaunches macOS normally after installation, without exiting for cleanup', async () => {
    const downloadAndInstall = vi.fn().mockResolvedValue(undefined);
    const update = { downloadAndInstall } as unknown as Update;
    mocks.invoke.mockResolvedValue('relaunch');
    await installAppUpdate(update);
    expect(downloadAndInstall).toHaveBeenCalledOnce();
    expect(mocks.invoke).toHaveBeenCalledWith('notex_prepare_update_relaunch_with_local_data_reset');
    expect(mocks.relaunch).toHaveBeenCalledOnce();
    expect(mocks.exit).not.toHaveBeenCalled();
    expect(downloadAndInstall.mock.invocationCallOrder[0]).toBeLessThan(mocks.invoke.mock.invocationCallOrder[0]);
    expect(mocks.invoke.mock.invocationCallOrder[0]).toBeLessThan(mocks.relaunch.mock.invocationCallOrder[0]);
  });

  it('exits Windows only after its cleanup helper has been scheduled', async () => {
    mocks.invoke.mockResolvedValue('exit');
    await installAppUpdate({ downloadAndInstall: vi.fn().mockResolvedValue(undefined) } as unknown as Update);
    expect(mocks.exit).toHaveBeenCalledWith(0);
    expect(mocks.relaunch).not.toHaveBeenCalled();
    expect(mocks.invoke.mock.invocationCallOrder[0]).toBeLessThan(mocks.exit.mock.invocationCallOrder[0]);
  });

  it.each(['install', 'prepare', 'unknown strategy'])('does not restart after %s failure', async (failure) => {
    const downloadAndInstall = vi.fn().mockResolvedValue(undefined);
    if (failure === 'install') downloadAndInstall.mockRejectedValue(new Error('install failed'));
    if (failure === 'prepare') mocks.invoke.mockRejectedValue(new Error('persistent data protected'));
    if (failure === 'unknown strategy') mocks.invoke.mockResolvedValue('unsupported');
    await expect(installAppUpdate({ downloadAndInstall } as unknown as Update)).rejects.toThrow();
    expect(mocks.exit).not.toHaveBeenCalled();
    expect(mocks.relaunch).not.toHaveBeenCalled();
    if (failure === 'install') expect(mocks.invoke).not.toHaveBeenCalled();
  });
});
