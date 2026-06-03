import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import type { NoteFile, NoteFileKind } from '../models/models';

type FileImportInfo = NoteFile & {
  absolutePath: string;
  kind: NoteFileKind;
};

const attachmentFilters = [
  {
    name: 'Supported files',
    extensions: [
      'apng',
      'avif',
      'bmp',
      'csv',
      'doc',
      'docx',
      'gif',
      'jpeg',
      'jpg',
      'md',
      'pdf',
      'png',
      'svg',
      'txt',
      'webp',
      'xls',
      'xlsx',
    ],
  },
];

export async function chooseNoteAttachment() {
  const selected = await open({
    multiple: false,
    filters: attachmentFilters,
  });

  return typeof selected === 'string' ? selected : null;
}

export function importNoteAttachment(sourcePath: string, noteId: string, blockId?: string | null) {
  return invoke<FileImportInfo>('notex_note_file_import', {
    sourcePath,
    noteId,
    blockId: blockId ?? null,
  });
}

export async function resolveNoteFileSrc(relativePath: string) {
  const absolutePath = await invoke<string>('notex_note_file_absolute_path', { relativePath });
  return convertFileSrc(absolutePath);
}

export function openNoteAttachment(relativePath: string) {
  return invoke<void>('notex_note_file_open', { relativePath });
}

export function deleteNoteAttachment(relativePath: string) {
  return invoke<void>('notex_note_file_delete', { relativePath });
}

export async function exportNoteAttachment(file: NoteFile) {
  const destinationPath = await save({
    defaultPath: file.originalName,
  });

  if (!destinationPath) {
    return null;
  }

  return invoke<string>('notex_note_file_copy_to', {
    relativePath: file.relativePath,
    destinationPath,
  });
}
