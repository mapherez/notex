import { stableStringify } from '../utils/stableJson';

export type PendingBackup = {
  entityId: string;
  kind: 'note' | 'library';
  changeToken: string;
  version: number;
  deleted: boolean;
  firstChangedAt: number;
  lastChangedAt: number;
};

export const organizationFields = [
  'primaryCollectionId', 'favoriteTagIds', 'pinnedNoteIds', 'quickPinNoteIds', 'noteHiddenPanelIds',
] as const;

export function backupProjection(table: string, value: Record<string, unknown> | undefined) {
  if (!value) return undefined;
  if (table === 'notes') {
    // Block/file edits increment the parent revision even when its header stays
    // unchanged. Visits do not increment it, so keep version in this projection.
    const { lastOpenedAt: _opened, updatedAt: _updated, stats: _stats, ...content } = value;
    return content;
  }
  if (table === 'userSettings') {
    return Object.fromEntries(organizationFields.map((key) => [key, value[key]]));
  }
  const { count: _count, ...content } = value;
  return content;
}

export function hasBackupChange(table: string, before: Record<string, unknown> | undefined, after: Record<string, unknown> | undefined) {
  return stableStringify(backupProjection(table, before)) !== stableStringify(backupProjection(table, after));
}
