import { afterEach, describe, expect, it } from 'vitest';

import { BackendDatabase } from '../src/database.js';

const databases: BackendDatabase[] = [];

function createDatabase(): BackendDatabase {
  const database = new BackendDatabase(':memory:');
  database.migrate();
  databases.push(database);
  return database;
}

function registerAccount(database: BackendDatabase, userId = 'user-1', email = 'person@example.com'): void {
  const intent = database.createRegistrationIntent('ABCD-EFGH');
  expect(database.consumeRegistrationIntent(intent.token, userId, email)).toBe(true);
  database.completeGoogleRegistration({ userId, subject: `google-${userId}` });
}

afterEach(() => {
  while (databases.length > 0) databases.pop()?.close();
});

describe('BackendDatabase', () => {
  it('creates only backend metadata tables and no note-content schema', () => {
    const database = createDatabase();
    const tables = (
      database.raw
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
        .all() as Array<{ name: string }>
    ).map(({ name }) => name);

    expect(tables).toEqual([
      'notex_accounts',
      'notex_backend_migrations',
      'notex_backend_settings',
      'notex_desktop_activations',
      'notex_desktop_sessions',
      'notex_pending_registrations',
      'notex_registration_intents',
    ]);
    const schema = (
      database.raw.prepare("SELECT group_concat(sql, ' ') AS sql FROM sqlite_master WHERE type = 'table'").get() as {
        sql: string;
      }
    ).sql;
    expect(schema).not.toMatch(/\b(note_id|title|content|tag_id|collection_id)\b/i);
  });

  it('consumes a registration intent once and persists the canonical Google identity', () => {
    const database = createDatabase();
    const intent = database.createRegistrationIntent('ABCD-EFGH');

    expect(database.consumeRegistrationIntent(intent.token, 'user-1', 'person@example.com')).toBe(true);
    expect(database.consumeRegistrationIntent(intent.token, 'user-2', 'other@example.com')).toBe(false);
    expect(database.hasPendingRegistration('user-1')).toBe(true);

    database.completeGoogleRegistration({ userId: 'user-1', subject: 'google-subject-1' });
    expect(database.getAccount('user-1')).toEqual({
      userId: 'user-1',
      issuer: 'https://accounts.google.com',
      subject: 'google-subject-1',
      email: 'person@example.com',
    });
    expect(database.hasPendingRegistration('user-1')).toBe(false);
  });

  it('rejects unknown registration intents without creating pending state', () => {
    const database = createDatabase();
    expect(database.consumeRegistrationIntent('not-a-real-token', 'user-1', 'person@example.com')).toBe(false);
    expect(database.hasPendingRegistration('user-1')).toBe(false);
    expect(database.getAccount('user-1')).toBeNull();
  });

  it('atomically replaces the previous desktop session for one account', () => {
    const database = createDatabase();
    registerAccount(database);

    const firstActivation = database.createDesktopActivation();
    const first = database.activateDesktopSession('user-1', firstActivation.token);
    expect(first).not.toBeNull();
    if (!first) throw new Error('First activation failed.');
    expect(database.isDesktopSessionActive('user-1', first.sessionId)).toBe(true);

    const secondActivation = database.createDesktopActivation();
    const second = database.activateDesktopSession('user-1', secondActivation.token);
    expect(second).not.toBeNull();
    if (!second) throw new Error('Second activation failed.');
    expect(second.replacedSessionIds).toEqual([first.sessionId]);
    expect(database.isDesktopSessionActive('user-1', first.sessionId)).toBe(false);
    expect(database.isDesktopSessionActive('user-1', second.sessionId)).toBe(true);
  });

  it('retries a consumed activation only while its session remains active', () => {
    const database = createDatabase();
    registerAccount(database);
    const activation = database.createDesktopActivation();
    const first = database.activateDesktopSession('user-1', activation.token);
    expect(first).not.toBeNull();
    if (!first) throw new Error('Activation failed.');
    const retried = database.activateDesktopSession('user-1', activation.token);

    expect(retried?.sessionId).toBe(first.sessionId);
    expect(retried?.replacedSessionIds).toEqual([]);

    const replacement = database.createDesktopActivation();
    expect(database.activateDesktopSession('user-1', replacement.token)).not.toBeNull();
    expect(database.activateDesktopSession('user-1', activation.token)).toBeNull();
    expect(database.activateDesktopSession('user-2', activation.token)).toBeNull();
    expect(database.activateDesktopSession('user-1', 'unknown-token')).toBeNull();
  });

  it('deletes only remote MCP metadata for the selected account', () => {
    const database = createDatabase();
    registerAccount(database, 'user-1');
    registerAccount(database, 'user-2', 'second@example.com');
    database.activateDesktopSession('user-1', database.createDesktopActivation().token);
    database.activateDesktopSession('user-2', database.createDesktopActivation().token);

    database.deleteAccountMetadata('user-1');

    expect(database.getAccount('user-1')).toBeNull();
    expect(database.hasActiveDesktopSession('user-1')).toBe(false);
    expect(database.getAccount('user-2')).not.toBeNull();
    expect(database.hasActiveDesktopSession('user-2')).toBe(true);
  });
});
