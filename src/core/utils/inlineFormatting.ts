import { tagColorOptions } from '../../config/appSettings';
import type { TagColor } from '../models/models';

export const inlineStyleColors = tagColorOptions;

export type InlineStyleColor = TagColor;
export type InlineStyleKind = 'bg' | 'color';

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

export function applyInlineStyleToken({
  color,
  fallback,
  kind,
  selectionEnd,
  selectionStart,
  text,
}: {
  color: InlineStyleColor;
  fallback: string;
  kind: InlineStyleKind;
  selectionEnd: number;
  selectionStart: number;
  text: string;
}): InlineStyleTextEdit {
  const start = Math.min(selectionStart, selectionEnd);
  const end = Math.max(selectionStart, selectionEnd);
  const selected = text.slice(start, end) || fallback;
  const openingToken = `[[${kind}:${color}]]`;
  const closingToken = `[[/${kind}]]`;
  const nextText = `${text.slice(0, start)}${openingToken}${selected}${closingToken}${text.slice(end)}`;
  const nextSelectionStart = start + openingToken.length;

  return {
    changed: true,
    selectionStart: nextSelectionStart,
    selectionEnd: nextSelectionStart + selected.length,
    text: nextText,
  };
}

export function stripInlineFormatting(value?: string | null) {
  return (value ?? '').replace(inlineStyleTokenPattern, '');
}
