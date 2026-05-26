import { tagColorOptions } from '../../config/appSettings';
import type { TagColor } from '../models/models';
import { isSafeMarkdownHref } from './markdown';

const ignoredTags = new Set(['HEAD', 'LINK', 'META', 'SCRIPT', 'STYLE', 'TITLE']);
const blockTags = new Set([
  'ADDRESS',
  'ARTICLE',
  'ASIDE',
  'BLOCKQUOTE',
  'DIV',
  'DL',
  'FIGCAPTION',
  'FIGURE',
  'FOOTER',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HEADER',
  'HR',
  'LI',
  'MAIN',
  'NAV',
  'OL',
  'P',
  'PRE',
  'SECTION',
  'TABLE',
  'UL',
]);

const paletteRgb: Record<TagColor, [number, number, number]> = {
  amber: [255, 189, 61],
  blue: [79, 140, 255],
  brown: [183, 121, 31],
  cyan: [34, 211, 238],
  fuchsia: [217, 70, 239],
  green: [77, 209, 123],
  indigo: [99, 102, 241],
  lime: [163, 230, 53],
  mint: [110, 231, 183],
  neutral: [168, 173, 187],
  orange: [255, 155, 38],
  pink: [236, 94, 255],
  purple: [168, 85, 247],
  red: [204, 63, 63],
  rose: [255, 92, 138],
  sky: [56, 189, 248],
  slate: [148, 163, 184],
  teal: [45, 212, 191],
  violet: [139, 92, 246],
  yellow: [255, 216, 77],
};

const namedColors: Record<string, [number, number, number] | null> = {
  black: [0, 0, 0],
  blue: [0, 0, 255],
  brown: [165, 42, 42],
  cyan: [0, 255, 255],
  fuchsia: [255, 0, 255],
  gray: [128, 128, 128],
  green: [0, 128, 0],
  grey: [128, 128, 128],
  lime: [0, 255, 0],
  magenta: [255, 0, 255],
  navy: [0, 0, 128],
  orange: [255, 165, 0],
  pink: [255, 192, 203],
  purple: [128, 0, 128],
  red: [255, 0, 0],
  transparent: null,
  violet: [238, 130, 238],
  white: [255, 255, 255],
  yellow: [255, 255, 0],
};

type InlineFormat = {
  backgroundColor?: TagColor;
  bold: boolean;
  italic: boolean;
  strike: boolean;
  textColor?: TagColor;
  underline: boolean;
};

const emptyFormat: InlineFormat = {
  bold: false,
  italic: false,
  strike: false,
  underline: false,
};

export function htmlToMarkdown(html: string) {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const blocks = convertChildrenToBlocks(document.body);
  return normalizeMarkdown(blocks.join('\n\n'));
}

function convertChildrenToBlocks(parent: ParentNode): string[] {
  const blocks: string[] = [];
  let inlineBuffer = '';

  parent.childNodes.forEach((child) => {
    if (isIgnoredNode(child)) {
      return;
    }

    if (isBlockNode(child)) {
      pushInlineBuffer();
      const block = convertBlockNode(child);
      if (block.trim()) {
        blocks.push(block);
      }
      return;
    }

    inlineBuffer += convertInlineNode(child);
  });

  pushInlineBuffer();
  return blocks;

  function pushInlineBuffer() {
    const normalized = normalizeInlineText(inlineBuffer);
    if (normalized) {
      blocks.push(normalized);
    }
    inlineBuffer = '';
  }
}

function convertBlockNode(node: ChildNode): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return normalizeInlineText(node.textContent ?? '');
  }

  if (!(node instanceof HTMLElement) || ignoredTags.has(node.tagName)) {
    return '';
  }

  if (/^H[1-6]$/.test(node.tagName)) {
    const level = Number(node.tagName.slice(1));
    const text = normalizeInlineText(convertInlineChildren(node));
    return text ? `${'#'.repeat(level)} ${text}` : '';
  }

  if (node.tagName === 'BLOCKQUOTE') {
    const quote = convertChildrenToBlocks(node).join('\n\n') || normalizeInlineText(convertInlineChildren(node));
    return quote
      .split('\n')
      .map((line) => (line.trim() ? `> ${line}` : '>'))
      .join('\n');
  }

  if (node.tagName === 'UL' || node.tagName === 'OL') {
    return convertList(node, node.tagName === 'OL');
  }

  if (node.tagName === 'TABLE') {
    return convertTable(node);
  }

  if (node.tagName === 'PRE') {
    return ['```', (node.textContent ?? '').replace(/\n+$/g, ''), '```'].join('\n');
  }

  if (node.tagName === 'HR') {
    return '---';
  }

  const childBlocks = convertChildrenToBlocks(node);
  if (childBlocks.length > 1 || hasBlockChild(node)) {
    return childBlocks.join('\n\n');
  }

  return normalizeInlineText(childBlocks[0] ?? convertInlineChildren(node));
}

