import Database from 'better-sqlite3';
import 'dotenv/config';
import { createCipheriv, createDecipheriv, createHmac, createHash, randomBytes, randomUUID } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(process.env.STATIC_DIR ?? join(__dirname, '..', 'dist'));
const databasePath = process.env.DATABASE_PATH ?? join(__dirname, '..', 'data', 'notex.sqlite');
const port = Number(process.env.PORT ?? 3000);
const sessionCookieName = 'notex_session';
const sessionMaxAgeSeconds = 60 * 60 * 24 * 30;
const oauthStateTtlMs = 1000 * 60 * 10;
const googleTokenEndpoint = 'https://oauth2.googleapis.com/token';
const googleUserInfoEndpoint = 'https://www.googleapis.com/oauth2/v3/userinfo';
const googleAuthEndpoint = 'https://accounts.google.com/o/oauth2/v2/auth';
const googleScopes = ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/drive.appdata'];
const accessTokenCache = new Map();

mkdirSync(dirname(databasePath), { recursive: true });
const db = new Database(databasePath);
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS google_accounts (
    google_sub TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    first_name TEXT,
    handle TEXT,
    avatar_url TEXT,
    encrypted_refresh_token TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_login_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS auth_sessions (
    id TEXT PRIMARY KEY,
    session_hash TEXT NOT NULL UNIQUE,
    google_sub TEXT NOT NULL,
    name TEXT NOT NULL,
    user_agent TEXT,
    ip_address TEXT,
    created_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    FOREIGN KEY (google_sub) REFERENCES google_accounts (google_sub)
  );

  CREATE TABLE IF NOT EXISTS oauth_states (
    state_hash TEXT PRIMARY KEY,
    return_to TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
`);

const statements = {
  deleteExpiredStates: db.prepare('DELETE FROM oauth_states WHERE expires_at < ?'),
  deleteState: db.prepare('DELETE FROM oauth_states WHERE state_hash = ?'),
  getAccount: db.prepare('SELECT * FROM google_accounts WHERE google_sub = ?'),
  getSession: db.prepare(`
    SELECT
      auth_sessions.id,
      auth_sessions.session_hash,
      auth_sessions.google_sub,
      auth_sessions.name,
      auth_sessions.user_agent,
      auth_sessions.created_at,
      auth_sessions.last_seen_at,
      auth_sessions.expires_at,
      auth_sessions.revoked_at,
      google_accounts.email,
      google_accounts.full_name,
      google_accounts.first_name,
      google_accounts.handle,
      google_accounts.avatar_url,
      google_accounts.last_login_at
    FROM auth_sessions
    JOIN google_accounts ON google_accounts.google_sub = auth_sessions.google_sub
    WHERE auth_sessions.session_hash = ?
  `),
  getState: db.prepare('SELECT * FROM oauth_states WHERE state_hash = ?'),
  insertSession: db.prepare(`
    INSERT INTO auth_sessions (
      id, session_hash, google_sub, name, user_agent, ip_address, created_at, last_seen_at, expires_at
    ) VALUES (
      @id, @sessionHash, @googleSub, @name, @userAgent, @ipAddress, @createdAt, @lastSeenAt, @expiresAt
    )
  `),
  insertState: db.prepare('INSERT INTO oauth_states (state_hash, return_to, created_at, expires_at) VALUES (?, ?, ?, ?)'),
  listSessions: db.prepare(`
    SELECT id, name, user_agent, created_at, last_seen_at, expires_at
    FROM auth_sessions
    WHERE google_sub = ? AND revoked_at IS NULL AND expires_at > ?
    ORDER BY last_seen_at DESC
  `),
  revokeSession: db.prepare('UPDATE auth_sessions SET revoked_at = ?, last_seen_at = ? WHERE id = ? AND google_sub = ?'),
  revokeSessionByHash: db.prepare('UPDATE auth_sessions SET revoked_at = ?, last_seen_at = ? WHERE session_hash = ?'),
  touchSession: db.prepare('UPDATE auth_sessions SET last_seen_at = ? WHERE session_hash = ?'),
  upsertAccount: db.prepare(`
    INSERT INTO google_accounts (
      google_sub, email, full_name, first_name, handle, avatar_url, encrypted_refresh_token, created_at, updated_at, last_login_at
    ) VALUES (
      @googleSub, @email, @fullName, @firstName, @handle, @avatarUrl, @encryptedRefreshToken, @createdAt, @updatedAt, @lastLoginAt
    )
    ON CONFLICT(google_sub) DO UPDATE SET
      email = excluded.email,
      full_name = excluded.full_name,
      first_name = excluded.first_name,
      handle = excluded.handle,
      avatar_url = excluded.avatar_url,
      encrypted_refresh_token = excluded.encrypted_refresh_token,
      updated_at = excluded.updated_at,
      last_login_at = excluded.last_login_at
  `),
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', getRequestOrigin(req));

    if (url.pathname.startsWith('/api/auth/')) {
      await handleAuthRoute(req, res, url);
      return;
    }

    await serveStaticFile(req, res, url);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: 'internal_server_error' });
  }
});

server.listen(port, () => {
  console.log(`NoteX server listening on http://0.0.0.0:${port}`);
});

