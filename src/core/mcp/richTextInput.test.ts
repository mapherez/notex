import { expect, it } from 'vitest';
import { parseMcpBlockRichText, parseMcpInlineRichText } from './richTextInput';
import { blockRichTextOutput } from './richTextOutput';

it('preserves literal text and normalizes Windows line endings', () => {
  const result = parseMcpBlockRichText({ format: 'text', value: '<script>literal</script>\r\nSecond' });
  expect(result.contentText).toContain('<script>literal</script>');
  expect(result.contentText).not.toContain('\r');
});

it('retains supported formatting while stripping executable content and attachments', () => {
  const input = '<h2>Heading</h2><p><strong>Bold</strong><em>Italic</em><u>Underline</u>' +
    '<span style="color: #ff0000">Color</span><mark>Highlight</mark></p>' +
    '<ul><li><p>List</p></li></ul><blockquote><p>Quote</p></blockquote>' +
    '<pre><code>Code</code></pre><table><tbody><tr><td><p>Cell</p></td></tr></tbody></table>' +
    '<script>bad()</script><img src="file:///private"><notex-file>private</notex-file>' +
    '<p onclick="bad()"><a href="javascript:bad()">Link</a></p>';
  const parsed = parseMcpBlockRichText({ format: 'html', value: input });
  const output = blockRichTextOutput(parsed.contentJson, parsed.contentText);
  for (const text of ['Heading', 'Bold', 'Italic', 'Underline', 'Color', 'Highlight', 'List', 'Quote', 'Code', 'Cell']) {
    expect(output.text).toContain(text);
  }
  for (const tag of ['<h2', '<strong', '<em', '<u>', '<mark', '<ul', '<blockquote', '<pre', '<table']) {
    expect(output.html).toContain(tag);
  }
  expect(JSON.stringify(parsed)).not.toMatch(/javascript:|onclick|file:\/\/\/|bad\(\)|private/);
});

it('sanitizes inline headers using the inline editor schema', () => {
  const result = parseMcpInlineRichText({ format: 'html', value: '<p><b>Title</b><script>bad()</script></p>' });
  expect(result).toContain('<strong>Title</strong>');
  expect(result).not.toContain('bad');
});

it('parses NoteX colors, alignment, checklists, tips, and arbitrary table dimensions', () => {
  const input =
    '<p style="text-align: center"><span style="color: var(--nx-color-red)">' +
    '<mark style="background-color: color-mix(in srgb, var(--nx-color-yellow) 28%, transparent)">Styled</mark>' +
    '</span></p>' +
    '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>Done</p></li>' +
    '<li data-type="taskItem" data-checked="false"><p>Pending</p></li></ul>' +
    '<notex-tip title="Remember"><p>Tip body</p></notex-tip>' +
    '<table><tbody>' +
    '<tr><th><p>A</p></th><th><p>B</p></th><th><p>C</p></th></tr>' +
    '<tr><td><p>1</p></td><td><p>2</p></td><td><p>3</p></td></tr>' +
    '</tbody></table>';
  const parsed = parseMcpBlockRichText({ format: 'html', value: input });
  const json = JSON.stringify(parsed.contentJson);

  expect(json).toContain('"textAlign":"center"');
  expect(json).toContain('"color":"var(--nx-color-red)"');
  expect(json).toContain('"type":"taskList"');
  expect(json).toContain('"type":"taskItem"');
  expect(json).toContain('"checked":true');
  expect(json).toContain('"type":"noteTip"');
  expect(json).toContain('"title":"Remember"');
  expect(json.match(/"type":"tableRow"/g)).toHaveLength(2);
  expect(json.match(/"type":"tableHeader"/g)).toHaveLength(3);
  expect(json.match(/"type":"tableCell"/g)).toHaveLength(3);
});
