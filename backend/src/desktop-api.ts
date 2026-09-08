import { requireMcpAuth } from '@better-auth/mcp';
import { z } from 'zod';

import { deleteRemoteAccount, DESKTOP_SCOPE, revokeAiAccess, type NoteXAuth } from './auth.js';
import type { BridgeRegistry } from './bridge/registry.js';
import type { BackendConfig } from './config.js';
import type { BackendDatabase } from './database.js';
import { asPublicBridgeError, PublicBridgeError, publicErrorHttpStatus } from './errors.js';

const sessionBodySchema = z.object({ sessionId: z.string().uuid() });
const activationBodySchema = z.object({
  activationToken: z.string().min(32).max(512).regex(/^[A-Za-z0-9_-]+$/),
});
const DESKTOP_SESSION_HEADER = 'x-notex-desktop-session';

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

function requireActiveDesktopSession(request: Request, database: BackendDatabase, userId: string): string {
  const parsed = z.string().uuid().safeParse(request.headers.get(DESKTOP_SESSION_HEADER));
  if (!parsed.success || !database.isDesktopSessionActive(userId, parsed.data)) {
    throw new PublicBridgeError('USER_NOT_LOGGED_IN');
  }
  return parsed.data;
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
          const { activationToken } = activationBodySchema.parse(await request.json());
          const activated = database.activateDesktopSession(userId, activationToken);
          if (!activated) throw new PublicBridgeError('FORBIDDEN');
          if (activated.replacedSessionIds.length > 0) {
            registry.revokeUserConnection(userId, 'A newer NoteX login replaced this session.');
          }
          const issued = registry.issueTicket(userId, activated.sessionId);
          return json({
            sessionId: activated.sessionId,
            email: account.email,
            bridgeUrl: bridgeUrl(config),
            ...issued,
          });
        }

        const activeSessionId = requireActiveDesktopSession(request, database, userId);

        if (request.method === 'POST' && pathname === '/v1/desktop/session/ticket') {
          const { sessionId } = sessionBodySchema.parse(await request.json());
          if (sessionId !== activeSessionId) throw new PublicBridgeError('USER_NOT_LOGGED_IN');
          return json({ bridgeUrl: bridgeUrl(config), ...registry.issueTicket(userId, sessionId) });
        }

        if (request.method === 'POST' && pathname === '/v1/desktop/session/logout') {
          const { sessionId } = sessionBodySchema.parse(await request.json());
          if (sessionId !== activeSessionId) throw new PublicBridgeError('USER_NOT_LOGGED_IN');
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
        return json(publicError.toBridgeError(), publicErrorHttpStatus(publicError.code));
      }
    },
    {
      resource: config.mcpUrl,
      requiredScopes: [DESKTOP_SCOPE],
      challengeScopes: [DESKTOP_SCOPE],
    },
  );
}
