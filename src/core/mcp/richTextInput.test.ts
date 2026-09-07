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
