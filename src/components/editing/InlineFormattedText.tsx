import { Fragment, type ReactNode } from 'react';
import { openExternalUrl } from '../../core/services/externalLinks';
import { isSafeMarkdownHref } from '../../core/utils/markdown';
import { normalizeInlineStyleColor } from '../../core/utils/inlineFormatting';

const inlinePattern = /(\[\[(color|bg):([a-z-]+)\]\][\s\S]+?\[\[\/\2\]\]|\[\[u\]\][\s\S]+?\[\[\/u\]\]|~~[^~]+~~|`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|\[[^\]]+\]\([^)]+\))/g;
const htmlTagPattern = /<\/?[a-z][\s\S]*>/i;

export function InlineFormattedText({ value }: { value?: string | null }) {
  return <>{renderInlineText(value ?? '')}</>;
}

export function renderInlineText(text: string): ReactNode[] {
  if (htmlTagPattern.test(text)) {
    return renderInlineHtml(text);
  }

  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(inlinePattern)) {
    const token = match[0];
    const index = match.index ?? 0;

    if (index > lastIndex) {
      nodes.push(text.slice(lastIndex, index));
    }

    nodes.push(renderInlineToken(token, nodes.length));
    lastIndex = index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.map((node, index) => <Fragment key={index}>{node}</Fragment>);
}

function renderInlineHtml(html: string) {
  const root = parseHtmlFragment(html);
  if (!root) {
    return [htmlToPlainText(html)];
  }

  return Array.from(root.childNodes).flatMap((node, index) => renderHtmlNode(node, `html-${index}`));
}

function parseHtmlFragment(html: string) {
  if (typeof document === 'undefined') {
    return null;
  }

  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content;
}

function renderHtmlNode(node: ChildNode, key: string): ReactNode[] {
  if (node.nodeType === Node.TEXT_NODE) {
    return [node.textContent ?? ''];
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return [];
  }

  const element = node as HTMLElement;
  const tagName = element.tagName.toLowerCase();

  if (tagName === 'script' || tagName === 'style') {
    return [];
  }

  if (tagName === 'br') {
    return [<br key={key} />];
  }

  const children = renderHtmlChildren(element, key);

  if (tagName === 'strong' || tagName === 'b') {
    return [<strong key={key}>{children}</strong>];
  }

  if (tagName === 'em' || tagName === 'i') {
    return [<em key={key}>{children}</em>];
  }

  if (tagName === 'u') {
    return [
      <span className="rich-text-underline" key={key}>
        {children}
      </span>,
    ];
  }

  if (tagName === 's' || tagName === 'strike' || tagName === 'del') {
    return [
      <s className="rich-text-strike" key={key}>
        {children}
      </s>,
    ];
  }

  if (tagName === 'code') {
    return [<code key={key}>{children}</code>];
  }

  if (tagName === 'a') {
    const href = element.getAttribute('href')?.trim() ?? '';
    const safeHref = isSafeMarkdownHref(href) ? href : '#';
    const isExternal = safeHref.startsWith('http://') || safeHref.startsWith('https://') || safeHref.startsWith('mailto:');

    return [
      <a
        href={safeHref}
        key={key}
        rel={isExternal ? 'noreferrer' : undefined}
        onClick={
          isExternal
            ? (event) => {
                event.preventDefault();
                void openExternalUrl(safeHref);
              }
            : undefined
        }
      >
        {children}
      </a>,
    ];
  }

  if (tagName === 'span' || tagName === 'mark') {
    const className = getInlineHtmlClassName(element, tagName);

    if (className) {
      return [
        <span className={className} key={key}>
          {children}
        </span>,
      ];
    }
  }

  return [<Fragment key={key}>{children}</Fragment>];
}

function renderHtmlChildren(element: HTMLElement, keyPrefix: string) {
  return Array.from(element.childNodes).flatMap((child, index) => renderHtmlNode(child, `${keyPrefix}-${index}`));
}

function getInlineHtmlClassName(element: HTMLElement, tagName: string) {
  const style = element.getAttribute('style') ?? '';
  const color = extractKnownColor(style.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i)?.[1] ?? '');
  const background = extractKnownColor(
    element.getAttribute('data-color') ??
      style.match(/(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/i)?.[1] ??
      '',
  );
  const classes = [
    color ? `rich-text-color--${color}` : '',
    background || tagName === 'mark' ? `rich-text-bg--${background ?? 'neutral'}` : '',
  ].filter(Boolean);

  return classes.join(' ');
}

function extractKnownColor(value: string) {
  const cssVariable = value.match(/--nx-color-([a-z-]+)/i)?.[1];
  const dataColor = value.match(/^([a-z-]+)$/i)?.[1];
  return normalizeInlineStyleColor(cssVariable ?? dataColor ?? '');
}

function htmlToPlainText(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li)>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function renderInlineToken(token: string, key: number) {
  const styleToken = token.match(/^\[\[(color|bg):([a-z-]+)\]\]([\s\S]*)\[\[\/\1\]\]$/);
  if (styleToken) {
    const kind = styleToken[1];
    const color = normalizeInlineStyleColor(styleToken[2]);

    if (!color) {
      return styleToken[3];
    }

    return (
      <span className={`rich-text-${kind}--${color}`} key={key}>
        {renderInlineText(styleToken[3])}
      </span>
    );
  }

  const underlineToken = token.match(/^\[\[u\]\]([\s\S]*)\[\[\/u\]\]$/);
  if (underlineToken) {
    return (
      <span className="rich-text-underline" key={key}>
        {renderInlineText(underlineToken[1])}
      </span>
    );
  }

  if (token.startsWith('~~') && token.endsWith('~~')) {
    return (
      <s className="rich-text-strike" key={key}>
        {renderInlineText(token.slice(2, -2))}
      </s>
    );
  }

  if (token.startsWith('`') && token.endsWith('`')) {
    return <code key={key}>{token.slice(1, -1)}</code>;
  }

  if ((token.startsWith('**') && token.endsWith('**')) || (token.startsWith('__') && token.endsWith('__'))) {
    return <strong key={key}>{renderInlineText(token.slice(2, -2))}</strong>;
  }

  if ((token.startsWith('*') && token.endsWith('*')) || (token.startsWith('_') && token.endsWith('_'))) {
    return <em key={key}>{renderInlineText(token.slice(1, -1))}</em>;
  }

  const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
  if (link) {
    const href = link[2].trim();
    const safeHref = isSafeMarkdownHref(href) ? href : '#';
    const isExternal = safeHref.startsWith('http://') || safeHref.startsWith('https://') || safeHref.startsWith('mailto:');

    return (
      <a
        href={safeHref}
        key={key}
        rel={isExternal ? 'noreferrer' : undefined}
        onClick={
          isExternal
            ? (event) => {
                event.preventDefault();
                void openExternalUrl(safeHref);
              }
            : undefined
        }
      >
        {renderInlineText(link[1])}
      </a>
    );
  }

  return token;
}