async function handleAuthRoute(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/auth/session') {
    const session = getCurrentSession(req);
    if (!session) {
      sendJson(res, 200, { connected: false, sessions: [] });
      return;
    }

    sendJson(res, 200, buildSessionPayload(session));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/auth/google/start') {
    const config = getAuthConfig();
    const returnTo = normalizeReturnTo(url.searchParams.get('returnTo'));
    const state = randomBytes(32).toString('base64url');
    const now = new Date();
    statements.deleteExpiredStates.run(now.toISOString());
    statements.insertState.run(hashState(state), returnTo, now.toISOString(), new Date(now.getTime() + oauthStateTtlMs).toISOString());

    const authUrl = new URL(googleAuthEndpoint);
    authUrl.searchParams.set('client_id', config.googleClientId);
    authUrl.searchParams.set('redirect_uri', config.googleRedirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', googleScopes.join(' '));
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('include_granted_scopes', 'true');
    authUrl.searchParams.set('prompt', 'consent');
    authUrl.searchParams.set('state', state);

    redirect(res, authUrl.toString());
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/auth/google/callback') {
    await handleGoogleCallback(req, res, url);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/google/token') {
    const session = getCurrentSession(req);
    if (!session) {
      sendJson(res, 401, { error: 'not_authenticated' });
      return;
    }

    try {
      const token = await getGoogleAccessToken(session.google_sub);
      sendJson(res, 200, token);
    } catch (error) {
      console.error(error);
      sendJson(res, 401, { error: 'google_reconnect_required' });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
    const rawSessionId = parseCookies(req.headers.cookie)[sessionCookieName];
    if (rawSessionId) {
      const now = new Date().toISOString();
      statements.revokeSessionByHash.run(now, now, hashSession(rawSessionId));
    }

    setSessionCookie(res, '', 0);
    sendJson(res, 200, { ok: true });
    return;
  }

  const sessionMatch = url.pathname.match(/^\/api\/auth\/sessions\/([^/]+)$/);
  if (req.method === 'DELETE' && sessionMatch) {
    const session = getCurrentSession(req);
    if (!session) {
      sendJson(res, 401, { error: 'not_authenticated' });
      return;
    }

    const now = new Date().toISOString();
    statements.revokeSession.run(now, now, decodeURIComponent(sessionMatch[1]), session.google_sub);
    sendJson(res, 200, { ok: true });
    return;
  }

  sendJson(res, 404, { error: 'not_found' });
}

async function handleGoogleCallback(req, res, url) {
  const config = getAuthConfig();
  const state = url.searchParams.get('state') ?? '';
  const storedState = statements.getState.get(hashState(state));
  const fallbackReturnTo = '/profile';
  const returnTo = storedState ? storedState.return_to : fallbackReturnTo;

  if (storedState) {
    statements.deleteState.run(hashState(state));
  }

  if (!storedState || new Date(storedState.expires_at).getTime() < Date.now()) {
    redirect(res, toAppUrl(appendQuery(returnTo, 'notex_auth_error', 'invalid_state')));
    return;
  }

  const oauthError = url.searchParams.get('error');
  if (oauthError) {
    redirect(res, toAppUrl(appendQuery(returnTo, 'notex_auth_error', oauthError)));
    return;
  }

  const code = url.searchParams.get('code');
  if (!code) {
    redirect(res, toAppUrl(appendQuery(returnTo, 'notex_auth_error', 'missing_code')));
    return;
  }

  try {
    const token = await exchangeAuthorizationCode(config, code);
    const profile = await fetchGoogleProfile(token.access_token);
    const existingAccount = statements.getAccount.get(profile.sub);
    const encryptedRefreshToken = token.refresh_token
      ? encryptSecret(token.refresh_token)
      : existingAccount?.encrypted_refresh_token;

    if (!encryptedRefreshToken) {
      redirect(res, toAppUrl(appendQuery(returnTo, 'notex_auth_error', 'missing_refresh_token')));
      return;
    }

    const now = new Date().toISOString();
    const firstName = profile.given_name?.trim() || profile.name.trim().split(/\s+/)[0] || profile.email.split('@')[0];
    statements.upsertAccount.run({
      googleSub: profile.sub,
      email: profile.email,
      fullName: profile.name,
      firstName,
      handle: deriveHandleFromEmail(profile.email),
      avatarUrl: profile.picture ?? null,
      encryptedRefreshToken,
      createdAt: existingAccount?.created_at ?? now,
      updatedAt: now,
      lastLoginAt: now,
    });

    const sessionId = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + sessionMaxAgeSeconds * 1000).toISOString();
    statements.insertSession.run({
      id: randomUUID(),
      sessionHash: hashSession(sessionId),
      googleSub: profile.sub,
      name: getDeviceName(req.headers['user-agent']),
      userAgent: req.headers['user-agent'] ?? '',
      ipAddress: getClientIp(req),
      createdAt: now,
      lastSeenAt: now,
      expiresAt,
    });

    if (token.access_token) {
      accessTokenCache.set(profile.sub, {
        accessToken: token.access_token,
        expiresAt: Date.now() + Math.max(0, (token.expires_in ?? 3600) - 60) * 1000,
      });
    }

    setSessionCookie(res, sessionId, sessionMaxAgeSeconds);
    redirect(res, toAppUrl(appendQuery(returnTo, 'notex_auth', 'connected')));
  } catch (error) {
    console.error(error);
    redirect(res, toAppUrl(appendQuery(returnTo, 'notex_auth_error', 'callback_failed')));
  }
}

