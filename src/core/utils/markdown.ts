export type MarkdownListItem = {
  checked?: boolean;
  text: string;
};

export type MarkdownBlock =
  | { type: 'blockquote'; lines: string[] }
  | { type: 'code'; code: string; language?: string }
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; text: string }
  | { type: 'horizontal-rule' }
  | { type: 'ordered-list'; items: MarkdownListItem[] }
  | { type: 'paragraph'; lines: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'unordered-list'; items: MarkdownListItem[] };

const headingPattern = /^(#{1,6})\s+(.+)$/;
const horizontalRulePattern = /^\s*-{3,}\s*$/;
const unorderedListPattern = /^\s*[-*+]\s+(?:\[( |x|X)\]\s+)?(.+)$/;
const orderedListPattern = /^\s*\d+[.)]\s+(?:\[( |x|X)\]\s+)?(.+)$/;

export function parseMarkdown(markdown: string): MarkdownBlock[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.trimStart().startsWith('```')) {
      const fence = line.trim();
      const language = fence.slice(3).trim() || undefined;
      const codeLines: string[] = [];
      index += 1;

      while (index < lines.length && !lines[index].trimStart().startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }

      if (index < lines.length) {
        index += 1;
      }

      blocks.push({ type: 'code', code: codeLines.join('\n'), language });
      continue;
    }

    if (horizontalRulePattern.test(line)) {
      blocks.push({ type: 'horizontal-rule' });
      index += 1;
      continue;
    }

    const heading = line.match(headingPattern);
    if (heading) {
      blocks.push({
        type: 'heading',
        level: heading[1].length as 1 | 2 | 3 | 4 | 5 | 6,
        text: heading[2].trim(),
      });
      index += 1;
      continue;
    }

    if (isTableStart(lines, index)) {
      const { headers, rows, nextIndex } = parseTable(lines, index);
      blocks.push({ type: 'table', headers, rows });
      index = nextIndex;
      continue;
    }

    if (line.trimStart().startsWith('>')) {
      const quoteLines: string[] = [];

      while (index < lines.length && lines[index].trimStart().startsWith('>')) {
        quoteLines.push(lines[index].trimStart().replace(/^>\s?/, ''));
        index += 1;
      }

      blocks.push({ type: 'blockquote', lines: quoteLines });
      continue;
    }

    if (unorderedListPattern.test(line)) {
      const items: MarkdownListItem[] = [];

      while (index < lines.length) {
        const match = lines[index].match(unorderedListPattern);
        if (!match) {
          break;
        }
        items.push({ checked: checkboxValue(match[1]), text: match[2].trim() });
        index += 1;
      }

      blocks.push({ type: 'unordered-list', items });
      continue;
    }

    if (orderedListPattern.test(line)) {
      const items: MarkdownListItem[] = [];

      while (index < lines.length) {
        const match = lines[index].match(orderedListPattern);
        if (!match) {
          break;
        }
        items.push({ checked: checkboxValue(match[1]), text: match[2].trim() });
        index += 1;
      }

      blocks.push({ type: 'ordered-list', items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length && lines[index].trim()) {
      if (isBlockBoundary(lines, index) && paragraphLines.length > 0) {
        break;
      }
      paragraphLines.push(lines[index].trim());
      index += 1;
    }

    blocks.push({ type: 'paragraph', lines: paragraphLines });
  }

  return blocks;
}

export function isSafeMarkdownHref(href: string) {
  const trimmed = href.trim();
  return (
    trimmed.startsWith('/') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('mailto:')
  );
}

function checkboxValue(value?: string) {
  if (value === undefined) {
    return undefined;
  }

  return value.toLowerCase() === 'x';
}

function isBlockBoundary(lines: string[], index: number) {
  const line = lines[index];
  return (
    headingPattern.test(line) ||
    horizontalRulePattern.test(line) ||
    line.trimStart().startsWith('>') ||
    line.trimStart().startsWith('```') ||
    unorderedListPattern.test(line) ||
    orderedListPattern.test(line) ||
    isTableStart(lines, index)
  );
}

function isTableStart(lines: string[], index: number) {
  return Boolean(lines[index]?.includes('|') && isTableSeparator(lines[index + 1] ?? ''));
}

function isTableSeparator(line: string) {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function parseTable(lines: string[], startIndex: number) {
  const headers = splitTableRow(lines[startIndex]);
  const rows: string[][] = [];
  let index = startIndex + 2;

  while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
    rows.push(splitTableRow(lines[index]));
    index += 1;
  }

  return { headers, rows, nextIndex: index };
}

function splitTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}