function convertInlineChildren(parent: ParentNode) {
  return Array.from(parent.childNodes)
    .map((child) => convertInlineNode(child))
    .join('');
}

function convertInlineNode(node: ChildNode): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return normalizeWhitespace(node.textContent ?? '');
  }

  if (!(node instanceof HTMLElement) || ignoredTags.has(node.tagName)) {
    return '';
  }

  if (node.tagName === 'BR') {
    return '\n';
  }

  if (node.tagName === 'IMG') {
    return node.getAttribute('alt')?.trim() ?? '';
  }

  if (isBlockNode(node) && node.tagName !== 'A') {
    return convertBlockNode(node);
  }

  if (node.tagName === 'CODE') {
    return wrapInlineCode(node.textContent ?? '');
  }

  const format = readInlineFormat(node);
  let content = normalizeInlineText(convertInlineChildren(node));

  if (!content) {
    return '';
  }

  if (node.tagName === 'A') {
    const href = node.getAttribute('href')?.trim();
    if (href && isSafeMarkdownHref(href)) {
      content = `[${content}](${href})`;
    }
  }

  if (format.bold) {
    content = `**${content}**`;
  }
  if (format.italic) {
    content = `*${content}*`;
  }
  if (format.underline) {
    content = `[[u]]${content}[[/u]]`;
  }
  if (format.strike) {
    content = `~~${content}~~`;
  }
  if (format.textColor) {
    content = `[[color:${format.textColor}]]${content}[[/color]]`;
  }
  if (format.backgroundColor) {
    content = `[[bg:${format.backgroundColor}]]${content}[[/bg]]`;
  }

  return content;
}

function convertList(list: HTMLElement, ordered: boolean) {
  let itemIndex = 1;

  return Array.from(list.children)
    .filter((child): child is HTMLElement => child instanceof HTMLElement && child.tagName === 'LI')
    .map((item) => {
      const nestedLists: string[] = [];
      let content = '';

      item.childNodes.forEach((child) => {
        if (child instanceof HTMLElement && (child.tagName === 'UL' || child.tagName === 'OL')) {
          nestedLists.push(convertList(child, child.tagName === 'OL'));
          return;
        }

        content += isBlockNode(child) ? ` ${convertBlockNode(child)}` : convertInlineNode(child);
      });

      const checkbox = item.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
      const marker = ordered ? `${itemIndex}.` : checkbox ? `- [${checkbox.checked ? 'x' : ' '}]` : '-';
      const line = `${marker} ${normalizeInlineText(content.replace(/\[[ x]\]/i, ''))}`;
      itemIndex += 1;

      if (!nestedLists.length) {
        return line;
      }

      return [line, ...nestedLists.map((nestedList) => indentMarkdown(nestedList))].join('\n');
    })
    .join('\n');
}

function convertTable(table: HTMLElement) {
  const tableRows = Array.from(table.querySelectorAll('tr')).map((row) =>
    Array.from(row.children)
      .filter((cell) => cell instanceof HTMLElement && (cell.tagName === 'TH' || cell.tagName === 'TD'))
      .map((cell) => normalizeInlineText(convertInlineChildren(cell)).replace(/\|/g, '/')),
  );
  const rows = tableRows.filter((row) => row.length);

  if (!rows.length) {
    return '';
  }

  const firstRowCells = Array.from(table.querySelectorAll('tr')[0]?.children ?? []);
  const firstRowHasHeaders = firstRowCells.some((cell) => cell instanceof HTMLElement && cell.tagName === 'TH');
  const columnCount = Math.max(...rows.map((row) => row.length));
  const headers = firstRowHasHeaders ? padRow(rows[0], columnCount) : Array.from({ length: columnCount }, (_, index) => `Column ${index + 1}`);
  const bodyRows = firstRowHasHeaders ? rows.slice(1) : rows;

  return [
    tableRow(headers),
    tableRow(headers.map(() => '---')),
    ...bodyRows.map((row) => tableRow(padRow(row, columnCount))),
  ].join('\n');
}