async function exchangeAuthorizationCode(config, code) {
  const body = new URLSearchParams({
    client_id: config.googleClientId,
    client_secret: config.googleClientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: config.googleRedirectUri,
  });

  const response = await fetch(googleTokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const payload = await response.json();

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || 'Google authorization code exchange failed');
  }

  return payload;
}

async function fetchGoogleProfile(accessToken) {
  const response = await fetch(googleUserInfoEndpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Could not load Google profile');
  }

  return response.json();
}

async function getGoogleAccessToken(googleSub) {
  const cached = accessTokenCache.get(googleSub);
  if (cached && Date.now() < cached.expiresAt) {
    return cached;
  }

  const config = getAuthConfig();
  const account = statements.getAccount.get(googleSub);
  if (!account) {
    throw new Error('Google account not connected');
  }

  const body = new URLSearchParams({
    client_id: config.googleClientId,
    client_secret: config.googleClientSecret,
    refresh_token: decryptSecret(account.encrypted_refresh_token),
    grant_type: 'refresh_token',
  });
  const response = await fetch(googleTokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const payload = await response.json();

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || 'Google token refresh failed');
  }

  const token = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + Math.max(0, (payload.expires_in ?? 3600) - 60) * 1000,
  };
  accessTokenCache.set(googleSub, token);
  return token;
}

function getCurrentSession(req) {
  const rawSessionId = parseCookies(req.headers.cookie)[sessionCookieName];
  if (!rawSessionId) {
    return null;
  }

  const session = statements.getSession.get(hashSession(rawSessionId));
  if (!session || session.revoked_at || new Date(session.expires_at).getTime() < Date.now()) {
    return null;
  }

  statements.touchSession.run(new Date().toISOString(), session.session_hash);
  return {
    ...session,
    last_seen_at: new Date().toISOString(),
  };
}

function buildSessionPayload(session) {
  const now = new Date().toISOString();
  const sessions = statements.listSessions.all(session.google_sub, now).map((item) => ({
    id: item.id,
    name: item.name,
    userAgent: item.user_agent ?? '',
    createdAt: item.created_at,
    lastSeenAt: item.last_seen_at,
    expiresAt: item.expires_at,
  }));

  return {
    connected: true,
    currentSessionId: session.id,
    lastLoginAt: session.last_login_at,
    profile: {
      sub: session.google_sub,
      name: session.full_name,
      given_name: session.first_name,
      email: session.email,
      picture: session.avatar_url ?? undefined,
    },
    sessions,
  };
}

async function serveStaticFile(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendText(res, 405, 'Method not allowed');
    return;
  }

  const pathname = decodeURIComponent(url.pathname);
  const requestedPath = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  let filePath = resolve(join(distDir, requestedPath));

  if (!filePath.startsWith(distDir)) {
    sendText(res, 403, 'Forbidden');
    return;
  }

  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(distDir, 'index.html');
  }

  if (!existsSync(filePath)) {
    sendText(res, 404, 'Build output not found. Run npm run build first.');
    return;
  }

  res.writeHead(200, {
    'Content-Type': getContentType(filePath),
    'Cache-Control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
  });

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  createReadStream(filePath).pipe(res);
}

