import type { MarkdownTextEdit } from './markdownTables';

export type MarkdownBlockStyle = 'bullet-list' | 'check-list' | 'heading-1' | 'heading-2' | 'heading-3' | 'numbered-list' | 'quote';

type LineInfo = {
  end: number;
  start: number;
  text: string;
};

export function applyMarkdownBlockStyle({
  selectionEnd,
  selectionStart,
  style,
  text,
}: {
  selectionEnd: number;
  selectionStart: number;
  style: MarkdownBlockStyle;
  text: string;
}): MarkdownTextEdit {
  const start = Math.min(selectionStart, selectionEnd);
  const end = Math.max(selectionStart, selectionEnd);
  const lines = getLines(text);
  const firstLineIndex = getLineIndex(lines, start);
  const lastLineIndex = getLineIndex(lines, end > start && text[end - 1] === '\n' ? end - 1 : end);
  const selectedLines = lines.slice(firstLineIndex, lastLineIndex + 1);
  const nonBlankLines = selectedLines.filter((line) => line.text.trim());
  const shouldRemove = nonBlankLines.length > 0 && nonBlankLines.every((line) => hasBlockStyle(line.text, style));
  let numberedIndex = 1;

  const nextLines = lines.map((line, index) => {
    if (index < firstLineIndex || index > lastLineIndex || !line.text.trim()) {
      return line.text;
    }

    if (shouldRemove) {
      return removeBlockStyle(line.text, style);
    }

    if (style === 'numbered-list') {
      return applyBlockStyle(line.text, style, numberedIndex++);
    }

    return applyBlockStyle(line.text, style);
  });

  const nextText = nextLines.join('\n');
  const nextSelectionStart = lines[firstLineIndex]?.start ?? 0;
  const nextSelectionEnd = nextSelectionStart + nextLines.slice(firstLineIndex, lastLineIndex + 1).join('\n').length;

  return {
    changed: nextText !== text,
    selectionStart: nextSelectionStart,
    selectionEnd: nextSelectionEnd,
    text: nextText,
  };
}

function applyBlockStyle(line: string, style: MarkdownBlockStyle, orderedIndex = 1) {
  const content = stripBlockPrefixes(line);

  if (style === 'heading-1') {
    return `# ${content}`;
  }

  if (style === 'heading-2') {
    return `## ${content}`;
  }

  if (style === 'heading-3') {
    return `### ${content}`;
  }

  if (style === 'bullet-list') {
    return `- ${content}`;
  }

  if (style === 'numbered-list') {
    return `${orderedIndex}. ${content}`;
  }

  if (style === 'check-list') {
    return `- [ ] ${content}`;
  }

  return `> ${removeQuotePrefix(line)}`;
}

function hasBlockStyle(line: string, style: MarkdownBlockStyle) {
  if (style === 'heading-1') {
    return /^#{1}\s+/.test(line);
  }

  if (style === 'heading-2') {
    return /^#{2}\s+/.test(line);
  }

  if (style === 'heading-3') {
    return /^#{3}\s+/.test(line);
  }

  if (style === 'bullet-list') {
    return /^[-*+]\s+(?!\[[ xX]\]\s+)/.test(line);
  }

  if (style === 'numbered-list') {
    return /^\d+[.)]\s+/.test(line);
  }

  if (style === 'check-list') {
    return /^[-*+]\s+\[[ xX]\]\s+/.test(line);
  }

  return /^>\s?/.test(line);
}

function removeBlockStyle(line: string, style: MarkdownBlockStyle) {
  if (style.startsWith('heading')) {
    return line.replace(/^#{1,6}\s+/, '');
  }

  if (style === 'bullet-list') {
    return line.replace(/^[-*+]\s+/, '');
  }

  if (style === 'numbered-list') {
    return line.replace(/^\d+[.)]\s+/, '');
  }

  if (style === 'check-list') {
    return line.replace(/^[-*+]\s+\[[ xX]\]\s+/, '');
  }

  return removeQuotePrefix(line);
}

function stripBlockPrefixes(line: string) {
  return removeQuotePrefix(line)
    .replace(/^#{1,6}\s+/, '')
    .replace(/^[-*+]\s+\[[ xX]\]\s+/, '')
    .replace(/^[-*+]\s+/, '')
    .replace(/^\d+[.)]\s+/, '');
}

function removeQuotePrefix(line: string) {
  return line.replace(/^>\s?/, '');
}

function getLines(text: string): LineInfo[] {
  const rawLines = text.split('\n');
  let cursor = 0;

  return rawLines.map((line) => {
    const info = {
      start: cursor,
      end: cursor + line.length,
      text: line,
    };
    cursor += line.length + 1;
    return info;
  });
}

function getLineIndex(lines: LineInfo[], cursor: number) {
  const index = lines.findIndex((line) => cursor >= line.start && cursor <= line.end);
  return index === -1 ? Math.max(0, lines.length - 1) : index;
}