function readInlineFormat(element: HTMLElement): InlineFormat {
  const style = element.style;
  const textDecoration = `${style.textDecoration} ${style.textDecorationLine}`.toLowerCase();
  const fontWeight = style.fontWeight.trim().toLowerCase();
  const fontWeightNumber = Number.parseInt(fontWeight, 10);
  const textColor = colorToPalette(style.color, 'text');
  const backgroundColor =
    colorToPalette(style.backgroundColor, 'background') ??
    colorToPalette(style.getPropertyValue('background'), 'background') ??
    colorToPalette(style.getPropertyValue('mso-highlight'), 'background');

  return {
    backgroundColor: backgroundColor ?? undefined,
    bold: element.tagName === 'B' || element.tagName === 'STRONG' || fontWeight === 'bold' || fontWeightNumber >= 600,
    italic: element.tagName === 'EM' || element.tagName === 'I' || style.fontStyle.toLowerCase() === 'italic',
    strike: ['DEL', 'S', 'STRIKE'].includes(element.tagName) || textDecoration.includes('line-through'),
    textColor: textColor ?? undefined,
    underline: element.tagName === 'U' || textDecoration.includes('underline'),
  };
}

function colorToPalette(value: string, usage: 'background' | 'text'): TagColor | null {
  const rgb = parseCssColor(value);
  if (!rgb) {
    return null;
  }

  if (usage === 'text' && isLowSignalTextColor(rgb)) {
    return null;
  }

  if (usage === 'background' && isLowSignalBackgroundColor(rgb)) {
    return null;
  }

  return nearestPaletteColor(rgb);
}

function parseCssColor(value: string): [number, number, number] | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === 'initial' || normalized === 'inherit' || normalized === 'currentcolor') {
    return null;
  }

  const named = namedColors[normalized];
  if (normalized in namedColors) {
    return named;
  }

  const hex = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const value = hex[1].length === 3 ? hex[1].replace(/(.)/g, '$1$1') : hex[1];
    return [
      Number.parseInt(value.slice(0, 2), 16),
      Number.parseInt(value.slice(2, 4), 16),
      Number.parseInt(value.slice(4, 6), 16),
    ];
  }

  const rgb = normalized.match(/^rgba?\(([^)]+)\)$/);
  if (rgb) {
    const parts = rgb[1].split(',').map((part) => part.trim());
    const alpha = parts[3] === undefined ? 1 : Number.parseFloat(parts[3]);
    if (alpha === 0) {
      return null;
    }

    return [parseColorChannel(parts[0]), parseColorChannel(parts[1]), parseColorChannel(parts[2])];
  }

  return null;
}

function parseColorChannel(value: string) {
  if (value.endsWith('%')) {
    return Math.round((Number.parseFloat(value) / 100) * 255);
  }
  return Math.max(0, Math.min(255, Number.parseInt(value, 10)));
}

function nearestPaletteColor(rgb: [number, number, number]): TagColor {
  return tagColorOptions.reduce<TagColor>((bestColor, color) => {
    const bestDistance = colorDistance(rgb, paletteRgb[bestColor]);
    const nextDistance = colorDistance(rgb, paletteRgb[color]);
    return nextDistance < bestDistance ? color : bestColor;
  }, tagColorOptions[0]);
}

function colorDistance(a: [number, number, number], b: [number, number, number]) {
  return (a[0] - b[0]) ** 2 * 0.3 + (a[1] - b[1]) ** 2 * 0.59 + (a[2] - b[2]) ** 2 * 0.11;
}

function isLowSignalTextColor([red, green, blue]: [number, number, number]) {
  const saturation = colorSaturation(red, green, blue);
  const brightness = (red + green + blue) / (255 * 3);
  return saturation < 0.14 || brightness < 0.12 || brightness > 0.88;
}

function isLowSignalBackgroundColor([red, green, blue]: [number, number, number]) {
  const saturation = colorSaturation(red, green, blue);
  const brightness = (red + green + blue) / (255 * 3);
  return saturation < 0.1 || brightness < 0.08 || brightness > 0.94;
}

function colorSaturation(red: number, green: number, blue: number) {
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  return max === 0 ? 0 : (max - min) / max;
}

function isIgnoredNode(node: ChildNode) {
  return node.nodeType === Node.COMMENT_NODE || (node instanceof HTMLElement && ignoredTags.has(node.tagName));
}

function isBlockNode(node: ChildNode) {
  return node instanceof HTMLElement && blockTags.has(node.tagName);
}

function hasBlockChild(parent: ParentNode) {
  return Array.from(parent.childNodes).some(isBlockNode);
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ');
}

function normalizeInlineText(value: string) {
  return value.replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n').replace(/[ \t]{2,}/g, ' ').trim();
}

function normalizeMarkdown(value: string) {
  return value.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function wrapInlineCode(value: string) {
  const content = value.replace(/\s+/g, ' ').trim();
  return content.includes('`') ? `\`\`${content}\`\`` : `\`${content}\``;
}

function indentMarkdown(value: string) {
  return value
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');
}

function padRow(row: string[], columnCount: number) {
  return [...row, ...Array.from({ length: Math.max(0, columnCount - row.length) }, () => '')];
}

function tableRow(cells: string[]) {
  return `| ${cells.join(' | ')} |`;
}
