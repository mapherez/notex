import { afterEach, describe, expect, it } from 'vitest';

import {
  REGISTRATION_COOKIE,
  createAuth,
  deleteRemoteAccount,
  ensureDesktopOAuthClient,
  migrateAuth,
  revokeAiAccess,
} from '../src/auth.js';
import { loadConfig } from '../src/config.js';
import { BackendDatabase } from '../src/database.js';

const databases: BackendDatabase[] = [];

function testConfig() {
  return loadConfig({
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
}

async function createHarness() {
  const config = testConfig();
  const database = new BackendDatabase(':memory:');
  databases.push(database);
  database.migrate();
  const auth = createAuth(config, database);
  await migrateAuth(auth);
  return { auth, config, database };
}

async function createBetterAuthUser(auth: Awaited<ReturnType<typeof createHarness>>['auth'], label: string) {
  const { adapter } = await auth.$context;
  const now = new Date();
  const user = await adapter.create({
    model: 'user',
    data: {
      name: 'Test Person',
      email: `${label}@example.com`,
      emailVerified: true,
      image: null,
      createdAt: now,
      updatedAt: now,
    },
  });
  if (!user || typeof user.id !== 'string') throw new Error('Better Auth did not create a user ID.');
  await adapter.create({
    model: 'account',
    data: {
      accountId: `google-${label}`,
      providerId: 'google',
      issuer: 'https://accounts.google.com',
      userId: user.id,
      createdAt: now,
      updatedAt: now,
    },
  });
  return user.id;
}

async function createPublicOAuthClient(auth: Awaited<ReturnType<typeof createHarness>>['auth'], clientId: string) {
  const { adapter } = await auth.$context;
  const now = new Date();
  await adapter.create({
    model: 'oauthClient',
    data: {
      clientId,
      clientDiscoveryId: null,
      disabled: false,
      skipConsent: false,
      enableEndSession: false,
      scopes: ['openid', 'profile', 'email', 'offline_access', 'notex:read'],
      clientCredentialsScopes: [],
      name: 'AI test client',
      redirectUris: ['https://ai-client.example/callback'],
      tokenEndpointAuthMethod: 'none',
      applicationType: 'web',
      grantTypes: ['authorization_code', 'refresh_token'],
      responseTypes: ['code'],
      requirePKCE: true,
      dpopBoundAccessTokens: false,
      createdAt: now,
      updatedAt: now,
    },
  });
}

async function createOAuthGrant(
  auth: Awaited<ReturnType<typeof createHarness>>['auth'],
  userId: string,
  clientId: string,
) {
  const { adapter } = await auth.$context;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60_000);
  await adapter.create({
    model: 'oauthRefreshToken',
    data: {
      token: `refresh-${clientId}`,
      clientId,
      userId,
      resources: ['http://127.0.0.1:8080/mcp'],
      expiresAt,
      createdAt: now,
      scopes: ['notex:read'],
    },
  });
  await adapter.create({
    model: 'oauthAccessToken',
    data: {
      token: `access-${clientId}`,
      clientId,
      userId,
      resources: ['http://127.0.0.1:8080/mcp'],
      expiresAt,
      createdAt: now,
      scopes: ['notex:read'],
    },
  });
  await adapter.create({
    model: 'oauthConsent',
    data: {
      clientId,
      userId,
      resources: ['http://127.0.0.1:8080/mcp'],
      scopes: ['notex:read'],
      createdAt: now,
      updatedAt: now,
    },
  });
}

afterEach(() => {
  while (databases.length > 0) databases.pop()?.close();
});

describe('Better Auth configuration', () => {
  it('migrates only backend identity/authorization models and seeds the MCP resource', async () => {
    const { auth, config, database } = await createHarness();
    await ensureDesktopOAuthClient(auth, database);
    const tables = (
      database.raw
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
        .all() as Array<{ name: string }>
    ).map(({ name }) => name);

    expect(tables).toEqual(
      expect.arrayContaining(['user', 'account', 'session', 'oauthClient', 'oauthResource', 'deviceCode']),
    );
    expect(tables).not.toContain('notes');
    expect(tables).not.toContain('note_blocks');

    const context = await auth.$context;
    await expect(
      context.adapter.findOne({
        model: 'oauthResource',
        where: [{ field: 'identifier', value: config.mcpUrl }],
      }),
    ).resolves.toMatchObject({ identifier: config.mcpUrl });
  });

  it('creates one reusable first-party native desktop client', async () => {
    const { auth, database } = await createHarness();
    const firstClientId = await ensureDesktopOAuthClient(auth, database);
    const secondClientId = await ensureDesktopOAuthClient(auth, database);
    expect(secondClientId).toBe(firstClientId);

    const context = await auth.$context;
    await expect(
      context.adapter.findOne({
        model: 'oauthClient',
        where: [{ field: 'clientId', value: firstClientId }],
      }),
    ).resolves.toMatchObject({
      clientId: firstClientId,
      applicationType: 'native',
      tokenEndpointAuthMethod: 'none',
      skipConsent: true,
    });
  });

  it('blocks implicit user creation and permits it only with a valid registration intent cookie', async () => {
    const { auth, database } = await createHarness();
    const beforeCreate = auth.options.databaseHooks?.user?.create?.before;
    const afterAccountCreate = auth.options.databaseHooks?.account?.create?.after;
    if (!beforeCreate || !afterAccountCreate) throw new Error('Registration hooks are not configured.');

    const user = {
      id: 'user-1',
      name: 'Test Person',
      email: 'person@example.com',
      emailVerified: true,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await expect(beforeCreate(user, null)).resolves.toBe(false);
    expect(database.getAccount(user.id)).toBeNull();

    const intent = database.createRegistrationIntent('ABCD-EFGH');
    const request = new Request('http://127.0.0.1:8080/api/auth/callback/google', {
      headers: { cookie: `${REGISTRATION_COOKIE}=${intent.token}` },
    });
    const context = { request } as Parameters<typeof beforeCreate>[1];
    await expect(beforeCreate({ ...user, emailVerified: false }, context)).resolves.toBe(false);
    await expect(beforeCreate(user, context)).resolves.toBeUndefined();

    const account: Parameters<typeof afterAccountCreate>[0] = {
      id: 'account-1',
      accountId: 'google-subject-1',
      providerId: 'google',
      issuer: 'https://accounts.google.com',
      userId: user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await afterAccountCreate(account);
    expect(database.getAccount(user.id)).toMatchObject({
      issuer: 'https://accounts.google.com',
      subject: 'google-subject-1',
      email: user.email,
    });
  });

  it('revokes AI grants while preserving the first-party desktop grant', async () => {
    const { auth, database } = await createHarness();
    const desktopClientId = await ensureDesktopOAuthClient(auth, database);
    const userId = await createBetterAuthUser(auth, 'user-1');
    await createPublicOAuthClient(auth, 'ai-client');
    await createOAuthGrant(auth, userId, desktopClientId);
    await createOAuthGrant(auth, userId, 'ai-client');

    await revokeAiAccess(auth, userId, desktopClientId);

    const { adapter } = await auth.$context;
    for (const model of ['oauthAccessToken', 'oauthRefreshToken', 'oauthConsent']) {
      const remaining = await adapter.findMany({ model, where: [{ field: 'userId', value: userId }] });
      expect(remaining).toHaveLength(1);
      expect(remaining[0]).toMatchObject({ clientId: desktopClientId });
    }
  });

  it('deletes Better Auth and backend account metadata without a NoteX data store', async () => {
    const { auth, database } = await createHarness();
    const userId = await createBetterAuthUser(auth, 'user-1');
    const intent = database.createRegistrationIntent('ABCD-EFGH');
    database.consumeRegistrationIntent(intent.token, userId, 'person@example.com');
    database.completeGoogleRegistration({ userId, subject: 'google-user-1' });
    database.activateDesktopSession(userId, database.createDesktopActivation().token);

    await deleteRemoteAccount(auth, database, userId);

    const { adapter } = await auth.$context;
    await expect(
      adapter.findOne({ model: 'user', where: [{ field: 'id', value: userId }] }),
    ).resolves.toBeNull();
    await expect(
      adapter.findOne({ model: 'account', where: [{ field: 'userId', value: userId }] }),
    ).resolves.toBeNull();
    expect(database.getAccount(userId)).toBeNull();
    expect(database.hasActiveDesktopSession(userId)).toBe(false);
  });
});
