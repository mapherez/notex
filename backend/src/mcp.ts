import {
  commandInputSchemas,
  commandNames,
  commandScope,
  type CommandName,
} from '@notex/mcp-contract';
import { requireMcpAuth } from '@better-auth/mcp';
import { createMcpHandler, McpServer, type AuthInfo, type McpHttpHandler } from '@modelcontextprotocol/server';

import type { BackendConfig } from './config.js';
import { asPublicBridgeError, PublicBridgeError } from './errors.js';
import type { AppLogger } from './logger.js';
import type { NoteXAuth } from './auth.js';
import type { BridgeRegistry } from './bridge/registry.js';

const toolDescriptions: Record<CommandName, string> = {
  notex_status: 'Check whether this account has a live, ready NoteX Desktop connection.',
  search_notes: 'Search local NoteX notes by text, including active notes or trash when requested.',
  get_note: 'Read one local note header and its ordered block summaries.',
  get_note_block: 'Read the exact supported rich-text content of one local note block.',
  list_tags: 'List existing local NoteX tags. Use returned IDs in write tools.',
  list_collections: 'List existing local NoteX collections. Use returned IDs in write tools.',
  create_note: 'Create a local NoteX note, optionally with blocks and existing tags.',
  update_note_header: 'Update selected header fields of a local NoteX note using optimistic versioning.',
  add_note_block: 'Append a block to a local NoteX note using optimistic versioning.',
  update_note_block: 'Update selected fields of a local NoteX block using optimistic versioning.',
  set_note_tags: 'Replace a local note tag set with existing tag IDs using optimistic versioning.',
};

function scopeList(scopeClaim: unknown): string[] {
  if (typeof scopeClaim === 'string') return scopeClaim.split(/\s+/).filter(Boolean);
  if (Array.isArray(scopeClaim)) return scopeClaim.filter((scope): scope is string => typeof scope === 'string');
  return [];
}

function createServer(userId: string, scopes: ReadonlySet<string>, registry: BridgeRegistry): McpServer {
  const server = new McpServer({ name: 'NoteX', version: '0.1.0' });

  for (const command of commandNames) {
    server.registerTool(
      command,
      {
        title: command.replaceAll('_', ' '),
        description: toolDescriptions[command],
        inputSchema: commandInputSchemas[command],
        annotations: {
          readOnlyHint: commandScope[command] === 'notex:read',
          destructiveHint: false,
          idempotentHint: command.startsWith('get_') || command.startsWith('list_') || command === 'search_notes',
          openWorldHint: false,
        },
      },
      async (input) => {
        try {
          const requiredScope = commandScope[command];
          if (!scopes.has(requiredScope)) throw new PublicBridgeError('FORBIDDEN');
          const result = await registry.dispatch(userId, command, input);
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(result) }],
            structuredContent: result,
          };
        } catch (error) {
          const publicError = asPublicBridgeError(error);
          const body = publicError.toBridgeError();
          return {
            isError: true,
            content: [{ type: 'text' as const, text: JSON.stringify(body) }],
          };
        }
      },
    );
  }

  return server;
}

export function createProtectedMcpHandler(
  auth: NoteXAuth,
  config: BackendConfig,
  registry: BridgeRegistry,
  logger: AppLogger,
): McpHttpHandler & { protectedFetch: (request: Request) => Promise<Response> } {
  const handler = createMcpHandler(
    ({ authInfo }) => {
      const userId = authInfo?.extra?.userId;
      if (typeof userId !== 'string' || !userId) throw new PublicBridgeError('FORBIDDEN');
      return createServer(userId, new Set(authInfo.scopes), registry);
    },
    {
      legacy: 'stateless',
      responseMode: 'json',
      onerror(error) {
        logger.warn({ event: 'mcp_protocol_error', errorType: error.name });
      },
    },
  );

  const protectedFetch = requireMcpAuth(
    auth,
    async (request, claims) => {
      const authorization = request.headers.get('authorization') ?? '';
      const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
      const scopes = scopeList(claims.scope);
      const userId = typeof claims.notex_user_id === 'string' ? claims.notex_user_id : claims.sub;
      const clientId =
        typeof claims.client_id === 'string'
          ? claims.client_id
          : typeof claims.azp === 'string'
            ? claims.azp
            : 'unknown';
      const authInfo: AuthInfo = {
        token,
        clientId,
        scopes,
        expiresAt: claims.exp,
        resource: new URL(config.mcpUrl),
        extra: { userId },
      };
      return handler.fetch(request, { authInfo });
    },
    {
      resource: config.mcpUrl,
      challengeScopes: ['notex:read'],
    },
  );

  return Object.assign(handler, { protectedFetch });
}
