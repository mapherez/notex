import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bold,
  Code,
  Delete,
  FileUp,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  ChevronDown,
  Lightbulb,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Quote,
  SquareCode,
  Strikethrough,
  Table2,
  TableColumnsSplit,
  TableRowsSplit,
  Trash2,
  Underline,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { Node, mergeAttributes, type Editor, type JSONContent } from '@tiptap/core';
import { EditorContent, NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor, type ReactNodeViewProps } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import UnderlineExtension from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { layout, prepare } from '@chenglou/pretext';
import { TextStyleToolbar } from '../editing/TextStyleToolbar';
import type { InlineStyleColor, InlineStyleKind } from '../../core/utils/inlineFormatting';
import type { NoteFile, TiptapDocument } from '../../core/models/models';
import { exportNoteAttachment, openNoteAttachment, resolveNoteFileSrc } from '../../core/services/noteFiles';
import { openExternalUrl } from "../../core/services/externalLinks";
import { useClickOutside } from '../../core/utils/useClickOutside';
import { richTextToTiptapContent } from '../../core/utils/richText';
import { useI18n } from '../../i18n/I18nProvider';
import { emptyTiptapDocument } from '../../store/useNotesStore';

type NoteTiptapEditorProps = {
  autoFocus?: boolean;
  blockId: string;
  disabled?: boolean;
  insertTextRequest?: NoteTiptapInsertTextRequest | null;
  onBlur?: () => void;
  onChange: (contentJson: TiptapDocument, contentText: string) => void;
  onFocus?: () => void;
  onPendingFileInsertChange?: (pending: boolean) => void;
  onRequestFileUpload: () => Promise<NoteFile | null>;
  onToolbarTargetChange: (target: NoteTiptapToolbarTarget) => void;
  value: TiptapDocument | null;
};

export type NoteTiptapToolbarTarget =
  | {
      blockId: string;
      editor: Editor;
      insertFile: () => Promise<void>;
      kind: 'content';
    }
  | {
      blockId?: string;
      editor: Editor;
      id: string;
      kind: 'inline';
    };

export type NoteTiptapInsertTextRequest = {
  nonce: number;
  text: string;
};

type FileAttrs = NoteFile & {
  align?: 'center' | 'left' | 'right';
  width?: number;
  wrap?: 'none' | 'left' | 'right';
};

const FileNode = Node.create({
  name: 'noteFile',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      id: { default: null },
      noteId: { default: null },
      blockId: { default: null },
      kind: { default: 'attachment' },
      originalName: { default: '' },
      mimeType: { default: 'application/octet-stream' },
      sizeBytes: { default: 0 },
      checksum: { default: '' },
      relativePath: { default: '' },
      createdAt: { default: '' },
      align: { default: 'center' },
      width: { default: 420 },
      wrap: { default: 'none' },
    };
  },

  parseHTML() {
    return [{ tag: 'notex-file' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['notex-file', mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FileNodeView);
  },
});

const TipNode = Node.create({
  name: 'noteTip',
  group: 'block',
  content: 'block+',
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      title: { default: 'Tip' },
    };
  },

  parseHTML() {
    return [{ tag: 'notex-tip' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['notex-tip', mergeAttributes(HTMLAttributes), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TipNodeView);
  },
});

const extensions = [
  StarterKit.configure({
    link: false,
  }),
  Placeholder.configure({
    placeholder: '',
  }),
  UnderlineExtension,
  Link.configure({
    openOnClick: false,
    autolink: true,
    defaultProtocol: 'https',
  }),
  TextAlign.configure({
    types: ['heading', 'paragraph'],
  }),
  TextStyle,
  Color,
  Highlight.configure({ multicolor: true }),
  Table.configure({ resizable: true }),
  TableRow,
  TableHeader,
  TableCell,
  TaskList,
  TaskItem.configure({ nested: true }),
  TipNode,
  FileNode,
];

const inlineExtensions = [
  StarterKit.configure({
    blockquote: false,
    bulletList: false,
    codeBlock: false,
    heading: false,
    horizontalRule: false,
    link: false,
    listItem: false,
    orderedList: false,
  }),
  UnderlineExtension,
  Link.configure({
    openOnClick: false,
    autolink: true,
    defaultProtocol: 'https',
  }),
  TextStyle,
  Color,
  Highlight.configure({ multicolor: true }),
];

