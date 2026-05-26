import { tagColorOptions } from '../../config/appSettings';
import type { TagColor } from '../models/models';

export const inlineStyleColors = tagColorOptions;

export type InlineStyleColor = TagColor;
export type InlineStyleKind = 'bg' | 'color';
export type InlineFormatKind = 'bold' | 'code' | 'italic' | 'strike' | 'underline';

const inlineStyleColorSet = new Set<string>(inlineStyleColors);
const inlineStyleTokenPattern = /\[\[(?:color|bg):[a-z-]+\]\]|\[\[\/(?:color|bg)\]\]|\[\[u\]\]|\[\[\/u\]\]/g;

export type InlineStyleTextEdit = {
  changed: boolean;
  selectionEnd: number;
  selectionStart: number;
  text: string;
};

export function normalizeInlineStyleColor(value: string): InlineStyleColor | null {
  return inlineStyleColorSet.has(value) ? (value as InlineStyleColor) : null;
}

export function applyInlineFormatToken({
  fallback,
  prefix,
  selectionEnd,
  selectionStart,
  suffix = prefix,
  text,
}: {
  fallback: string;
  prefix: string;
  selectionEnd: number;
  selectionStart: number;
  suffix?: string;
  text: string;
}): InlineStyleTextEdit {
  const marker = getInlineMarker(prefix, suffix);

  if (!marker) {
    return wrapSelection({ fallback, prefix, selectionEnd, selectionStart, suffix, text });
  }

  return applyInlineTokenEdit({
    fallback,
    mode: 'toggle',
    selectionEnd,
    selectionStart,
    style: marker.style,
    text,
  });
}

export function applyInlineStyleToken({
  color,
  fallback,
  kind,
  selectionEnd,
  selectionStart,
  text,
}: {
  color: InlineStyleColor | null;
  fallback: string;
  kind: InlineStyleKind;
  selectionEnd: number;
  selectionStart: number;
  text: string;
}): InlineStyleTextEdit {
  return applyInlineTokenEdit({
    fallback,
    mode: color ? 'set' : 'clear',
    nextPrefix: color ? `[[${kind}:${color}]]` : null,
    nextSuffix: color ? `[[/${kind}]]` : null,
    selectionEnd,
    selectionStart,
    style: kind,
    text,
    value: color,
  });
}

export function stripInlineFormatting(value?: string | null) {
  return (value ?? '').replace(inlineStyleTokenPattern, '');
}

type InlineTokenStyle = InlineFormatKind | InlineStyleKind;

type InlineRange = {
  innerEnd: number;
  innerStart: number;
  outerEnd: number;
  outerStart: number;
  prefix: string;
  style: InlineTokenStyle;
  suffix: string;
  value?: InlineStyleColor;
};

type InlineTokenMode = 'clear' | 'set' | 'toggle';

const inlineMarkers: Array<{ prefix: string; style: InlineFormatKind; suffix: string }> = [
  { prefix: '**', style: 'bold', suffix: '**' },
  { prefix: '*', style: 'italic', suffix: '*' },
  { prefix: '[[u]]', style: 'underline', suffix: '[[/u]]' },
  { prefix: '~~', style: 'strike', suffix: '~~' },
  { prefix: '`', style: 'code', suffix: '`' },
];

function applyInlineTokenEdit({
  fallback,
  mode,
  nextPrefix = null,
  nextSuffix = null,
  selectionEnd,
  selectionStart,
  style,
  text,
  value,
}: {
  fallback: string;
  mode: InlineTokenMode;
  nextPrefix?: string | null;
  nextSuffix?: string | null;
  selectionEnd: number;
  selectionStart: number;
  style: InlineTokenStyle;
  text: string;
  value?: InlineStyleColor | null;
}): InlineStyleTextEdit {
  const start = Math.min(selectionStart, selectionEnd);
  const end = Math.max(selectionStart, selectionEnd);

  if (start === end) {
    if (mode === 'clear') {
      return unchangedEdit(text, selectionStart, selectionEnd);
    }

    return wrapSelection({
      fallback,
      prefix: nextPrefix ?? getDefaultPrefix(style),
      selectionEnd,
      selectionStart,
      suffix: nextSuffix ?? getDefaultSuffix(style),
      text,
    });
  }

  const ranges = findInlineRanges(text, style);
  const exactRange = ranges.find((range) => range.outerStart === start && range.outerEnd === end);
  if (exactRange) {
    if (mode === 'set') {
      if (!nextPrefix || !nextSuffix || exactRange.value === value) {
        return unchangedEdit(text, selectionStart, selectionEnd);
      }

      return replaceInlineRange({
        range: exactRange,
        selectionEnd: exactRange.innerEnd,
        selectionStart: exactRange.innerStart,
        text,
        withPrefix: nextPrefix,
        withSuffix: nextSuffix,
      });
    }

    return unwrapRange(text, exactRange);
  }

  const containingRange = ranges
    .filter((range) => range.innerStart <= start && end <= range.innerEnd)
    .sort((left, right) => left.innerEnd - left.innerStart - (right.innerEnd - right.innerStart))[0];

  if (containingRange) {
    if (mode === 'set' && containingRange.value === value) {
      return unchangedEdit(text, selectionStart, selectionEnd);
    }

    return replaceInlineRange({
      range: containingRange,
      selectionEnd: end,
      selectionStart: start,
      text,
      withPrefix: mode === 'set' ? nextPrefix : null,
      withSuffix: mode === 'set' ? nextSuffix : null,
    });
  }

  if (mode === 'clear') {
    return clearRangesInsideSelection(text, ranges, start, end);
  }

  return wrapSelection({
    fallback,
    prefix: nextPrefix ?? getDefaultPrefix(style),
    selectionEnd,
    selectionStart,
    suffix: nextSuffix ?? getDefaultSuffix(style),
    text,
  });
}

