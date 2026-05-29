import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  FileUp,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Quote,
  Strikethrough,
  Table2,
  Underline,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Node, mergeAttributes, type Editor, type JSONContent } from '@tiptap/core';
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor, type ReactNodeViewProps } from '@tiptap/react';
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
import { editorSettings } from '../../config/appSettings';
import type { DynamicNoteFile, TiptapDocument } from '../../core/models/models';
import { exportDynamicAttachment, openDynamicAttachment, resolveDynamicFileSrc } from '../../core/services/dynamicFiles';
import { useI18n } from '../../i18n/I18nProvider';
import { emptyTiptapDocument } from '../../store/useDynamicNotesStore';

type DynamicTiptapEditorProps = {
  blockId: string;
  disabled?: boolean;
  onChange: (contentJson: TiptapDocument, contentText: string) => void;
  onRequestFileUpload: () => Promise<DynamicNoteFile | null>;
  onToolbarTargetChange: (target: DynamicTiptapToolbarTarget) => void;
  placeholder: string;
  value: TiptapDocument | null;
};

export type DynamicTiptapToolbarTarget = {
  blockId: string;
  editor: Editor;
  insertFile: () => Promise<void>;
};

type DynamicFileAttrs = DynamicNoteFile & {
  align?: 'center' | 'left' | 'right';
  width?: number;
  wrap?: 'none' | 'left' | 'right';
};

const DynamicFileNode = Node.create({
  name: 'dynamicFile',
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
    return ReactNodeViewRenderer(DynamicFileNodeView);
  },
});

