export const googleConfig = Object.freeze({
  webClientId: (import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID ?? '').trim(),
  desktopClientId: (import.meta.env.VITE_GOOGLE_DESKTOP_CLIENT_ID ?? '').trim(),
  webOrigin: (import.meta.env.VITE_GOOGLE_WEB_ORIGIN ?? '').trim().replace(/\/$/, ''),
});

export const googleScopes = 'openid email profile https://www.googleapis.com/auth/drive.appdata';

export type GoogleAccount = { id: string; email: string; name: string; picture?: string };

export async function readGoogleAccount(accessToken: string, signal?: AbortSignal): Promise<GoogleAccount> {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }, signal,
  });
  if (!response.ok) throw new Error('Google account verification failed');
  const profile = await response.json();
  if (typeof profile.sub !== 'string' || typeof profile.email !== 'string' || profile.email_verified !== true) {
    throw new Error('A verified Google account is required');
  }
  return { id: profile.sub, email: profile.email, name: typeof profile.name === 'string' ? profile.name : profile.email,
    picture: typeof profile.picture === 'string' ? profile.picture : undefined };
}
