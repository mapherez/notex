import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import {
  BRIDGE_PROTOCOL_VERSION,
  parseServerBridgeFrame,
  type ServerBridgeMessage,
} from '@notex/mcp-contract';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket, { type RawData } from 'ws';

import { BridgeRegistry } from '../src/bridge/registry.js';
import { installBridgeServer } from '../src/bridge/server.js';
import { loadConfig } from '../src/config.js';
import { BackendDatabase } from '../src/database.js';
import { createLogger } from '../src/logger.js';

interface Harness {
  database: BackendDatabase;
  registry: BridgeRegistry;
  server: Server;
  sessionId: string;
  bridgeUrl: string;
  clients: Set<WebSocket>;
  closeBridge: () => Promise<void>;
}

const harnesses: Harness[] = [];

async function createHarness(): Promise<Harness> {
  const config = loadConfig({
    NODE_ENV: 'test',
    NOTEX_MCP_PUBLIC_URL: 'http://127.0.0.1:8080',
    NOTEX_MCP_HOST: '127.0.0.1',
    NOTEX_MCP_PORT: '8080',
    NOTEX_MCP_DATABASE_PATH: ':memory:',
    NOTEX_MCP_LOG_LEVEL: 'silent',
    BETTER_AUTH_SECRET: 'test-secret-that-is-at-least-32-bytes-long',
    GOOGLE_CLIENT_ID: 'google-client.test',
    GOOGLE_CLIENT_SECRET: 'google-secret.test',
  });
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
  const registry = new BridgeRegistry(database);
  const server = createServer((_request, response) => response.writeHead(404).end());
  const closeBridge = installBridgeServer(server, config, registry, createLogger(config));
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const { port } = server.address() as AddressInfo;
  const harness = {
    database,
    registry,
    server,
    sessionId,
    bridgeUrl: `ws://127.0.0.1:${port}/v1/bridge`,
    clients: new Set<WebSocket>(),
    closeBridge,
  };
  harnesses.push(harness);
  return harness;
}

function parseMessage(data: RawData): ServerBridgeMessage {
  if (data instanceof ArrayBuffer) return parseServerBridgeFrame(data);
  const bytes = Array.isArray(data) ? Buffer.concat(data) : data;
  return parseServerBridgeFrame(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
}

async function nextMessage(socket: WebSocket): Promise<ServerBridgeMessage> {
  const [data] = (await once(socket, 'message')) as [RawData];
  return parseMessage(data);
}

async function connectDesktop(harness: Harness, ticket: string): Promise<WebSocket> {
  const socket = new WebSocket(harness.bridgeUrl);
  harness.clients.add(socket);
  await once(socket, 'open');
  const authenticated = nextMessage(socket);
  socket.send(JSON.stringify({ type: 'authenticate', ticket }));
  await expect(authenticated).resolves.toEqual({ type: 'authenticated' });
  socket.send(
    JSON.stringify({ type: 'ready', protocolVersion: BRIDGE_PROTOCOL_VERSION, appVersion: 'simulator-test' }),
  );
  await expect.poll(() => harness.registry.getPresence('user-1').online).toBe(true);
  return socket;
}

afterEach(async () => {
  while (harnesses.length > 0) {
    const harness = harnesses.pop();
    if (!harness) continue;
    for (const socket of harness.clients) socket.terminate();
    await harness.closeBridge();
    await new Promise<void>((resolve, reject) =>
      harness.server.close((error) => (error ? reject(error) : resolve())),
    );
    harness.database.close();
  }
});

describe('WebSocket desktop bridge', () => {
  it('routes a command over a real socket and rejects in-flight work on disconnect', async () => {
    const harness = await createHarness();
    const { ticket } = harness.registry.issueTicket('user-1', harness.sessionId);
    const socket = await connectDesktop(harness, ticket);

    const requestFrame = nextMessage(socket);
    const resultPromise = harness.registry.dispatch('user-1', 'search_notes', { query: 'draft' });
    const request = await requestFrame;
    expect(request).toMatchObject({
      type: 'request',
      command: 'search_notes',
      input: { query: 'draft', location: 'active', limit: 20 },
    });
    if (request.type !== 'request') throw new Error('Expected a bridge request.');
    socket.send(
      JSON.stringify({ type: 'response', requestId: request.requestId, ok: true, result: { results: [] } }),
    );
    await expect(resultPromise).resolves.toEqual({ results: [] });

    const abandonedFrame = nextMessage(socket);
    const abandonedResult = harness.registry.dispatch('user-1', 'get_note', { noteId: 'note-1' });
    await abandonedFrame;
    socket.terminate();
    await expect(abandonedResult).rejects.toMatchObject({ code: 'NOTEX_OFFLINE' });
    expect(harness.registry.getPresence('user-1')).toEqual({ loggedIn: true, online: false });
  });

  it('rejects reuse of an already-consumed bridge ticket', async () => {
    const harness = await createHarness();
    const { ticket } = harness.registry.issueTicket('user-1', harness.sessionId);
    await connectDesktop(harness, ticket);

    const replay = new WebSocket(harness.bridgeUrl);
    harness.clients.add(replay);
    await once(replay, 'open');
    const closed = once(replay, 'close');
    replay.send(JSON.stringify({ type: 'authenticate', ticket }));
    const [code] = (await closed) as [number, Buffer];
    expect(code).toBe(4003);
  });

  it('rejects an untrusted WebSocket Origin during upgrade', async () => {
    const harness = await createHarness();
    const socket = new WebSocket(harness.bridgeUrl, { origin: 'https://attacker.example' });
    harness.clients.add(socket);
    const response = await new Promise<{ statusCode: number | undefined }>((resolve, reject) => {
      socket.once('unexpected-response', (_request, upgradeResponse) => {
        upgradeResponse.resume();
        resolve({ statusCode: upgradeResponse.statusCode });
      });
      socket.once('error', reject);
    });
    expect(response.statusCode).toBe(403);
  });
});
