import { invoke } from '@tauri-apps/api/core';
import { waitForNoteMutations } from '../mcp/noteMutationCoordinator';
import { currentDesktopLibrary, pauseDesktopStorage, selectDesktopLibrary } from '../storage/desktopInvoke';
import { beginLibraryTransition } from '../storage/libraryTransition';

export async function replaceDesktopLibrary(command: string, sourcePath: string) {
  const { useCloudStore } = await import('../../store/useCloudStore');
  const { useLocalMcpStore } = await import('../../store/useLocalMcpStore');
  const release = beginLibraryTransition();
  const libraryId = currentDesktopLibrary();
  const running = useLocalMcpStore.getState().connection.state === 'running';
  try {
    await useCloudStore.getState().stop();
    if (running) await useLocalMcpStore.getState().stop();
    await waitForNoteMutations();
    await pauseDesktopStorage();
    await invoke<void>(command, { sourcePath, libraryId });
    selectDesktopLibrary(libraryId);
    const [{ useAppStore }, { useKnowledgeStore }, { useNotesStore }] = await Promise.all([
      import('../../store/useAppStore'), import('../../store/useKnowledgeStore'), import('../../store/useNotesStore'),
    ]);
    await useAppStore.getState().hydrateSettings();
    await useKnowledgeStore.getState().refreshKnowledge();
    await useNotesStore.getState().refreshNotes();
  } finally {
    selectDesktopLibrary(libraryId);
    try {
      if (libraryId) await useCloudStore.getState().start(libraryId);
      if (running) await useLocalMcpStore.getState().start();
    } finally { release(); }
  }
}
