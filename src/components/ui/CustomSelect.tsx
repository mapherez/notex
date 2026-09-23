import { ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { useEffect, useId, useRef, useState } from 'react';
import type { TagColor } from '../../core/models/models';
import { useClickOutside } from '../../core/utils/useClickOutside';
import { useFloatingPopover } from '../../core/utils/useFloatingPopover';
import { useMenuOptionFocus } from '../../core/utils/useMenuOptionFocus';

export type CustomSelectOption = {
  color?: TagColor;
  disabled?: boolean;
  label: string;
  marker?: string;
  value: string;
};

export function CustomSelect({
  ariaLabel,
  className,
  disabled = false,
  emptyText,
  onChange,
  options,
  placeholder,
  value,
}: {
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  emptyText?: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const selectedOption = options.find((option) => option.value === value);
  const menu = useMenuOptionFocus(open, () => setOpen(false), 1,
    Math.max(0, options.filter((option) => !option.disabled).findIndex((option) => option.value === value)));
  const placeholderLabel = placeholder ?? '';

  useClickOutside(rootRef, open, () => setOpen(false));
  useFloatingPopover(open, menu.triggerRef, menu.menuRef, 'bottom-start');

  useEffect(() => {
    if (disabled && open) {
      setOpen(false);
    }
  }, [disabled, open]);

  function selectOption(option: CustomSelectOption) {
    if (option.disabled) {
      return;
    }

    onChange(option.value);
    menu.closeAndFocus();
  }

  return (
    <div className={clsx('custom-select', className, disabled && 'custom-select--disabled')} ref={rootRef}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}
      onKeyDown={menu.onKeyDown}>
      <button
        className="custom-select__trigger"
        ref={menu.triggerRef}
        type="button"
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="custom-select__value">
          {selectedOption ? <CustomSelectOptionContent option={selectedOption} /> : <span className="custom-select__label">{placeholderLabel}</span>}
        </span>
        <ChevronDown className="custom-select__chevron" />
      </button>
      {open ? (
        <div className="custom-select__menu" ref={menu.menuRef} id={menuId} role="listbox" aria-label={ariaLabel}>
          {options.length ? (
            options.map((option) => (
              <button
                className={clsx('custom-select__option', option.value === value && 'custom-select__option--selected')}
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                disabled={option.disabled}
                tabIndex={-1}
                onClick={() => selectOption(option)}
              >
                <CustomSelectOptionContent option={option} />
              </button>
            ))
          ) : (
            <span className="custom-select__empty">{emptyText}</span>
          )}
        </div>
      ) : null}
    </div>
  );
}

function CustomSelectOptionContent({ option }: { option: CustomSelectOption }) {
  return (
    <>
      {option.color ? <span className={`notes-filter-dot ${option.color}`} /> : null}
      {option.marker ? <span className="custom-select__marker">{option.marker}</span> : null}
      <span className="custom-select__label">{option.label}</span>
    </>
  );
}