export function NoteTiptapEditor({
  autoFocus = false,
  blockId,
  disabled = false,
  insertTextRequest = null,
  onBlur,
  onChange,
  onFocus,
  onPendingFileInsertChange,
  onRequestFileUpload,
  onToolbarTargetChange,
  value,
}: NoteTiptapEditorProps) {
  const { t } = useI18n();
  const editorShellRef = useRef<HTMLDivElement>(null);
  const [contentKey, setContentKey] = useState(() =>
    JSON.stringify(value ?? emptyTiptapDocument),
  );
  const [bubbleMenuSuppressed, setBubbleMenuSuppressed] = useState(false);
  const lastInsertTextNonceRef = useRef<number | null>(null);
  const editor = useEditor(
    {
      editable: !disabled,
      extensions,
      content: (value ?? emptyTiptapDocument) as JSONContent,
      immediatelyRender: false,
      onUpdate: ({ editor }) => {
        const json = editor.getJSON() as TiptapDocument;
        setContentKey(JSON.stringify(json));
        onChange(json, editor.getText({ blockSeparator: "\n" }));
      },
      onBlur,
      onFocus,
      editorProps: {
        handleClick: (_view, _pos, event) => handleEditorLinkClick(event),
        attributes: {
          class: "note-tiptap-prosemirror",
        },
      },
    },
    [],
  );

  const insertUploadedFile = useCallback(async () => {
    onPendingFileInsertChange?.(true);
    try {
      const file = await onRequestFileUpload();
      if (!file || !editor) {
        return;
      }
      editor
        .chain()
        .focus()
        .insertContent({
          type: "noteFile",
          attrs: {
            ...file,
            align: "center",
            width: file.kind === "image" ? 420 : 0,
            wrap: "none",
          },
        })
        .run();
      const json = editor.getJSON() as TiptapDocument;
      setContentKey(JSON.stringify(json));
      onChange(json, editor.getText({ blockSeparator: "\n" }));
    } finally {
      requestAnimationFrame(() => onPendingFileInsertChange?.(false));
    }
  }, [editor, onChange, onPendingFileInsertChange, onRequestFileUpload]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (autoFocus && editor) {
      requestAnimationFrame(() => editor.chain().focus("end").run());
    }
  }, [autoFocus, editor]);

  useEffect(() => {
    if (
      !editor ||
      !insertTextRequest ||
      lastInsertTextNonceRef.current === insertTextRequest.nonce
    ) {
      return;
    }

    lastInsertTextNonceRef.current = insertTextRequest.nonce;
    requestAnimationFrame(() => {
      editor.chain().focus("end").insertContent(insertTextRequest.text).run();
    });
  }, [editor, insertTextRequest]);

  useEffect(() => {
    if (!editor || editor.isFocused) {
      return;
    }

    const nextKey = JSON.stringify(value ?? emptyTiptapDocument);
    if (nextKey !== contentKey) {
      editor.commands.setContent(
        (value ?? emptyTiptapDocument) as JSONContent,
        { emitUpdate: false },
      );
      setContentKey(nextKey);
    }
  }, [contentKey, editor, value]);

  useEffect(() => {
    function handleOutsidePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof globalThis.Node)) {
        return;
      }
      if (editorShellRef.current?.contains(target)) {
        return;
      }
      if (target instanceof Element && target.closest(".note-bubble-toolbar")) {
        return;
      }

      setBubbleMenuSuppressed(true);
    }

    document.addEventListener("pointerdown", handleOutsidePointerDown);
    return () =>
      document.removeEventListener("pointerdown", handleOutsidePointerDown);
  }, []);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const showBubbleOnSelection = () => {
      if (!editor.state.selection.empty) {
        setBubbleMenuSuppressed(false);
      }
    };

    editor.on("focus", showBubbleOnSelection);
    editor.on("selectionUpdate", showBubbleOnSelection);

    return () => {
      editor.off("focus", showBubbleOnSelection);
      editor.off("selectionUpdate", showBubbleOnSelection);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const publishTarget = () => {
      onToolbarTargetChange({
        blockId,
        editor,
        insertFile: insertUploadedFile,
        kind: "content",
      });
    };

    editor.on("focus", publishTarget);
    editor.on("selectionUpdate", publishTarget);
    editor.on("update", publishTarget);

    return () => {
      editor.off("focus", publishTarget);
      editor.off("selectionUpdate", publishTarget);
      editor.off("update", publishTarget);
    };
  }, [blockId, editor, insertUploadedFile, onToolbarTargetChange]);

  return (
    <div className="note-tiptap-editor" ref={editorShellRef}>
      {editor ? (
        <BubbleMenu
          className="note-bubble-toolbar"
          editor={editor}
          shouldShow={({ editor, state }) =>
            !bubbleMenuSuppressed &&
            editor.isFocused &&
            !state.selection.empty &&
            !isNoteFileSelection(state.selection)
          }
          updateDelay={0}
        >
          <ToolbarButton
            disabled={disabled}
            label={t("editor.bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold />
          </ToolbarButton>
          <ToolbarButton
            disabled={disabled}
            label={t("editor.italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic />
          </ToolbarButton>
          <ToolbarButton
            disabled={disabled}
            label={t("editor.link")}
            onClick={() => setLink(editor, t("editor.linkText"))}
          >
            <Link2 />
          </ToolbarButton>
        </BubbleMenu>
      ) : null}
      <EditorContent editor={editor} />
    </div>
  );
}

export function NoteInlineTiptapEditor({
  autoFocus = false,
  blockId,
  className,
  disabled = false,
  id,
  insertTextRequest = null,
  onBlur,
  onChange,
  onFocus,
  onToolbarTargetChange,
  placeholder,
  value,
}: {
  autoFocus?: boolean;
  blockId?: string;
  className: string;
  disabled?: boolean;
  id: string;
  insertTextRequest?: NoteTiptapInsertTextRequest | null;
  onBlur?: () => void;
  onChange: (value: string, plainText: string) => void;
  onFocus?: () => void;
  onToolbarTargetChange: (target: NoteTiptapToolbarTarget) => void;
  placeholder: string;
  value: string;
}) {
  const [contentKey, setContentKey] = useState(() => value);
  const lastInsertTextNonceRef = useRef<number | null>(null);
  const fieldExtensions = useMemo(
    () => [
      ...inlineExtensions,
      Placeholder.configure({
        placeholder,
      }),
    ],
    [placeholder],
  );
  const editor = useEditor(
    {
      editable: !disabled,
      extensions: fieldExtensions,
      content: richTextToTiptapContent(value),
      immediatelyRender: false,
      onUpdate: ({ editor }) => {
        const plainText = editor.getText({ blockSeparator: "\n" });
        const nextValue = plainText.trim() ? editor.getHTML() : "";
        setContentKey(nextValue);
        onChange(nextValue, plainText);
      },
      onBlur,
      onFocus,
      editorProps: {
        handleClick: (_view, _pos, event) => handleEditorLinkClick(event),
        attributes: {
          class: `${className} note-inline-prosemirror`,
        },
      },
    },
    [],
  );

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (autoFocus && editor) {
      requestAnimationFrame(() => editor.chain().focus('end').run());
    }
  }, [autoFocus, editor]);

  useEffect(() => {
    if (!editor || !insertTextRequest || lastInsertTextNonceRef.current === insertTextRequest.nonce) {
      return;
    }

    lastInsertTextNonceRef.current = insertTextRequest.nonce;
    requestAnimationFrame(() => {
      editor.chain().focus('end').insertContent(insertTextRequest.text).run();
    });
  }, [editor, insertTextRequest]);

  useEffect(() => {
    if (!editor || editor.isFocused) {
      return;
    }

    if (value !== contentKey) {
      editor.commands.setContent(richTextToTiptapContent(value), { emitUpdate: false });
      setContentKey(value);
    }
  }, [contentKey, editor, value]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const publishTarget = () => {
      onToolbarTargetChange({
        blockId,
        editor,
        id,
        kind: 'inline',
      });
    };

    editor.on('focus', publishTarget);
    editor.on('selectionUpdate', publishTarget);
    editor.on('update', publishTarget);

    return () => {
      editor.off('focus', publishTarget);
      editor.off('selectionUpdate', publishTarget);
      editor.off('update', publishTarget);
    };
  }, [blockId, editor, id, onToolbarTargetChange]);

  return (
    <div className="note-inline-editor">
      <EditorContent editor={editor} />
    </div>
  );
}

