import type { BridgeError, BridgeErrorCode } from '@notex/mcp-contract';
import { z } from 'zod';

const publicMessages: Record<BridgeErrorCode, string> = {
  USER_NOT_LOGGED_IN: 'User not logged in',
  NOTEX_OFFLINE: 'NoteX is offline',
  FORBIDDEN: 'The requested operation is not allowed',
  NOT_FOUND: 'The requested item was not found',
  READ_ONLY_TRASH: 'Notes in trash are read-only',
  CONFLICT: 'The note has changed; refresh it before trying again',
  LOCAL_EDITS_PENDING: 'The note has unsaved local edits',
  INVALID_INPUT: 'Invalid input',
  UNSUPPORTED_CONTENT: 'The content contains unsupported elements',
  TIMEOUT: 'NoteX did not respond in time',
  INTERNAL: 'An internal error occurred',
};

export class PublicBridgeError extends Error {
  readonly code: BridgeErrorCode;
  readonly retryable: boolean;
  readonly currentVersion?: number;

  constructor(code: BridgeErrorCode, options: { retryable?: boolean; currentVersion?: number; message?: string } = {}) {
    super(options.message ?? publicMessages[code]);
    this.name = 'PublicBridgeError';
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.currentVersion = options.currentVersion;
  }

  toBridgeError(): BridgeError {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      ...(this.currentVersion === undefined ? {} : { currentVersion: this.currentVersion }),
    };
  }
}

export function asPublicBridgeError(error: unknown): PublicBridgeError {
  if (error instanceof PublicBridgeError) return error;
  if (error instanceof z.ZodError) return new PublicBridgeError('INVALID_INPUT');
  return new PublicBridgeError('INTERNAL');
}

export function publicErrorHttpStatus(code: BridgeErrorCode): number {
  switch (code) {
    case 'INVALID_INPUT':
      return 400;
    case 'USER_NOT_LOGGED_IN':
      return 401;
    case 'FORBIDDEN':
      return 403;
    case 'NOT_FOUND':
      return 404;
    case 'CONFLICT':
    case 'LOCAL_EDITS_PENDING':
      return 409;
    case 'TIMEOUT':
      return 504;
    default:
      return 500;
  }
}
