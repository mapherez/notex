import { requireMcpAuth } from '@better-auth/mcp';
import { z } from 'zod';

import { deleteRemoteAccount, DESKTOP_SCOPE, revokeAiAccess, type NoteXAuth } from './auth.js';
import type { BridgeRegistry } from './bridge/registry.js';
import type { BackendConfig } from './config.js';
import type { BackendDatabase } from './database.js';
import { asPublicBridgeError, PublicBridgeError } from './errors.js';

const sessionBodySchema = z.object({ sessionId: z.string().uuid() });

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

function userIdFromClaims(claims: Record<string, unknown>): string {
  const userId = typeof claims.notex_user_id === 'string' ? claims.notex_user_id : claims.sub;
  if (typeof userId !== 'string' || !userId) throw new PublicBridgeError('FORBIDDEN');
  return userId;
}

function grantIdFromClaims(claims: Record<string, unknown>): string {
  const value = claims.notex_grant_id ?? claims.sid;
  if (typeof value !== 'string' || !value) throw new PublicBridgeError('FORBIDDEN');
  return value;
}

function bridgeUrl(config: BackendConfig): string {
  const url = new URL('/v1/bridge', config.publicUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

export function createDesktopApi(
  auth: NoteXAuth,
  config: BackendConfig,
  database: BackendDatabase,
  registry: BridgeRegistry,
  desktopClientId: string,
): (request: Request) => Promise<Response> {
  return requireMcpAuth(
    auth,
    async (request, claims) => {
      try {
        const userId = userIdFromClaims(claims);
        const account = database.getAccount(userId);
        if (!account) throw new PublicBridgeError('USER_NOT_LOGGED_IN');
        const pathname = new URL(request.url).pathname;

        if (request.method === 'POST' && pathname === '/v1/desktop/session/activate') {
          const grantId = grantIdFromClaims(claims);
          const activated = database.activateDesktopSession(userId, grantId);
          registry.revokeUserConnection(userId, 'A newer NoteX login replaced this session.');
          const issued = registry.issueTicket(userId, activated.sessionId);
          return json({
            sessionId: activated.sessionId,
            email: account.email,
            bridgeUrl: bridgeUrl(config),
            ...issued,
          });
        }

        if (request.method === 'POST' && pathname === '/v1/desktop/session/ticket') {
          const { sessionId } = sessionBodySchema.parse(await request.json());
          return json({ bridgeUrl: bridgeUrl(config), ...registry.issueTicket(userId, sessionId) });
        }

        if (request.method === 'POST' && pathname === '/v1/desktop/session/logout') {
          const { sessionId } = sessionBodySchema.parse(await request.json());
          database.revokeDesktopSession(userId, sessionId);
          registry.revokeUserConnection(userId, 'NoteX logged out.');
          return json({ success: true });
        }

        if (request.method === 'GET' && pathname === '/v1/desktop/account') {
          const presence = registry.getPresence(userId);
          return json({
            email: account.email,
            online: presence.online,
            loggedIn: presence.loggedIn,
            appVersion: presence.appVersion,
          });
        }

        if (request.method === 'POST' && pathname === '/v1/desktop/revoke-ai-access') {
          await revokeAiAccess(auth, userId, desktopClientId);
          return json({ success: true });
        }

        if (request.method === 'DELETE' && pathname === '/v1/desktop/account') {
          registry.revokeUserConnection(userId, 'MCP account deleted.');
          await deleteRemoteAccount(auth, database, userId);
          return json({ success: true });
        }

        return json({ error: 'NOT_FOUND' }, 404);
      } catch (error) {
        const publicError = asPublicBridgeError(error);
        const status = publicError.code === 'FORBIDDEN' ? 403 : publicError.code === 'INVALID_INPUT' ? 400 : 401;
        return json(publicError.toBridgeError(), status);
      }
    },
    {
      resource: config.mcpUrl,
      requiredScopes: [DESKTOP_SCOPE],
      challengeScopes: [DESKTOP_SCOPE],
    },
  );
}