function unwrapRange(text: string, range: InlineRange): InlineStyleTextEdit {
  const selected = text.slice(range.innerStart, range.innerEnd);
  const nextText = `${text.slice(0, range.outerStart)}${selected}${text.slice(range.outerEnd)}`;

  return {
    changed: nextText !== text,
    selectionStart: range.outerStart,
    selectionEnd: range.outerStart + selected.length,
    text: nextText,
  };
}

function clearRangesInsideSelection(text: string, ranges: InlineRange[], selectionStart: number, selectionEnd: number) {
  const containedRanges = ranges
    .filter((range) => range.outerStart >= selectionStart && range.outerEnd <= selectionEnd)
    .sort((left, right) => right.outerStart - left.outerStart);

  if (!containedRanges.length) {
    return unchangedEdit(text, selectionStart, selectionEnd);
  }

  let nextText = text;
  let removedLength = 0;

  for (const range of containedRanges) {
    nextText = `${nextText.slice(0, range.outerStart)}${nextText.slice(range.innerStart, range.innerEnd)}${nextText.slice(range.outerEnd)}`;
    removedLength += range.prefix.length + range.suffix.length;
  }

  return {
    changed: nextText !== text,
    selectionStart,
    selectionEnd: Math.max(selectionStart, selectionEnd - removedLength),
    text: nextText,
  };
}

function wrapSelection({
  fallback,
  prefix,
  selectionEnd,
  selectionStart,
  suffix,
  text,
}: {
  fallback: string;
  prefix: string;
  selectionEnd: number;
  selectionStart: number;
  suffix: string;
  text: string;
}): InlineStyleTextEdit {
  const start = Math.min(selectionStart, selectionEnd);
  const end = Math.max(selectionStart, selectionEnd);
  const selected = text.slice(start, end) || fallback;
  const nextText = `${text.slice(0, start)}${prefix}${selected}${suffix}${text.slice(end)}`;
  const nextSelectionStart = start + prefix.length;

  return {
    changed: true,
    selectionStart: nextSelectionStart,
    selectionEnd: nextSelectionStart + selected.length,
    text: nextText,
  };
}

function replaceInlineRange({
  range,
  selectionEnd,
  selectionStart,
  text,
  withPrefix,
  withSuffix,
}: {
  range: InlineRange;
  selectionEnd: number;
  selectionStart: number;
  text: string;
  withPrefix: string | null;
  withSuffix: string | null;
}): InlineStyleTextEdit {
  const operation = expandSelectionToNestedRanges(text, selectionStart, selectionEnd, range.innerStart, range.innerEnd, range.style);
  const before = text.slice(range.innerStart, operation.start);
  const selected = text.slice(operation.start, operation.end);
  const after = text.slice(operation.end, range.innerEnd);
  const beforePart = before ? `${range.prefix}${before}${range.suffix}` : '';
  const selectedPart = withPrefix && withSuffix ? `${withPrefix}${selected}${withSuffix}` : selected;
  const afterPart = after ? `${range.prefix}${after}${range.suffix}` : '';
  const replacement = `${beforePart}${selectedPart}${afterPart}`;
  const nextText = `${text.slice(0, range.outerStart)}${replacement}${text.slice(range.outerEnd)}`;
  const nextSelectionStart = range.outerStart + beforePart.length + (withPrefix?.length ?? 0) + (selectionStart - operation.start);
  const nextSelectionEnd = range.outerStart + beforePart.length + (withPrefix?.length ?? 0) + (selectionEnd - operation.start);

  return {
    changed: nextText !== text,
    selectionStart: nextSelectionStart,
    selectionEnd: nextSelectionEnd,
    text: nextText,
  };
}

function expandSelectionToNestedRanges(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  boundaryStart: number,
  boundaryEnd: number,
  excludedStyle: InlineTokenStyle,
) {
  let start = selectionStart;
  let end = selectionEnd;
  let changed = true;
  const ranges = getAllInlineRanges(text);

  while (changed) {
    changed = false;

    for (const range of ranges) {
      if (
        range.style !== excludedStyle &&
        range.outerStart >= boundaryStart &&
        range.outerEnd <= boundaryEnd &&
        range.innerStart <= start &&
        end <= range.innerEnd &&
        (range.outerStart < start || end < range.outerEnd)
      ) {
        start = Math.min(start, range.outerStart);
        end = Math.max(end, range.outerEnd);
        changed = true;
      }
    }
  }

  return { start, end };
}

