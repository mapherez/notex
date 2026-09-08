import { createHmac, randomUUID } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';
import pino from 'pino';

import type { BackendConfig } from './config.js';

export function createLogger(config: BackendConfig) {
  return pino({
    level: config.logLevel,
    base: undefined,
    redact: {
      paths: ['authorization', 'cookie', '*.authorization', '*.cookie', '*.email', '*.body', '*.query'],
      censor: '[REDACTED]',
    },
  });
}

export type AppLogger = ReturnType<typeof createLogger>;

export function accountFingerprint(secret: string, userId: string): string {
  return createHmac('sha256', secret).update(userId).digest('hex').slice(0, 16);
}

export function requestLogMiddleware(logger: AppLogger) {
  return (request: Request, response: Response, next: NextFunction) => {
    const startedAt = performance.now();
    const requestId = request.header('x-request-id')?.slice(0, 128) || randomUUID();
    response.setHeader('x-request-id', requestId);

    response.once('finish', () => {
      logger.info({
        requestId,
        method: request.method,
        path: request.path,
        statusCode: response.statusCode,
        durationMs: Math.round(performance.now() - startedAt),
      });
    });

    next();
  };
}
