import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./googleConfig', () => ({
  googleConfig: { webClientId: 'web-client' },
  googleScopes: 'openid https://www.googleapis.com/auth/drive.appdata',
  readGoogleAccount: vi.fn(async () => ({ id: 'account', email: 'user@gmail.com', name: 'User' })),
}));

beforeEach(() => { vi.resetModules(); sessionStorage.clear(); });

describe('web authorization across refreshes', () => {
  it('retains a successful authorization across module reload and removes it on logout', async () => {
    const requestAccessToken = vi.fn();
    const google = { accounts: { oauth2: { initTokenClient: vi.fn((options) => {
      requestAccessToken.mockImplementation(() => options.callback({
        access_token: 'test-token', expires_in: 3600, scope: 'https://www.googleapis.com/auth/drive.appdata',
      }));
      return { requestAccessToken };
    }) } } };
    Object.defineProperty(window, 'google', { configurable: true, value: google });
    try {
      const auth = await import('./googleWebAuth');
      await auth.loginGoogleWeb();
      vi.resetModules();
      const refreshed = await import('./googleWebAuth');
      expect(refreshed.googleWebAccessToken('account')).toBe('test-token');
      expect(() => refreshed.googleWebAccessToken('other-account')).toThrow('GOOGLE_REAUTHORIZE');
      refreshed.clearGoogleWebAuthorization();
      vi.resetModules();
      const loggedOut = await import('./googleWebAuth');
      expect(() => loggedOut.googleWebAccessToken('account')).toThrow('GOOGLE_REAUTHORIZE');
      expect(sessionStorage.getItem('notex.googleWebAuthorization')).toBeNull();
    } finally { Reflect.deleteProperty(window, 'google'); }
  });

  it.each([
    '{invalid',
    JSON.stringify({ accountId: 'account', value: 'test-token', expiresAt: Date.now() - 1, clientId: 'web-client' }),
    JSON.stringify({ accountId: 'account', value: 'test-token', expiresAt: Date.now() + 3600_000, clientId: 'another-client' }),
  ])('discards malformed, expired or different-client authorization', async (raw) => {
    sessionStorage.setItem('notex.googleWebAuthorization', raw);
    const auth = await import('./googleWebAuth');
    expect(() => auth.googleWebAccessToken('account')).toThrow('GOOGLE_REAUTHORIZE');
    expect(sessionStorage.getItem('notex.googleWebAuthorization')).toBeNull();
  });
});