function findInlineRanges(text: string, style: InlineTokenStyle): InlineRange[] {
  if (style === 'bg' || style === 'color') {
    return findColorRanges(text, style);
  }

  if (style === 'underline') {
    return findExplicitRanges(text, 'underline', '[[u]]', '[[/u]]');
  }

  return findDelimitedRanges(text, style);
}

function getAllInlineRanges(text: string) {
  return (['bold', 'italic', 'underline', 'strike', 'code', 'color', 'bg'] as InlineTokenStyle[]).flatMap((style) => findInlineRanges(text, style));
}

function findColorRanges(text: string, style: InlineStyleKind): InlineRange[] {
  const ranges: InlineRange[] = [];
  const stack: Array<{ prefix: string; start: number; value: InlineStyleColor }> = [];
  const pattern = new RegExp(`\\[\\[${style}:([a-z-]+)\\]\\]|\\[\\[\\/${style}\\]\\]`, 'g');

  for (const match of text.matchAll(pattern)) {
    const token = match[0];
    const tokenStart = match.index ?? 0;
    const normalizedColor = match[1] ? normalizeInlineStyleColor(match[1]) : null;

    if (normalizedColor) {
      stack.push({ prefix: token, start: tokenStart, value: normalizedColor });
      continue;
    }

    const opening = stack.pop();
    if (!opening) {
      continue;
    }

    ranges.push({
      innerEnd: tokenStart,
      innerStart: opening.start + opening.prefix.length,
      outerEnd: tokenStart + token.length,
      outerStart: opening.start,
      prefix: opening.prefix,
      style,
      suffix: token,
      value: opening.value,
    });
  }

  return ranges;
}

function findExplicitRanges(text: string, style: InlineFormatKind, prefix: string, suffix: string): InlineRange[] {
  const ranges: InlineRange[] = [];
  const stack: number[] = [];
  const escapedPrefix = escapeRegExp(prefix);
  const escapedSuffix = escapeRegExp(suffix);
  const pattern = new RegExp(`${escapedPrefix}|${escapedSuffix}`, 'g');

  for (const match of text.matchAll(pattern)) {
    const token = match[0];
    const tokenStart = match.index ?? 0;

    if (token === prefix) {
      stack.push(tokenStart);
      continue;
    }

    const openingStart = stack.pop();
    if (openingStart === undefined) {
      continue;
    }

    ranges.push({
      innerEnd: tokenStart,
      innerStart: openingStart + prefix.length,
      outerEnd: tokenStart + suffix.length,
      outerStart: openingStart,
      prefix,
      style,
      suffix,
    });
  }

  return ranges;
}

function findDelimitedRanges(text: string, style: InlineFormatKind): InlineRange[] {
  const ranges: InlineRange[] = [];
  const stacks = new Map<string, number[]>();
  const pattern = /\*\*|__|~~|`|(?<!\*)\*(?!\*)|(?<!_)_(?!_)/g;

  for (const match of text.matchAll(pattern)) {
    const token = match[0];
    const tokenStyle = getDelimitedStyle(token);
    if (tokenStyle !== style) {
      continue;
    }

    const tokenStack = stacks.get(token) ?? [];
    if (tokenStack.length) {
      const openingStart = tokenStack.pop() ?? 0;
      ranges.push({
        innerEnd: match.index ?? 0,
        innerStart: openingStart + token.length,
        outerEnd: (match.index ?? 0) + token.length,
        outerStart: openingStart,
        prefix: token,
        style,
        suffix: token,
      });
    } else {
      tokenStack.push(match.index ?? 0);
    }
    stacks.set(token, tokenStack);
  }

  return ranges;
}

function getDelimitedStyle(token: string): InlineFormatKind {
  if (token === '**' || token === '__') {
    return 'bold';
  }

  if (token === '*' || token === '_') {
    return 'italic';
  }

  if (token === '~~') {
    return 'strike';
  }

  return 'code';
}

function getInlineMarker(prefix: string, suffix: string) {
  return inlineMarkers.find((marker) => marker.prefix === prefix && marker.suffix === suffix) ?? null;
}

function getDefaultPrefix(style: InlineTokenStyle) {
  return inlineMarkers.find((marker) => marker.style === style)?.prefix ?? '';
}

function getDefaultSuffix(style: InlineTokenStyle) {
  return inlineMarkers.find((marker) => marker.style === style)?.suffix ?? '';
}

function unchangedEdit(text: string, selectionStart: number, selectionEnd: number): InlineStyleTextEdit {
  return {
    changed: false,
    selectionStart,
    selectionEnd,
    text,
  };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
