import { Fragment, useMemo } from 'react';
import { parseMarkdown, type MarkdownListItem } from '../../core/utils/markdown';
import { renderInlineText } from './InlineFormattedText';

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
          return <HeadingTag key={index}>{renderInlineText(block.text)}</HeadingTag>;
        }

        if (block.type === 'horizontal-rule') {
          return <hr key={index} />;
        }

        if (block.type === 'paragraph') {
          return <p key={index}>{renderParagraphLines(block.lines)}</p>;
        }

        if (block.type === 'blockquote') {
          return (
            <blockquote key={index}>
              {block.lines.map((line, lineIndex) => (
                <p key={`${index}-${lineIndex}`}>{renderInlineText(line)}</p>
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
                    <th key={`${index}-header-${headerIndex}`}>{renderInlineText(header)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={`${index}-row-${rowIndex}`}>
                    {block.headers.map((_, cellIndex) => (
                      <td key={`${index}-cell-${rowIndex}-${cellIndex}`}>{renderInlineText(row[cellIndex] ?? '')}</td>
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

function renderParagraphLines(lines: string[]) {
  return lines.map((line, lineIndex) => (
    <Fragment key={lineIndex}>
      {lineIndex > 0 ? <br /> : null}
      {renderInlineText(line)}
    </Fragment>
  ));
}

function renderListItem(item: MarkdownListItem) {
  if (item.checked === undefined) {
    return renderInlineText(item.text);
  }

  return (
    <span className="markdown-task">
      <input checked={item.checked} readOnly type="checkbox" />
      <span>{renderInlineText(item.text)}</span>
    </span>
  );
}
