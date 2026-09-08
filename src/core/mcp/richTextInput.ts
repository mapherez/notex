import {
  generateHTML,
  generateJSON,
  generateText,
  type Extensions,
  type JSONContent,
} from '@tiptap/core';
import type { RichTextInput } from '@notex/mcp-contract';
import {
  createNoteContentExtensions,
  createNoteInlineExtensions,
} from '../editor/noteEditorExtensions';
import type { TiptapDocument } from '../models/models';
import { isSafeMarkdownHref } from '../utils/markdown';
import { textToTiptapDocument } from '../utils/richText';

export type ParsedBlockRichText = {
  contentJson: TiptapDocument;
  contentText: string;
};

export class UnsupportedRichTextInputError extends Error {}

const contentExtensions = createNoteContentExtensions();
const inlineExtensions = createNoteInlineExtensions();

const removedTags = new Set([
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

const inlineTags = new Set([
  'a',
  'b',
  'br',
  'code',
  'del',
  'em',
  'i',
  'mark',
  'p',
  's',
  'span',
  'strike',
  'strong',
  'u',
]);

const contentTags = new Set([
  ...inlineTags,
  'blockquote',
  'div',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'label',
  'li',
  'notex-tip',
  'ol',
  'pre',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'ul',
]);

const allowedAttributes = new Set([
  'colspan',
  'colwidth',
  'data-checked',
  'data-type',
  'rowspan',
  'start',
  'title',
]);

const allowedStyleProperties = new Set([
  'background-color',
  'color',
  'min-width',
  'text-align',
  'width',
]);

export function parseMcpInlineRichText(input: RichTextInput): string {
  try {
    const documentValue = parseRichTextDocument(input, inlineExtensions, inlineTags);
    assertSafeDocument(documentValue);
    const text = generateText(documentValue, inlineExtensions, { blockSeparator: '\n' });
    return text.trim() ? generateHTML(documentValue, inlineExtensions) : '';
  } catch (error) {
    if (error instanceof UnsupportedRichTextInputError) {
      throw error;
    }
    throw new UnsupportedRichTextInputError('Unable to parse rich text input.');
  }
}

export function parseMcpBlockRichText(input: RichTextInput): ParsedBlockRichText {
  try {
    const documentValue = parseRichTextDocument(input, contentExtensions, contentTags);
    assertSafeDocument(documentValue);
    return {
      contentJson: documentValue as TiptapDocument,
      contentText: generateText(documentValue, contentExtensions, { blockSeparator: '\n' }),
    };
  } catch (error) {
    if (error instanceof UnsupportedRichTextInputError) {
      throw error;
    }
    throw new UnsupportedRichTextInputError('Unable to parse rich text input.');
  }
}

function parseRichTextDocument(
  input: RichTextInput,
  extensions: Extensions,
  allowedTags: Set<string>,
): JSONContent {
  if (input.format === 'text') {
    return textToTiptapDocument(normalizeLineEndings(input.value));
  }

  if (typeof document === 'undefined') {
    throw new UnsupportedRichTextInputError('HTML parsing is unavailable.');
  }

  const sanitized = sanitizeHtml(input.value, allowedTags);
  const parsed = generateJSON(sanitized || '<p></p>', extensions) as JSONContent;
  if (parsed.type !== 'doc') {
    throw new UnsupportedRichTextInputError('Rich text must produce a document.');
  }
  if (!parsed.content?.length) {
    parsed.content = [{ type: 'paragraph' }];
  }
  return parsed;
}

function sanitizeHtml(html: string, allowedTags: Set<string>) {
  const template = document.createElement('template');
  template.innerHTML = html;
  sanitizeChildren(template.content, allowedTags);
  return template.innerHTML;
}

function sanitizeChildren(parent: ParentNode, allowedTags: Set<string>) {
  for (const child of Array.from(parent.children)) {
    const tagName = child.tagName.toLowerCase();
    if (removedTags.has(tagName)) {
      child.remove();
      continue;
    }

    sanitizeChildren(child, allowedTags);
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

function assertSafeDocument(node: JSONContent) {
  if (node.type === 'noteFile' || node.type === 'image') {
    throw new UnsupportedRichTextInputError('Files and images are not supported.');
  }

  if (node.marks) {
    for (const mark of node.marks) {
      if (mark.type === 'link') {
        const href = typeof mark.attrs?.href === 'string' ? mark.attrs.href : '';
        if (!isSafeMarkdownHref(href)) {
          throw new UnsupportedRichTextInputError('Unsafe link protocol.');
        }
      }
    }
  }

  node.content?.forEach(assertSafeDocument);
}

function normalizeLineEndings(value: string) {
  return value.replace(/\r\n?/g, '\n');
}
