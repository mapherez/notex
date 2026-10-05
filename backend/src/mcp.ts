import { createHttpHandler } from '@nox/mcp';
import { protectWithBetterAuth } from '@nox/mcp/better-auth';
import { commandInputSchemas, commandOutputSchemas, commandNames, commandScope, toolMetadata } from '@notex/mcp-contract';
import type { AuthInfo, McpHttpHandler } from '@modelcontextprotocol/server';
import type { BackendConfig } from './config.js';
import { asPublicBridgeError, PublicBridgeError } from './errors.js';
import type { AppLogger } from './logger.js';
import { isAccessTokenActive, type NoteXAuth } from './auth.js';
import type { BridgeRegistry } from './bridge/registry.js';
import type { BackendDatabase } from './database.js';

export function createMcpProtocolHandler(registry: BridgeRegistry, logger: AppLogger): McpHttpHandler {
  return createHttpHandler({ appId: 'notex', name: 'NoteX', version: '0.1.0',
    tools: commandNames.map(command => ({ name: command, ...toolMetadata[command], inputSchema: commandInputSchemas[command], outputSchema: commandOutputSchemas[command], requiredScopes: [commandScope[command]],
      execute: async (input, context) => await registry.dispatch(context.userId!, command, input, { signal: context.signal, deadlineAt: context.deadlineAt }) as Record<string, unknown>,
    })),
    resolveAuth(authInfo) {
      const userId = authInfo?.extra?.userId;
      if (typeof userId !== 'string' || !userId) throw new PublicBridgeError('FORBIDDEN');
      return { userId, scopes: authInfo!.scopes };
    },
    formatError: error => asPublicBridgeError(error).toBridgeError(),
    onerror: error => logger.warn({ event: 'mcp_protocol_error', errorType: error.name }),
  });
}
export function createProtectedMcpHandler(auth: NoteXAuth, config: BackendConfig, registry: BridgeRegistry, logger: AppLogger, database: BackendDatabase): McpHttpHandler & { protectedFetch(request: Request): Promise<Response> } {
  const handler = createMcpProtocolHandler(registry, logger);
  const protectedFetch = protectWithBetterAuth(auth, async (request, claims) => {
    const authInfo: AuthInfo = {
      token: request.headers.get('authorization')?.slice(7) ?? '',
      clientId: typeof claims.client_id === 'string' ? claims.client_id : typeof claims.azp === 'string' ? claims.azp : 'unknown',
      scopes: typeof claims.scope === 'string' ? claims.scope.split(/\s+/).filter(Boolean) : [],
      expiresAt: claims.exp, resource: new URL(config.mcpUrl),
      extra: { userId: typeof claims.notex_user_id === 'string' ? claims.notex_user_id : claims.sub },
    };
    return handler.fetch(request, { authInfo });
  }, { resource: config.mcpUrl, challengeScopes: ['notex:read'], isActive: (request, claims) => isAccessTokenActive(auth, database, request, claims) });
  return Object.assign(handler, { protectedFetch });
}
