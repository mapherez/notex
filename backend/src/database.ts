import { createHash, randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

const GOOGLE_ISSUER = 'https://accounts.google.com';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export interface RegisteredAccount {
  userId: string;
  issuer: string;
  subject: string;
  email: string;
}

export class BackendDatabase {
  readonly raw: Database.Database;

  constructor(databasePath: string) {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    this.raw = new Database(databasePath);
    this.raw.pragma('journal_mode = WAL');
    this.raw.pragma('foreign_keys = ON');
    this.raw.pragma('busy_timeout = 5000');
  }

  migrate(): void {
    this.raw.exec(`
      CREATE TABLE IF NOT EXISTS notex_backend_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS notex_accounts (
        user_id TEXT PRIMARY KEY,
        google_issuer TEXT NOT NULL,
        google_subject TEXT NOT NULL,
        email TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (google_issuer, google_subject)
      );

      CREATE TABLE IF NOT EXISTS notex_registration_intents (
        token_hash TEXT PRIMARY KEY,
        user_code TEXT NOT NULL UNIQUE,
        expires_at INTEGER NOT NULL,
        consumed_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS notex_pending_registrations (
        user_id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS notex_desktop_activations (
        token_hash TEXT PRIMARY KEY,
        expires_at INTEGER NOT NULL,
        consumed_at INTEGER,
        user_id TEXT,
        session_id TEXT
      );

      CREATE TABLE IF NOT EXISTS notex_desktop_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        grant_hash TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        revoked_at TEXT,
        UNIQUE (user_id, grant_hash)
      );

      CREATE INDEX IF NOT EXISTS idx_notex_desktop_sessions_active
        ON notex_desktop_sessions(user_id, active);

      CREATE TABLE IF NOT EXISTS notex_backend_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      INSERT OR IGNORE INTO notex_backend_migrations(version, applied_at)
      VALUES (1, CURRENT_TIMESTAMP);

      INSERT OR IGNORE INTO notex_backend_migrations(version, applied_at)
      VALUES (2, CURRENT_TIMESTAMP);
    `);
  }

  close(): void {
    this.raw.close();
  }

  createRegistrationIntent(userCode: string, ttlSeconds = 600): { token: string; expiresAt: number } {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
    this.cleanupExpiredRegistrationIntents();
    this.raw
      .prepare(
        `INSERT INTO notex_registration_intents(token_hash, user_code, expires_at)
         VALUES (?, ?, ?)`,
      )
      .run(sha256(token), userCode, expiresAt);
    return { token, expiresAt };
  }

  consumeRegistrationIntent(token: string, userId: string, email: string): boolean {
    const now = Math.floor(Date.now() / 1000);
    const consume = this.raw.transaction(() => {
      const result = this.raw
        .prepare(
          `UPDATE notex_registration_intents
             SET consumed_at = ?
           WHERE token_hash = ? AND consumed_at IS NULL AND expires_at >= ?`,
        )
        .run(now, sha256(token), now);
      if (result.changes !== 1) return false;
      this.raw
        .prepare(
          `INSERT INTO notex_pending_registrations(user_id, email, created_at)
           VALUES (?, ?, ?)
           ON CONFLICT(user_id) DO UPDATE SET email = excluded.email, created_at = excluded.created_at`,
        )
        .run(userId, email, now);
      return true;
    });
    return consume();
  }

  hasPendingRegistration(userId: string): boolean {
    return Boolean(
      this.raw.prepare('SELECT 1 FROM notex_pending_registrations WHERE user_id = ?').get(userId),
    );
  }

  completeGoogleRegistration(input: { userId: string; subject: string }): void {
    const complete = this.raw.transaction(() => {
      const pending = this.raw
        .prepare('SELECT email FROM notex_pending_registrations WHERE user_id = ?')
        .get(input.userId) as { email: string } | undefined;
      if (!pending) return;
      const now = new Date().toISOString();
      this.raw
        .prepare(
          `INSERT INTO notex_accounts(user_id, google_issuer, google_subject, email, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(user_id) DO UPDATE SET
             google_subject = excluded.google_subject,
             email = excluded.email,
             updated_at = excluded.updated_at`,
        )
        .run(input.userId, GOOGLE_ISSUER, input.subject, pending.email, now, now);
      this.raw.prepare('DELETE FROM notex_pending_registrations WHERE user_id = ?').run(input.userId);
    });
    complete();
  }

  getAccount(userId: string): RegisteredAccount | null {
    const row = this.raw
      .prepare(
        `SELECT user_id AS userId, google_issuer AS issuer, google_subject AS subject, email
           FROM notex_accounts WHERE user_id = ?`,
      )
      .get(userId) as RegisteredAccount | undefined;
    return row ?? null;
  }

  isRegistered(userId: string): boolean {
    return this.getAccount(userId) !== null;
  }

  createDesktopActivation(ttlSeconds = 600): { token: string; expiresAt: number } {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
    const now = Math.floor(Date.now() / 1000);
    this.raw
      .prepare('DELETE FROM notex_desktop_activations WHERE expires_at < ?')
      .run(now);
    this.raw
      .prepare('INSERT INTO notex_desktop_activations(token_hash, expires_at) VALUES (?, ?)')
      .run(sha256(token), expiresAt);
    return { token, expiresAt };
  }

  activateDesktopSession(
    userId: string,
    activationToken: string,
  ): { sessionId: string; replacedSessionIds: string[] } | null {
    const grantHash = sha256(activationToken);
    const nowSeconds = Math.floor(Date.now() / 1000);
    const now = new Date().toISOString();
    return this.raw.transaction(() => {
      const activation = this.raw
        .prepare(
          `SELECT consumed_at AS consumedAt, user_id AS userId, session_id AS sessionId
             FROM notex_desktop_activations
            WHERE token_hash = ? AND expires_at >= ?`,
        )
        .get(grantHash, nowSeconds) as
        | { consumedAt: number | null; userId: string | null; sessionId: string | null }
        | undefined;
      if (!activation) return null;
      if (activation.consumedAt !== null) {
        if (
          activation.userId !== userId ||
          !activation.sessionId ||
          !this.isDesktopSessionActive(userId, activation.sessionId)
        ) {
          return null;
        }
        return { sessionId: activation.sessionId, replacedSessionIds: [] };
      }

      const replacedSessionIds = (
        this.raw
          .prepare('SELECT id FROM notex_desktop_sessions WHERE user_id = ? AND active = 1 AND grant_hash <> ?')
          .all(userId, grantHash) as Array<{ id: string }>
      ).map((row) => row.id);
      this.raw
        .prepare(
          `UPDATE notex_desktop_sessions
              SET active = 0, revoked_at = ?, updated_at = ?
            WHERE user_id = ? AND active = 1 AND grant_hash <> ?`,
        )
        .run(now, now, userId, grantHash);

      const existing = this.raw
        .prepare('SELECT id FROM notex_desktop_sessions WHERE user_id = ? AND grant_hash = ?')
        .get(userId, grantHash) as { id: string } | undefined;
      const sessionId = existing?.id ?? randomUUID();
      this.raw
        .prepare(
          `INSERT INTO notex_desktop_sessions(id, user_id, grant_hash, active, created_at, updated_at, revoked_at)
           VALUES (?, ?, ?, 1, ?, ?, NULL)
           ON CONFLICT(user_id, grant_hash) DO UPDATE SET
             active = 1, updated_at = excluded.updated_at, revoked_at = NULL`,
        )
        .run(sessionId, userId, grantHash, now, now);
      this.raw
        .prepare(
          `UPDATE notex_desktop_activations
              SET consumed_at = ?, user_id = ?, session_id = ?
            WHERE token_hash = ? AND consumed_at IS NULL`,
        )
        .run(nowSeconds, userId, sessionId, grantHash);
      return { sessionId, replacedSessionIds };
    })();
  }

  isDesktopSessionActive(userId: string, sessionId: string): boolean {
    return Boolean(
      this.raw
        .prepare('SELECT 1 FROM notex_desktop_sessions WHERE id = ? AND user_id = ? AND active = 1')
        .get(sessionId, userId),
    );
  }

  hasActiveDesktopSession(userId: string): boolean {
    return Boolean(
      this.raw.prepare('SELECT 1 FROM notex_desktop_sessions WHERE user_id = ? AND active = 1').get(userId),
    );
  }

  revokeDesktopSession(userId: string, sessionId: string): boolean {
    const now = new Date().toISOString();
    return (
      this.raw
        .prepare(
          `UPDATE notex_desktop_sessions
              SET active = 0, revoked_at = ?, updated_at = ?
            WHERE id = ? AND user_id = ? AND active = 1`,
        )
        .run(now, now, sessionId, userId).changes === 1
    );
  }

  revokeAllDesktopSessions(userId: string): string[] {
    const sessionIds = (
      this.raw.prepare('SELECT id FROM notex_desktop_sessions WHERE user_id = ? AND active = 1').all(userId) as Array<{
        id: string;
      }>
    ).map((row) => row.id);
    const now = new Date().toISOString();
    this.raw
      .prepare(
        `UPDATE notex_desktop_sessions
            SET active = 0, revoked_at = ?, updated_at = ?
          WHERE user_id = ? AND active = 1`,
      )
      .run(now, now, userId);
    return sessionIds;
  }

  deleteAccountMetadata(userId: string): void {
    this.raw.transaction(() => {
      this.raw.prepare('DELETE FROM notex_desktop_sessions WHERE user_id = ?').run(userId);
      this.raw.prepare('DELETE FROM notex_desktop_activations WHERE user_id = ?').run(userId);
      this.raw.prepare('DELETE FROM notex_pending_registrations WHERE user_id = ?').run(userId);
      this.raw.prepare('DELETE FROM notex_accounts WHERE user_id = ?').run(userId);
    })();
  }

  getSetting(key: string): string | null {
    const row = this.raw.prepare('SELECT value FROM notex_backend_settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined;
    return row?.value ?? null;
  }

  setSetting(key: string, value: string): void {
    this.raw
      .prepare(
        `INSERT INTO notex_backend_settings(key, value, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .run(key, value);
  }

  private cleanupExpiredRegistrationIntents(): void {
    this.raw
      .prepare('DELETE FROM notex_registration_intents WHERE expires_at < ? OR consumed_at IS NOT NULL')
      .run(Math.floor(Date.now() / 1000));
  }
}

export function readCookie(headers: Headers | undefined, name: string): string | null {
  const cookieHeader = headers?.get('cookie');
  if (!cookieHeader) return null;
  for (const item of cookieHeader.split(';')) {
    const separator = item.indexOf('=');
    if (separator < 0) continue;
    if (item.slice(0, separator).trim() !== name) continue;
    return decodeURIComponent(item.slice(separator + 1).trim());
  }
  return null;
}