const extensions = [
  StarterKit.configure({
    link: false,
  }),
  Placeholder.configure({
    placeholder: ({ node }) => (node.type.name === 'heading' ? 'Heading' : 'Write...'),
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
  DynamicFileNode,
];

export function DynamicTiptapEditor({
  blockId,
  disabled = false,
  onChange,
  onRequestFileUpload,
  onToolbarTargetChange,
  placeholder,
  value,
}: DynamicTiptapEditorProps) {
  const { t } = useI18n();
  const [contentKey, setContentKey] = useState(() => JSON.stringify(value ?? emptyTiptapDocument));
  const editor = useEditor(
    {
      editable: !disabled,
      extensions,
      content: (value ?? emptyTiptapDocument) as JSONContent,
      immediatelyRender: false,
      onUpdate: ({ editor }) => {
        const json = editor.getJSON() as TiptapDocument;
        setContentKey(JSON.stringify(json));
        onChange(json, editor.getText({ blockSeparator: '\n' }));
      },
      editorProps: {
        attributes: {
          class: 'dynamic-tiptap-prosemirror',
          'data-placeholder': placeholder,
        },
      },
    },
    [],
  );

  const insertUploadedFile = useCallback(async () => {
    const file = await onRequestFileUpload();
    if (!file || !editor) {
      return;
    }
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'dynamicFile',
        attrs: {
          ...file,
          align: 'center',
          width: file.kind === 'image' ? 420 : 0,
          wrap: 'none',
        },
      })
      .run();
  }, [editor, onRequestFileUpload]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor || editor.isFocused) {
      return;
    }

    const nextKey = JSON.stringify(value ?? emptyTiptapDocument);
    if (nextKey !== contentKey) {
      editor.commands.setContent((value ?? emptyTiptapDocument) as JSONContent, { emitUpdate: false });
      setContentKey(nextKey);
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
        insertFile: insertUploadedFile,
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
  }, [blockId, editor, insertUploadedFile, onToolbarTargetChange]);

  return (
    <div className="dynamic-tiptap-editor">
      {editor ? (
        <BubbleMenu className="dynamic-bubble-toolbar" editor={editor}>
          <ToolbarButton disabled={disabled} label={t('editor.bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
            <Bold />
          </ToolbarButton>
          <ToolbarButton disabled={disabled} label={t('editor.italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
            <Italic />
          </ToolbarButton>
          <ToolbarButton disabled={disabled} label={t('editor.link')} onClick={() => setLink(editor, t('editor.linkText'))}>
            <Link2 />
          </ToolbarButton>
        </BubbleMenu>
      ) : null}
      <EditorContent editor={editor} />
    </div>
  );
}

export function DynamicTiptapToolbar({
  disabled,
  editor,
  onInsertFile,
  t,
}: {
  disabled: boolean;
  editor: Editor | null;
  onInsertFile: () => void;
  t: ReturnType<typeof useI18n>['t'];
}) {
  const configuredTools = useMemo(() => new Set((editorSettings.dynamicTools ?? []).map((tool) => tool.id)), []);
  const unavailable = disabled || !editor;

  function enabled(toolId: string) {
    return configuredTools.size === 0 || configuredTools.has(toolId);
  }

  return (
    <div className="dynamic-tiptap-toolbar" aria-label={t('editor.toolbar')}>
      {enabled('bold') ? (
        <ToolbarButton active={editor?.isActive('bold')} disabled={unavailable} label={t('editor.bold')} onClick={() => editor?.chain().focus().toggleBold().run()}>
          <Bold />
        </ToolbarButton>
      ) : null}
      {enabled('italic') ? (
        <ToolbarButton active={editor?.isActive('italic')} disabled={unavailable} label={t('editor.italic')} onClick={() => editor?.chain().focus().toggleItalic().run()}>
          <Italic />
        </ToolbarButton>
      ) : null}
      {enabled('underline') ? (
        <ToolbarButton active={editor?.isActive('underline')} disabled={unavailable} label={t('editor.underline')} onClick={() => editor?.chain().focus().toggleUnderline().run()}>
          <Underline />
        </ToolbarButton>
      ) : null}
      {enabled('strike') ? (
        <ToolbarButton active={editor?.isActive('strike')} disabled={unavailable} label={t('editor.strikethrough')} onClick={() => editor?.chain().focus().toggleStrike().run()}>
          <Strikethrough />
        </ToolbarButton>
      ) : null}
      <span className="toolbar-divider" />
      <ToolbarButton active={editor?.isActive('heading', { level: 1 })} disabled={unavailable} label={t('editor.heading1')} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}>
        <Heading1 />
      </ToolbarButton>
      <ToolbarButton active={editor?.isActive('heading', { level: 2 })} disabled={unavailable} label={t('editor.heading2')} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 />
      </ToolbarButton>
      <ToolbarButton active={editor?.isActive('heading', { level: 3 })} disabled={unavailable} label={t('editor.heading3')} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}>
        <Heading3 />
      </ToolbarButton>
      <ToolbarButton disabled={unavailable} label={t('editor.text')} onClick={() => editor?.chain().focus().setParagraph().run()}>
        <AlignLeft />
      </ToolbarButton>
      <ToolbarButton disabled={unavailable} label={t('editor.text')} onClick={() => editor?.chain().focus().setTextAlign('center').run()}>
        <AlignCenter />
      </ToolbarButton>
      <ToolbarButton disabled={unavailable} label={t('editor.text')} onClick={() => editor?.chain().focus().setTextAlign('right').run()}>
        <AlignRight />
      </ToolbarButton>
      <span className="toolbar-divider" />
      {enabled('bulletList') ? (
        <ToolbarButton active={editor?.isActive('bulletList')} disabled={unavailable} label={t('editor.bulletList')} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
          <List />
        </ToolbarButton>
      ) : null}
      {enabled('orderedList') ? (
        <ToolbarButton active={editor?.isActive('orderedList')} disabled={unavailable} label={t('editor.numberedList')} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
          <ListOrdered />
        </ToolbarButton>
      ) : null}
      {enabled('taskList') ? (
        <ToolbarButton active={editor?.isActive('taskList')} disabled={unavailable} label={t('editor.checkList')} onClick={() => editor?.chain().focus().toggleTaskList().run()}>
          <ListChecks />
        </ToolbarButton>
      ) : null}
      {enabled('blockquote') ? (
        <ToolbarButton active={editor?.isActive('blockquote')} disabled={unavailable} label={t('editor.quote')} onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
          <Quote />
        </ToolbarButton>
      ) : null}
      {enabled('codeBlock') ? (
        <ToolbarButton active={editor?.isActive('codeBlock')} disabled={unavailable} label={t('editor.codeBlock')} onClick={() => editor?.chain().focus().toggleCodeBlock().run()}>
          <Code />
        </ToolbarButton>
      ) : null}
      <ToolbarButton disabled={unavailable} label={t('editor.highlightColor')} onClick={() => editor?.chain().focus().toggleHighlight({ color: '#fff0a6' }).run()}>
        <Highlighter />
      </ToolbarButton>
      <ToolbarButton disabled={unavailable} label={t('editor.link')} onClick={() => editor && setLink(editor, t('editor.linkText'))}>
        <Link2 />
      </ToolbarButton>
      <span className="toolbar-divider" />
      {enabled('table') ? (
        <ToolbarButton disabled={unavailable} label={t('editor.insertTable')} onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
          <Table2 />
        </ToolbarButton>
      ) : null}
      {enabled('image') ? (
        <ToolbarButton disabled={unavailable} label={t('dynamicNotes.editor.addImage')} onClick={onInsertFile}>
          <ImageIcon />
        </ToolbarButton>
      ) : null}
      {enabled('file') ? (
        <ToolbarButton disabled={unavailable} label={t('dynamicNotes.editor.addFile')} onClick={onInsertFile}>
          <FileUp />
        </ToolbarButton>
      ) : null}
    </div>
  );
}

function DynamicFileNodeView({ node, selected, updateAttributes }: ReactNodeViewProps) {
  const { t } = useI18n();
  const attrs = node.attrs as DynamicFileAttrs;
  const [src, setSrc] = useState<string | null>(null);
  const [wrapLines, setWrapLines] = useState(1);
  const isImage = attrs.kind === 'image';
  const imageWidth = quantizeImageWidth(Number(attrs.width ?? 420));

  useEffect(() => {
    let cancelled = false;
    if (!isImage || !attrs.relativePath) {
      setSrc(null);
      return;
    }

    void resolveDynamicFileSrc(attrs.relativePath).then((nextSrc) => {
      if (!cancelled) {
        setSrc(nextSrc);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [attrs.relativePath, isImage]);

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
      <NodeViewWrapper className={selected ? 'dynamic-file-card is-selected' : 'dynamic-file-card'} data-drag-handle>
        <FileUp />
        <span>
          <strong>{attrs.originalName}</strong>
          <small>{formatFileSize(attrs.sizeBytes)}</small>
        </span>
        <button type="button" onClick={() => void openDynamicAttachment(attrs.relativePath)}>
          {t('common.open')}
        </button>
        <button type="button" onClick={() => void exportDynamicAttachment(attrs)}>
          {t('common.export')}
        </button>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      className={[
        'dynamic-image-node',
        selected && 'is-selected',
        attrs.wrap === 'left' && 'wrap-left',
        attrs.wrap === 'right' && 'wrap-right',
        attrs.align === 'left' && 'align-left',
        attrs.align === 'right' && 'align-right',
        attrs.align === 'center' && 'align-center',
        `dynamic-image-size-${imageWidth}`,
      ].filter(Boolean).join(' ')}
      data-drag-handle
      data-wrap-lines={wrapLines}
    >
      <figure>
        {src ? <img src={src} alt={attrs.originalName} draggable={false} /> : <span className="dynamic-image-placeholder">{attrs.originalName}</span>}
        <figcaption>{attrs.originalName}</figcaption>
      </figure>
      <div className="dynamic-image-controls" contentEditable={false}>
        <button type="button" onClick={() => updateAttributes({ align: 'left', wrap: 'none' })}>
          <AlignLeft />
        </button>
        <button type="button" onClick={() => updateAttributes({ align: 'center', wrap: 'none' })}>
          <AlignCenter />
        </button>
        <button type="button" onClick={() => updateAttributes({ align: 'right', wrap: 'none' })}>
          <AlignRight />
        </button>
        <button type="button" onClick={() => updateAttributes({ wrap: attrs.wrap === 'left' ? 'none' : 'left', align: 'left' })}>
          {t('dynamicNotes.editor.wrapLeft')}
        </button>
        <button type="button" onClick={() => updateAttributes({ wrap: attrs.wrap === 'right' ? 'none' : 'right', align: 'right' })}>
          {t('dynamicNotes.editor.wrapRight')}
        </button>
        <input
          type="range"
          min={160}
          max={760}
          step={40}
          value={imageWidth}
          onChange={(event) => updateAttributes({ width: Number(event.currentTarget.value) })}
        />
      </div>
    </NodeViewWrapper>
  );
}

function ToolbarButton({
  active = false,
  children,
  disabled = false,
  label,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className={active ? 'markdown-tool-button active' : 'markdown-tool-button'} disabled={disabled} title={label} type="button" aria-label={label} onClick={onClick}>
      {children}
    </button>
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
