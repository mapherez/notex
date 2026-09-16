import { invoke, isTauri } from '@tauri-apps/api/core';
import { create } from 'zustand';
import { db } from '../core/db/notexDb';
import { cloudStorage } from '../core/cloud/cloudStorage';
import { DriveClient } from '../core/cloud/driveClient';
import { setCloudView, withCloudMetadata, markCloudDeleted } from '../core/cloud/cloudView';
import { initialTransferState, TransferEngine, type TransferState } from '../core/cloud/transferEngine';
import { googleWebAccessToken } from '../core/services/googleWebAuth';
import { useAppStore } from './useAppStore';
import { useKnowledgeStore } from './useKnowledgeStore';
import { useNotesStore } from './useNotesStore';

type CloudState = TransferState & {
  accountId: string | null; expanded: boolean;
  excludedNotes: string[];
  toggleExcluded: (id: string) => Promise<void>;
  start: (accountId: string) => Promise<void>; stop: () => Promise<void>;
  backupNow: () => Promise<void>; pause: (paused: boolean) => void;
  prioritize: (ids: string[]) => void; ensureAvailable: (id: string) => Promise<void>;
  resolve: (id: string, choice: 'local' | 'remote') => void;
  toggleExpanded: () => void;
};
let engine: TransferEngine | undefined;
let controller: AbortController | undefined;
let removeOnlineListener: (() => void) | undefined;

export const useCloudStore = create<CloudState>((set, get) => ({
  ...initialTransferState, accountId: null, expanded: false, excludedNotes: [],
  start: async (accountId) => {
    await get().stop();
    set({ ...initialTransferState, accountId });
    controller = new AbortController();
    const storage = cloudStorage(accountId);
    const drive = new DriveClient(async () => isTauri()
      ? invoke<string>('notex_google_access_token', { libraryId: accountId }) : googleWebAccessToken(accountId), controller.signal, storage);
    set({ excludedNotes: await storage.getState<string[]>('excludedNotes') ?? [] });
    engine = new TransferEngine(drive, storage, (state) => {
      set(state); setCloudView(state.catalog, get().ensureAvailable);
    }, async (noteId) => {
      if (noteId) {
        const { backup } = await storage.snapshot(noteId);
        if (!backup) markCloudDeleted([noteId]);
        useNotesStore.setState((state) => ({ notes: withCloudMetadata([
          ...state.notes.filter((note) => note.id !== noteId && !note.cloudOnly),
          ...(backup ? [{ ...backup.note, blocks: backup.blocks, files: backup.files }] : []),
        ]) }));
        return;
      }
      await useKnowledgeStore.getState().refreshKnowledge();
      await useAppStore.getState().hydrateSettings();
      await useNotesStore.getState().refreshNotes();
    });
    const online = () => { void engine?.tick(true); };
    window.addEventListener('online', online);
    const visible = () => { if (document.visibilityState === 'visible') void engine?.tick(); };
    document.addEventListener('visibilitychange', visible);
    removeOnlineListener = () => { window.removeEventListener('online', online); document.removeEventListener('visibilitychange', visible); };
    await engine.start();
  },
  stop: async () => {
    controller?.abort();
    await engine?.stop();
    engine = undefined; controller = undefined;
    removeOnlineListener?.(); removeOnlineListener = undefined;
    setCloudView(null);
    set({ ...initialTransferState, accountId: null, excludedNotes: [] });
  },
  backupNow: async () => { await engine?.backupNow(); },
  pause: (paused) => engine?.pause(paused),
  prioritize: (ids) => engine?.prioritize(ids),
  ensureAvailable: async (id) => {
    if (await db.notes.get(id)) return;
    const active = engine;
    if (!active) throw new Error('CLOUD_DOWNLOAD_UNAVAILABLE');
    active.requestNote(id);
    await new Promise<void>((resolve, reject) => {
      const unsubscribe = useNotesStore.subscribe((state) => {
        if (state.notes.some((note) => note.id === id && !note.cloudOnly)) finish();
      });
      const unsubscribeCloud = useCloudStore.subscribe((state) => {
        if (state.error || engine !== active) finish(new Error(state.error ?? 'GOOGLE_ACCOUNT_MISMATCH'));
      });
      const timer = setTimeout(() => finish(new Error('CLOUD_DOWNLOAD_PENDING')), 180_000);
      function finish(error?: Error) { clearTimeout(timer); unsubscribe(); unsubscribeCloud(); if (error) reject(error); else resolve(); }
      if (get().error) finish(new Error(get().error!));
      else if (useNotesStore.getState().notes.some((note) => note.id === id && !note.cloudOnly)) finish();
    });
  },
  resolve: (id, choice) => engine?.resolve(id, choice),
  toggleExpanded: () => set({ expanded: !get().expanded }),
  toggleExcluded: async (id) => {
    const { accountId, excludedNotes } = get();
    if (!accountId) return;
    const next = excludedNotes.includes(id) ? excludedNotes.filter((value) => value !== id) : [...excludedNotes, id];
    await cloudStorage(accountId).putState('excludedNotes', next);
    set({ excludedNotes: next });
    void engine?.tick(true);
  },
}));
