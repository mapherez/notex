import { act, createElement, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSidebarDrawer } from './useSidebarDrawer';

let root: Root;
let matches: boolean;
let mediaChanged: () => void;
const onClose = vi.fn();

function Harness({ open }: { open: boolean }) {
  const backgroundRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { sidebarRef } = useSidebarDrawer(open, onClose, backgroundRef, triggerRef);
  return createElement('div', null,
    createElement('aside', { ref: sidebarRef, id: 'sidebar' },
      createElement('button', { className: 'sidebar-close' }, 'Close'),
      createElement('a', { href: '#notes', id: 'last' }, 'Notes')),
    createElement('main', { ref: backgroundRef },
      createElement('button', { ref: triggerRef, id: 'trigger' }, 'Open')));
}

function render(open: boolean) {
  act(() => root.render(createElement(Harness, { open })));
}

function press(key: string, shiftKey = false) {
  act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, cancelable: true })));
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  matches = true;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  document.documentElement.style.setProperty('--nx-breakpoint-tablet', '900px');
  vi.stubGlobal('matchMedia', vi.fn((query: string) => {
    expect(query).toBe('(max-width: 900px)');
    return { get matches() { return matches; }, addEventListener: (_: string, handler: () => void) => { mediaChanged = handler; }, removeEventListener: vi.fn() };
  }));
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.replaceChildren();
  document.body.style.overflow = '';
  document.documentElement.style.removeProperty('--nx-breakpoint-tablet');
  vi.unstubAllGlobals();
});

describe('responsive sidebar drawer', () => {
  it('makes the closed drawer inert, traps focus while open and restores the trigger', () => {
    render(false);
    expect(document.querySelector<HTMLElement>('#sidebar')?.inert).toBe(true);
    document.querySelector<HTMLElement>('#trigger')?.focus();
    render(true);
    expect(document.querySelector<HTMLElement>('main')?.inert).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.activeElement?.className).toBe('sidebar-close');
    const outside = document.createElement('button');
    document.body.append(outside);
    outside.focus();
    expect(document.activeElement?.className).toBe('sidebar-close');
    press('Tab', true);
    expect(document.activeElement?.id).toBe('last');
    press('Tab');
    expect(document.activeElement?.className).toBe('sidebar-close');
    press('Escape');
    expect(onClose).toHaveBeenCalledOnce();
    render(false);
    expect(document.activeElement?.id).toBe('trigger');
    expect(document.querySelector<HTMLElement>('main')?.inert).toBe(false);
    expect(document.body.style.overflow).toBe('');
  });

  it('releases the modal state when resizing to desktop and closes on either breakpoint transition', () => {
    render(true);
    matches = false;
    act(() => mediaChanged());
    expect(onClose).toHaveBeenCalledOnce();
    expect(document.querySelector<HTMLElement>('#sidebar')?.inert).toBe(false);
    expect(document.querySelector<HTMLElement>('main')?.inert).toBe(false);
    expect(document.body.style.overflow).toBe('');
    render(false);
    document.querySelector<HTMLElement>('#last')?.focus();
    matches = true;
    act(() => mediaChanged());
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(document.querySelector<HTMLElement>('#sidebar')?.inert).toBe(true);
    expect(document.activeElement?.id).toBe('trigger');
  });

  it('preserves a previous scroll lock and leaves focus restoration to an incoming modal', () => {
    render(false);
    document.body.style.overflow = 'clip';
    document.querySelector<HTMLElement>('#trigger')?.focus();
    render(true);
    const modal = document.createElement('button');
    modal.className = 'modal-backdrop';
    document.body.append(modal);
    modal.focus();
    render(false);
    expect(document.activeElement).toBe(modal);
    expect(document.body.style.overflow).toBe('clip');
  });
});
