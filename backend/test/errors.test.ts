import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { asPublicBridgeError, publicErrorHttpStatus } from '../src/errors.js';

describe('public backend errors', () => {
  it('maps schema failures without exposing Zod details', () => {
    const error = z.object({ value: z.string() }).safeParse({ value: 1 }).error;
    const publicError = asPublicBridgeError(error);

    expect(publicError.toBridgeError()).toEqual({
      code: 'INVALID_INPUT',
      message: 'Invalid input',
      retryable: false,
    });
    expect(publicErrorHttpStatus(publicError.code)).toBe(400);
  });

  it('uses server errors for unexpected failures', () => {
    const publicError = asPublicBridgeError(new Error('secret implementation detail'));
    expect(publicError.code).toBe('INTERNAL');
    expect(publicError.message).toBe('An internal error occurred');
    expect(publicErrorHttpStatus(publicError.code)).toBe(500);
  });
});
