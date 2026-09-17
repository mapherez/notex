import { act, createElement, Fragment } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Window } from '@tauri-apps/api/window';
import desktopCapability from '../../../src-tauri/capabilities/desktop.json';
import { WindowTitleBar } from '../layout/WindowTitleBar';
import { DesktopBackupCloseGuard } from './DesktopBackupCloseGuard';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  destroyed: vi.fn(),
  listeners: new Map<string, (event: unknown) => Promise<void>>(),
  account: null as { id: string } | null,
  pending: vi.fn(),
  cloud: { excludedNotes: [] as string[], phase: 'idle', paused: false, pause: vi.fn(), backupNow: vi.fn() },
}));

// Keep the real Window API: onCloseRequested internally calls destroy(),
// which needs a different permission from the titlebar's close() call.
vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => true, invoke: mocks.invoke }));
vi.mock('../../i18n/I18nProvider', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('../../core/cloud/cloudStorage', () => ({ cloudStorage: () => ({ pending: mocks.pending }) }));
vi.mock('../../core/mcp/noteMutationCoordinator', () => ({ waitForNoteMutations: async () => {} }));
vi.mock('../../store/useCloudStore', () => ({ useCloudStore: { getState: () => mocks.cloud } }));
vi.mock('../../store/useGoogleAccountStore', () => ({ useGoogleAccountStore: { getState: () => ({ account: mocks.account }) } }));

let root: Root;

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  Object.assign(window, { __TAURI_INTERNALS__: {
    metadata: { currentWindow: { label: 'main' } },
    invoke: (command: string, args: unknown) => mocks.invoke(command, args),
  } });
  vi.spyOn(Window.prototype, 'listen').mockImplementation(async (name, handler) => {
    mocks.listeners.set(name, handler as (event: unknown) => Promise<void>);
    return () => { mocks.listeners.delete(name); };
  });
  mocks.listeners.clear();
  mocks.account = null;
  mocks.cloud.phase = 'idle';
  mocks.cloud.excludedNotes = [];
  mocks.pending.mockResolvedValue([]);
  mocks.cloud.backupNow.mockResolvedValue(undefined);
  mocks.invoke.mockImplementation(async (command: string) => {
    const action = command.split('|')[1];
    if (!desktopCapability.windows.includes('main') || !desktopCapability.permissions.includes(`core:window:allow-${action.replace(/_/g, '-')}`)) {
      throw new Error(`Window command denied: ${command}`);
    }
    if (action === 'close') {
      await mocks.listeners.get('tauri://close-requested')?.({ event: 'tauri://close-requested', id: 1, payload: null });
    }
    if (action === 'is_maximized') return false;
    if (action === 'destroy') mocks.destroyed();
  });
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root.render(createElement(Fragment, null, createElement(WindowTitleBar), createElement(DesktopBackupCloseGuard)));
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  document.body.replaceChildren();
  document.body.style.overflow = '';
  Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function click(selector: string) {
  const button = document.querySelector<HTMLButtonElement>(selector);
  expect(button).not.toBeNull();
  await act(async () => button!.click());
}

function expectDestroyed() {
  expect(mocks.invoke).toHaveBeenCalledWith('plugin:window|destroy', { label: 'main' });
  expect(mocks.destroyed).toHaveBeenCalledTimes(1);
  expect(document.querySelector('[role="dialog"]')).toBeNull();
}

describe('desktop titlebar close with the backup guard', () => {
  it('closes without a signed-in account using the SDK destroy permission', async () => {
    await click('.window-titlebar__control--close');
    expectDestroyed();
  });

  it('closes when the signed-in account has no pending backups', async () => {
    mocks.account = { id: 'account-1' };
    await click('.window-titlebar__control--close');
    expect(mocks.pending).toHaveBeenCalled();
    expectDestroyed();
  });

  it('allows cancelling or exiting immediately when backups are pending', async () => {
    mocks.account = { id: 'account-1' };
    mocks.pending.mockResolvedValue([{ entityId: 'note-1' }]);
    await click('.window-titlebar__control--close');
    expect(mocks.invoke).not.toHaveBeenCalledWith('plugin:window|destroy', { label: 'main' });
    await click('.choice-modal .secondary-button:last-child');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await click('.window-titlebar__control--close');
    await click('.choice-modal .secondary-button');
    expect(mocks.invoke).toHaveBeenCalledWith('plugin:window|destroy', { label: 'main' });
    expect(mocks.destroyed).toHaveBeenCalledTimes(1);
  });

  it('finishes the backup before closing when requested', async () => {
    mocks.account = { id: 'account-1' };
    mocks.pending.mockResolvedValueOnce([{ entityId: 'note-1' }]).mockResolvedValue([]);
    await click('.window-titlebar__control--close');
    await click('.choice-modal .primary-button');
    expect(mocks.cloud.backupNow).toHaveBeenCalledTimes(1);
    expect(mocks.invoke).toHaveBeenCalledWith('plugin:window|destroy', { label: 'main' });
    expect(mocks.destroyed).toHaveBeenCalledTimes(1);
  });
});
