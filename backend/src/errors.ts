import { bridgeErrorMessages, type BridgeError, type BridgeErrorCode } from '@notex/mcp-contract';
import { z } from 'zod';
import { McpError } from '@nox/mcp/contract';

export class PublicBridgeError extends Error {
  readonly code: BridgeErrorCode;
  readonly retryable: boolean;
  readonly currentVersion?: number;

  constructor(code: BridgeErrorCode, options: { retryable?: boolean; currentVersion?: number; message?: string } = {}) {
    super(options.message ?? bridgeErrorMessages[code]);
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
  if (error instanceof McpError) {
    const code = error.code === 'CANCELLED' || error.code === 'APP_OFFLINE' ? 'NOTEX_OFFLINE' : error.code;
    return new PublicBridgeError(code in bridgeErrorMessages ? code as BridgeErrorCode : 'INTERNAL', { retryable: error.retryable });
  }
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
