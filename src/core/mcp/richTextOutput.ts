import { generateHTML, generateText, type JSONContent } from '@tiptap/core';
import type { RichTextOutput } from '@notex/mcp-contract';
import { createNoteContentExtensions } from '../editor/noteEditorExtensions';
import type { TiptapDocument } from '../models/models';
import { isSafeMarkdownHref } from '../utils/markdown';
import { richTextToPlainText } from '../utils/richText';

const contentExtensions = createNoteContentExtensions();
const legacyInlinePattern = /(\[\[(color|bg):([a-z-]+)\]\][\s\S]+?\[\[\/\2\]\]|\[\[u\]\][\s\S]+?\[\[\/u\]\]|~~[^~]+~~|`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|\[[^\]]+\]\([^)]+\))/g;
const htmlTagPattern = /<\/?[a-z][\s\S]*>/i;
const blockedTags = new Set([
  'audio',
  'button',
  'embed',
  'form',
  'iframe',
  'img',
  'input',
  'notex-file',
  'object',
  'picture',
  'script',
  'source',
  'style',
  'svg',
  'video',
]);
const allowedTags = new Set([
  'a',
  'b',
  'blockquote',
  'br',
  'code',
  'col',
  'colgroup',
  'del',
  'div',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'label',
  'li',
  'mark',
  'notex-tip',
  'ol',
  'p',
  'pre',
  's',
  'span',
  'strike',
  'strong',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
]);
const allowedAttributes = new Set([
  'colspan',
  'colwidth',
  'data-checked',
  'data-color',
  'data-notex-bg',
  'data-notex-color',
  'data-type',
  'rowspan',
  'start',
  'title',
]);
const allowedStyleProperties = new Set(['background-color', 'color', 'min-width', 'text-align', 'width']);
const plainTextBlockTags = new Set([
  'blockquote',
  'div',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'li',
  'notex-tip',
  'p',
  'pre',
  'tr',
]);

export function inlineRichTextOutput(value: string | null | undefined): RichTextOutput {
  const source = value ?? '';
  if (!source) {
    return { html: '', text: '' };
  }

  const html = htmlTagPattern.test(source) ? sanitizeRichTextHtml(source) : renderLegacyInline(source);
  return {
    html,
    text: htmlToPlainText(html),
  };
}

export function blockRichTextOutput(
  documentValue: TiptapDocument | null | undefined,
  storedText: string | null | undefined,
): RichTextOutput {
  const documentWithoutFiles = removeFileNodes(documentValue);
  const fallbackText = storedText ?? '';

  if (!documentWithoutFiles) {
    return {
      html: plainTextToHtml(fallbackText),
      text: fallbackText,
    };
  }

  try {
    const generatedText = generateText(documentWithoutFiles as JSONContent, contentExtensions, {
      blockSeparator: '\n',
    });
    return {
      html: sanitizeRichTextHtml(generateHTML(documentWithoutFiles as JSONContent, contentExtensions)),
      text: fallbackText || generatedText,
    };
  } catch {
    return {
      html: plainTextToHtml(fallbackText),
      text: fallbackText,
    };
  }
}

function removeFileNodes(documentValue: TiptapDocument | null | undefined): TiptapDocument | null {
  if (!documentValue) {
    return null;
  }

  const filtered = filterNode(documentValue as JSONContent);
  if (!filtered) {
    return null;
  }
  if (!filtered.content?.length) {
    filtered.content = [{ type: 'paragraph' }];
  }
  return filtered as TiptapDocument;
}

function filterNode(node: JSONContent): JSONContent | null {
  if (node.type === 'noteFile') {
    return null;
  }

  const content = node.content?.flatMap((child) => {
    const filtered = filterNode(child);
    return filtered ? [filtered] : [];
  });
  return {
    ...node,
    ...(node.content ? { content } : {}),
  };
}

function sanitizeRichTextHtml(html: string) {
  if (typeof document === 'undefined') {
    return plainTextToHtml(richTextToPlainText(html));
  }

  const template = document.createElement('template');
  template.innerHTML = html;
  sanitizeChildren(template.content);
  return template.innerHTML;
}

function sanitizeChildren(parent: ParentNode) {
  for (const child of Array.from(parent.children)) {
    const tagName = child.tagName.toLowerCase();
    if (blockedTags.has(tagName)) {
      child.remove();
      continue;
    }

    sanitizeChildren(child);
    if (!allowedTags.has(tagName)) {
      child.replaceWith(...Array.from(child.childNodes));
      continue;
    }

    sanitizeAttributes(child as HTMLElement, tagName);
  }
}

function sanitizeAttributes(element: HTMLElement, tagName: string) {
  for (const attribute of Array.from(element.attributes)) {
    const name = attribute.name.toLowerCase();
    if (name === 'href' && tagName === 'a') {
      if (!isSafeMarkdownHref(attribute.value)) {
        element.removeAttribute(attribute.name);
      }
      continue;
    }
    if (name === 'style') {
      const style = sanitizeStyle(attribute.value);
      if (style) {
        element.setAttribute('style', style);
      } else {
        element.removeAttribute(attribute.name);
      }
      continue;
    }
    if (!allowedAttributes.has(name)) {
      element.removeAttribute(attribute.name);
    }
  }
}

function sanitizeStyle(style: string) {
  return style
    .split(';')
    .flatMap((declaration) => {
      const separator = declaration.indexOf(':');
      if (separator < 0) {
        return [];
      }
      const property = declaration.slice(0, separator).trim().toLowerCase();
      const value = declaration.slice(separator + 1).trim();
      if (!allowedStyleProperties.has(property) || !isSafeStyleValue(value)) {
        return [];
      }
      return [`${property}: ${value}`];
    })
    .join('; ');
}

function isSafeStyleValue(value: string) {
  return (
    value.length <= 200 &&
    /^[a-z0-9#(),.%\s-]+$/i.test(value) &&
    !/(?:expression|url|javascript|@import)/i.test(value)
  );
}

function renderLegacyInline(value: string): string {
  let html = '';
  let lastIndex = 0;

  for (const match of value.matchAll(legacyInlinePattern)) {
    const token = match[0];
    const index = match.index ?? 0;
    html += escapeHtml(value.slice(lastIndex, index));
    html += renderLegacyToken(token);
    lastIndex = index + token.length;
  }

  html += escapeHtml(value.slice(lastIndex));
  return html.replace(/\r?\n/g, '<br>');
}

function renderLegacyToken(token: string): string {
  const styleToken = token.match(/^\[\[(color|bg):([a-z-]+)\]\]([\s\S]*)\[\[\/\1\]\]$/);
  if (styleToken) {
    const kind = styleToken[1];
    const color = styleToken[2];
    return `<span data-notex-${kind}="${escapeHtml(color)}">${renderLegacyInline(styleToken[3])}</span>`;
  }

  const underline = token.match(/^\[\[u\]\]([\s\S]*)\[\[\/u\]\]$/);
  if (underline) {
    return `<u>${renderLegacyInline(underline[1])}</u>`;
  }
  if (token.startsWith('~~') && token.endsWith('~~')) {
    return `<s>${renderLegacyInline(token.slice(2, -2))}</s>`;
  }
  if (token.startsWith('`') && token.endsWith('`')) {
    return `<code>${escapeHtml(token.slice(1, -1))}</code>`;
  }
  if ((token.startsWith('**') && token.endsWith('**')) || (token.startsWith('__') && token.endsWith('__'))) {
    return `<strong>${renderLegacyInline(token.slice(2, -2))}</strong>`;
  }
  if ((token.startsWith('*') && token.endsWith('*')) || (token.startsWith('_') && token.endsWith('_'))) {
    return `<em>${renderLegacyInline(token.slice(1, -1))}</em>`;
  }

  const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
  if (link) {
    const label = renderLegacyInline(link[1]);
    const href = link[2].trim();
    return isSafeMarkdownHref(href) ? `<a href="${escapeHtml(href)}">${label}</a>` : label;
  }
  return escapeHtml(token);
}

function htmlToPlainText(html: string) {
  if (typeof document === 'undefined') {
    return richTextToPlainText(html);
  }
  const element = document.createElement('div');
  element.innerHTML = html;
  appendPlainTextSeparators(element);
  return (element.textContent ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+|\n+$/g, '');
}

function appendPlainTextSeparators(parent: ParentNode) {
  for (const child of Array.from(parent.children)) {
    appendPlainTextSeparators(child);
    const tagName = child.tagName.toLowerCase();
    if (tagName === 'br') {
      child.replaceWith(document.createTextNode('\n'));
    } else if (tagName === 'td' || tagName === 'th') {
      child.append(document.createTextNode('\t'));
    } else if (plainTextBlockTags.has(tagName)) {
      child.append(document.createTextNode('\n'));
    }
  }
}

function plainTextToHtml(text: string) {
  if (!text) {
    return '';
  }
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('');
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
