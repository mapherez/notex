import { setStorageDatabase } from '../db/notexDb';
import { IndexedDbStorage } from './indexedDbStorage';

let browserStorage: IndexedDbStorage | undefined;
const objectUrls = new Map<string, string>();

function clearUrls() { for (const url of objectUrls.values()) URL.revokeObjectURL(url); objectUrls.clear(); }

export function releaseBrowserFileUrl(path: string) {
  const url = objectUrls.get(path);
  if (!url) return;
  URL.revokeObjectURL(url);
  objectUrls.delete(path);
}

export async function browserFileUrl(path: string) {
  const existing = objectUrls.get(path);
  if (existing) return existing;
  const storage = currentBrowserStorage();
  const blob = await storage.readBlob(path);
  if (!blob || storage !== browserStorage) throw new Error('Attachment is not available');
  const url = URL.createObjectURL(blob);
  objectUrls.set(path, url);
  return url;
}

export async function openBrowserLibrary(accountId: string) {
  const next = await IndexedDbStorage.open(accountId);
  browserStorage?.close();
  clearUrls();
  browserStorage = next;
  setStorageDatabase(next.db);
  // This is a persistence request, not a prerequisite for writing locally.
  // Backup status will still report pending changes if browser quota is full.
  void navigator.storage?.persist?.().catch(() => false);
  return next;
}

export function closeBrowserLibrary() {
  browserStorage?.close();
  browserStorage = undefined;
  clearUrls();
}

export function currentBrowserStorage() {
  if (!browserStorage) throw new Error('GOOGLE_LOGIN_REQUIRED');
  return browserStorage;
}
