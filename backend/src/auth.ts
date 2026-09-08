import { createHmac } from 'node:crypto';

import { cimd } from '@better-auth/cimd';
import { fetchClientMetadataResource } from '@better-auth/cimd/node';
import { mcp } from '@better-auth/mcp';
import { oauthDeviceAuthorization } from '@better-auth/oauth-provider';
import { betterAuth } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import { jwt } from 'better-auth/plugins';
import { z } from 'zod';

import type { BackendConfig } from './config.js';
import { BackendDatabase, readCookie } from './database.js';

export const DESKTOP_SCOPE = 'notex:desktop';
export const REGISTRATION_COOKIE = 'notex_registration_intent';
const PUBLIC_SCOPES = ['openid', 'profile', 'email', 'offline_access', 'notex:read', 'notex:create', 'notex:edit'] as const;
const oauthResourceRecordSchema = z.object({ identifier: z.string() });

type HookContext = { request?: Request; headers?: Headers } | null;

function getHeaders(context: HookContext): Headers | undefined {
  return context?.request?.headers ?? context?.headers;
}

function deriveDesktopClientId(secret: string): string {
  const suffix = createHmac('sha256', secret)
    .update('notex-desktop-oauth-client')
    .digest('base64url')
    .slice(0, 32);
  return `notex-desktop-${suffix}`;
}

export function createAuth(config: BackendConfig, database: BackendDatabase) {
  return betterAuth({
    appName: 'NoteX MCP',
    baseURL: config.publicUrl.origin,
    basePath: '/api/auth',
    secret: config.authSecret,
    database: database.raw,
    trustedOrigins: [...config.allowedOrigins],
    logger: { disabled: true },
    emailAndPassword: { enabled: false },
    socialProviders: {
      google: {
        clientId: config.googleClientId,
        clientSecret: config.googleClientSecret,
        scope: ['openid', 'email', 'profile'],
        prompt: 'select_account',
      },
    },
    advanced: {
      useSecureCookies: config.secureCookies,
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.secureCookies,
      },
    },
    onAPIError: {
      errorURL: '/auth/error',
    },
    databaseHooks: {
      user: {
        create: {
          async before(user, context) {
            if (!user.emailVerified) return false;
            const token = readCookie(getHeaders(context as HookContext), REGISTRATION_COOKIE);
            if (!token || !database.consumeRegistrationIntent(token, user.id, user.email)) return false;
          },
        },
      },
      account: {
        create: {
          async after(account) {
            if (account.providerId !== 'google') return;
            database.completeGoogleRegistration({
              userId: account.userId,
              subject: account.accountId,
            });
          },
        },
      },
    },
    plugins: [
      jwt(),
      mcp({
        loginPage: '/login',
        consentPage: '/consent',
        resource: config.mcpUrl,
        scopes: [...PUBLIC_SCOPES, DESKTOP_SCOPE],
        allowPublicClientPrelogin: true,
        allowDynamicClientRegistration: true,
        allowUnauthenticatedClientRegistration: true,
        clientRegistrationDefaultScopes: [...PUBLIC_SCOPES],
        clientRegistrationAllowedScopes: [...PUBLIC_SCOPES],
        clientRegistrationDefaultResources: [config.mcpUrl],
        clientRegistrationAllowedResources: [config.mcpUrl],
        clientRegistrationRequirePKCE: true,
        enforcePerClientResources: true,
        accessTokenExpiresIn: 15 * 60,
        refreshTokenExpiresIn: 365 * 24 * 60 * 60,
        refreshTokenReuseInterval: 0,
        customAccessTokenClaims: ({ user, referenceId }) => ({
          ...(user ? { notex_user_id: user.id } : {}),
          ...(referenceId ? { notex_grant_id: referenceId } : {}),
        }),
      }),
      cimd({
        fetchClientMetadataResource,
        metadataProfile: 'mcp-2026-07-28',
      }),
      oauthDeviceAuthorization({
        verificationUri: new URL('/device', config.publicUrl).toString(),
        expiresIn: '10m',
        interval: '5s',
      }),
    ] as const,
  });
}

export type NoteXAuth = ReturnType<typeof createAuth>;

export async function migrateAuth(auth: NoteXAuth): Promise<void> {
  const migration = await getMigrations(auth.options, { throwOnUnsafe: false });
  if (migration.unsafeChanges.length > 0) {
    throw new Error(`Unsafe Better Auth migration refused: ${migration.unsafeChanges.join('; ')}`);
  }
  await migration.runMigrations();
}

