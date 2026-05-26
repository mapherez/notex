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
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ClipboardEvent, ReactNode } from 'react';
import {
  applyInlineFormatToken,
  applyInlineStyleToken,
  type InlineStyleColor,
  type InlineStyleKind,
} from '../../core/utils/inlineFormatting';
import { htmlToMarkdown } from '../../core/utils/htmlToMarkdown';
import { applyMarkdownBlockStyle, type MarkdownBlockStyle } from '../../core/utils/markdownFormatting';
import {
  applyMarkdownTableAction,
  hasMarkdownTableAtCursor,
  type MarkdownTableAction,
  type MarkdownTextEdit,
} from '../../core/utils/markdownTables';
import { useClickOutside } from '../../core/utils/useClickOutside';
import { useI18n } from '../../i18n/I18nProvider';
import { useEditorToolbarTarget, type EditorToolbarMode, type EditorToolbarTarget } from './EditorToolbarContext';
import { MarkdownPreview } from './MarkdownPreview';
import { TextStyleToolbar } from './TextStyleToolbar';

type MarkdownEditorTab = EditorToolbarMode;

export function MarkdownEditor({
  bare = false,
  className,
  compact = false,
  label,
  onAccept,
  onCancel,
  onChange,
  placeholder,
  rows = 8,
  showActions = true,
  showTabs = true,
  showToolbar = true,
  value,
}: {
  bare?: boolean;
  className?: string;
  compact?: boolean;
  label: string;
  onAccept?: (value: string) => Promise<void> | void;
  onCancel?: () => void;
  onChange?: (value: string) => void;
  placeholder?: string;
  rows?: number;
  showActions?: boolean;
  showTabs?: boolean;
  showToolbar?: boolean;
  value: string;
}) {
  const { t } = useI18n();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const tableToolRef = useRef<HTMLDivElement>(null);
  const targetId = useId();
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

  const updateDraft = useCallback((value: string) => {
    setDraft(value);
    onChange?.(value);
  }, [onChange]);

  const syncSelection = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    setSelectionStart(textarea.selectionStart);
    setSelectionEnd(textarea.selectionEnd);
  }, []);

  const applyTextEdit = useCallback((edit: MarkdownTextEdit) => {
    updateDraft(edit.text);
    setSelectionStart(edit.selectionStart);
    setSelectionEnd(edit.selectionEnd);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(edit.selectionStart, edit.selectionEnd);
    });
  }, [updateDraft]);

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
      applyTextEdit(
        applyInlineFormatToken({
          fallback,
          prefix,
          selectionEnd,
          selectionStart,
          suffix,
          text: draft,
        }),
      );
    },
    [applyTextEdit, draft, selectionEnd, selectionStart],
  );

  const applyBlockStyle = useCallback(
    (style: MarkdownBlockStyle) => {
      applyTextEdit(
        applyMarkdownBlockStyle({
          selectionEnd,
          selectionStart,
          style,
          text: draft,
        }),
      );
    },
    [applyTextEdit, draft, selectionEnd, selectionStart],
  );

  const insertLink = useCallback(() => {
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
  }, [applyTextEdit, draft, selectionEnd, selectionStart, t]);

  const insertCodeBlock = useCallback(() => {
    const selected = draft.slice(selectionStart, selectionEnd) || t('editor.codeText');
    const insertion = ['```', selected, '```'].join('\n');
    const next = `${draft.slice(0, selectionStart)}${insertion}${draft.slice(selectionEnd)}`;

    applyTextEdit({
      text: next,
      selectionStart: selectionStart + 4,
      selectionEnd: selectionStart + 4 + selected.length,
      changed: true,
    });
  }, [applyTextEdit, draft, selectionEnd, selectionStart, t]);

  const insertTextAtSelection = useCallback((text: string) => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? selectionStart;
    const end = textarea?.selectionEnd ?? selectionEnd;
    const next = `${draft.slice(0, start)}${text}${draft.slice(end)}`;
    const cursor = start + text.length;

    applyTextEdit({
      text: next,
      selectionStart: cursor,
      selectionEnd: cursor,
      changed: true,
    });
  }, [applyTextEdit, draft, selectionEnd, selectionStart]);

  const handlePaste = useCallback((event: ClipboardEvent<HTMLTextAreaElement>) => {
    const html = event.clipboardData.getData('text/html');
    if (!html.trim()) {
      return;
    }

    const markdown = htmlToMarkdown(html);
    if (!markdown.trim()) {
      return;
    }

    event.preventDefault();
    insertTextAtSelection(markdown);
  }, [insertTextAtSelection]);

  const applyTableAction = useCallback((action: MarkdownTableAction) => {
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
  }, [applyTextEdit, draft, selectionEnd, selectionStart]);

  const applyInlineStyle = useCallback((kind: InlineStyleKind, color: InlineStyleColor | null) => {
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
  }, [applyTextEdit, draft, selectionEnd, selectionStart, t]);

  const toolbarTarget = useMemo<EditorToolbarTarget>(
    () => ({
      id: targetId,
      kind: 'markdown',
      disabled: saving,
      canEditCurrentTable,
      actions: {
        applyBlockStyle,
        applyInlineStyle,
        applyTableAction,
        insertCodeBlock,
        insertLink,
        replaceSelection,
      },
    }),
    [applyBlockStyle, applyInlineStyle, applyTableAction, canEditCurrentTable, insertCodeBlock, insertLink, replaceSelection, saving, targetId],
  );
  const editorToolbar = useEditorToolbarTarget(toolbarTarget);
  const currentTab = editorToolbar.mode ?? activeTab;
  const setCurrentTab = editorToolbar.setMode ?? setActiveTab;

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
    <div className={clsx('markdown-editor', bare && 'bare', compact && 'compact', className)}>
      {showTabs ? (
        <div className="markdown-editor-top">
          <div className="editor-tabs" role="tablist" aria-label={label}>
            <button
              className={currentTab === 'text' ? 'active' : undefined}
              type="button"
              role="tab"
              aria-selected={currentTab === 'text'}
              onClick={() => setCurrentTab('text')}
            >
              {t('editor.text')}
            </button>
            <button
              className={currentTab === 'preview' ? 'active' : undefined}
              type="button"
              role="tab"
              aria-selected={currentTab === 'preview'}
              onClick={() => setCurrentTab('preview')}
            >
              {t('editor.preview')}
            </button>
          </div>
        </div>
      ) : null}

      {currentTab === 'text' ? (
        <>
          {showToolbar ? (
            <div className="markdown-toolbar" aria-label={t('editor.toolbar')}>
              <ToolbarButton label={t('editor.bold')} onClick={() => replaceSelection({ fallback: t('editor.boldText'), prefix: '**' })}>
                <Bold />
              </ToolbarButton>
              <ToolbarButton label={t('editor.italic')} onClick={() => replaceSelection({ fallback: t('editor.italicText'), prefix: '*' })}>
                <Italic />
              </ToolbarButton>
              <ToolbarButton label={t('editor.underline')} onClick={() => replaceSelection({ fallback: t('editor.underlinedText'), prefix: '[[u]]', suffix: '[[/u]]' })}>
                <Underline />
              </ToolbarButton>
              <ToolbarButton label={t('editor.strikethrough')} onClick={() => replaceSelection({ fallback: t('editor.strikethroughText'), prefix: '~~' })}>
                <Strikethrough />
              </ToolbarButton>
              <ToolbarButton label={t('editor.heading1')} onClick={() => applyBlockStyle('heading-1')}>
                <Heading1 />
              </ToolbarButton>
              <ToolbarButton label={t('editor.heading2')} onClick={() => applyBlockStyle('heading-2')}>
                <Heading2 />
              </ToolbarButton>
              <ToolbarButton label={t('editor.heading3')} onClick={() => applyBlockStyle('heading-3')}>
                <Heading3 />
              </ToolbarButton>
              <TextStyleToolbar compact disabled={saving} onSelect={applyInlineStyle} />
              <span className="toolbar-divider" />
              <ToolbarButton label={t('editor.bulletList')} onClick={() => applyBlockStyle('bullet-list')}>
                <List />
              </ToolbarButton>
              <ToolbarButton label={t('editor.numberedList')} onClick={() => applyBlockStyle('numbered-list')}>
                <ListOrdered />
              </ToolbarButton>
              <ToolbarButton label={t('editor.checkList')} onClick={() => applyBlockStyle('check-list')}>
                <ListChecks />
              </ToolbarButton>
              <ToolbarButton label={t('editor.quote')} onClick={() => applyBlockStyle('quote')}>
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
          ) : null}
          <textarea
            ref={textareaRef}
            className="markdown-textarea"
            disabled={saving}
            onChange={(event) => updateDraft(event.target.value)}
            onClick={syncSelection}
            onFocus={editorToolbar.activateTarget}
            onKeyUp={syncSelection}
            onPaste={handlePaste}
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

