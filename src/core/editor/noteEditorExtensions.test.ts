import { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import {
  createNoteContentExtensions,
  createNoteInlineExtensions,
  createPermanentNoteFileRemovalExtension,
} from './noteEditorExtensions';

describe('NoteX editor extensions', () => {
  it('registers underline exactly once in full and inline editors', () => {
    const fullEditor = new Editor({
      content: '<p>Full editor</p>',
      extensions: createNoteContentExtensions(),
    });
    const inlineEditor = new Editor({
      content: '<p>Inline editor</p>',
      extensions: createNoteInlineExtensions(),
    });

    expect(extensionCount(fullEditor, 'underline')).toBe(1);
    expect(extensionCount(inlineEditor, 'underline')).toBe(1);

    fullEditor.destroy();
    inlineEditor.destroy();
  });

  it('applies underline formatting through the shared full-editor schema', () => {
    const editor = new Editor({
      content: '<p>Underline me</p>',
      extensions: createNoteContentExtensions(),
    });

    editor.commands.selectAll();

    expect(editor.commands.toggleUnderline()).toBe(true);
    expect(editor.getHTML()).toContain('<u>Underline me</u>');

    editor.destroy();
  });

  it('makes file removal permanent and blocks history from restoring the deleted file ID', async () => {
    const removed: string[][] = [];
    const fileNode = {
      type: 'noteFile',
      attrs: {
        id: 'image-1', noteId: 'note', blockId: 'block', kind: 'image',
        originalName: 'image.png', mimeType: 'image/png', sizeBytes: 10,
        checksum: 'checksum', relativePath: 'note/image.png', createdAt: '2026-01-01',
        align: 'center', width: 420, wrap: 'none',
      },
    };
    const editor = new Editor({
      content: { type: 'doc', content: [fileNode, { type: 'paragraph' }] },
      extensions: [
        ...createNoteContentExtensions(),
        createPermanentNoteFileRemovalExtension((fileIds) => removed.push(fileIds)),
      ],
    });

    editor.commands.setNodeSelection(0);
    expect(editor.commands.deleteSelection()).toBe(true);
    await Promise.resolve();
    expect(removed).toEqual([['image-1']]);
    expect(editor.getJSON().content?.some((node) => node.type === 'noteFile')).toBe(false);

    editor.commands.undo();
    editor.commands.setContent({ type: 'doc', content: [fileNode, { type: 'paragraph' }] });
    expect(editor.getJSON().content?.some((node) => node.type === 'noteFile')).toBe(false);

    editor.destroy();
  });
});

function extensionCount(editor: Editor, name: string) {
  return editor.extensionManager.extensions.filter((extension) => extension.name === name).length;
}
