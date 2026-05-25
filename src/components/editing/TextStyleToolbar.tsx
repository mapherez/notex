import { Baseline, ChevronDown, Highlighter } from 'lucide-react';
import clsx from 'clsx';
import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  applyInlineStyleToken,
  inlineStyleColors,
  type InlineStyleColor,
  type InlineStyleKind,
} from '../../core/utils/inlineFormatting';
import { useClickOutside } from '../../core/utils/useClickOutside';
import { useI18n } from '../../i18n/I18nProvider';

type TextControlElement = HTMLInputElement | HTMLTextAreaElement;

export function TextStyleToolbar({
  compact = false,
  disabled = false,
  onSelect,
}: {
  compact?: boolean;
  disabled?: boolean;
  onSelect: (kind: InlineStyleKind, color: InlineStyleColor) => void;
}) {
  const { t } = useI18n();

  return (
    <div className={clsx('text-style-toolbar', compact && 'text-style-toolbar--compact')} aria-label={t('editor.textStyleToolbar')}>
      <TextStylePicker disabled={disabled} kind="color" label={t('editor.textColor')} onSelect={onSelect} />
      <TextStylePicker disabled={disabled} kind="bg" label={t('editor.highlightColor')} onSelect={onSelect} />
    </div>
  );
}

export function StyledTextField({
  className,
  controlClassName,
  disabled = false,
  multiline = false,
  onChange,
  placeholder,
  rows = 4,
  value,
}: {
  className?: string;
  controlClassName?: string;
  disabled?: boolean;
  multiline?: boolean;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  value: string;
}) {
  const { t } = useI18n();
  const controlRef = useRef<TextControlElement | null>(null);
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);

  function syncSelection() {
    const control = controlRef.current;
    if (!control) {
      return;
    }

    setSelectionStart(control.selectionStart ?? 0);
    setSelectionEnd(control.selectionEnd ?? 0);
  }

  function applyStyle(kind: InlineStyleKind, color: InlineStyleColor) {
    const edit = applyInlineStyleToken({
      color,
      fallback: kind === 'color' ? t('editor.coloredText') : t('editor.highlightedText'),
      kind,
      selectionEnd,
      selectionStart,
      text: value,
    });

    onChange(edit.text);
    setSelectionStart(edit.selectionStart);
    setSelectionEnd(edit.selectionEnd);
    requestAnimationFrame(() => {
      controlRef.current?.focus();
      controlRef.current?.setSelectionRange(edit.selectionStart, edit.selectionEnd);
    });
  }

  const controlProps = {
    className: controlClassName,
    disabled,
    onChange: (event: ChangeEvent<TextControlElement>) => onChange(event.target.value),
    onClick: syncSelection,
    onKeyUp: syncSelection,
    onSelect: syncSelection,
    placeholder,
    ref: (element: TextControlElement | null) => {
      controlRef.current = element;
    },
    value,
  };

  return (
    <div className={clsx('styled-text-field', className)}>
      <TextStyleToolbar compact disabled={disabled} onSelect={applyStyle} />
      {multiline ? <textarea {...controlProps} rows={rows} /> : <input {...controlProps} type="text" />}
    </div>
  );
}

function TextStylePicker({
  disabled,
  kind,
  label,
  onSelect,
}: {
  disabled: boolean;
  kind: InlineStyleKind;
  label: string;
  onSelect: (kind: InlineStyleKind, color: InlineStyleColor) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const Icon = kind === 'color' ? Baseline : Highlighter;

  useClickOutside(pickerRef, open, () => setOpen(false));

  return (
    <div className="text-style-picker" ref={pickerRef}>
      <button
        className="markdown-tool-button text-style-picker__trigger"
        disabled={disabled}
        type="button"
        title={label}
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon />
        <ChevronDown />
      </button>
      {open ? (
        <div className="text-style-picker__menu" role="menu" aria-label={label}>
          {inlineStyleColors.map((color) => (
            <button
              className={`text-style-picker__swatch text-style-picker__swatch--${kind}-${color}`}
              key={color}
              type="button"
              title={t(`tags.colors.${color}`)}
              aria-label={`${label}: ${t(`tags.colors.${color}`)}`}
              onClick={() => {
                onSelect(kind, color);
                setOpen(false);
              }}
            >
              <span />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
