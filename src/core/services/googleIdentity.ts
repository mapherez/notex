import type { GoogleUserProfile } from '../utils/userProfile';

const GOOGLE_IDENTITY_SCRIPT = 'https://accounts.google.com/gsi/client';
const GOOGLE_USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo';
const GOOGLE_DRIVE_APPDATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const GOOGLE_PROFILE_SCOPES = 'openid email profile';

type TokenClientConfig = {
  client_id: string;
  scope: string;
  prompt?: string;
  callback: (response: GoogleTokenResponse) => void;
  error_callback?: (error: unknown) => void;
};

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type TokenClient = {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: TokenClientConfig) => TokenClient;
        };
      };
    };
  }
}

let scriptPromise: Promise<void> | null = null;
let tokenClient: TokenClient | null = null;

export type GoogleConnection = {
  accessToken: string;
  expiresAt: number;
  profile: GoogleUserProfile;
};

export async function requestGoogleConnection(prompt: 'consent' | '' = 'consent'): Promise<GoogleConnection> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  if (!clientId) {
    throw new Error('Missing VITE_GOOGLE_CLIENT_ID');
  }

  await loadGoogleIdentityScript();
  const token = await requestAccessToken(clientId, prompt);
  const profile = await fetchGoogleProfile(token.accessToken);

  return {
    ...token,
    profile,
  };
}

async function loadGoogleIdentityScript() {
  if (window.google?.accounts?.oauth2) {
    return;
  }

  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_IDENTITY_SCRIPT}"]`);
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('Google Identity script failed to load')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = GOOGLE_IDENTITY_SCRIPT;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Google Identity script failed to load'));
      document.head.append(script);
    });
  }

  await scriptPromise;

  if (!window.google?.accounts?.oauth2) {
    throw new Error('Google Identity Services unavailable');
  }
}

function requestAccessToken(clientId: string, prompt: 'consent' | '') {
  return new Promise<{ accessToken: string; expiresAt: number }>((resolve, reject) => {
    tokenClient = window.google?.accounts?.oauth2?.initTokenClient({
      client_id: clientId,
      scope: `${GOOGLE_PROFILE_SCOPES} ${GOOGLE_DRIVE_APPDATA_SCOPE}`,
      prompt,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error_description || response.error || 'Google authorization failed'));
          return;
        }

        resolve({
          accessToken: response.access_token,
          expiresAt: Date.now() + Math.max(0, (response.expires_in ?? 3600) - 60) * 1000,
        });
      },
      error_callback: (error) => reject(error instanceof Error ? error : new Error('Google authorization failed')),
    }) ?? null;

    tokenClient?.requestAccessToken({ prompt });
  });
}

async function fetchGoogleProfile(accessToken: string): Promise<GoogleUserProfile> {
  const response = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Could not load Google profile');
  }

  return response.json() as Promise<GoogleUserProfile>;
}
