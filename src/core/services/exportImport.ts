import type { NoteXExport } from '../models/models';

export function createExportFile(payload: NoteXExport) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `notex-export-${payload.exportedAt.slice(0, 10)}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function readImportFile(file: File): Promise<NoteXExport> {
  const text = await file.text();
  const payload = JSON.parse(text) as NoteXExport;

  if (payload.version !== 1 || !Array.isArray(payload.notes)) {
    throw new Error('Invalid NoteX export file');
  }

  return payload;
}
