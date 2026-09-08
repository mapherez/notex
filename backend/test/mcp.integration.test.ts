import {
  BRIDGE_PROTOCOL_VERSION,
  parseServerBridgeFrame,
  type CommandName,
  type CommandOutput,
} from '@notex/mcp-contract';
import type { AuthInfo, McpHttpHandler } from '@modelcontextprotocol/server';
import { afterEach, describe, expect, it } from 'vitest';
import type { WebSocket } from 'ws';

import { BridgeRegistry, type DesktopConnection } from '../src/bridge/registry.js';
import { loadConfig } from '../src/config.js';
import { BackendDatabase } from '../src/database.js';
import { createLogger } from '../src/logger.js';
import { createMcpProtocolHandler } from '../src/mcp.js';

const LEGACY_PROTOCOL_VERSION = '2025-11-25';
const MODERN_PROTOCOL_VERSION = '2026-07-28';

class RespondingSocket {
  readonly OPEN = 1;
  readonly CONNECTING = 0;
  readyState = this.OPEN;
  connection?: DesktopConnection;
  commands: CommandName[] = [];

  send(data: string, callback?: (error?: Error) => void): void {
    const message = parseServerBridgeFrame(data);
    if (message.type === 'request') {
      this.commands.push(message.command);
      const connection = this.connection;
      if (!connection) throw new Error('Socket is not attached.');
      const result = this.fixture(message.command);
      queueMicrotask(() =>
        connection &&
        registryFor(connection).acceptResponse(connection, {
          type: 'response',
          requestId: message.requestId,
          ok: true,
          result,
        }),
      );
    }
    callback?.();
  }

  close(): void {
    this.readyState = 3;
  }

  private fixture(command: CommandName): CommandOutput<CommandName> {
    if (command === 'search_notes') return { results: [] };
    if (command === 'notex_status') {
      return { state: 'online', appVersion: 'mcp-test', protocolVersion: BRIDGE_PROTOCOL_VERSION };
    }
    throw new Error(`No test fixture for ${command}.`);
  }
}

const registryByConnection = new WeakMap<DesktopConnection, BridgeRegistry>();

function registryFor(connection: DesktopConnection): BridgeRegistry {
  const registry = registryByConnection.get(connection);
  if (!registry) throw new Error('Registry was not registered for the test connection.');
  return registry;
}

interface Harness {
  database: BackendDatabase;
  registry: BridgeRegistry;
  handler: McpHttpHandler;
  socket: RespondingSocket;
  authInfo: AuthInfo;
}

const harnesses: Harness[] = [];

function createHarness(): Harness {
  const config = loadConfig({
    NODE_ENV: 'test',
    NOTEX_MCP_PUBLIC_URL: 'http://127.0.0.1:8080',
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
  const activation = database.createDesktopActivation();
  const desktopSession = database.activateDesktopSession('user-1', activation.token);
  if (!desktopSession) throw new Error('Desktop activation failed.');
  const { sessionId } = desktopSession;
  const registry = new BridgeRegistry(database);
  const socket = new RespondingSocket();
  const connection = registry.attach('user-1', sessionId, socket as unknown as WebSocket);
  socket.connection = connection;
  registryByConnection.set(connection, registry);
  registry.markReady(connection, 'mcp-test');
  const handler = createMcpProtocolHandler(registry, createLogger(config));
  const harness = {
    database,
    registry,
    handler,
    socket,
    authInfo: {
      token: 'validated-test-token',
      clientId: 'ai-client',
      scopes: ['notex:read'],
      resource: new URL(config.mcpUrl),
      extra: { userId: 'user-1' },
    },
  };
  harnesses.push(harness);
  return harness;
}

async function sendMcp(
  harness: Harness,
  body: unknown,
  protocolVersion = LEGACY_PROTOCOL_VERSION,
): Promise<Record<string, unknown>> {
  const method =
    typeof body === 'object' && body !== null && 'method' in body && typeof body.method === 'string'
      ? body.method
      : undefined;
  const headers: Record<string, string> = {
    accept: 'application/json, text/event-stream',
    'content-type': 'application/json',
    'mcp-protocol-version': protocolVersion,
  };
  if (protocolVersion === MODERN_PROTOCOL_VERSION && method) headers['mcp-method'] = method;
  const response = await harness.handler.fetch(
    new Request('http://127.0.0.1:8080/mcp', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }),
    { authInfo: harness.authInfo, parsedBody: body },
  );
  const responseBody = await response.text();
  expect(response.status, responseBody).toBe(200);
  if (response.headers.get('content-type')?.includes('text/event-stream')) {
    const data = responseBody
      .split(/\r?\n/)
      .find((line) => line.startsWith('data: '))
      ?.slice('data: '.length);
    if (!data) throw new Error('MCP SSE response did not include a data event.');
    return JSON.parse(data) as Record<string, unknown>;
  }
  return JSON.parse(responseBody) as Record<string, unknown>;
}

afterEach(async () => {
  while (harnesses.length > 0) {
    const harness = harnesses.pop();
    if (!harness) continue;
    await harness.handler.close();
    harness.registry.close();
    harness.database.close();
  }
});

describe('authenticated MCP protocol handler', () => {
  it('advertises the modern 2026 protocol through server/discover', async () => {
    const harness = createHarness();
    const discovered = await sendMcp(
      harness,
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'server/discover',
        params: {
          _meta: {
            'io.modelcontextprotocol/protocolVersion': MODERN_PROTOCOL_VERSION,
            'io.modelcontextprotocol/clientInfo': { name: 'NoteX test client', version: '1.0.0' },
            'io.modelcontextprotocol/clientCapabilities': {},
          },
        },
      },
      MODERN_PROTOCOL_VERSION,
    );

    expect(discovered.result).toMatchObject({
      supportedVersions: expect.arrayContaining([MODERN_PROTOCOL_VERSION]),
      capabilities: { tools: expect.any(Object) },
    });
  });

  it('serves the 2025 stateless tools surface and routes a read command', async () => {
    const harness = createHarness();
    const listed = await sendMcp(harness, {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {},
    });
    const tools = (listed.result as { tools: Array<{ name: string }> }).tools;
    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining(['notex_status', 'search_notes', 'create_note', 'update_note_block']),
    );

    const called = await sendMcp(harness, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'search_notes', arguments: { query: 'draft' } },
    });
    expect(called.result).toMatchObject({ structuredContent: { results: [] } });
    expect(harness.socket.commands).toEqual(['search_notes']);
  });

  it('enforces the per-tool OAuth scope before bridge dispatch', async () => {
    const harness = createHarness();
    const called = await sendMcp(harness, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'create_note',
        arguments: { title: { format: 'text', value: 'Forbidden' } },
      },
    });

    expect(called.result).toMatchObject({
      isError: true,
      content: [{ type: 'text', text: expect.stringContaining('FORBIDDEN') }],
    });
    expect(harness.socket.commands).toEqual([]);
  });
});