export function NoteTiptapToolbar({
  target,
  t,
}: {
  target: NoteTiptapToolbarTarget | null;
  t: ReturnType<typeof useI18n>['t'];
}) {
  const [tableMenuOpen, setTableMenuOpen] = useState(false);
  const tableToolRef = useRef<HTMLDivElement>(null);
  const editor = target?.editor ?? null;
  const contentTarget = target?.kind === 'content' ? target : null;
  const unavailable = !target || !editor;
  const contentUnavailable = unavailable || !contentTarget;
  const tableDisabled = contentUnavailable;
  const canEditCurrentTable = Boolean(editor?.isActive('table'));

  useClickOutside(tableToolRef, tableMenuOpen, () => setTableMenuOpen(false));

  function applyTextStyle(kind: InlineStyleKind, color: InlineStyleColor | null) {
    if (!editor || unavailable) {
      return;
    }

    const chain = editor.chain().focus();
    if (kind === 'color') {
      if (color) {
        chain.setColor(`var(--nx-color-${color})`).run();
      } else {
        chain.unsetColor().run();
      }
      return;
    }

    if (color) {
      chain.setHighlight({ color: `color-mix(in srgb, var(--nx-color-${color}) 28%, transparent)` }).run();
    } else {
      chain.unsetHighlight().run();
    }
  }

  function applyTableAction(action: 'column-delete' | 'column-left' | 'column-right' | 'insert-table' | 'row-above' | 'row-below' | 'row-delete' | 'table-delete') {
    if (!editor || contentUnavailable) {
      return;
    }

    const chain = editor.chain().focus();
    if (action === 'insert-table') {
      chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    } else if (action === 'row-delete') {
      chain.deleteRow().run();
    } else if (action === 'column-delete') {
      chain.deleteColumn().run();
    } else if (action === 'table-delete') {
      chain.deleteTable().run();
    } else if (action === 'row-above') {
      chain.addRowBefore().run();
    } else if (action === 'row-below') {
      chain.addRowAfter().run();
    } else if (action === 'column-left') {
      chain.addColumnBefore().run();
    } else {
      chain.addColumnAfter().run();
    }
    setTableMenuOpen(false);
  }

  return (
    <div
      className="note-edit-toolbar note-tiptap-toolbar"
      aria-label={t("editor.toolbar")}
    >
      <div
        className={
          unavailable
            ? "note-edit-toolbar__tools note-edit-toolbar__tools--disabled"
            : "note-edit-toolbar__tools"
        }
      >
        <ToolbarButton
          disabled={unavailable}
          label={t("editor.bold")}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold />
        </ToolbarButton>
        <ToolbarButton
          disabled={unavailable}
          label={t("editor.italic")}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic />
        </ToolbarButton>
        <ToolbarButton
          disabled={unavailable}
          label={t("editor.underline")}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        >
          <Underline />
        </ToolbarButton>
        <ToolbarButton
          disabled={unavailable}
          label={t("editor.strikethrough")}
          onClick={() => editor?.chain().focus().toggleStrike().run()}
        >
          <Strikethrough />
        </ToolbarButton>
        <TextStyleToolbar
          compact
          disabled={unavailable}
          onSelect={applyTextStyle}
        />

        <span className="toolbar-divider" />

        <ToolbarButton
          disabled={contentUnavailable}
          label={t("editor.heading1")}
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 1 }).run()
          }
        >
          <Heading1 />
        </ToolbarButton>
        <ToolbarButton
          disabled={contentUnavailable}
          label={t("editor.heading2")}
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          <Heading2 />
        </ToolbarButton>
        <ToolbarButton
          disabled={contentUnavailable}
          label={t("editor.heading3")}
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 3 }).run()
          }
        >
          <Heading3 />
        </ToolbarButton>
        <ToolbarButton
          disabled={contentUnavailable}
          label={t("editor.bulletList")}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List />
        </ToolbarButton>
        <ToolbarButton
          disabled={contentUnavailable}
          label={t("editor.numberedList")}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered />
        </ToolbarButton>
        <ToolbarButton
          disabled={contentUnavailable}
          label={t("editor.checkList")}
          onClick={() => editor?.chain().focus().toggleTaskList().run()}
        >
          <ListChecks />
        </ToolbarButton>
        <ToolbarButton
          disabled={contentUnavailable}
          label={t("editor.quote")}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        >
          <Quote />
        </ToolbarButton>
        <ToolbarButton
          disabled={contentUnavailable}
          label={t("noteDetail.tip")}
          onClick={() =>
            editor
              ?.chain()
              .focus()
              .insertContent({
                type: "noteTip",
                attrs: { title: t("noteDetail.tip") },
                content: [{ type: "paragraph" }],
              })
              .run()
          }
        >
          <Lightbulb />
        </ToolbarButton>

        <span className="toolbar-divider" />

        <ToolbarButton
          disabled={unavailable}
          label={t("editor.inlineCode")}
          onClick={() => editor?.chain().focus().toggleCode().run()}
        >
          <Code />
        </ToolbarButton>
        <ToolbarButton
          disabled={contentUnavailable}
          label={t("editor.codeBlock")}
          onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
        >
          <SquareCode />
        </ToolbarButton>
        <ToolbarButton
          disabled={unavailable}
          label={t("editor.link")}
          onClick={() => editor && setLink(editor, t("editor.linkText"))}
        >
          <Link2 />
        </ToolbarButton>
        <div className="table-tool" ref={tableToolRef}>
          <button
            className="markdown-tool-button"
            type="button"
            disabled={tableDisabled}
            aria-expanded={tableMenuOpen}
            aria-label={t("editor.tableMenu")}
            onMouseDown={preserveToolbarSelection}
            onClick={() => setTableMenuOpen((open) => !open)}
          >
            <Table2 />
            <ChevronDown />
          </button>
          {tableMenuOpen ? (
            <div className="markdown-table-menu">
              <ToolbarButton
                disabled={tableDisabled}
                label={t("editor.insertTable")}
                onClick={() => applyTableAction("insert-table")}
              >
                <Table2 />
              </ToolbarButton>
              <ToolbarButton
                disabled={tableDisabled || !canEditCurrentTable}
                label={t("editor.addRowAbove")}
                onClick={() => applyTableAction("row-above")}
              >
                <ArrowUp />
              </ToolbarButton>
              <ToolbarButton
                disabled={tableDisabled || !canEditCurrentTable}
                label={t("editor.addRowBelow")}
                onClick={() => applyTableAction("row-below")}
              >
                <ArrowDown />
              </ToolbarButton>
              <ToolbarButton
                disabled={tableDisabled || !canEditCurrentTable}
                label={t("editor.addColumnLeft")}
                onClick={() => applyTableAction("column-left")}
              >
                <ArrowLeft />
              </ToolbarButton>
              <ToolbarButton
                disabled={tableDisabled || !canEditCurrentTable}
                label={t("editor.addColumnRight")}
                onClick={() => applyTableAction("column-right")}
              >
                <ArrowRight />
              </ToolbarButton>
              <ToolbarButton
                disabled={tableDisabled || !canEditCurrentTable}
                label={t("editor.deleteRow")}
                onClick={() => applyTableAction("row-delete")}
              >
                <TableRowsSplit />
              </ToolbarButton>
              <ToolbarButton
                disabled={tableDisabled || !canEditCurrentTable}
                label={t("editor.deleteColumn")}
                onClick={() => applyTableAction("column-delete")}
              >
                <TableColumnsSplit />
              </ToolbarButton>
              <ToolbarButton
                disabled={tableDisabled || !canEditCurrentTable}
                label={t("editor.deleteTable")}
                onClick={() => applyTableAction("table-delete")}
              >
                <Delete />
              </ToolbarButton>
            </div>
          ) : null}
        </div>

        <span className="toolbar-divider" />

        <ToolbarButton
          disabled={contentUnavailable}
          label={t("notes.editor.addImage")}
          onClick={() => void contentTarget?.insertFile()}
        >
          <ImageIcon />
        </ToolbarButton>
        <ToolbarButton
          disabled={contentUnavailable}
          label={t("notes.editor.addFile")}
          onClick={() => void contentTarget?.insertFile()}
        >
          <FileUp />
        </ToolbarButton>
      </div>
    </div>
  );
}

