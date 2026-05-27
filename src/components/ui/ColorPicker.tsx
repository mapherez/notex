import { Check, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { TagColor } from '../../core/models/models';
import { tagColorOptions } from '../../core/utils/tagColors';
import { useClickOutside } from '../../core/utils/useClickOutside';
import { useI18n } from '../../i18n/I18nProvider';

const colorPickerColumnCount = 5;

export function ColorPicker({
  ariaLabel,
  className,
  disabled = false,
  onKeyboardCancel,
  onKeyboardCommit,
  onChange,
  value,
}: {
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  onKeyboardCancel?: () => void;
  onKeyboardCommit?: () => void;
  onChange: (color: TagColor) => void;
  value: TagColor;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => selectedColorIndex(value));
  const pickerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const selectedLabel = t(`tags.colors.${value}`);
  const activeColor = tagColorOptions[activeIndex] ?? value;

  useClickOutside(pickerRef, open, () => setOpen(false));

  useEffect(() => {
    if (disabled && open) {
      setOpen(false);
    }
  }, [disabled, open]);

  useEffect(() => {
    if (!open) {
      setActiveIndex(selectedColorIndex(value));
    }
  }, [open, value]);

  function selectColor(color: TagColor, focusAfterSelect?: () => void) {
    onChange(color);
    setOpen(false);
    focusAfterClose(focusAfterSelect);
  }

  function focusAfterClose(focusTarget?: () => void) {
    requestAnimationFrame(() => {
      if (focusTarget) {
        focusTarget();
        return;
      }

      triggerRef.current?.focus();
    });
  }

  function moveActiveColor(offset: number) {
    const selectedIndex = selectedColorIndex(value);
    const startIndex = open ? activeIndex : selectedIndex;
    const nextIndex = wrapIndex(startIndex + offset);

    setActiveIndex(nextIndex);
    setOpen(true);
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      event.stopPropagation();
      moveActiveColor(colorPickerColumnCount);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      moveActiveColor(-colorPickerColumnCount);
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      event.stopPropagation();
      moveActiveColor(1);
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      event.stopPropagation();
      moveActiveColor(-1);
      return;
    }

    if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      focusAfterClose(onKeyboardCancel);
      return;
    }

    if (event.key === 'Enter' && open) {
      event.preventDefault();
      event.stopPropagation();
      selectColor(activeColor, onKeyboardCommit);
      return;
    }

    if (event.key === 'Tab' && open) {
      setOpen(false);
    }
  }

  return (
    <div className={clsx('color-picker', disabled && 'color-picker--disabled', className)} ref={pickerRef}>
      <button
        ref={triggerRef}
        className="color-picker__trigger"
        type="button"
        aria-activedescendant={open ? `${menuId}-option-${activeColor}` : undefined}
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => {
          setActiveIndex(selectedColorIndex(value));
          setOpen((current) => !current);
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className={`color-picker__preview color-picker__preview--${value}`} />
        <span className="color-picker__label">{selectedLabel}</span>
        <ChevronDown className="color-picker__chevron" />
      </button>
      {open ? (
        <div className="color-picker__menu color-palette-menu" id={menuId} role="listbox" aria-label={ariaLabel}>
          {tagColorOptions.map((color, index) => (
            <button
              className={clsx(
                'color-palette-menu__swatch',
                `color-palette-menu__swatch--${color}`,
                color === value && 'is-selected',
                index === activeIndex && 'is-active',
              )}
              id={`${menuId}-option-${color}`}
              key={color}
              type="button"
              role="option"
              aria-label={t(`tags.colors.${color}`)}
              aria-selected={color === value}
              tabIndex={-1}
              title={t(`tags.colors.${color}`)}
              onClick={() => selectColor(color)}
              onMouseEnter={() => setActiveIndex(index)}
            >
              <span />
              {color === value ? <Check /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function selectedColorIndex(color: TagColor) {
  return Math.max(0, tagColorOptions.indexOf(color));
}

function wrapIndex(index: number) {
  return (index + tagColorOptions.length) % tagColorOptions.length;
}
