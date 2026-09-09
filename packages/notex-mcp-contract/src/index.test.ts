import { describe, expect, it } from 'vitest';
import {
  BRIDGE_PROTOCOL_VERSION,
  MAX_BRIDGE_FRAME_BYTES,
  bridgeDeliveryPolicy,
  bridgeErrorMessages,
  bridgePresenceSchema,
  bridgeReadySchema,
  commandNames,
  commandScope,
  commandInputSchemas,
  createToolManifest,
  parseDesktopBridgeFrame,
  parseCommandInput,
  parseCommandOutput,
  parseServerBridgeFrame,
  toolMetadata,
} from './index.js';

describe('NoteX MCP contract', () => {
  it('applies bounded search defaults', () => {
    expect(parseCommandInput('search_notes', {})).toEqual({
      query: '',
      location: 'active',
      limit: 20,
    });
  });

  it('requires a field for focused updates', () => {
    expect(() =>
      commandInputSchemas.update_note_header.parse({ noteId: 'note-1', expectedVersion: 1 }),
    ).toThrow();
    expect(() => parseCommandInput('update_tag', { tagId: 'tag-1' })).toThrow();
    expect(() => parseCommandInput('update_collection', { collectionId: 'collection-1' })).toThrow();
  });

  it('validates the new entity and note-management inputs', () => {
    expect(parseCommandInput('create_tag', { name: ' Work ', color: 'blue' })).toEqual({
      name: 'Work',
      color: 'blue',
    });
    expect(() => parseCommandInput('create_tag', { name: 'Work', color: 'unknown' })).toThrow();
    expect(() => parseCommandInput('add_note_link', {
      noteId: 'note-1', expectedVersion: 1, title: 'Local', href: 'file:///private.txt',
    })).toThrow();
    expect(() => parseCommandInput('reorder_note_blocks', {
      noteId: 'note-1', expectedVersion: 1, blockIds: ['block-1', 'block-1'],
    })).toThrow();
    expect(parseCommandInput('set_note_favorite', {
      noteId: 'note-1', expectedVersion: 2, isFavorite: true,
    })).toEqual({ noteId: 'note-1', expectedVersion: 2, isFavorite: true });
  });

  it('publishes all feature-parity tools with the intended scopes and annotations', () => {
    expect(commandNames).toHaveLength(34);
    expect(commandScope.create_collection).toBe('notex:create');
    expect(commandScope.update_collection).toBe('notex:edit');
    expect(commandScope.delete_collection).toBe('notex:delete');
    expect(toolMetadata.delete_note_block.annotations.destructiveHint).toBe(true);
    expect(toolMetadata.reorder_note_blocks.annotations.destructiveHint).toBe(false);
    expect(createToolManifest().tools.map((tool) => tool.name)).toContain('add_linked_note');
  });

  it('models the additional note fields required by the new tools', () => {
    expect(parseCommandOutput('get_note', {
      id: 'note-1',
      title: { html: 'Title', text: 'Title' },
      subtitle: { html: '', text: '' },
      collectionId: null,
      tagIds: ['tag-1'],
      linkedNoteIds: ['note-2'],
      additionalExamples: ['Example'],
      relatedLinks: [{ id: 'link-1', title: 'Reference', href: 'https://example.com' }],
      isFavorite: true,
      isPinned: false,
      thumbnail: { variant: 'paper' },
      isTrashed: false,
      readOnly: false,
      createdAt: '2026-09-09T00:00:00.000Z',
      updatedAt: '2026-09-09T00:00:00.000Z',
      version: 3,
      blocks: [],
    })).toMatchObject({
      linkedNoteIds: ['note-2'],
      isFavorite: true,
      thumbnail: { variant: 'paper' },
    });
  });

  it('validates trash mutations and marks destructive tools', () => {
    expect(parseCommandInput('move_note_to_trash', { noteId: 'note-1', expectedVersion: 2 })).toEqual({
      noteId: 'note-1',
      expectedVersion: 2,
    });
    expect(() => parseCommandInput('clear_trash', { expectedStateToken: 'invalid' })).toThrow();
    expect(commandScope.delete_note_permanently).toBe('notex:delete');
    expect(toolMetadata.move_note_to_trash.annotations.destructiveHint).toBe(true);
    expect(toolMetadata.restore_note.annotations.destructiveHint).toBe(false);
    expect(toolMetadata.delete_note_permanently.annotations.destructiveHint).toBe(true);
    expect(toolMetadata.clear_trash.annotations.destructiveHint).toBe(true);
  });

  it('publishes rich-text syntax in the generated tool schemas', () => {
    const manifest = JSON.stringify(createToolManifest());
    expect(manifest).toContain('var(--nx-color-NAME)');
    expect(manifest).toContain('data-type=\\"taskList\\"');
    expect(manifest).toContain('<notex-tip title=\\"Tip\\">');
    expect(manifest).toContain('one <tr> per row');
    expect(manifest).toContain('Content is the complete new body.');
  });

  it('rejects incompatible bridge versions', () => {
    expect(
      bridgeReadySchema.safeParse({
        type: 'ready',
        protocolVersion: BRIDGE_PROTOCOL_VERSION,
        appVersion: '2.1.0',
      }).success,
    ).toBe(true);
    expect(
      bridgeReadySchema.safeParse({
        type: 'ready',
        protocolVersion: '2.0',
        appVersion: '2.1.0',
      }).success,
    ).toBe(false);
  });

  it('models detailed presence without weakening the sidebar online gate', () => {
    expect(
      bridgePresenceSchema.parse({
        state: 'online',
        protocolVersion: BRIDGE_PROTOCOL_VERSION,
        appVersion: '2.1.0',
      }),
    ).toEqual({ state: 'online', protocolVersion: BRIDGE_PROTOCOL_VERSION, appVersion: '2.1.0' });
    expect(
      bridgePresenceSchema.safeParse({ state: 'online', protocolVersion: BRIDGE_PROTOCOL_VERSION }).success,
    ).toBe(false);
    expect(
      bridgePresenceSchema.safeParse({ state: 'error', protocolVersion: BRIDGE_PROTOCOL_VERSION }).success,
    ).toBe(false);
  });

  it('validates bridge frame direction and request deadlines', () => {
    const desktopFrame = JSON.stringify({
      type: 'ready',
      protocolVersion: BRIDGE_PROTOCOL_VERSION,
      appVersion: '2.1.0',
    });
    expect(parseDesktopBridgeFrame(desktopFrame)).toMatchObject({ type: 'ready' });
    expect(() => parseServerBridgeFrame(desktopFrame)).toThrow();

    expect(() =>
      parseServerBridgeFrame(
        JSON.stringify({
          type: 'request',
          requestId: 'd30ff3b1-8e42-4b9b-ac48-2240abdb99d8',
          command: 'notex_status',
          input: {},
          deadlineAt: 'not-a-date',
        }),
      ),
    ).toThrow();
  });

  it('rejects malformed, invalid UTF-8, and oversized frames before dispatch', () => {
    expect(() => parseDesktopBridgeFrame('{')).toThrow();
    expect(() => parseDesktopBridgeFrame(new Uint8Array([0xff]))).toThrow();
    expect(() => parseDesktopBridgeFrame('x'.repeat(MAX_BRIDGE_FRAME_BYTES + 1))).toThrow(RangeError);
  });

  it('fixes no-queue, no-replay, disconnect, and ticket policies', () => {
    expect(bridgeDeliveryPolicy).toEqual({
      queue: 'none',
      replay: 'never',
      disconnect: 'fail-in-flight',
      ticketUse: 'single-use',
    });
  });

  it('keeps the required public availability messages exact', () => {
    expect(bridgeErrorMessages.USER_NOT_LOGGED_IN).toBe('User not logged in');
    expect(bridgeErrorMessages.NOTEX_OFFLINE).toBe('NoteX is offline');
  });
});
