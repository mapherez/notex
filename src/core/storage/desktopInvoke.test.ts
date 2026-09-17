import { beforeEach, describe, expect, it, vi } from 'vitest';
import { desktopInvoke, pauseDesktopStorage, selectDesktopLibrary } from './desktopInvoke';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke }));

describe('desktop library operations', () => {
  beforeEach(() => { invoke.mockReset(); selectDesktopLibrary(null); });

  it('waits for already dispatched writes and rejects new writes during a switch', async () => {
    let finish!: () => void;
    invoke.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    selectDesktopLibrary('account-a');
    const write = desktopInvoke('notex_sqlite_transaction', { operations: [] });
    let drained = false;
    const drain = pauseDesktopStorage().then(() => { drained = true; });
    await Promise.resolve();
    expect(drained).toBe(false);
    await expect(desktopInvoke('notex_sqlite_count')).rejects.toThrow('changing');
    expect(invoke).toHaveBeenCalledExactlyOnceWith('notex_sqlite_transaction', { operations: [], libraryId: 'account-a' });
    finish();
    await write;
    await drain;
    selectDesktopLibrary('account-b');
    invoke.mockResolvedValueOnce(3);
    expect(await desktopInvoke('notex_sqlite_count', { libraryId: 'account-a' })).toBe(3);
    expect(invoke).toHaveBeenLastCalledWith('notex_sqlite_count', { libraryId: 'account-b' });
  });
});
