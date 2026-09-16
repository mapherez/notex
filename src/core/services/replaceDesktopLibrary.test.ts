import { beforeEach, describe, expect, it, vi } from 'vitest';
import { replaceDesktopLibrary } from './replaceDesktopLibrary';
import { beginLibraryTransition } from '../storage/libraryTransition';

const mocks = vi.hoisted(() => {
  const events: string[] = [];
  const action = (name: string) => vi.fn(async () => { events.push(name); });
  return { events, invoke: action('replace'), stop: action('cloud-stop'), start: action('cloud-start'),
    mcpStop: action('mcp-stop'), mcpStart: action('mcp-start'), wait: action('wait'), pause: action('pause'),
    select: vi.fn(() => { events.push('resume'); }), refresh: action('refresh') };
});
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }));
vi.mock('../mcp/noteMutationCoordinator', () => ({ waitForNoteMutations: mocks.wait }));
vi.mock('../storage/desktopInvoke', () => ({ currentDesktopLibrary: () => 'account-a', pauseDesktopStorage: mocks.pause, selectDesktopLibrary: mocks.select }));
vi.mock('../../store/useCloudStore', () => ({ useCloudStore: { getState: () => ({ stop: mocks.stop, start: mocks.start }) } }));
vi.mock('../../store/useLocalMcpStore', () => ({ useLocalMcpStore: { getState: () => ({ connection: { state: 'running' }, stop: mocks.mcpStop, start: mocks.mcpStart }) } }));
vi.mock('../../store/useAppStore', () => ({ useAppStore: { getState: () => ({ hydrateSettings: mocks.refresh }) } }));
vi.mock('../../store/useKnowledgeStore', () => ({ useKnowledgeStore: { getState: () => ({ refreshKnowledge: mocks.refresh }) } }));
vi.mock('../../store/useNotesStore', () => ({ useNotesStore: { getState: () => ({ refreshNotes: mocks.refresh }) } }));
beforeEach(() => { vi.clearAllMocks(); mocks.events.length = 0; });

describe('desktop library replacement', () => {
  it('drains writes, binds the import to the account and refreshes before restarting services', async () => {
    await replaceDesktopLibrary('import', 'backup.notex');
    expect(mocks.invoke).toHaveBeenCalledWith('import', { sourcePath: 'backup.notex', libraryId: 'account-a' });
    expect(mocks.events).toEqual(['cloud-stop', 'mcp-stop', 'wait', 'pause', 'replace', 'resume',
      'refresh', 'refresh', 'refresh', 'resume', 'cloud-start', 'mcp-start']);
  });
  it('restores access and services after a rejected import and releases the transition', async () => {
    mocks.invoke.mockRejectedValueOnce(new Error('Invalid package'));
    await expect(replaceDesktopLibrary('import', 'invalid')).rejects.toThrow('Invalid package');
    expect(mocks.select).toHaveBeenCalledWith('account-a');
    expect(mocks.start).toHaveBeenCalledWith('account-a');
    expect(mocks.mcpStart).toHaveBeenCalledOnce();
    beginLibraryTransition()();
  });
  it('refuses to import while another account transition owns the library', async () => {
    const release = beginLibraryTransition();
    try {
      await expect(replaceDesktopLibrary('import', 'backup')).rejects.toThrow('already in progress');
      expect(mocks.invoke).not.toHaveBeenCalled();
      expect(mocks.stop).not.toHaveBeenCalled();
    } finally { release(); }
  });
});
