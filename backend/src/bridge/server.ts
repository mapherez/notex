import type { Server as HttpServer } from 'node:http';

import {
  BRIDGE_HEARTBEAT_INTERVAL_MS,
  BRIDGE_OFFLINE_AFTER_MS,
  MAX_BRIDGE_FRAME_BYTES,
  bridgeAuthenticateSchema,
  bridgeReadySchema,
  bridgeResponseSchema,
} from '@notex/mcp-contract';
import { WebSocketServer, type RawData, type WebSocket } from 'ws';

import type { BackendConfig } from '../config.js';
import type { AppLogger } from '../logger.js';
import { BridgeRegistry, type DesktopConnection } from './registry.js';

function parseFrame(data: RawData): unknown {
  return JSON.parse(data.toString('utf8')) as unknown;
}

export function installBridgeServer(
  server: HttpServer,
  config: BackendConfig,
  registry: BridgeRegistry,
  logger: AppLogger,
): () => Promise<void> {
  const webSocketServer = new WebSocketServer({ noServer: true, maxPayload: MAX_BRIDGE_FRAME_BYTES });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url ?? '/', config.publicUrl);
    if (url.pathname !== '/v1/bridge') return;
    const host = (request.headers.host ?? '').split(':')[0]?.toLowerCase();
    const origin = request.headers.origin;
    if (!host || !config.allowedHosts.includes(host) || (origin && !config.allowedOrigins.includes(origin))) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
      webSocketServer.emit('connection', webSocket, request);
    });
  });

  webSocketServer.on('connection', (socket) => {
    let connection: DesktopConnection | undefined;
    const authenticationTimeout = setTimeout(() => socket.close(4003, 'Authentication timeout.'), 5_000);

    socket.on('pong', () => {
      if (connection) registry.markPong(connection);
    });

    socket.on('message', (data) => {
      try {
        const frame = parseFrame(data);
        if (!connection) {
          const authentication = bridgeAuthenticateSchema.parse(frame);
          const ticket = registry.consumeTicket(authentication.ticket);
          if (!ticket) {
            socket.close(4003, 'Invalid or expired ticket.');
            return;
          }
          clearTimeout(authenticationTimeout);
          connection = registry.attach(ticket.userId, ticket.sessionId, socket);
          socket.send(JSON.stringify({ type: 'authenticated' }));
          return;
        }
        const type = (frame as { type?: unknown }).type;
        if (type === 'ready') {
          const ready = bridgeReadySchema.parse(frame);
          registry.markReady(connection, ready.appVersion);
          return;
        }
        if (type === 'response') {
          registry.acceptResponse(connection, bridgeResponseSchema.parse(frame));
          return;
        }
        socket.close(4002, 'Unsupported bridge frame.');
      } catch {
        socket.close(4002, 'Invalid bridge frame.');
      }
    });

    socket.on('close', () => {
      clearTimeout(authenticationTimeout);
      if (connection) registry.detach(connection);
    });
    socket.on('error', () => {
      if (connection) registry.detach(connection);
    });
  });

  const heartbeat = setInterval(() => {
    registry.closeStaleConnections(BRIDGE_OFFLINE_AFTER_MS);
    for (const socket of webSocketServer.clients) {
      if (socket.readyState === socket.OPEN) socket.ping();
    }
  }, BRIDGE_HEARTBEAT_INTERVAL_MS);
  heartbeat.unref();

  return async () => {
    clearInterval(heartbeat);
    registry.close();
    await new Promise<void>((resolve) => webSocketServer.close(() => resolve()));
    logger.info({ event: 'bridge_closed' });
  };
}

export function closeSocket(socket: WebSocket): void {
  if (socket.readyState === socket.OPEN || socket.readyState === socket.CONNECTING) socket.close();
}
