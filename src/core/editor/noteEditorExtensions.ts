import { Node, mergeAttributes, wrappingInputRule, type Extensions } from '@tiptap/core';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import { BulletList, OrderedList, bulletListInputRegex, orderedListInputRegex } from '@tiptap/extension-list';
import Placeholder from '@tiptap/extension-placeholder';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import UnderlineExtension from '@tiptap/extension-underline';
import type { Node as ProseMirrorNode, NodeType } from '@tiptap/pm/model';
import StarterKit from '@tiptap/starter-kit';

export const NoteFileNode = Node.create({
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
});

export const NoteTipNode = Node.create({
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
});

const dotBulletListInputRegex = /^\s*(\.)\s$/;
const numberSpaceOrderedListInputRegex = /^(\d+)\s$/;

const ShortcutBulletList = BulletList.extend({
  addKeyboardShortcuts() {
    return {};
  },

  addInputRules() {
    return [
      wrappingInputRule({
        find: bulletListInputRegex,
        type: this.type,
      }),
      wrappingInputRule({
        find: dotBulletListInputRegex,
        type: this.type,
      }),
    ];
  },
});

const ShortcutOrderedList = OrderedList.extend({
  addKeyboardShortcuts() {
    return {};
  },

  addInputRules() {
    return [
      createOrderedListInputRule(orderedListInputRegex, this.type),
      createOrderedListInputRule(numberSpaceOrderedListInputRegex, this.type),
    ];
  },
});

const ShortcutTaskList = TaskList.extend({
  addKeyboardShortcuts() {
    return {};
  },
});

const ShortcutTaskItem = TaskItem.extend({
  addInputRules() {
    return [];
  },
});

const ShortcutTextAlign = TextAlign.extend({
  addKeyboardShortcuts() {
    return {};
  },
});

function createOrderedListInputRule(find: RegExp, type: NodeType) {
  return wrappingInputRule({
    find,
    type,
    getAttributes: (match) => ({ start: Number(match[1]) }),
    joinPredicate: (match, node: ProseMirrorNode) => node.childCount + node.attrs.start === Number(match[1]),
  });
}

export function createNoteContentExtensions({
  fileNode = NoteFileNode,
  placeholder = '',
  tipNode = NoteTipNode,
}: {
  fileNode?: Node;
  placeholder?: string;
  tipNode?: Node;
} = {}): Extensions {
  return [
    StarterKit.configure({
      bulletList: false,
      link: false,
      orderedList: false,
      underline: false,
    }),
    Placeholder.configure({ placeholder }),
    UnderlineExtension,
    Link.configure({
      openOnClick: false,
      autolink: true,
      defaultProtocol: 'https',
    }),
    ShortcutTextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    ShortcutBulletList,
    ShortcutOrderedList,
    ShortcutTaskList,
    ShortcutTaskItem.configure({ nested: true }),
    tipNode,
    fileNode,
  ];
}

export function createNoteInlineExtensions(placeholder = ''): Extensions {
  return [
    StarterKit.configure({
      blockquote: false,
      bulletList: false,
      codeBlock: false,
      heading: false,
      horizontalRule: false,
      link: false,
      listItem: false,
      orderedList: false,
      underline: false,
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
    Placeholder.configure({ placeholder }),
  ];
}
