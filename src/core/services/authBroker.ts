import type { GoogleUserProfile } from '../utils/userProfile';

export type BrokerSessionDevice = {
  id: string;
  name: string;
  userAgent?: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
};

export type BrokerSession =
  | {
      connected: false;
      sessions: [];
    }
  | {
      connected: true;
      currentSessionId: string;
      lastLoginAt: string;
      profile: GoogleUserProfile;
      sessions: BrokerSessionDevice[];
    };

export type BrokerAccessToken = {
  accessToken: string;
  expiresAt: number;
};

export type SyncHintEvent = {
  type: 'sync-hint';
  userId: string;
  deviceId: string;
  timestamp: string;
};

export async function getBrokerSession(): Promise<BrokerSession> {
  const response = await fetch('/api/auth/session', {
    credentials: 'include',
  });

  return readJsonResponse<BrokerSession>(response, 'Could not load auth session');
}

export function startGoogleBrokerLogin(returnTo = getCurrentReturnTo()) {
  const params = new URLSearchParams({ returnTo });
  window.location.assign(`/api/auth/google/start?${params.toString()}`);
}

export async function requestBrokerAccessToken(): Promise<BrokerAccessToken> {
  const response = await fetch('/api/auth/google/token', {
    method: 'POST',
    credentials: 'include',
  });

  return readJsonResponse<BrokerAccessToken>(response, 'Reconnect Google to keep syncing');
}

export async function logoutBrokerSession() {
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });

  await readJsonResponse<{ ok: boolean }>(response, 'Could not log out');
}

export async function removeBrokerSession(sessionId: string) {
  const response = await fetch(`/api/auth/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  await readJsonResponse<{ ok: boolean }>(response, 'Could not remove session');
}

export async function sendSyncHint() {
  const response = await fetch('/api/sync/hint', {
    method: 'POST',
    credentials: 'include',
  });

  await readJsonResponse<{ ok: boolean }>(response, 'Could not notify other devices');
}

async function readJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof payload?.error === 'string' ? payload.error : fallbackMessage;
    throw new Error(formatAuthError(message, fallbackMessage));
  }

  return payload as T;
}

function formatAuthError(error: string, fallbackMessage: string) {
  if (error === 'not_authenticated' || error === 'google_reconnect_required') {
    return 'Reconnect Google to keep syncing';
  }

  return error || fallbackMessage;
}

function getCurrentReturnTo() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}
