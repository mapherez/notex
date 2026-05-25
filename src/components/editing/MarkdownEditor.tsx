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
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Quote,
  Table2,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  applyInlineStyleToken,
  type InlineStyleColor,
  type InlineStyleKind,
} from '../../core/utils/inlineFormatting';
import {
  applyMarkdownTableAction,
  hasMarkdownTableAtCursor,
  type MarkdownTableAction,
  type MarkdownTextEdit,
} from '../../core/utils/markdownTables';
import { useClickOutside } from '../../core/utils/useClickOutside';
import { useI18n } from '../../i18n/I18nProvider';
import { MarkdownPreview } from './MarkdownPreview';
import { TextStyleToolbar } from './TextStyleToolbar';

type MarkdownEditorTab = 'preview' | 'text';

export function MarkdownEditor({
  className,
  compact = false,
  label,
  onAccept,
  onCancel,
  onChange,
  placeholder,
  rows = 8,
  showActions = true,
  value,
}: {
  className?: string;
  compact?: boolean;
  label: string;
  onAccept?: (value: string) => Promise<void> | void;
  onCancel?: () => void;
  onChange?: (value: string) => void;
  placeholder?: string;
  rows?: number;
  showActions?: boolean;
  value: string;
}) {
  const { t } = useI18n();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const tableToolRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<MarkdownEditorTab>('text');
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  const [tableMenuOpen, setTableMenuOpen] = useState(false);
  const canEditCurrentTable = useMemo(() => hasMarkdownTableAtCursor(draft, selectionStart), [draft, selectionStart]);

  useClickOutside(tableToolRef, tableMenuOpen, () => setTableMenuOpen(false));

  useEffect(() => {
    setDraft(value);
  }, [value]);

  function updateDraft(value: string) {
    setDraft(value);
    onChange?.(value);
  }

  function syncSelection() {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    setSelectionStart(textarea.selectionStart);
    setSelectionEnd(textarea.selectionEnd);
  }

  function applyTextEdit(edit: MarkdownTextEdit) {
    updateDraft(edit.text);
    setSelectionStart(edit.selectionStart);
    setSelectionEnd(edit.selectionEnd);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(edit.selectionStart, edit.selectionEnd);
    });
  }

  function replaceSelection({
    fallback,
    prefix,
    suffix = prefix,
  }: {
    fallback: string;
    prefix: string;
    suffix?: string;
  }) {
    const selected = draft.slice(selectionStart, selectionEnd) || fallback;
    const next = `${draft.slice(0, selectionStart)}${prefix}${selected}${suffix}${draft.slice(selectionEnd)}`;
    const cursorStart = selectionStart + prefix.length;
    const cursorEnd = cursorStart + selected.length;

    applyTextEdit({
      text: next,
      selectionStart: cursorStart,
      selectionEnd: cursorEnd,
      changed: true,
    });
  }

  function prefixLines(prefixer: (line: string, index: number) => string) {
    const lineStart = draft.lastIndexOf('\n', Math.max(0, selectionStart - 1)) + 1;
    const lineEndSearch = draft.indexOf('\n', selectionEnd);
    const lineEnd = lineEndSearch === -1 ? draft.length : lineEndSearch;
    const selectedBlock = draft.slice(lineStart, lineEnd);
    const nextBlock = selectedBlock
      .split('\n')
      .map((line, index) => prefixer(line, index))
      .join('\n');
    const next = `${draft.slice(0, lineStart)}${nextBlock}${draft.slice(lineEnd)}`;

    applyTextEdit({
      text: next,
      selectionStart: lineStart,
      selectionEnd: lineStart + nextBlock.length,
      changed: true,
    });
  }

  function insertLink() {
    const selected = draft.slice(selectionStart, selectionEnd);
    const labelText = selected || t('editor.linkText');
    const insertion = `[${labelText}](https://)`;
    const next = `${draft.slice(0, selectionStart)}${insertion}${draft.slice(selectionEnd)}`;
    const urlStart = selectionStart + labelText.length + 3;

    applyTextEdit({
      text: next,
      selectionStart: urlStart,
      selectionEnd: urlStart + 8,
      changed: true,
    });
  }

  function insertCodeBlock() {
    const selected = draft.slice(selectionStart, selectionEnd) || t('editor.codeText');
    const insertion = ['```', selected, '```'].join('\n');
    const next = `${draft.slice(0, selectionStart)}${insertion}${draft.slice(selectionEnd)}`;

    applyTextEdit({
      text: next,
      selectionStart: selectionStart + 4,
      selectionEnd: selectionStart + 4 + selected.length,
      changed: true,
    });
  }

  function applyTableAction(action: MarkdownTableAction) {
    const edit = applyMarkdownTableAction({
      action,
      selectionEnd,
      selectionStart,
      text: draft,
    });

    if (edit.changed) {
      applyTextEdit(edit);
    }

    setTableMenuOpen(false);
  }

  function applyInlineStyle(kind: InlineStyleKind, color: InlineStyleColor) {
    applyTextEdit(
      applyInlineStyleToken({
        color,
        fallback: kind === 'color' ? t('editor.coloredText') : t('editor.highlightedText'),
        kind,
        selectionEnd,
        selectionStart,
        text: draft,
      }),
    );
  }

  async function accept() {
    if (!onAccept) {
      return;
    }

    setSaving(true);
    await onAccept(draft);
    setSaving(false);
  }

  function cancel() {
    updateDraft(value);
    onCancel?.();
  }

  return (
    <div className={clsx('markdown-editor', compact && 'compact', className)}>
      <div className="markdown-editor-top">
        <div className="editor-tabs" role="tablist" aria-label={label}>
          <button
            className={activeTab === 'text' ? 'active' : undefined}
            type="button"
            role="tab"
            aria-selected={activeTab === 'text'}
            onClick={() => setActiveTab('text')}
          >
            {t('editor.text')}
          </button>
          <button
            className={activeTab === 'preview' ? 'active' : undefined}
            type="button"
            role="tab"
            aria-selected={activeTab === 'preview'}
            onClick={() => setActiveTab('preview')}
          >
            {t('editor.preview')}
          </button>
        </div>
      </div>

      {activeTab === 'text' ? (
        <>
          <div className="markdown-toolbar" aria-label={t('editor.toolbar')}>
            <ToolbarButton label={t('editor.bold')} onClick={() => replaceSelection({ fallback: t('editor.boldText'), prefix: '**' })}>
              <Bold />
            </ToolbarButton>
            <ToolbarButton label={t('editor.italic')} onClick={() => replaceSelection({ fallback: t('editor.italicText'), prefix: '*' })}>
              <Italic />
            </ToolbarButton>
            <ToolbarButton label={t('editor.heading')} onClick={() => prefixLines((line) => `## ${line.replace(/^#{1,6}\s+/, '')}`)}>
              <Heading1 />
            </ToolbarButton>
            <TextStyleToolbar compact disabled={saving} onSelect={applyInlineStyle} />
            <span className="toolbar-divider" />
            <ToolbarButton label={t('editor.bulletList')} onClick={() => prefixLines((line) => `- ${line.replace(/^[-*+]\s+/, '')}`)}>
              <List />
            </ToolbarButton>
            <ToolbarButton
              label={t('editor.numberedList')}
              onClick={() => prefixLines((line, index) => `${index + 1}. ${line.replace(/^\d+[.)]\s+/, '')}`)}
            >
              <ListOrdered />
            </ToolbarButton>
            <ToolbarButton label={t('editor.checkList')} onClick={() => prefixLines((line) => `- [ ] ${line.replace(/^[-*+]\s+(?:\[[ xX]\]\s+)?/, '')}`)}>
              <ListChecks />
            </ToolbarButton>
            <ToolbarButton label={t('editor.quote')} onClick={() => prefixLines((line) => `> ${line.replace(/^>\s?/, '')}`)}>
              <Quote />
            </ToolbarButton>
            <span className="toolbar-divider" />
            <ToolbarButton label={t('editor.inlineCode')} onClick={() => replaceSelection({ fallback: t('editor.codeText'), prefix: '`' })}>
              <Code />
            </ToolbarButton>
            <ToolbarButton label={t('editor.codeBlock')} onClick={insertCodeBlock}>
              <Code />
            </ToolbarButton>
            <ToolbarButton label={t('editor.link')} onClick={insertLink}>
              <Link2 />
            </ToolbarButton>
            <span className="toolbar-divider" />
            <div className="table-tool" ref={tableToolRef}>
              <button
                className="markdown-tool-button"
                type="button"
                aria-expanded={tableMenuOpen}
                aria-label={t('editor.tableMenu')}
                onClick={() => setTableMenuOpen((open) => !open)}
              >
                <Table2 />
                <ChevronDown />
              </button>
              {tableMenuOpen ? (
                <div className="markdown-table-menu">
                  <ToolbarButton label={t('editor.insertTable')} onClick={() => applyTableAction('insert-table')}>
                    <Table2 />
                  </ToolbarButton>
                  <ToolbarButton disabled={!canEditCurrentTable} label={t('editor.addRowAbove')} onClick={() => applyTableAction('row-above')}>
                    <ArrowUp />
                  </ToolbarButton>
                  <ToolbarButton disabled={!canEditCurrentTable} label={t('editor.addRowBelow')} onClick={() => applyTableAction('row-below')}>
                    <ArrowDown />
                  </ToolbarButton>
                  <ToolbarButton disabled={!canEditCurrentTable} label={t('editor.addColumnLeft')} onClick={() => applyTableAction('column-left')}>
                    <ArrowLeft />
                  </ToolbarButton>
                  <ToolbarButton disabled={!canEditCurrentTable} label={t('editor.addColumnRight')} onClick={() => applyTableAction('column-right')}>
                    <ArrowRight />
                  </ToolbarButton>
                </div>
              ) : null}
            </div>
          </div>
          <textarea
            ref={textareaRef}
            className="markdown-textarea"
            disabled={saving}
            onChange={(event) => updateDraft(event.target.value)}
            onClick={syncSelection}
            onKeyUp={syncSelection}
            onSelect={syncSelection}
            placeholder={placeholder ?? t('editor.placeholder')}
            rows={rows}
            value={draft}
          />
        </>
      ) : (
        <div className="markdown-preview-panel">
          <MarkdownPreview emptyText={t('editor.emptyPreview')} value={draft} />
        </div>
      )}

      {showActions ? (
        <div className="markdown-editor-actions">
          <button className="editor-accept-button" disabled={saving} type="button" onClick={() => void accept()}>
            <Check />
            {t('editor.accept')}
          </button>
          <button className="editor-cancel-button" disabled={saving} type="button" onClick={cancel}>
            <X />
            {t('common.cancel')}
          </button>
        </div>
      ) : null}
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

