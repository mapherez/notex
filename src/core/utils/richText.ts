import type { JSONContent } from '@tiptap/core';

export function richTextToPlainText(value: string | null | undefined) {
  const text = value ?? '';
  if (!hasHtmlTags(text)) {
    return text;
  }

  if (typeof document !== 'undefined') {
    const element = document.createElement('div');
    element.innerHTML = text;
    return element.textContent ?? '';
  }

  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

export function richTextToTiptapContent(value: string | null | undefined): JSONContent | string {
  const text = value ?? '';
  if (hasHtmlTags(text)) {
    return text;
  }

  return textToTiptapDocument(text);
}

export function textToTiptapDocument(text: string): JSONContent {
  return {
    type: 'doc',
    content: text
      ? text.split('\n').map((line) => ({
          type: 'paragraph',
          content: line ? [{ type: 'text', text: line }] : undefined,
        }))
      : [{ type: 'paragraph' }],
  };
}

function hasHtmlTags(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}
