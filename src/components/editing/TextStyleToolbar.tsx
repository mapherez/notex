import { Baseline, ChevronDown, Eraser, Highlighter } from 'lucide-react';
import clsx from 'clsx';
import { useRef, useState } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';
import {
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
  onSelect: (kind: InlineStyleKind, color: InlineStyleColor | null) => void;
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
  autoFocus = false,
  className,
  controlClassName,
  disabled = false,
  multiline = false,
  onChange,
  placeholder,
  rows = 4,
  value,
}: {
  autoFocus?: boolean;
  className?: string;
  controlClassName?: string;
  disabled?: boolean;
  multiline?: boolean;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  value: string;
}) {
  const controlProps = {
    autoFocus,
    className: controlClassName,
    disabled,
    onChange: (event: ChangeEvent<TextControlElement>) => onChange(event.target.value),
    placeholder,
    value,
  };

  return (
    <div className={clsx('styled-text-field', className)}>
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
  onSelect: (kind: InlineStyleKind, color: InlineStyleColor | null) => void;
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
        onMouseDown={preserveEditorSelection}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon />
        <ChevronDown />
      </button>
      {open ? (
        <div className="text-style-picker__menu" role="menu" aria-label={label}>
          <button
            className="text-style-picker__reset"
            type="button"
            title={kind === 'color' ? t('editor.automaticColor') : t('editor.noHighlightColor')}
            aria-label={kind === 'color' ? `${label}: ${t('editor.automaticColor')}` : `${label}: ${t('editor.noHighlightColor')}`}
            onMouseDown={preserveEditorSelection}
            onClick={() => {
              onSelect(kind, null);
              setOpen(false);
            }}
          >
            {kind === 'color' ? <span className="text-style-picker__auto-swatch" /> : <Eraser />}
            <span>{kind === 'color' ? t('editor.automaticColor') : t('editor.noHighlightColor')}</span>
          </button>
          {inlineStyleColors.map((color) => (
            <button
              className={`text-style-picker__swatch text-style-picker__swatch--${kind}-${color}`}
              key={color}
              type="button"
              title={t(`tags.colors.${color}`)}
              aria-label={`${label}: ${t(`tags.colors.${color}`)}`}
              onMouseDown={preserveEditorSelection}
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

function preserveEditorSelection(event: MouseEvent<HTMLElement>) {
  event.preventDefault();
}