function TipNodeView({ deleteNode, node }: ReactNodeViewProps) {
  const { t } = useI18n();
  const title = typeof node.attrs.title === 'string' && node.attrs.title.trim() ? node.attrs.title : t('noteDetail.tip');

  return (
    <NodeViewWrapper className="tip-box note-tip-box" data-drag-handle>
      <Lightbulb />
      <div>
        <h2 className="section-title" contentEditable={false}>
          {title}
        </h2>
        <NodeViewContent className="note-tip-content" />
      </div>
      <button
        className="note-tip-delete icon-button danger"
        type="button"
        contentEditable={false}
        aria-label={t('common.delete')}
        title={t('common.delete')}
        onMouseDown={preserveToolbarSelection}
        onClick={deleteNode}
      >
        <Trash2 />
      </button>
    </NodeViewWrapper>
  );
}

function FileNodeView({ editor, node, selected, updateAttributes }: ReactNodeViewProps) {
  const { t } = useI18n();
  const attrs = node.attrs as FileAttrs;
  const imageNodeRef = useRef<HTMLDivElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [editorFocused, setEditorFocused] = useState(editor.isFocused);
  const [controlsFocused, setControlsFocused] = useState(false);
  const [wrapLines, setWrapLines] = useState(1);
  const isImage = attrs.kind === 'image';
  const imageWidth = quantizeImageWidth(Number(attrs.width ?? 420));
  const showImageControls = selected && (editorFocused || controlsFocused);

  useEffect(() => {
    let cancelled = false;
    if (!isImage || !attrs.relativePath) {
      setSrc(null);
      setImageLoadFailed(false);
      return;
    }

    void resolveNoteFileSrc(attrs.relativePath).then((nextSrc) => {
      if (!cancelled) {
        setImageLoadFailed(false);
        setSrc(nextSrc);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [attrs.relativePath, isImage]);

  useEffect(() => {
    const updateFocused = () => setEditorFocused(editor.isFocused);

    editor.on('focus', updateFocused);
    editor.on('blur', updateFocused);
    editor.on('selectionUpdate', updateFocused);

    return () => {
      editor.off('focus', updateFocused);
      editor.off('blur', updateFocused);
      editor.off('selectionUpdate', updateFocused);
    };
  }, [editor]);

  useEffect(() => {
    if (!isImage) {
      return;
    }
    try {
      const measured = layout(prepare(attrs.originalName || 'Image', '14px sans-serif'), Math.max(120, imageWidth), 20);
      setWrapLines(measured.lineCount);
    } catch {
      setWrapLines(1);
    }
  }, [attrs.originalName, imageWidth, isImage]);

  if (!isImage) {
    return (
      <NodeViewWrapper className={selected ? 'note-file-card is-selected' : 'note-file-card'} data-drag-handle>
        <FileUp />
        <span>
          <strong>{attrs.originalName}</strong>
          <small>{formatFileSize(attrs.sizeBytes)}</small>
        </span>
        <button type="button" onClick={() => void openNoteAttachment(attrs.relativePath)}>
          {t('common.open')}
        </button>
        <button type="button" onClick={() => void exportNoteAttachment(attrs)}>
          {t('common.export')}
        </button>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      ref={imageNodeRef}
      className={[
        "note-image-node",
        selected && "is-selected",
        attrs.wrap === "left" && "wrap-left",
        attrs.wrap === "right" && "wrap-right",
        attrs.align === "left" && "align-left",
        attrs.align === "right" && "align-right",
        attrs.align === "center" && "align-center",
        `note-image-size-${imageWidth}`,
      ]
        .filter(Boolean)
        .join(" ")}
      data-drag-handle
      data-wrap-lines={wrapLines}
    >
      <figure>
        {src && !imageLoadFailed ? (
          <img
            src={src}
            alt={attrs.originalName}
            draggable={false}
            onError={() => setImageLoadFailed(true)}
          />
        ) : (
          <span className="note-image-placeholder">{attrs.originalName}</span>
        )}
      </figure>
      {showImageControls ? (
        <div
          className="note-image-controls"
          contentEditable={false}
          onBlurCapture={(event) => {
            if (!imageNodeRef.current?.contains(event.relatedTarget)) {
              setControlsFocused(false);
            }
          }}
          onFocusCapture={() => setControlsFocused(true)}
          onPointerDownCapture={() => setControlsFocused(true)}
        >
          <button
            type="button"
            onMouseDown={preserveToolbarSelection}
            onClick={() => updateAttributes({ align: "left", wrap: "none" })}
          >
            <AlignLeft />
          </button>
          <button
            type="button"
            onMouseDown={preserveToolbarSelection}
            onClick={() => updateAttributes({ align: "center", wrap: "none" })}
          >
            <AlignCenter />
          </button>
          <button
            type="button"
            onMouseDown={preserveToolbarSelection}
            onClick={() => updateAttributes({ align: "right", wrap: "none" })}
          >
            <AlignRight />
          </button>
          <button
            type="button"
            onMouseDown={preserveToolbarSelection}
            onClick={() =>
              updateAttributes({
                wrap: attrs.wrap === "left" ? "none" : "left",
                align: "left",
              })
            }
          >
            {t("notes.editor.wrapLeft")}
          </button>
          <button
            type="button"
            onMouseDown={preserveToolbarSelection}
            onClick={() =>
              updateAttributes({
                wrap: attrs.wrap === "right" ? "none" : "right",
                align: "right",
              })
            }
          >
            {t("notes.editor.wrapRight")}
          </button>
          <input
            type="range"
            min={160}
            max={760}
            step={40}
            value={imageWidth}
            onChange={(event) =>
              updateAttributes({ width: Number(event.currentTarget.value) })
            }
          />
        </div>
      ) : null}
    </NodeViewWrapper>
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
    <button className="markdown-tool-button" disabled={disabled} title={label} type="button" aria-label={label} onMouseDown={preserveToolbarSelection} onClick={onClick}>
      {children}
    </button>
  );
}

function preserveToolbarSelection(event: ReactMouseEvent<HTMLElement>) {
  event.preventDefault();
}

function isNoteFileSelection(selection: unknown) {
  const selectedNode = (selection as { node?: { type?: { name?: string } } }).node;
  return selectedNode?.type?.name === 'noteFile';
}

function handleEditorLinkClick(event: globalThis.MouseEvent) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return false;
  }

  const link = target.closest("a[href]");
  if (
    !(link instanceof HTMLAnchorElement) ||
    !isClickInLinkLaunchZone(link, event)
  ) {
    return false;
  }

  const href = link.href || link.getAttribute("href") || "";
  if (!href || href === "#") {
    return false;
  }

  event.preventDefault();
  event.stopPropagation();
  void openExternalUrl(href);
  return true;
}

function isClickInLinkLaunchZone(
  link: HTMLAnchorElement,
  event: globalThis.MouseEvent,
) {
  const launchZoneWidth = 20;
  return Array.from(link.getClientRects()).some(
    (rect) =>
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom &&
      event.clientX >= rect.right - launchZoneWidth &&
      event.clientX <= rect.right + 4,
  );
}

function setLink(editor: NonNullable<ReturnType<typeof useEditor>>, fallbackLabel: string) {
  const previousUrl = editor.getAttributes('link').href as string | undefined;
  const url = window.prompt(fallbackLabel, previousUrl ?? 'https://');
  if (url === null) {
    return;
  }

  if (!url.trim()) {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    return;
  }

  editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
}

function formatFileSize(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`;
  }
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function quantizeImageWidth(width: number) {
  const clamped = Math.max(160, Math.min(760, Number.isFinite(width) ? width : 420));
  return Math.round(clamped / 40) * 40;
}
