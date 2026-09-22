import { Baseline, ChevronDown, Eraser, Highlighter } from 'lucide-react';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  inlineStyleColors,
  type InlineStyleColor,
  type InlineStyleKind,
} from '../../core/utils/inlineFormatting';
import { useClickOutside } from '../../core/utils/useClickOutside';
import { useMenuOptionFocus } from '../../core/utils/useMenuOptionFocus';
import { useFloatingPopover } from '../../core/utils/useFloatingPopover';
import { useI18n } from '../../i18n/I18nProvider';

type TextControlElement = HTMLInputElement | HTMLTextAreaElement;

export function TextStyleToolbar({
  activeBackground = false,
  activeColor = false,
  compact = false,
  disabled = false,
  floatingMenus = false,
  menusEnabled = true,
  onSelect,
}: {
  activeBackground?: boolean;
  activeColor?: boolean;
  compact?: boolean;
  disabled?: boolean;
  floatingMenus?: boolean;
  menusEnabled?: boolean;
  onSelect: (kind: InlineStyleKind, color: InlineStyleColor | null) => void;
}) {
  const { t } = useI18n();

  return (
    <div className={clsx('text-style-toolbar', compact && 'text-style-toolbar--compact')} aria-label={t('editor.textStyleToolbar')}>
      <TextStylePicker active={activeColor} disabled={disabled} floatingMenu={floatingMenus} kind="color" label={t('editor.textColor')} menuEnabled={menusEnabled} onSelect={onSelect} />
      <TextStylePicker active={activeBackground} disabled={disabled} floatingMenu={floatingMenus} kind="bg" label={t('editor.highlightColor')} menuEnabled={menusEnabled} onSelect={onSelect} />
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
  active,
  disabled,
  floatingMenu,
  kind,
  label,
  menuEnabled,
  onSelect,
}: {
  active: boolean;
  disabled: boolean;
  floatingMenu: boolean;
  kind: InlineStyleKind;
  label: string;
  menuEnabled: boolean;
  onSelect: (kind: InlineStyleKind, color: InlineStyleColor | null) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const menu = useMenuOptionFocus(open, () => setOpen(false), 1, 0, !floatingMenu);
  const Icon = kind === 'color' ? Baseline : Highlighter;

  useClickOutside(pickerRef, open, () => setOpen(false), floatingMenu ? menu.menuRef : undefined);
  useFloatingPopover(open && floatingMenu, menu.triggerRef, menu.menuRef, 'top-start', null, 'fixed');

  useEffect(() => {
    if (!menuEnabled) setOpen(false);
  }, [menuEnabled]);

  function closeMenuAfterSelection() {
    if (floatingMenu) setOpen(false);
    else menu.closeAndFocus();
  }

  const pickerMenu = open ? (
    <div
      className={clsx('text-style-picker__menu', floatingMenu && 'responsive-popover note-toolbar-popover')}
      ref={menu.menuRef}
      role="menu"
      aria-label={label}
    >
      <button
        className="text-style-picker__reset"
        type="button"
        role="menuitem"
        tabIndex={-1}
        title={kind === 'color' ? t('editor.automaticColor') : t('editor.noHighlightColor')}
        aria-label={kind === 'color' ? `${label}: ${t('editor.automaticColor')}` : `${label}: ${t('editor.noHighlightColor')}`}
        onMouseDown={preserveEditorSelection}
          onClick={() => {
            onSelect(kind, null);
            closeMenuAfterSelection();
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
          role="menuitem"
          tabIndex={-1}
          title={t(`tags.colors.${color}`)}
          aria-label={`${label}: ${t(`tags.colors.${color}`)}`}
          onMouseDown={preserveEditorSelection}
          onClick={() => {
            onSelect(kind, color);
            closeMenuAfterSelection();
          }}
        >
          <span />
        </button>
      ))}
    </div>
  ) : null;

  return (
    <div className="text-style-picker" ref={pickerRef} onKeyDown={menu.onKeyDown}>
      <button
        className={clsx('markdown-tool-button text-style-picker__trigger', active && 'is-active')}
        ref={menu.triggerRef}
        disabled={disabled}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-pressed={active}
        onMouseDown={preserveEditorSelection}
        onClick={() => {
          if (menuEnabled) setOpen((value) => !value);
        }}
      >
        <Icon />
        <ChevronDown />
        <span className="markdown-tool-tooltip" role="tooltip">
          <span className="markdown-tool-tooltip__label">{label}</span>
        </span>
      </button>
      {pickerMenu && floatingMenu ? createPortal(pickerMenu, document.body) : pickerMenu}
    </div>
  );
}

function preserveEditorSelection(event: MouseEvent<HTMLElement>) {
  event.preventDefault();
}
