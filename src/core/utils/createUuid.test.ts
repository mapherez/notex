import { afterEach, describe, expect, it, vi } from 'vitest';
import { createUuid } from './createUuid';

afterEach(() => { vi.unstubAllGlobals(); });

describe('local identifiers', () => {
  it('preserves the native UUID generator when available', () => {
    const randomUUID = vi.fn(() => 'native-uuid');
    const getRandomValues = vi.fn();
    vi.stubGlobal('crypto', { randomUUID, getRandomValues });
    expect(createUuid()).toBe('native-uuid');
    expect(getRandomValues).not.toHaveBeenCalled();
  });

  it('creates a v4 UUID with secure random bytes when randomUUID is unavailable on LAN HTTP', () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => bytes.fill(255));
    vi.stubGlobal('crypto', { getRandomValues });
    expect(createUuid()).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
    expect(getRandomValues).toHaveBeenCalledOnce();
  });
});
