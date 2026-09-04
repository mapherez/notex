import { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { createNoteContentExtensions, createNoteInlineExtensions } from './noteEditorExtensions';

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
});

function extensionCount(editor: Editor, name: string) {
  return editor.extensionManager.extensions.filter((extension) => extension.name === name).length;
}
