import type { Note } from '../models/models';
import type { DriveCatalog } from './backupFormat';

let catalog: DriveCatalog | null = null;
let loader: ((id: string) => Promise<void>) | undefined;
const deletedIds = new Set<string>();
export function markCloudDeleted(ids: string[]) { for (const id of ids) deletedIds.add(id); }
export function setCloudView(value: DriveCatalog | null, load?: (id: string) => Promise<void>) { catalog = value; if (load) loader = load; if (!value) { loader = undefined; deletedIds.clear(); } }
export function withCloudMetadata(notes: Note[]): Note[] {
  const localIds = new Set(notes.map((note) => note.id));
  return [...notes, ...Object.values(catalog?.notes ?? {}).filter((entry) => !entry.deleted && entry.metadata && !localIds.has(entry.id) && !deletedIds.has(entry.id))
    .map((entry) => ({ ...entry.metadata!, cloudOnly: true, blocks: [], files: [] }))];
}
export async function downloadCloudNote(id: string) {
  if (!loader) throw new Error('CLOUD_DOWNLOAD_UNAVAILABLE');
  await loader(id);
}
