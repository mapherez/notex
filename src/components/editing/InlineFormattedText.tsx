import { Fragment, type ReactNode } from 'react';
import { openExternalUrl } from '../../core/services/externalLinks';
import { isSafeMarkdownHref } from '../../core/utils/markdown';
import { normalizeInlineStyleColor } from '../../core/utils/inlineFormatting';

const inlinePattern = /(\[\[(color|bg):([a-z-]+)\]\][\s\S]+?\[\[\/\2\]\]|\[\[u\]\][\s\S]+?\[\[\/u\]\]|~~[^~]+~~|`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|\[[^\]]+\]\([^)]+\))/g;

export function InlineFormattedText({ value }: { value?: string | null }) {
  return <>{renderInlineText(value ?? '')}</>;
}

export function renderInlineText(text: string): ReactNode[] {
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