export async function ensureDesktopOAuthClient(auth: NoteXAuth, database: BackendDatabase): Promise<string> {
  const settingKey = 'desktop_oauth_client_id';
  const existingClientId = database.getSetting(settingKey);
  if (existingClientId) {
    const context = await auth.$context;
    const existing = await context.adapter.findOne({
      model: 'oauthClient',
      where: [{ field: 'clientId', value: existingClientId }],
    });
    if (existing) return existingClientId;
  }

  if (typeof auth.options.secret !== 'string') throw new Error('Better Auth secret is unavailable.');
  const clientId = deriveDesktopClientId(auth.options.secret);
  const context = await auth.$context;
  const resourceIdentifier = new URL('/mcp', context.baseURL).toString();
  let resource = oauthResourceRecordSchema.safeParse(
    await context.adapter.findOne({
      model: 'oauthResource',
      where: [{ field: 'identifier', value: resourceIdentifier }],
    }),
  );
  if (!resource.success) {
    // Better Auth initializes plugins before migrations, so its first resource seed is deferred.
    const now = new Date();
    await context.adapter.create({
      model: 'oauthResource',
      data: {
        identifier: resourceIdentifier,
        name: resourceIdentifier,
        accessTokenTtl: null,
        refreshTokenTtl: null,
        signingAlgorithm: null,
        signingKeyId: null,
        allowedScopes: null,
        customClaims: null,
        dpopBoundAccessTokensRequired: false,
        disabled: false,
        policyVersion: 1,
        metadata: null,
        createdAt: now,
        updatedAt: now,
      },
    });
    resource = oauthResourceRecordSchema.safeParse(
      await context.adapter.findOne({
        model: 'oauthResource',
        where: [{ field: 'identifier', value: resourceIdentifier }],
      }),
    );
  }
  if (!resource.success) throw new Error('MCP OAuth resource could not be initialized.');

  const existing = await context.adapter.findOne({
    model: 'oauthClient',
    where: [{ field: 'clientId', value: clientId }],
  });
  if (!existing) {
    const now = new Date();
    await context.adapter.create({
      model: 'oauthClient',
      data: {
        clientId,
        clientDiscoveryId: null,
        disabled: false,
        skipConsent: true,
        enableEndSession: false,
        scopes: ['openid', 'profile', 'email', 'offline_access', DESKTOP_SCOPE],
        clientCredentialsScopes: [],
        name: 'NoteX Desktop',
        redirectUris: [],
        tokenEndpointAuthMethod: 'none',
        applicationType: 'native',
        grantTypes: ['urn:ietf:params:oauth:grant-type:device_code', 'refresh_token'],
        responseTypes: [],
        requirePKCE: true,
        dpopBoundAccessTokens: false,
        createdAt: now,
        updatedAt: now,
      },
    });
    await context.adapter.create({
      model: 'oauthClientResource',
      data: { clientId, resourceId: resource.data.identifier, createdAt: now },
    });
  }
  database.setSetting(settingKey, clientId);
  return clientId;
}

export async function revokeAiAccess(auth: NoteXAuth, userId: string, desktopClientId: string): Promise<void> {
  const { adapter } = await auth.$context;
  const where = [
    { field: 'userId', value: userId },
    { field: 'clientId', value: desktopClientId, operator: 'ne' as const },
  ];
  await adapter.deleteMany({ model: 'oauthAccessToken', where });
  await adapter.deleteMany({ model: 'oauthRefreshToken', where });
  await adapter.deleteMany({ model: 'oauthConsent', where });
}

export async function deleteRemoteAccount(auth: NoteXAuth, database: BackendDatabase, userId: string): Promise<void> {
  const { adapter, internalAdapter } = await auth.$context;
  const where = [{ field: 'userId', value: userId }];
  await adapter.deleteMany({ model: 'oauthAccessToken', where });
  await adapter.deleteMany({ model: 'oauthRefreshToken', where });
  await adapter.deleteMany({ model: 'oauthConsent', where });
  await adapter.deleteMany({ model: 'deviceCode', where });
  await internalAdapter.deleteUserSessions(userId);
  await internalAdapter.deleteAccounts(userId);
  await internalAdapter.deleteUser(userId);
  database.deleteAccountMetadata(userId);
}
