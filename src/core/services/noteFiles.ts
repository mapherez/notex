import { convertFileSrc, isTauri } from '@tauri-apps/api/core';
import { browserFileUrl, currentBrowserStorage } from '../storage/storageRuntime';
import { desktopInvoke as invoke } from '../storage/desktopInvoke';
import { open, save } from '@tauri-apps/plugin-dialog';
import type { NoteFile, NoteFileKind } from '../models/models';
import { createUuid } from '../utils/createUuid';

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

export async function chooseNoteAttachment(): Promise<string | File | null> {
  if (!isTauri()) {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = attachmentFilters[0].extensions.map((extension) => `.${extension}`).join(',');
      input.addEventListener('change', () => resolve(input.files?.[0] ?? null), { once: true });
      input.addEventListener('cancel', () => resolve(null), { once: true });
      input.click();
    });
  }
  const selected = await open({
    multiple: false,
    filters: attachmentFilters,
  });

  return typeof selected === 'string' ? selected : null;
}

export async function importNoteAttachment(sourcePath: string | File, noteId: string, blockId?: string | null): Promise<FileImportInfo> {
  if (!isTauri()) {
    if (!(sourcePath instanceof File)) throw new Error('Select a file from this device');
    const storage = currentBrowserStorage();
    const bytes = new Uint8Array(await sourcePath.arrayBuffer());
    let checksum = 0xcbf29ce484222325n;
    for (const byte of bytes) checksum = BigInt.asUintN(64, (checksum ^ BigInt(byte)) * 0x100000001b3n);
    const id = createUuid();
    const relativePath = `${noteId}/${id}/${encodeURIComponent(sourcePath.name).replace(/%/g, '_')}`;
    await storage.writeBlob(relativePath, sourcePath);
    return { id, noteId, blockId: blockId ?? null, kind: sourcePath.type.startsWith('image/') ? 'image' : 'attachment',
      originalName: sourcePath.name, mimeType: sourcePath.type || 'application/octet-stream', sizeBytes: sourcePath.size,
      checksum: checksum.toString(16).padStart(16, '0'), relativePath, absolutePath: '', createdAt: new Date().toISOString() };
  }
  return invoke<FileImportInfo>('notex_note_file_import', {
    sourcePath,
    noteId,
    blockId: blockId ?? null,
  });
}

export async function resolveNoteFileSrc(relativePath: string) {
  if (!isTauri()) return browserFileUrl(relativePath);
  const absolutePath = await invoke<string>('notex_note_file_absolute_path', { relativePath });
  return convertFileSrc(absolutePath);
}

export async function openNoteAttachment(relativePath: string) {
  if (!isTauri()) {
    const url = await browserFileUrl(relativePath);
    const file = (await currentBrowserStorage().db.noteFiles.where('relativePath').equals(relativePath).toArray())[0];
    const anchor = document.createElement('a'); anchor.href = url; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer';
    if (!file || !['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif'].includes(file.mimeType)) anchor.download = file?.originalName ?? 'attachment';
    anchor.click(); return;
  }
  return invoke<void>('notex_note_file_open', { relativePath });
}

export function deleteNoteAttachment(relativePath: string) {
  if (!isTauri()) return currentBrowserStorage().deleteBlob(relativePath);
  return invoke<void>('notex_note_file_delete', { relativePath });
}

export async function exportNoteAttachment(file: NoteFile) {
  if (!isTauri()) {
    const url = await browserFileUrl(file.relativePath);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = file.originalName; anchor.click(); return file.originalName;
  }
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
