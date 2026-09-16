import { googleConfig, googleScopes, readGoogleAccount, type GoogleAccount } from './googleConfig';

type TokenResponse = { access_token?: string; expires_in?: number; scope?: string; error?: string };
type TokenClient = { requestAccessToken: (options: { prompt: string; hint?: string }) => void };
type GoogleIdentity = { accounts: { oauth2: { initTokenClient: (options: {
  client_id: string; scope: string; callback: (response: TokenResponse) => void;
  error_callback: (error: { type: string }) => void;
}) => TokenClient } } };

let loading: Promise<void> | undefined;
let cached: { accountId: string; value: string; expiresAt: number } | undefined;
let authorization: { reject: (error: Error) => void } | undefined;
let generation = 0;
const identity = () => (window as Window & { google?: GoogleIdentity }).google;

// Load before enabling the button, so requestAccessToken runs directly within
// the click gesture (awaiting script loading there can lose popup permission).
export function prepareGoogleWebLogin(): Promise<void> {
  if (!googleConfig.webClientId) return Promise.reject(new Error('GOOGLE_NOT_CONFIGURED'));
  if (identity()) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    let timer: ReturnType<typeof setTimeout>;
    const finish = (error?: Error) => {
      clearTimeout(timer);
      script.onload = null; script.onerror = null;
      if (error) { script.remove(); reject(error); } else resolve();
    };
    script.onload = () => finish(identity() ? undefined : new Error('GOOGLE_NETWORK_ERROR'));
    script.onerror = () => finish(new Error('GOOGLE_NETWORK_ERROR'));
    timer = setTimeout(() => finish(new Error('GOOGLE_NETWORK_ERROR')), 20_000);
    document.head.append(script);
  }).catch((error) => { loading = undefined; throw error; });
  return loading;
}

export function loginGoogleWeb(expectedAccountId?: string): Promise<GoogleAccount> {
  if (authorization) return Promise.reject(new Error('GOOGLE_LOGIN_IN_PROGRESS'));
  const google = identity();
  if (!googleConfig.webClientId) return Promise.reject(new Error('GOOGLE_NOT_CONFIGURED'));
  if (!google) return Promise.reject(new Error('GOOGLE_NETWORK_ERROR'));
  const attempt = ++generation;
  return new Promise<GoogleAccount>((resolve, reject) => {
    const finish = (account?: GoogleAccount, error?: Error) => {
      if (generation !== attempt) return;
      generation += 1;
      clearTimeout(timer);
      authorization = undefined;
      if (error) reject(error); else resolve(account!);
    };
    const timer = setTimeout(() => finish(undefined, new Error('GOOGLE_AUTH_TIMEOUT')), 180_000);
    authorization = { reject: (error) => finish(undefined, error) };
    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: googleConfig.webClientId, scope: googleScopes,
        callback: (response) => {
          if (generation !== attempt) return;
          if (response.error || !response.access_token || !response.expires_in) {
            finish(undefined, new Error('GOOGLE_AUTH_CANCELLED')); return;
          }
          if (!response.scope?.split(' ').includes('https://www.googleapis.com/auth/drive.appdata')) {
            finish(undefined, new Error('GOOGLE_DRIVE_PERMISSION_REQUIRED')); return;
          }
          const token = response.access_token;
          void readGoogleAccount(token).then((account) => {
            if (generation !== attempt) return;
            if (expectedAccountId && account.id !== expectedAccountId) {
              finish(undefined, new Error('GOOGLE_ACCOUNT_MISMATCH')); return;
            }
            cached = { accountId: account.id, value: token, expiresAt: Date.now() + Math.max(0, response.expires_in! - 60) * 1000 };
            finish(account);
          }).catch(() => finish(undefined, new Error('GOOGLE_PROFILE_ERROR')));
        },
        error_callback: (error) => finish(undefined, new Error(error.type === 'popup_closed' ? 'GOOGLE_AUTH_CANCELLED' : 'GOOGLE_POPUP_BLOCKED')),
      });
      client.requestAccessToken({ prompt: 'select_account', ...(expectedAccountId ? { hint: expectedAccountId } : {}) });
    } catch { finish(undefined, new Error('GOOGLE_POPUP_BLOCKED')); }
  });
}

export function googleWebAccessToken(accountId: string): string {
  if (!cached || cached.accountId !== accountId || cached.expiresAt <= Date.now()) throw new Error('GOOGLE_REAUTHORIZE');
  return cached.value;
}

export function clearGoogleWebAuthorization() {
  authorization?.reject(new Error('GOOGLE_AUTH_CANCELLED'));
  cached = undefined;
  generation += 1;
}
