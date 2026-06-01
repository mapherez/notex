import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import type { DynamicNoteFile, DynamicNoteFileKind } from '../models/models';

type DynamicFileImportInfo = DynamicNoteFile & {
  absolutePath: string;
  kind: DynamicNoteFileKind;
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

export async function chooseDynamicAttachment() {
  const selected = await open({
    multiple: false,
    filters: attachmentFilters,
  });

  return typeof selected === 'string' ? selected : null;
}

export function importDynamicAttachment(sourcePath: string, noteId: string, blockId?: string | null) {
  return invoke<DynamicFileImportInfo>('notex_dynamic_file_import', {
    sourcePath,
    noteId,
    blockId: blockId ?? null,
  });
}

export async function resolveDynamicFileSrc(relativePath: string) {
  const absolutePath = await invoke<string>('notex_dynamic_file_absolute_path', { relativePath });
  return convertFileSrc(absolutePath);
}

export function openDynamicAttachment(relativePath: string) {
  return invoke<void>('notex_dynamic_file_open', { relativePath });
}

export function deleteDynamicAttachment(relativePath: string) {
  return invoke<void>('notex_dynamic_file_delete', { relativePath });
}

export async function exportDynamicAttachment(file: DynamicNoteFile) {
  const destinationPath = await save({
    defaultPath: file.originalName,
  });

  if (!destinationPath) {
    return null;
  }

  return invoke<string>('notex_dynamic_file_copy_to', {
    relativePath: file.relativePath,
    destinationPath,
  });
}
