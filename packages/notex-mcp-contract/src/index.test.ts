import { describe, expect, it } from 'vitest';
import {
  BRIDGE_PROTOCOL_VERSION,
  MAX_BRIDGE_FRAME_BYTES,
  bridgeDeliveryPolicy,
  bridgeErrorMessages,
  bridgePresenceSchema,
  bridgeReadySchema,
  commandInputSchemas,
  parseDesktopBridgeFrame,
  parseCommandInput,
  parseServerBridgeFrame,
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
