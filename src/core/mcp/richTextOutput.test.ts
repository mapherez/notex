import { describe, expect, it } from 'vitest';
import { blockRichTextOutput, inlineRichTextOutput } from './richTextOutput';

describe('MCP rich-text output', () => {
  it('preserves supported inline HTML while removing executable content and unsafe links', () => {
    const output = inlineRichTextOutput(
      '<p><strong>Safe</strong><script>alert(1)</script><a href="javascript:alert(1)" onclick="alert(1)">link</a></p>',
    );

    expect(output.html).toContain('<strong>Safe</strong>');
    expect(output.html).not.toContain('script');
    expect(output.html).not.toContain('javascript:');
    expect(output.html).not.toContain('onclick');
    expect(output.text).toBe('Safelink');
  });

  it('converts legacy inline tokens without losing their text', () => {
    const output = inlineRichTextOutput('A **bold** [[u]]underlined[[/u]] [link](https://example.com)');

    expect(output.html).toBe('A <strong>bold</strong> <u>underlined</u> <a href="https://example.com">link</a>');
    expect(output.text).toBe('A bold underlined link');
  });

  it('keeps plain-text boundaries between HTML blocks', () => {
    const output = inlineRichTextOutput('<p>First line</p><p>Second<br>line</p>');

    expect(output.text).toBe('First line\nSecond\nline');
  });

  it('serializes the NoteX Tiptap schema and excludes local file metadata', () => {
    const output = blockRichTextOutput(
      {
        type: 'doc',
        content: [
          {
            type: 'noteTip',
            attrs: { title: 'Remember' },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Keep this' }] }],
          },
          {
            type: 'noteFile',
            attrs: {
              id: 'private-file',
              relativePath: 'files/note/private.pdf',
              checksum: 'secret-checksum',
            },
          },
        ],
      },
      'Keep this',
    );

    expect(output.html).toContain('<notex-tip title="Remember"><p>Keep this</p></notex-tip>');
    expect(output.html).not.toContain('notex-file');
    expect(output.html).not.toContain('private.pdf');
    expect(output.html).not.toContain('secret-checksum');
    expect(output.text).toBe('Keep this');
  });

  it('falls back to stored plain text for an invalid document', () => {
    const output = blockRichTextOutput(
      { type: 'doc', content: [{ type: 'unsupported-node' }] },
      'Fallback text',
    );

    expect(output).toEqual({ html: '<p>Fallback text</p>', text: 'Fallback text' });
  });
});
