import {
  commandInputSchemas,
  commandNames,
  commandScope,
  toolMetadata,
} from '@notex/mcp-contract';
import { requireMcpAuth } from '@better-auth/mcp';
import { createMcpHandler, McpServer, type AuthInfo, type McpHttpHandler } from '@modelcontextprotocol/server';

import type { BackendConfig } from './config.js';
import { asPublicBridgeError, PublicBridgeError } from './errors.js';
import type { AppLogger } from './logger.js';
import type { NoteXAuth } from './auth.js';
import type { BridgeRegistry } from './bridge/registry.js';

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
        title: toolMetadata[command].title,
        description: toolMetadata[command].description,
        inputSchema: commandInputSchemas[command],
        annotations: toolMetadata[command].annotations,
      },
      async (input: unknown) => {
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
  const handler = createMcpProtocolHandler(registry, logger);

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

export function createMcpProtocolHandler(registry: BridgeRegistry, logger: AppLogger): McpHttpHandler {
  return createMcpHandler(
    ({ authInfo }) => {
      const userId = authInfo?.extra?.userId;
      if (typeof userId !== 'string' || !userId) throw new PublicBridgeError('FORBIDDEN');
      return createServer(userId, new Set(authInfo.scopes), registry);
    },
    {
      legacy: 'stateless',
      onerror(error) {
        logger.warn({ event: 'mcp_protocol_error', errorType: error.name });
      },
    },
  );
}
