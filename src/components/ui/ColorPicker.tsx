import { Check, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { useEffect, useId, useRef, useState } from 'react';
import type { TagColor } from '../../core/models/models';
import { tagColorOptions } from '../../core/utils/tagColors';
import { useClickOutside } from '../../core/utils/useClickOutside';
import { useI18n } from '../../i18n/I18nProvider';

export function ColorPicker({
  ariaLabel,
  className,
  disabled = false,
  onChange,
  value,
}: {
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  onChange: (color: TagColor) => void;
  value: TagColor;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const selectedLabel = t(`tags.colors.${value}`);

  useClickOutside(pickerRef, open, () => setOpen(false));

  useEffect(() => {
    if (disabled && open) {
      setOpen(false);
    }
  }, [disabled, open]);

  function selectColor(color: TagColor) {
    onChange(color);
    setOpen(false);
  }

  return (
    <div className={clsx('color-picker', disabled && 'color-picker--disabled', className)} ref={pickerRef}>
      <button
        className="color-picker__trigger"
        type="button"
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={`color-picker__preview color-picker__preview--${value}`} />
        <span className="color-picker__label">{selectedLabel}</span>
        <ChevronDown className="color-picker__chevron" />
      </button>
      {open ? (
        <div className="color-picker__menu color-palette-menu" id={menuId} role="listbox" aria-label={ariaLabel}>
          {tagColorOptions.map((color) => (
            <button
              className={clsx('color-palette-menu__swatch', `color-palette-menu__swatch--${color}`, color === value && 'is-selected')}
              key={color}
              type="button"
              role="option"
              aria-label={t(`tags.colors.${color}`)}
              aria-selected={color === value}
              title={t(`tags.colors.${color}`)}
              onClick={() => selectColor(color)}
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
