import { act, createElement, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppUpdatePrompt } from './AppUpdatePrompt';

const mocks = vi.hoisted(() => ({ getIdentifier: vi.fn(), check: vi.fn(), pushToast: vi.fn() }));
vi.mock('@tauri-apps/api/app', () => ({ getIdentifier: mocks.getIdentifier }));
vi.mock('../../config/appSettings', () => ({ updaterSettings: { checkOnStartup: true } }));
vi.mock('../../i18n/I18nProvider', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('../../store/useToastStore', () => ({
  useToastStore: (selector: (state: { pushToast: typeof mocks.pushToast }) => unknown) => selector(mocks),
}));
vi.mock('../../store/useAppUpdaterStore', () => {
  const state = {
    check: mocks.check, dismiss: vi.fn(), install: vi.fn(),
    progress: null, status: 'idle', updateInfo: null,
  };
  return { useAppUpdaterStore: (selector: (value: typeof state) => unknown) => selector(state) };
});

let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.resetAllMocks();
  mocks.check.mockResolvedValue(null);
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.replaceChildren();
});

describe('automatic update check', () => {
  it('does not consult the public updater in the macOS validation build', async () => {
    mocks.getIdentifier.mockResolvedValue('com.mapherez.notex.validation');
    await act(async () => root.render(createElement(AppUpdatePrompt, { enabled: true })));
    expect(mocks.getIdentifier).toHaveBeenCalledOnce();
    expect(mocks.check).not.toHaveBeenCalled();
    expect(mocks.pushToast).not.toHaveBeenCalled();
  });

  it.each(['com.mapherez.notex', 'com.mapherez.notex.dev'])(
    'keeps the startup check for %s, including public Windows and macOS releases',
    async (identifier) => {
      mocks.getIdentifier.mockResolvedValue(identifier);
      await act(async () => root.render(createElement(AppUpdatePrompt, { enabled: true })));
      expect(mocks.check).toHaveBeenCalledOnce();
    },
  );

  it('does not check or read native metadata when the prompt is disabled', async () => {
    await act(async () => root.render(createElement(AppUpdatePrompt, { enabled: false })));
    expect(mocks.getIdentifier).not.toHaveBeenCalled();
    expect(mocks.check).not.toHaveBeenCalled();
  });

  it('waits for native metadata and does not check after unmounting', async () => {
    let resolveIdentifier!: (identifier: string) => void;
    mocks.getIdentifier.mockReturnValue(new Promise<string>((resolve) => { resolveIdentifier = resolve; }));
    await act(async () => root.render(createElement(AppUpdatePrompt, { enabled: true })));
    expect(mocks.check).not.toHaveBeenCalled();
    await act(async () => root.render(null));
    await act(async () => resolveIdentifier('com.mapherez.notex'));
    expect(mocks.check).not.toHaveBeenCalled();
  });

  it('checks once in React StrictMode', async () => {
    mocks.getIdentifier.mockResolvedValue('com.mapherez.notex');
    await act(async () => root.render(createElement(StrictMode, null,
      createElement(AppUpdatePrompt, { enabled: true }))));
    expect(mocks.check).toHaveBeenCalledOnce();
  });

  it('does not query the updater if build identification fails', async () => {
    mocks.getIdentifier.mockRejectedValue(new Error('metadata unavailable'));
    await act(async () => root.render(createElement(AppUpdatePrompt, { enabled: true })));
    expect(mocks.check).not.toHaveBeenCalled();
    expect(mocks.pushToast).toHaveBeenCalledWith('metadata unavailable', 'warning');
  });
});
