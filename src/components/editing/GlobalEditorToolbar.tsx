import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bold,
  Check,
  ChevronDown,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Quote,
  Strikethrough,
  Table2,
  Underline,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { useRef, useState, type ReactNode } from 'react';
import type { MarkdownBlockStyle } from '../../core/utils/markdownFormatting';
import type { MarkdownTableAction } from '../../core/utils/markdownTables';
import { useClickOutside } from '../../core/utils/useClickOutside';
import { useI18n } from '../../i18n/I18nProvider';
import { useEditorToolbar } from './EditorToolbarContext';
import { TextStyleToolbar } from './TextStyleToolbar';

export function GlobalEditorToolbar({
  onCancel,
  onSave,
  saving,
}: {
  onCancel: () => void;
  onSave: () => Promise<void> | void;
  saving: boolean;
}) {
  const { t } = useI18n();
  const { activeTarget, mode, setMode } = useEditorToolbar();
  const [tableMenuOpen, setTableMenuOpen] = useState(false);
  const tableToolRef = useRef<HTMLDivElement>(null);
  const targetActions = activeTarget?.actions;
  const toolsDisabled = saving || mode === 'preview' || !activeTarget || activeTarget.disabled;
  const tableDisabled = toolsDisabled || !targetActions?.applyTableAction;

  useClickOutside(tableToolRef, tableMenuOpen, () => setTableMenuOpen(false));

  function canUse(action?: unknown) {
    return !toolsDisabled && Boolean(action);
  }

  function replaceSelection(fallback: string, prefix: string, suffix?: string) {
    targetActions?.replaceSelection?.({ fallback, prefix, suffix });
  }

  function applyBlockStyle(style: MarkdownBlockStyle) {
    targetActions?.applyBlockStyle?.(style);
  }

  function applyTableAction(action: MarkdownTableAction) {
    targetActions?.applyTableAction?.(action);
    setTableMenuOpen(false);
  }

  return (
    <div className="note-edit-toolbar-shell">
      <div className="note-edit-toolbar" aria-label={t('editor.toolbar')}>
        <div className="editor-tabs note-edit-toolbar__mode" role="tablist" aria-label={t('editor.toolbar')}>
          <button
            className={mode === 'text' ? 'active' : undefined}
            type="button"
            role="tab"
            aria-selected={mode === 'text'}
            onClick={() => setMode('text')}
          >
            {t('editor.text')}
          </button>
          <button
            className={mode === 'preview' ? 'active' : undefined}
            type="button"
            role="tab"
            aria-selected={mode === 'preview'}
            onClick={() => setMode('preview')}
          >
            {t('editor.preview')}
          </button>
        </div>

        <span className="toolbar-divider" />

        <div className={clsx('note-edit-toolbar__tools', toolsDisabled && 'note-edit-toolbar__tools--disabled')}>
          <ToolbarButton
            disabled={!canUse(targetActions?.replaceSelection)}
            label={t('editor.bold')}
            onClick={() => replaceSelection(t('editor.boldText'), '**')}
          >
            <Bold />
          </ToolbarButton>
          <ToolbarButton
            disabled={!canUse(targetActions?.replaceSelection)}
            label={t('editor.italic')}
            onClick={() => replaceSelection(t('editor.italicText'), '*')}
          >
            <Italic />
          </ToolbarButton>
          <ToolbarButton
            disabled={!canUse(targetActions?.replaceSelection)}
            label={t('editor.underline')}
            onClick={() => replaceSelection(t('editor.underlinedText'), '[[u]]', '[[/u]]')}
          >
            <Underline />
          </ToolbarButton>
          <ToolbarButton
            disabled={!canUse(targetActions?.replaceSelection)}
            label={t('editor.strikethrough')}
            onClick={() => replaceSelection(t('editor.strikethroughText'), '~~')}
          >
            <Strikethrough />
          </ToolbarButton>
          <TextStyleToolbar
            compact
            disabled={!canUse(targetActions?.applyInlineStyle)}
            onSelect={(kind, color) => targetActions?.applyInlineStyle?.(kind, color)}
          />

          <span className="toolbar-divider" />

          <ToolbarButton
            disabled={!canUse(targetActions?.applyBlockStyle)}
            label={t('editor.heading1')}
            onClick={() => applyBlockStyle('heading-1')}
          >
            <Heading1 />
          </ToolbarButton>
          <ToolbarButton
            disabled={!canUse(targetActions?.applyBlockStyle)}
            label={t('editor.heading2')}
            onClick={() => applyBlockStyle('heading-2')}
          >
            <Heading2 />
          </ToolbarButton>
          <ToolbarButton
            disabled={!canUse(targetActions?.applyBlockStyle)}
            label={t('editor.heading3')}
            onClick={() => applyBlockStyle('heading-3')}
          >
            <Heading3 />
          </ToolbarButton>
          <ToolbarButton
            disabled={!canUse(targetActions?.applyBlockStyle)}
            label={t('editor.bulletList')}
            onClick={() => applyBlockStyle('bullet-list')}
          >
            <List />
          </ToolbarButton>
          <ToolbarButton
            disabled={!canUse(targetActions?.applyBlockStyle)}
            label={t('editor.numberedList')}
            onClick={() => applyBlockStyle('numbered-list')}
          >
            <ListOrdered />
          </ToolbarButton>
          <ToolbarButton
            disabled={!canUse(targetActions?.applyBlockStyle)}
            label={t('editor.checkList')}
            onClick={() => applyBlockStyle('check-list')}
          >
            <ListChecks />
          </ToolbarButton>
          <ToolbarButton
            disabled={!canUse(targetActions?.applyBlockStyle)}
            label={t('editor.quote')}
            onClick={() => applyBlockStyle('quote')}
          >
            <Quote />
          </ToolbarButton>

          <span className="toolbar-divider" />

          <ToolbarButton
            disabled={!canUse(targetActions?.replaceSelection)}
            label={t('editor.inlineCode')}
            onClick={() => replaceSelection(t('editor.codeText'), '`')}
          >
            <Code />
          </ToolbarButton>
          <ToolbarButton disabled={!canUse(targetActions?.insertCodeBlock)} label={t('editor.codeBlock')} onClick={() => targetActions?.insertCodeBlock?.()}>
            <Code />
          </ToolbarButton>
          <ToolbarButton disabled={!canUse(targetActions?.insertLink)} label={t('editor.link')} onClick={() => targetActions?.insertLink?.()}>
            <Link2 />
          </ToolbarButton>
          <div className="table-tool" ref={tableToolRef}>
            <button
              className="markdown-tool-button"
              type="button"
              disabled={tableDisabled}
              aria-expanded={tableMenuOpen}
              aria-label={t('editor.tableMenu')}
              onClick={() => setTableMenuOpen((open) => !open)}
            >
              <Table2 />
              <ChevronDown />
            </button>
            {tableMenuOpen ? (
              <div className="markdown-table-menu">
                <ToolbarButton disabled={tableDisabled} label={t('editor.insertTable')} onClick={() => applyTableAction('insert-table')}>
                  <Table2 />
                </ToolbarButton>
                <ToolbarButton
                  disabled={tableDisabled || !activeTarget?.canEditCurrentTable}
                  label={t('editor.addRowAbove')}
                  onClick={() => applyTableAction('row-above')}
                >
                  <ArrowUp />
                </ToolbarButton>
                <ToolbarButton
                  disabled={tableDisabled || !activeTarget?.canEditCurrentTable}
                  label={t('editor.addRowBelow')}
                  onClick={() => applyTableAction('row-below')}
                >
                  <ArrowDown />
                </ToolbarButton>
                <ToolbarButton
                  disabled={tableDisabled || !activeTarget?.canEditCurrentTable}
                  label={t('editor.addColumnLeft')}
                  onClick={() => applyTableAction('column-left')}
                >
                  <ArrowLeft />
                </ToolbarButton>
                <ToolbarButton
                  disabled={tableDisabled || !activeTarget?.canEditCurrentTable}
                  label={t('editor.addColumnRight')}
                  onClick={() => applyTableAction('column-right')}
                >
                  <ArrowRight />
                </ToolbarButton>
              </div>
            ) : null}
          </div>
        </div>

        <span className="toolbar-divider note-edit-toolbar__actions-divider" />

        <div className="note-edit-toolbar__actions">
          <button className="editor-cancel-button" disabled={saving} type="button" onClick={onCancel}>
            <X />
            {t('common.cancel')}
          </button>
          <button className="editor-accept-button" disabled={saving} type="button" onClick={() => void onSave()}>
            <Check />
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

function ToolbarButton({
  children,
  disabled = false,
  label,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className="markdown-tool-button" disabled={disabled} title={label} type="button" aria-label={label} onClick={onClick}>
      {children}
    </button>
  );
}
