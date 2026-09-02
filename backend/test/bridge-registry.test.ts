import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WebSocket } from 'ws';

import { BRIDGE_PROTOCOL_VERSION, BRIDGE_REQUEST_TIMEOUT_MS } from '@notex/mcp-contract';

import { BridgeRegistry } from '../src/bridge/registry.js';
import { BackendDatabase } from '../src/database.js';

class FakeSocket {
  readonly OPEN = 1;
  readonly CONNECTING = 0;
  readyState = this.OPEN;
  sent: string[] = [];
  closes: Array<{ code?: number; reason?: string }> = [];

  send(data: string, callback?: (error?: Error) => void): void {
    this.sent.push(data);
    callback?.();
  }

  close(code?: number, reason?: string): void {
    this.readyState = 3;
    this.closes.push({ code, reason });
  }
}

interface Harness {
  database: BackendDatabase;
  registry: BridgeRegistry;
  sessionId: string;
}

const harnesses: Harness[] = [];

function createHarness(): Harness {
  const database = new BackendDatabase(':memory:');
  database.migrate();
  const intent = database.createRegistrationIntent('ABCD-EFGH');
  database.consumeRegistrationIntent(intent.token, 'user-1', 'person@example.com');
  database.completeGoogleRegistration({ userId: 'user-1', subject: 'google-user-1' });
  const desktopSession = database.activateDesktopSession(
    'user-1',
    database.createDesktopActivation().token,
  );
  if (!desktopSession) throw new Error('Desktop activation failed.');
  const { sessionId } = desktopSession;
  const harness = { database, registry: new BridgeRegistry(database), sessionId };
  harnesses.push(harness);
  return harness;
}

function attachReady(harness: Harness): { socket: FakeSocket; connection: ReturnType<BridgeRegistry['attach']> } {
  const socket = new FakeSocket();
  const connection = harness.registry.attach('user-1', harness.sessionId, socket as unknown as WebSocket);
  harness.registry.markReady(connection, '2.1.0');
  return { socket, connection };
}

afterEach(() => {
  vi.useRealTimers();
  while (harnesses.length > 0) {
    const harness = harnesses.pop();
    harness?.registry.close();
    harness?.database.close();
  }
});

describe('BridgeRegistry', () => {
  it('consumes each short-lived bridge ticket exactly once', () => {
    const harness = createHarness();
    const issued = harness.registry.issueTicket('user-1', harness.sessionId);
    const consumed = harness.registry.consumeTicket(issued.ticket);

    expect(consumed).toMatchObject({ userId: 'user-1', sessionId: harness.sessionId });
    expect(harness.registry.consumeTicket(issued.ticket)).toBeNull();
  });

  it('distinguishes logged out, offline, and ready states', () => {
    const harness = createHarness();
    expect(harness.registry.getPresence('unknown-user')).toEqual({ loggedIn: false, online: false });
    expect(harness.registry.getPresence('user-1')).toEqual({ loggedIn: true, online: false });

    attachReady(harness);
    expect(harness.registry.getPresence('user-1')).toEqual({
      loggedIn: true,
      online: true,
      appVersion: '2.1.0',
    });
  });

  it('routes one validated request and validates its response', async () => {
    const harness = createHarness();
    const { socket, connection } = attachReady(harness);
    const resultPromise = harness.registry.dispatch('user-1', 'search_notes', {});
    const request = JSON.parse(socket.sent.at(-1) ?? '{}') as { requestId: string; input: unknown; deadlineAt: string };

    expect(request.input).toEqual({ query: '', location: 'active', limit: 20 });
    expect(new Date(request.deadlineAt).getTime()).toBeGreaterThan(Date.now());
    harness.registry.acceptResponse(connection, {
      type: 'response',
      requestId: request.requestId,
      ok: true,
      result: { results: [] },
    });

    await expect(resultPromise).resolves.toEqual({ results: [] });
  });

  it('returns offline status without queueing a bridge request', async () => {
    const harness = createHarness();
    await expect(harness.registry.dispatch('user-1', 'notex_status', {})).resolves.toEqual({
      state: 'offline',
      protocolVersion: BRIDGE_PROTOCOL_VERSION,
    });
    await expect(harness.registry.dispatch('user-1', 'search_notes', {})).rejects.toMatchObject({
      code: 'NOTEX_OFFLINE',
    });
  });

  it('maps invalid command arguments to the public input error', async () => {
    const harness = createHarness();
    await expect(
      harness.registry.dispatch('user-1', 'search_notes', { location: 'somewhere-else' }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT', message: 'Invalid input' });
  });

  it('rejects in-flight work on disconnect and never replays it after reconnect', async () => {
    const harness = createHarness();
    const first = attachReady(harness);
    const resultPromise = harness.registry.dispatch('user-1', 'search_notes', { query: 'draft' });
    const rejection = expect(resultPromise).rejects.toMatchObject({ code: 'NOTEX_OFFLINE' });
    expect(first.socket.sent).toHaveLength(1);

    harness.registry.detach(first.connection);
    await rejection;

    const replacement = attachReady(harness);
    expect(replacement.socket.sent).toEqual([]);
  });

  it('times out once and ignores a late response', async () => {
    vi.useFakeTimers();
    const harness = createHarness();
    const { socket, connection } = attachReady(harness);
    const resultPromise = harness.registry.dispatch('user-1', 'search_notes', {});
    const rejection = expect(resultPromise).rejects.toMatchObject({ code: 'TIMEOUT' });
    const request = JSON.parse(socket.sent[0] ?? '{}') as { requestId: string };

    await vi.advanceTimersByTimeAsync(BRIDGE_REQUEST_TIMEOUT_MS + 1);
    await rejection;
    expect(() =>
      harness.registry.acceptResponse(connection, {
        type: 'response',
        requestId: request.requestId,
        ok: true,
        result: { results: [] },
      }),
    ).not.toThrow();
  });

  it('replaces the prior live socket for the account', () => {
    const harness = createHarness();
    const first = attachReady(harness);
    const secondSocket = new FakeSocket();
    harness.registry.attach('user-1', harness.sessionId, secondSocket as unknown as WebSocket);

    expect(first.socket.closes[0]?.code).toBe(4001);
    expect(harness.registry.getPresence('user-1')).toEqual({ loggedIn: true, online: false });
  });

  it('refuses ticket issuance after logout', () => {
    const harness = createHarness();
    harness.database.revokeDesktopSession('user-1', harness.sessionId);
    expect(() => harness.registry.issueTicket('user-1', harness.sessionId)).toThrowError(
      expect.objectContaining({ code: 'USER_NOT_LOGGED_IN' }),
    );
  });
});
