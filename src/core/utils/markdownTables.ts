export type MarkdownTableAction = 'column-left' | 'column-right' | 'insert-table' | 'row-above' | 'row-below';

export type MarkdownTextEdit = {
  text: string;
  selectionStart: number;
  selectionEnd: number;
  changed: boolean;
};

type LineInfo = {
  end: number;
  start: number;
  text: string;
};

type TableRange = {
  endLine: number;
  startLine: number;
};

const defaultTable = ['| Column 1 | Column 2 |', '| --- | --- |', '|  |  |'].join('\n');

export function hasMarkdownTableAtCursor(text: string, cursor: number) {
  const lines = getLines(text);
  const lineIndex = getLineIndex(lines, cursor);
  return Boolean(findTableRange(lines, lineIndex));
}

export function applyMarkdownTableAction({
  action,
  selectionEnd,
  selectionStart,
  text,
}: {
  action: MarkdownTableAction;
  selectionEnd: number;
  selectionStart: number;
  text: string;
}): MarkdownTextEdit {
  if (action === 'insert-table') {
    return insertDefaultTable(text, selectionStart, selectionEnd);
  }

  const lines = getLines(text);
  const lineIndex = getLineIndex(lines, selectionStart);
  const table = findTableRange(lines, lineIndex);

  if (!table) {
    return {
      text,
      selectionStart,
      selectionEnd,
      changed: false,
    };
  }

  if (action === 'row-above' || action === 'row-below') {
    return applyRowAction({ action, lines, selectionStart, table, text });
  }

  return applyColumnAction({ action, lines, lineIndex, selectionStart, table, text });
}

function insertDefaultTable(text: string, selectionStart: number, selectionEnd: number): MarkdownTextEdit {
  const before = text.slice(0, selectionStart);
  const after = text.slice(selectionEnd);
  const prefix = before && !before.endsWith('\n') ? '\n\n' : before.endsWith('\n') ? '\n' : '';
  const suffix = after && !after.startsWith('\n') ? '\n\n' : after.startsWith('\n') ? '\n' : '';
  const insertion = `${prefix}${defaultTable}${suffix}`;
  const nextText = `${before}${insertion}${after}`;
  const nextCursor = before.length + insertion.length;

  return {
    text: nextText,
    selectionStart: nextCursor,
    selectionEnd: nextCursor,
    changed: true,
  };
}

function applyRowAction({
  action,
  lines,
  selectionStart,
  table,
  text,
}: {
  action: 'row-above' | 'row-below';
  lines: LineInfo[];
  selectionStart: number;
  table: TableRange;
  text: string;
}): MarkdownTextEdit {
  const lineIndex = getLineIndex(lines, selectionStart);
  const columnCount = splitTableRow(lines[table.startLine].text).length;
  const emptyRow = formatTableRow(Array.from({ length: columnCount }, () => ''));
  const insertLine =
    lineIndex <= table.startLine + 1
      ? table.startLine + 2
      : action === 'row-above'
        ? lineIndex
        : Math.min(lineIndex + 1, table.endLine + 1);
  const nextLines = lines.map((line) => line.text);

  nextLines.splice(insertLine, 0, emptyRow);

  const nextText = nextLines.join('\n');
  const nextCursor = getOffsetForLine(nextLines, insertLine);

  return {
    text: nextText,
    selectionStart: nextCursor,
    selectionEnd: nextCursor,
    changed: nextText !== text,
  };
}

function applyColumnAction({
  action,
  lines,
  lineIndex,
  selectionStart,
  table,
  text,
}: {
  action: 'column-left' | 'column-right';
  lines: LineInfo[];
  lineIndex: number;
  selectionStart: number;
  table: TableRange;
  text: string;
}): MarkdownTextEdit {
  const columnIndex = getColumnIndex(lines[lineIndex]?.text ?? '', selectionStart - (lines[lineIndex]?.start ?? 0));
  const insertIndex = action === 'column-left' ? columnIndex : columnIndex + 1;
  const nextLines = lines.map((line) => line.text);

  for (let index = table.startLine; index <= table.endLine; index += 1) {
    const cells = splitTableRow(nextLines[index]);
    const cellValue = index === table.startLine + 1 ? '---' : '';
    cells.splice(Math.min(insertIndex, cells.length), 0, cellValue);
    nextLines[index] = formatTableRow(cells);
  }

  const nextText = nextLines.join('\n');
  const nextCursor = Math.min(selectionStart, nextText.length);

  return {
    text: nextText,
    selectionStart: nextCursor,
    selectionEnd: nextCursor,
    changed: nextText !== text,
  };
}

function findTableRange(lines: LineInfo[], lineIndex: number): TableRange | null {
  let index = 0;

  while (index < lines.length - 1) {
    if (!isTableRow(lines[index].text) || !isTableSeparator(lines[index + 1].text)) {
      index += 1;
      continue;
    }

    let endLine = index + 1;
    while (endLine + 1 < lines.length && isTableRow(lines[endLine + 1].text)) {
      endLine += 1;
    }

    if (lineIndex >= index && lineIndex <= endLine) {
      return { startLine: index, endLine };
    }

    index = endLine + 1;
  }

  return null;
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

function getOffsetForLine(lines: string[], lineIndex: number) {
  return lines.slice(0, lineIndex).reduce((offset, line) => offset + line.length + 1, 0);
}

function getColumnIndex(line: string, cursorColumn: number) {
  const pipeIndexes = [...line.matchAll(/\|/g)].map((match) => match.index ?? 0);

  if (pipeIndexes.length < 2) {
    return 0;
  }

  for (let index = 0; index < pipeIndexes.length - 1; index += 1) {
    if (cursorColumn >= pipeIndexes[index] && cursorColumn <= pipeIndexes[index + 1]) {
      return index;
    }
  }

  return Math.max(0, pipeIndexes.length - 2);
}

function isTableRow(line: string) {
  return line.includes('|') && line.trim().length > 0;
}

function isTableSeparator(line: string) {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function splitTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function formatTableRow(cells: string[]) {
  return `| ${cells.join(' | ')} |`;
}
