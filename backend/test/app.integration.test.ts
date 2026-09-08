import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApplication } from '../src/app.js';
import { createAuth, ensureDesktopOAuthClient, migrateAuth } from '../src/auth.js';
import { BridgeRegistry } from '../src/bridge/registry.js';
import { loadConfig } from '../src/config.js';
import { BackendDatabase } from '../src/database.js';
import { createLogger } from '../src/logger.js';

interface Harness {
  close: () => Promise<void>;
  database: BackendDatabase;
  app: ReturnType<typeof createApplication>['app'];
}

const harnesses: Harness[] = [];

async function createHarness(): Promise<Harness> {
  const config = loadConfig({
    NODE_ENV: 'test',
    NOTEX_MCP_PUBLIC_URL: 'http://127.0.0.1:8080',
    NOTEX_MCP_HOST: '127.0.0.1',
    NOTEX_MCP_PORT: '8080',
    NOTEX_MCP_DATABASE_PATH: ':memory:',
    NOTEX_MCP_ALLOWED_HOSTS: 'localhost',
    NOTEX_MCP_LOG_LEVEL: 'silent',
    BETTER_AUTH_SECRET: 'test-secret-that-is-at-least-32-bytes-long',
    GOOGLE_CLIENT_ID: 'google-client.test',
    GOOGLE_CLIENT_SECRET: 'google-secret.test',
  });
  const database = new BackendDatabase(':memory:');
  database.migrate();
  const auth = createAuth(config, database);
  await migrateAuth(auth);
  const desktopClientId = await ensureDesktopOAuthClient(auth, database);
  const registry = new BridgeRegistry(database);
  const application = createApplication({
    auth,
    config,
    database,
    registry,
    desktopClientId,
    logger: createLogger(config),
  });
  const harness = {
    app: application.app,
    database,
    async close() {
      registry.close();
      await application.close();
    },
  };
  harnesses.push(harness);
  return harness;
}

function host(call: request.Test): request.Test {
  return call.set('Host', '127.0.0.1:8080');
}

afterEach(async () => {
  while (harnesses.length > 0) {
    const harness = harnesses.pop();
    await harness?.close();
    harness?.database.close();
  }
});

describe('backend HTTP surface', () => {
  it('serves health and rejects unknown hosts', async () => {
    const { app } = await createHarness();
    await host(request(app).get('/healthz')).expect(200, { status: 'ok' });
    await request(app).get('/healthz').set('Host', 'attacker.example').expect(403);
  });

  it('publishes OAuth authorization-server and protected-resource metadata', async () => {
    const { app } = await createHarness();
    const authorization = await host(
      request(app).get('/.well-known/oauth-authorization-server/api/auth'),
    ).expect(200);
    expect(authorization.body).toMatchObject({
      issuer: 'http://127.0.0.1:8080/api/auth',
      code_challenge_methods_supported: expect.arrayContaining(['S256']),
    });

    const openId = await host(request(app).get('/api/auth/.well-known/openid-configuration')).expect(200);
    expect(openId.body).toMatchObject({ issuer: 'http://127.0.0.1:8080/api/auth' });

    const resource = await host(request(app).get('/.well-known/oauth-protected-resource/mcp')).expect(200);
    expect(resource.body).toMatchObject({
      resource: 'http://127.0.0.1:8080/mcp',
      authorization_servers: ['http://127.0.0.1:8080/api/auth'],
      scopes_supported: expect.arrayContaining(['notex:read', 'notex:create', 'notex:edit']),
    });
  });

  it('starts a desktop device flow without creating an account', async () => {
    const { app, database } = await createHarness();
    const response = await host(request(app).post('/v1/desktop/device/start'))
      .send({ mode: 'login' })
      .expect(200);

    expect(response.body).toMatchObject({
      device_code: expect.any(String),
      user_code: expect.any(String),
      verification_uri_complete: expect.stringContaining('/device?user_code='),
      interval: 5,
      activation_token: expect.stringMatching(/^[A-Za-z0-9_-]{32,}$/),
      client_id: expect.stringMatching(/^notex-desktop-/),
      token_endpoint: 'http://127.0.0.1:8080/api/auth/oauth2/token',
      resource: 'http://127.0.0.1:8080/mcp',
    });
    const users = database.raw.prepare('SELECT count(*) AS count FROM user').get() as { count: number };
    expect(users.count).toBe(0);
  });

  it('adds a short-lived registration intent only for Register mode', async () => {
    const { app, database } = await createHarness();
    const response = await host(request(app).post('/v1/desktop/device/start'))
      .send({ mode: 'register' })
      .expect(200);
    expect(response.body.verification_uri_complete).toContain('/desktop/device/register?');
    const intents = database.raw
      .prepare('SELECT count(*) AS count FROM notex_registration_intents')
      .get() as { count: number };
    expect(intents.count).toBe(1);
  });

  it('challenges unauthenticated MCP POSTs and exposes POST only', async () => {
    const { app } = await createHarness();
    const response = await host(request(app).post('/mcp'))
      .set('Content-Type', 'application/json')
      .send({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
      .expect(401);
    expect(response.headers['www-authenticate']).toContain('resource_metadata=');
    await host(request(app).get('/mcp')).expect('Allow', 'POST').expect(405);
  });
});
