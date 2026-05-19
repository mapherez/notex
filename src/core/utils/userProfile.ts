import type { User } from '../models/models';

export type GoogleUserProfile = {
  sub: string;
  name: string;
  given_name?: string;
  email: string;
  picture?: string;
};

export function deriveHandleFromEmail(email?: string) {
  const localPart = email?.split('@')[0]?.trim().toLowerCase() ?? '';
  const normalized = localPart
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]/g, '');

  return normalized ? `@${normalized}` : '@local';
}

export function buildGoogleUser(profile: GoogleUserProfile, lastLoginAt = new Date().toISOString()): User {
  const firstName = profile.given_name?.trim() || profile.name.trim().split(/\s+/)[0] || profile.email.split('@')[0];

  return {
    id: `google-${profile.sub}`,
    googleSub: profile.sub,
    provider: 'google',
    name: profile.name,
    firstName,
    email: profile.email,
    avatarUrl: profile.picture,
    handle: deriveHandleFromEmail(profile.email),
    lastLoginAt,
  };
}

export function getDisplayFirstName(user?: User | null) {
  return user?.firstName || user?.name.split(/\s+/)[0] || user?.email?.split('@')[0] || 'user';
}
