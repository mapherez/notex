import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { editorSettings } from '../../config/appSettings';
import { tryBeginMcpMutation } from '../../core/mcp/noteMutationCoordinator';
import { NoteHeaderDraftProvider, useNoteHeaderDraft } from './NoteHeaderDraft';

let root: Root;
let draft: ReturnType<typeof useNoteHeaderDraft>;
let note: { id: string; title: string; subtitle: string; collectionId: string | null };
const save = vi.fn();

function Probe() {
  draft = useNoteHeaderDraft();
  return createElement('output', null, `${draft.title}|${draft.subtitle}|${draft.collectionId}`);
}

function render() {
  act(() => root.render(createElement(NoteHeaderDraftProvider, {
    key: note.id, note, onSave: save, children: createElement(Probe),
  })));
}

async function debounce() {
  await act(async () => { await vi.advanceTimersByTimeAsync(editorSettings.headerSaveDebounceMs); });
}

function expectIdle() {
  const lease = tryBeginMcpMutation(note.id);
  expect(lease.acquired).toBe(true);
  if (lease.acquired) lease.release();
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  save.mockReset();
  note = { id: 'shared-header-test', title: 'Title', subtitle: 'Subtitle', collectionId: 'work' };
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.replaceChildren();
  vi.useRealTimers();
});

it('saves title and collection together and blocks MCP from the instant either is edited', async () => {
  save.mockImplementation(async (_id, patch) => { note = { ...note, ...patch }; render(); });
  render();
  act(() => {
    draft.setTitle('Edited title');
    expect(tryBeginMcpMutation(note.id)).toEqual({ acquired: false, blockedBy: 'local' });
    draft.setCollectionId('personal');
  });
  await debounce();
  expect(save).toHaveBeenCalledExactlyOnceWith(note.id, { title: 'Edited title', collectionId: 'personal' });
  expect(draft.subtitle).toBe('Subtitle');
  expectIdle();
});

it('keeps newer text when an earlier collection save updates the stored header', async () => {
  let finish!: () => void;
  save.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
  render();
  act(() => draft.setCollectionId('personal'));
  await debounce();
  expect(save).toHaveBeenCalledExactlyOnceWith(note.id, { collectionId: 'personal' });
  act(() => draft.setTitle('Newer text'));
  note = { ...note, collectionId: 'personal' };
  render();
  await act(async () => { finish(); await Promise.resolve(); });
  expect(draft.title).toBe('Newer text');
  expect(tryBeginMcpMutation(note.id)).toEqual({ acquired: false, blockedBy: 'local' });
  save.mockImplementation(async (_id, patch) => { note = { ...note, ...patch }; render(); });
  await debounce();
  expect(save).toHaveBeenLastCalledWith(note.id, { title: 'Newer text' });
  expectIdle();
});

it('reflects remote header changes without writing them back and supports no collection', async () => {
  render();
  note = { ...note, title: 'MCP title', subtitle: 'MCP subtitle', collectionId: 'personal' };
  render();
  expect(draft.title).toBe('MCP title');
  expect(draft.subtitle).toBe('MCP subtitle');
  expect(draft.collectionId).toBe('personal');
  await debounce();
  expect(save).not.toHaveBeenCalled();
  expectIdle();
  save.mockImplementation(async (_id, patch) => { note = { ...note, ...patch }; render(); });
  act(() => draft.setCollectionId(''));
  await debounce();
  expect(save).toHaveBeenCalledExactlyOnceWith(note.id, { collectionId: null });
  expectIdle();
});

it('retains a failed collection draft and MCP protection until it is reverted', async () => {
  save.mockRejectedValue(new Error('Save failed'));
  render();
  act(() => draft.setCollectionId('personal'));
  await debounce();
  expect(draft.collectionId).toBe('personal');
  expect(tryBeginMcpMutation(note.id)).toEqual({ acquired: false, blockedBy: 'local' });
  act(() => draft.setCollectionId('work'));
  expectIdle();
});
