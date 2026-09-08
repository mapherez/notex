import { act, createElement, Fragment } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../i18n/I18nProvider';
import { AppModal } from './AppModal';

type ModalProps = {
  dismissible?: boolean;
  onClose: () => void;
  open: boolean;
};

let root: Root | null = null;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
    root = null;
  }
  document.body.replaceChildren();
  document.body.style.overflow = '';
  vi.unstubAllGlobals();
});

describe('AppModal', () => {
  it('closes from the common button or Escape, but not from the backdrop', () => {
    const onClose = vi.fn();
    renderModal({ onClose, open: true });

    act(() => document.querySelector<HTMLElement>('.modal-backdrop')?.click());
    expect(onClose).not.toHaveBeenCalled();

    act(() => document.querySelector<HTMLButtonElement>('.app-modal__close')?.click());
    expect(onClose).toHaveBeenCalledTimes(1);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('keeps the close button disabled and ignores Escape when not dismissible', () => {
    const onClose = vi.fn();
    renderModal({ dismissible: false, onClose, open: true });

    expect(document.querySelector<HTMLButtonElement>('.app-modal__close')?.disabled).toBe(true);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('traps focus and restores it after closing', () => {
    const launcher = document.createElement('button');
    launcher.textContent = 'Open';
    document.body.append(launcher);
    launcher.focus();

    const onClose = vi.fn();
    renderModal({ onClose, open: true });

    const closeButton = document.querySelector<HTMLButtonElement>('.app-modal__close');
    const lastButton = document.querySelector<HTMLButtonElement>('#last-modal-action');
    expect(document.activeElement).toBe(closeButton);

    lastButton?.focus();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }));
    });
    expect(document.activeElement).toBe(closeButton);

    act(() => renderModalContent({ onClose, open: false }));
    expect(document.activeElement).toBe(launcher);
  });
});

function renderModal(props: ModalProps) {
  const container = document.createElement('div');
  container.id = 'root';
  document.body.append(container);
  root = createRoot(container);
  act(() => renderModalContent(props));
}

function renderModalContent(props: ModalProps) {
  root?.render(
    createElement(
      I18nProvider,
      { locale: 'en' },
      createElement(
        AppModal,
        {
          children: createElement(
            Fragment,
            null,
            createElement('h2', { id: 'test-modal-title' }, 'Test modal'),
            createElement('button', { id: 'first-modal-action', type: 'button' }, 'First'),
            createElement('button', { id: 'last-modal-action', type: 'button' }, 'Last'),
          ),
          dismissible: props.dismissible,
          labelledBy: 'test-modal-title',
          onClose: props.onClose,
          open: props.open,
        },
      ),
    ),
  );
}
