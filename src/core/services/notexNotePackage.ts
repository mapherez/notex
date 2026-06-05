import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import type { SqliteExportInfo } from './sqliteDataManagement';

export type NotexNoteImportInfo = {
  noteId: string;
  title: string;
  importedFilesCount: number;
  matchedTags: string[];
  droppedTags: string[];
  matchedCollection?: string | null;
  droppedCollection?: string | null;
  matchedLinkedNotes: string[];
  droppedLinkedNotes: string[];
};

const notePackageFilters = [
  {
    name: 'NoteX note',
    extensions: ['notex-note'],
  },
];

export function createNotexNoteTempExport(noteId: string) {
  return invoke<SqliteExportInfo>('notex_note_package_create_temp_export', { noteId });
}

export async function chooseNotexNoteExportDestination(exportInfo: SqliteExportInfo) {
  const destinationPath = await save({
    defaultPath: exportInfo.fileName,
    filters: notePackageFilters,
  });

  if (!destinationPath) {
    return null;
  }

  return invoke<string>('notex_note_package_copy_export_to', {
    tempPath: exportInfo.tempPath,
    destinationPath,
  });
}

export async function chooseNotexNoteImportFile() {
  const selected = await open({
    multiple: false,
    filters: notePackageFilters,
  });

  return typeof selected === 'string' ? selected : null;
}

export function importNotexNotePackage(sourcePath: string) {
  return invoke<NotexNoteImportInfo>('notex_note_package_import_from_file', { sourcePath });
}
