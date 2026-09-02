import type { Server as HttpServer } from 'node:http';

import {
  BRIDGE_HEARTBEAT_INTERVAL_MS,
  BRIDGE_OFFLINE_AFTER_MS,
  MAX_BRIDGE_FRAME_BYTES,
  parseDesktopBridgeFrame,
  type BridgeFrame,
} from '@notex/mcp-contract';
import { WebSocketServer, type RawData, type WebSocket } from 'ws';

import type { BackendConfig } from '../config.js';
import type { AppLogger } from '../logger.js';
import { BridgeRegistry, type DesktopConnection } from './registry.js';

function toBridgeFrame(data: RawData): BridgeFrame {
  if (data instanceof ArrayBuffer) return data;
  const bytes = Array.isArray(data) ? Buffer.concat(data) : data;
  return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function getHostname(host: string | undefined): string | null {
  if (!host) return null;
  try {
    return new URL(`http://${host}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function installBridgeServer(
  server: HttpServer,
  config: BackendConfig,
  registry: BridgeRegistry,
  logger: AppLogger,
): () => Promise<void> {
  const webSocketServer = new WebSocketServer({ noServer: true, maxPayload: MAX_BRIDGE_FRAME_BYTES });

  server.on('upgrade', (request, socket, head) => {
    let url: URL;
    try {
      url = new URL(request.url ?? '/', config.publicUrl);
    } catch {
      socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    if (url.pathname !== '/v1/bridge') {
      socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    const host = getHostname(request.headers.host);
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
        const frame = parseDesktopBridgeFrame(toBridgeFrame(data));
        if (!connection) {
          if (frame.type !== 'authenticate') {
            socket.close(4002, 'Expected authentication frame.');
            return;
          }
          const ticket = registry.consumeTicket(frame.ticket);
          if (!ticket) {
            socket.close(4003, 'Invalid or expired ticket.');
            return;
          }
          clearTimeout(authenticationTimeout);
          connection = registry.attach(ticket.userId, ticket.sessionId, socket);
          socket.send(JSON.stringify({ type: 'authenticated' }));
          return;
        }
        if (frame.type === 'ready') {
          registry.markReady(connection, frame.appVersion);
          return;
        }
        if (frame.type === 'response') {
          registry.acceptResponse(connection, frame);
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
