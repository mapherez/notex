import express, { type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { fromNodeHeaders, toNodeHandler as toBetterAuthNodeHandler } from 'better-auth/node';
import { toNodeHandler as toMcpNodeHandler } from '@modelcontextprotocol/node';
import { z } from 'zod';

import { DESKTOP_SCOPE, REGISTRATION_COOKIE, type NoteXAuth } from './auth.js';
import type { BridgeRegistry } from './bridge/registry.js';
import type { BackendConfig } from './config.js';
import type { BackendDatabase } from './database.js';
import { createDesktopApi } from './desktop-api.js';
import type { AppLogger } from './logger.js';
import { requestLogMiddleware } from './logger.js';
import { createProtectedMcpHandler } from './mcp.js';
import { completePage, consentPage, devicePage, errorPage, loginPage, sendPage } from './pages.js';

const startDeviceSchema = z.object({ mode: z.enum(['register', 'login']) });

function getHostname(request: Request): string | null {
  const host = request.header('host');
  if (!host) return null;
  try {
    return new URL(`http://${host}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function createApplication(input: {
  auth: NoteXAuth;
  config: BackendConfig;
  database: BackendDatabase;
  registry: BridgeRegistry;
  desktopClientId: string;
  logger: AppLogger;
}) {
  const { auth, config, database, registry, desktopClientId, logger } = input;
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', config.trustProxy);
  app.use((request, response, next) => {
    const hostname = getHostname(request);
    if (!hostname || !config.allowedHosts.includes(hostname)) {
      response.status(403).json({ error: 'FORBIDDEN' });
      return;
    }
    const origin = request.header('origin');
    if (origin && !config.allowedOrigins.includes(origin)) {
      response.status(403).json({ error: 'FORBIDDEN' });
      return;
    }
    next();
  });
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(requestLogMiddleware(logger));
  app.use(express.json({ limit: '2mb', type: ['application/json', 'application/*+json'] }));
  app.use(express.urlencoded({ extended: false, limit: '64kb' }));

  const authLimiter = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false });
  const toolLimiter = rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false });

  app.get('/healthz', (_request, response) => response.json({ status: 'ok' }));
  app.get('/login', (_request, response) => sendPage(response, loginPage()));
  app.get('/consent', (request, response) =>
    sendPage(response, consentPage(typeof request.query.scope === 'string' ? request.query.scope : '')),
  );
  app.get('/auth/error', (request, response) => {
    const code = typeof request.query.error === 'string' ? request.query.error : 'Account is not registered.';
    sendPage(response, errorPage(code), 400);
  });
  app.get('/auth/complete', (_request, response) => sendPage(response, completePage()));

  app.post('/v1/desktop/device/start', authLimiter, async (request, response, next) => {
    try {
      const { mode } = startDeviceSchema.parse(request.body);
      const result = await auth.api.deviceCode({
        body: {
          client_id: desktopClientId,
          scope: `openid profile email offline_access ${DESKTOP_SCOPE}`,
          resource: config.mcpUrl,
        },
      });
      const desktopDeviceResult = {
        ...result,
        activation_token: database.createDesktopActivation(result.expires_in).token,
        client_id: desktopClientId,
        token_endpoint: new URL('/api/auth/oauth2/token', config.publicUrl).toString(),
        resource: config.mcpUrl,
      };
      if (mode === 'register') {
        const intent = database.createRegistrationIntent(result.user_code, result.expires_in);
        const verification = new URL('/desktop/device/register', config.publicUrl);
        verification.searchParams.set('user_code', result.user_code);
        verification.searchParams.set('intent', intent.token);
        response.json({ ...desktopDeviceResult, verification_uri_complete: verification.toString() });
        return;
      }
      const verification = new URL('/device', config.publicUrl);
      verification.searchParams.set('user_code', result.user_code);
      response.json({ ...desktopDeviceResult, verification_uri_complete: verification.toString() });
    } catch (error) {
      next(error);
    }
  });

  app.get('/desktop/device/register', (request, response) => {
    const intent = typeof request.query.intent === 'string' ? request.query.intent : '';
    const userCode = typeof request.query.user_code === 'string' ? request.query.user_code : '';
    if (!intent || !userCode) {
      sendPage(response, errorPage('Invalid registration request.'), 400);
      return;
    }
    response.cookie(REGISTRATION_COOKIE, intent, {
      httpOnly: true,
      secure: config.secureCookies,
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
      path: '/',
    });
    response.redirect(303, `/device?user_code=${encodeURIComponent(userCode)}`);
  });

  app.get('/device', async (request, response) => {
    const userCode = typeof request.query.user_code === 'string' ? request.query.user_code : '';
    if (!userCode) {
      sendPage(response, errorPage('Missing device code.'), 400);
      return;
    }
    try {
      await auth.api.deviceVerify({ query: { user_code: userCode } });
      const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
      sendPage(response, devicePage(userCode, Boolean(session)));
    } catch {
      sendPage(response, errorPage('The device code is invalid or expired.'), 400);
    }
  });

  const mcpHandler = createProtectedMcpHandler(auth, config, registry, logger);
  const mcpNodeHandler = toMcpNodeHandler({ fetch: mcpHandler.protectedFetch }, { onerror: (error) => logger.error({ event: 'mcp_adapter_error', errorType: error.name }) });
  app.post('/mcp', toolLimiter, (request, response) => void mcpNodeHandler(request, response, request.body));
  app.all('/mcp', (_request, response) => response.status(405).set('allow', 'POST').end());

  const desktopApi = createDesktopApi(auth, config, database, registry, desktopClientId);
  const desktopNodeHandler = toMcpNodeHandler({ fetch: desktopApi });
  app.all('/v1/desktop/session/{*path}', authLimiter, (request, response) =>
    void desktopNodeHandler(request, response, request.body),
  );
  app.all('/v1/desktop/account', authLimiter, (request, response) =>
    void desktopNodeHandler(request, response, request.body),
  );
  app.post('/v1/desktop/revoke-ai-access', authLimiter, (request, response) =>
    void desktopNodeHandler(request, response, request.body),
  );

  const authNodeHandler = toBetterAuthNodeHandler(auth);
  app.all('/api/auth/{*path}', authLimiter, (request, response) => void authNodeHandler(request, response));
  app.all('/.well-known/{*path}', authLimiter, (request, response) => void authNodeHandler(request, response));

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof z.ZodError) {
      response.status(400).json({ code: 'INVALID_INPUT', message: 'Invalid input' });
      return;
    }
    logger.error({ event: 'http_error', errorType: error instanceof Error ? error.name : 'unknown' });
    response.status(500).json({ code: 'INTERNAL', message: 'An internal error occurred' });
  });

  return {
    app,
    close: () => mcpHandler.close(),
  };
}
