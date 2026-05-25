import { Fragment, useMemo, type ReactNode } from 'react';
import { openExternalUrl } from '../../core/services/externalLinks';
import { isSafeMarkdownHref, parseMarkdown, type MarkdownListItem } from '../../core/utils/markdown';

export function MarkdownPreview({
  emptyText,
  value,
}: {
  emptyText: string;
  value: string;
}) {
  const blocks = useMemo(() => parseMarkdown(value), [value]);

  if (!value.trim()) {
    return <p className="markdown-empty">{emptyText}</p>;
  }

  return (
    <div className="markdown-preview">
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          const HeadingTag = `h${block.level}` as const;
          return <HeadingTag key={index}>{renderInline(block.text)}</HeadingTag>;
        }

        if (block.type === 'paragraph') {
          return <p key={index}>{renderInline(block.lines.join(' '))}</p>;
        }

        if (block.type === 'blockquote') {
          return (
            <blockquote key={index}>
              {block.lines.map((line, lineIndex) => (
                <p key={`${index}-${lineIndex}`}>{renderInline(line)}</p>
              ))}
            </blockquote>
          );
        }

        if (block.type === 'code') {
          return (
            <pre key={index}>
              <code>{block.code}</code>
            </pre>
          );
        }

        if (block.type === 'unordered-list') {
          return (
            <ul key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={`${index}-${itemIndex}`}>{renderListItem(item)}</li>
              ))}
            </ul>
          );
        }

        if (block.type === 'ordered-list') {
          return (
            <ol key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={`${index}-${itemIndex}`}>{renderListItem(item)}</li>
              ))}
            </ol>
          );
        }

        return (
          <div className="markdown-table-wrap" key={index}>
            <table className="markdown-table">
              <thead>
                <tr>
                  {block.headers.map((header, headerIndex) => (
                    <th key={`${index}-header-${headerIndex}`}>{renderInline(header)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={`${index}-row-${rowIndex}`}>
                    {block.headers.map((_, cellIndex) => (
                      <td key={`${index}-cell-${rowIndex}-${cellIndex}`}>{renderInline(row[cellIndex] ?? '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

function renderListItem(item: MarkdownListItem) {
  if (item.checked === undefined) {
    return renderInline(item.text);
  }

  return (
    <span className="markdown-task">
      <input checked={item.checked} readOnly type="checkbox" />
      <span>{renderInline(item.text)}</span>
    </span>
  );
}

function renderInline(text: string): ReactNode[] {
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|\[[^\]]+\]\([^)]+\))/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
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
  if (token.startsWith('`') && token.endsWith('`')) {
    return <code key={key}>{token.slice(1, -1)}</code>;
  }

  if ((token.startsWith('**') && token.endsWith('**')) || (token.startsWith('__') && token.endsWith('__'))) {
    return <strong key={key}>{token.slice(2, -2)}</strong>;
  }

  if ((token.startsWith('*') && token.endsWith('*')) || (token.startsWith('_') && token.endsWith('_'))) {
    return <em key={key}>{token.slice(1, -1)}</em>;
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
        {link[1]}
      </a>
    );
  }

  return token;
}
