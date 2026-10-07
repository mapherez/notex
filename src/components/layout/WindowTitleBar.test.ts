import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import baseConfig from '../../../src-tauri/tauri.conf.json';
import macosConfig from '../../../src-tauri/tauri.macos.conf.json';
import validationConfig from '../../../src-tauri/tauri.macos-ci.conf.json';
import { useCustomWindowTitleBar } from './WindowTitleBar';

const mocks = vi.hoisted(() => ({ isTauri: vi.fn(), isDecorated: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ isTauri: mocks.isTauri }));
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => ({ isDecorated: mocks.isDecorated }) }));

let root: Root;

function TitleBarSelection() {
  return createElement('output', null, useCustomWindowTitleBar() ? 'custom' : 'native-or-web');
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.resetAllMocks();
  mocks.isTauri.mockReturnValue(true);
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('desktop title bar selection', () => {
  it('uses native controls when the window has macOS decorations', async () => {
    mocks.isDecorated.mockResolvedValue(true);
    await act(async () => root.render(createElement(TitleBarSelection)));
    expect(document.querySelector('output')?.textContent).toBe('native-or-web');
  });

  it('keeps custom controls in undecorated Windows windows', async () => {
    mocks.isDecorated.mockResolvedValue(false);
    await act(async () => root.render(createElement(TitleBarSelection)));
    expect(document.querySelector('output')?.textContent).toBe('custom');
  });

  it('does not query native window state in the web app', async () => {
    mocks.isTauri.mockReturnValue(false);
    await act(async () => root.render(createElement(TitleBarSelection)));
    expect(mocks.isDecorated).not.toHaveBeenCalled();
    expect(document.querySelector('output')?.textContent).toBe('native-or-web');
  });

  it('falls back to usable custom controls if window metadata is unavailable', async () => {
    const error = new Error('window unavailable');
    const logError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.isDecorated.mockRejectedValue(error);
    await act(async () => root.render(createElement(TitleBarSelection)));
    expect(document.querySelector('output')?.textContent).toBe('custom');
    expect(logError).toHaveBeenCalledWith('Window decoration check failed', error);
  });

  it('enables macOS decorations while preserving window geometry and the validation overlay', () => {
    const { titleBarStyle, decorations, ...macosWindow } = macosConfig.app.windows[0];
    const { decorations: windowsDecorations, ...windowsWindow } = baseConfig.app.windows[0];
    expect(windowsDecorations).toBe(false);
    expect(decorations).toBe(true);
    expect(titleBarStyle).toBe('Visible');
    expect(macosWindow).toEqual(windowsWindow);
    expect(validationConfig).not.toHaveProperty('app.windows');
    expect(validationConfig.identifier).toBe('com.mapherez.notex.validation');
    expect(validationConfig.bundle.createUpdaterArtifacts).toBe(false);
  });
});