function getAuthConfig() {
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const googleRedirectUri = process.env.GOOGLE_REDIRECT_URI;
  const sessionSecret = process.env.SESSION_SECRET;
  const tokenEncryptionKey = process.env.TOKEN_ENCRYPTION_KEY;

  const missing = [
    ['GOOGLE_CLIENT_ID', googleClientId],
    ['GOOGLE_CLIENT_SECRET', googleClientSecret],
    ['GOOGLE_REDIRECT_URI', googleRedirectUri],
    ['SESSION_SECRET', sessionSecret],
    ['TOKEN_ENCRYPTION_KEY', tokenEncryptionKey],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length) {
    throw new Error(`Missing required auth env vars: ${missing.join(', ')}`);
  }

  return {
    googleClientId,
    googleClientSecret,
    googleRedirectUri,
    sessionSecret,
    tokenEncryptionKey,
  };
}

function encryptSecret(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

function decryptSecret(value) {
  const [ivText, tagText, encryptedText] = value.split('.');
  const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedText, 'base64url')), decipher.final()]).toString('utf8');
}

function getEncryptionKey() {
  const raw = process.env.TOKEN_ENCRYPTION_KEY ?? '';
  const base64 = Buffer.from(raw, 'base64');
  if (base64.length === 32) {
    return base64;
  }

  const hex = Buffer.from(raw, 'hex');
  if (hex.length === 32) {
    return hex;
  }

  return createHash('sha256').update(raw).digest();
}

function hashSession(sessionId) {
  return createHmac('sha256', process.env.SESSION_SECRET ?? '').update(sessionId).digest('hex');
}

function hashState(state) {
  return createHash('sha256').update(state).digest('hex');
}

function setSessionCookie(res, value, maxAge) {
  const attributes = [
    `${sessionCookieName}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];

  if (shouldUseSecureCookie()) {
    attributes.push('Secure');
  }

  res.setHeader('Set-Cookie', attributes.join('; '));
}

function shouldUseSecureCookie() {
  if (process.env.COOKIE_SECURE) {
    return process.env.COOKIE_SECURE === 'true';
  }

  return (process.env.APP_ORIGIN ?? '').startsWith('https://');
}

function parseCookies(cookieHeader = '') {
  return Object.fromEntries(
    cookieHeader
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf('=');
        return index === -1 ? [part, ''] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      }),
  );
}

function getRequestOrigin(req) {
  const host = req.headers.host ?? `localhost:${port}`;
  const proto = req.headers['x-forwarded-proto'] ?? 'http';
  return `${Array.isArray(proto) ? proto[0] : proto}://${host}`;
}

function normalizeReturnTo(value) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/api/')) {
    return '/profile';
  }

  return value;
}

function appendQuery(path, key, value) {
  const url = new URL(path, 'http://notex.local');
  url.searchParams.set(key, value);
  return `${url.pathname}${url.search}${url.hash}`;
}

function toAppUrl(path) {
  const appOrigin = process.env.APP_ORIGIN;
  return appOrigin ? new URL(path, appOrigin).toString() : path;
}

function deriveHandleFromEmail(email) {
  const localPart = email?.split('@')[0]?.trim().toLowerCase() ?? '';
  const normalized = localPart
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]/g, '');

  return normalized ? `@${normalized}` : '@local';
}

function getDeviceName(userAgent = '') {
  const browser = userAgent.includes('Edg/')
    ? 'Edge'
    : userAgent.includes('Chrome/')
      ? 'Chrome'
      : userAgent.includes('Firefox/')
        ? 'Firefox'
        : userAgent.includes('Safari/')
          ? 'Safari'
          : 'Browser';
  const os = userAgent.includes('Windows')
    ? 'Windows'
    : userAgent.includes('Mac OS X')
      ? 'macOS'
      : userAgent.includes('Linux')
        ? 'Linux'
        : userAgent.includes('Android')
          ? 'Android'
          : userAgent.includes('iPhone') || userAgent.includes('iPad')
            ? 'iOS'
            : 'This device';

  return `${browser} on ${os}`;
}

function getClientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (Array.isArray(forwardedFor)) {
    return forwardedFor[0] ?? '';
  }

  return forwardedFor?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function getContentType(filePath) {
  const types = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
  };

  return types[extname(filePath)] ?? 'application/octet-stream';
}
