import { createElement, act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomSelect } from './CustomSelect';
import { useMenuOptionFocus } from '../../core/utils/useMenuOptionFocus';

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView'); vi.restoreAllMocks(); });
function press(key: string) {
  const element = document.activeElement as HTMLElement;
  act(() => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    element.dispatchEvent(event);
    if (key === 'Enter' && !event.defaultPrevented) element.click();
  });
}

describe('selector keyboard focus', () => {
  it('opens at the selected option, skips disabled items and returns focus on selection or Escape', () => {
    const onChange = vi.fn();
    act(() => root.render(createElement(CustomSelect, { value: 'a', onChange,
      options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B', disabled: true }, { value: 'c', label: 'C' }] })));
    const trigger = host.querySelector<HTMLButtonElement>('.custom-select__trigger')!;
    trigger.focus(); press('Enter');
    expect(document.activeElement?.textContent).toBe('A');
    press('ArrowDown'); expect(document.activeElement?.textContent).toBe('C');
    press('Enter'); expect(onChange).toHaveBeenCalledWith('c');
    expect(document.activeElement).toBe(trigger);
    expect(host.querySelector('[role=listbox]')).toBeNull();
    press('Enter'); press('ArrowDown'); press('Escape');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(trigger);
    expect(host.querySelector('[role=listbox]')).toBeNull();
  });

  it('opens a thumbnail-style grid at its first item and navigates by rows and columns', () => {
    const selected = vi.fn();
    function Grid() {
      const [open, setOpen] = useState(false);
      const menu = useMenuOptionFocus(open, () => setOpen(false), 3);
      return createElement('div', { onKeyDown: menu.onKeyDown },
        createElement('button', { ref: menu.triggerRef, onClick: () => setOpen(true) }, 'Open'),
        open && createElement('div', { ref: menu.menuRef }, Array.from({ length: 6 }, (_, index) =>
          createElement('button', { key: index, tabIndex: -1, onClick: () => { selected(index); menu.closeAndFocus(); } }, String(index)))));
    }
    act(() => root.render(createElement(Grid)));
    const trigger = host.querySelector('button')!;
    trigger.focus(); press('Enter'); expect(document.activeElement?.textContent).toBe('0');
    press('ArrowRight'); press('ArrowDown'); expect(document.activeElement?.textContent).toBe('4');
    press('Enter'); expect(selected).toHaveBeenCalledWith(4); expect(document.activeElement).toBe(trigger);
    press('Enter'); press('Escape'); expect(document.activeElement).toBe(trigger);
    expect(host.querySelectorAll('button')).toHaveLength(1);
  });
});
