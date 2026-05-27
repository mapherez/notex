import { Baseline, ChevronDown, Eraser, Highlighter } from 'lucide-react';
import clsx from 'clsx';
import { useCallback, useId, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  applyInlineFormatToken,
  applyInlineStyleToken,
  inlineStyleColors,
  type InlineStyleColor,
  type InlineStyleKind,
} from '../../core/utils/inlineFormatting';
import { useClickOutside } from '../../core/utils/useClickOutside';
import { useI18n } from '../../i18n/I18nProvider';
import { InlineFormattedText } from './InlineFormattedText';
import { useEditorToolbarTarget, type EditorToolbarTarget } from './EditorToolbarContext';

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
  const { t } = useI18n();
  const controlRef = useRef<TextControlElement | null>(null);
  const targetId = useId();
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);

  const syncSelection = useCallback(() => {
    const control = controlRef.current;
    if (!control) {
      return;
    }

    setSelectionStart(control.selectionStart ?? 0);
    setSelectionEnd(control.selectionEnd ?? 0);
  }, []);

  const applyTextEdit = useCallback(
    (edit: { selectionEnd: number; selectionStart: number; text: string }) => {
      onChange(edit.text);
      setSelectionStart(edit.selectionStart);
      setSelectionEnd(edit.selectionEnd);
      requestAnimationFrame(() => {
        controlRef.current?.focus();
        controlRef.current?.setSelectionRange(edit.selectionStart, edit.selectionEnd);
      });
    },
    [onChange],
  );

  const replaceSelection = useCallback(
    ({
      fallback,
      prefix,
      suffix = prefix,
    }: {
      fallback: string;
      prefix: string;
      suffix?: string;
    }) => {
      const control = controlRef.current;
      const start = control?.selectionStart ?? selectionStart;
      const end = control?.selectionEnd ?? selectionEnd;
      applyTextEdit(
        applyInlineFormatToken({
          fallback,
          prefix,
          selectionEnd: end,
          selectionStart: start,
          suffix,
          text: value,
        }),
      );
    },
    [applyTextEdit, selectionEnd, selectionStart, value],
  );

  const insertLink = useCallback(() => {
    const control = controlRef.current;
    const start = control?.selectionStart ?? selectionStart;
    const end = control?.selectionEnd ?? selectionEnd;
    const selected = value.slice(start, end);
    const labelText = selected || t('editor.linkText');
    const insertion = `[${labelText}](https://)`;
    const next = `${value.slice(0, start)}${insertion}${value.slice(end)}`;
    const urlStart = start + labelText.length + 3;

    applyTextEdit({
      text: next,
      selectionStart: urlStart,
      selectionEnd: urlStart + 8,
    });
  }, [applyTextEdit, selectionEnd, selectionStart, t, value]);

  const applyStyle = useCallback(
    (kind: InlineStyleKind, color: InlineStyleColor | null) => {
      const control = controlRef.current;
      const start = control?.selectionStart ?? selectionStart;
      const end = control?.selectionEnd ?? selectionEnd;
      const edit = applyInlineStyleToken({
        color,
        fallback: kind === 'color' ? t('editor.coloredText') : t('editor.highlightedText'),
        kind,
        selectionEnd: end,
        selectionStart: start,
        text: value,
      });

      applyTextEdit(edit);
    },
    [applyTextEdit, selectionEnd, selectionStart, t, value],
  );

  const toolbarTarget = useMemo<EditorToolbarTarget>(
    () => ({
      id: targetId,
      kind: 'plain',
      disabled,
      actions: {
        applyInlineStyle: applyStyle,
        insertLink,
        replaceSelection,
      },
    }),
    [applyStyle, disabled, insertLink, replaceSelection, targetId],
  );
  const editorToolbar = useEditorToolbarTarget(toolbarTarget);
  const isPreview = editorToolbar.mode === 'preview';

  const controlProps = {
    autoFocus,
    className: controlClassName,
    disabled,
    onChange: (event: ChangeEvent<TextControlElement>) => onChange(event.target.value),
    onClick: syncSelection,
    onFocus: editorToolbar.activateTarget,
    onKeyUp: syncSelection,
    onSelect: syncSelection,
    placeholder,
    ref: (element: TextControlElement | null) => {
      controlRef.current = element;
    },
    value,
  };

  if (isPreview) {
    return (
      <div className={clsx('styled-text-field', className)}>
        <div className={clsx(controlClassName, 'styled-text-preview', multiline && 'styled-text-preview--multiline')}>
          {value.trim() ? (
            multiline ? (
              value.split('\n').map((line, index) => (
                <p key={index}>
                  <InlineFormattedText value={line} />
                </p>
              ))
            ) : (
              <InlineFormattedText value={value} />
            )
          ) : (
            <span className="styled-text-preview__placeholder">{placeholder}</span>
          )}
        </div>
      </div>
    );
  }

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
