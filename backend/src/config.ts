import path from 'node:path';

import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NOTEX_MCP_PUBLIC_URL: z.string().url().default('http://127.0.0.1:8080'),
  NOTEX_MCP_HOST: z.string().min(1).default('127.0.0.1'),
  NOTEX_MCP_PORT: z.coerce.number().int().min(1).max(65_535).default(8080),
  NOTEX_MCP_DATABASE_PATH: z.string().min(1).default('./data/notex-mcp.sqlite'),
  NOTEX_MCP_ALLOWED_HOSTS: z.string().default(''),
  NOTEX_MCP_LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  BETTER_AUTH_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
});

export type BackendConfig = ReturnType<typeof loadConfig>;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env) {
  const parsed = environmentSchema.parse(environment);
  const publicUrl = new URL(parsed.NOTEX_MCP_PUBLIC_URL);

  if (
    parsed.NODE_ENV === 'production' &&
    publicUrl.protocol !== 'https:' &&
    !['127.0.0.1', 'localhost', '::1'].includes(publicUrl.hostname)
  ) {
    throw new Error('NOTEX_MCP_PUBLIC_URL must use HTTPS in production.');
  }

  const configuredHosts = parsed.NOTEX_MCP_ALLOWED_HOSTS.split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);

  return {
    environment: parsed.NODE_ENV,
    publicUrl,
    mcpUrl: new URL('/mcp', publicUrl).toString(),
    authBaseUrl: new URL('/api/auth', publicUrl).toString().replace(/\/$/, ''),
    host: parsed.NOTEX_MCP_HOST,
    port: parsed.NOTEX_MCP_PORT,
    databasePath: path.resolve(parsed.NOTEX_MCP_DATABASE_PATH),
    allowedHosts: [...new Set([publicUrl.hostname.toLowerCase(), ...configuredHosts])],
    allowedOrigins: [publicUrl.origin],
    logLevel: parsed.NOTEX_MCP_LOG_LEVEL,
    authSecret: parsed.BETTER_AUTH_SECRET,
    googleClientId: parsed.GOOGLE_CLIENT_ID,
    googleClientSecret: parsed.GOOGLE_CLIENT_SECRET,
    secureCookies: publicUrl.protocol === 'https:',
  } as const;
}
