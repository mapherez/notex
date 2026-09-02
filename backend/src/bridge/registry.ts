import { randomBytes, randomUUID } from 'node:crypto';

import {
  BRIDGE_PROTOCOL_VERSION,
  BRIDGE_REQUEST_TIMEOUT_MS,
  BRIDGE_TICKET_TTL_SECONDS,
  bridgeResponseSchema,
  parseCommandInput,
  parseCommandOutput,
  type BridgeResponse,
  type CommandInput,
  type CommandName,
  type CommandOutput,
} from '@notex/mcp-contract';
import type { WebSocket } from 'ws';

import type { BackendDatabase } from '../database.js';
import { PublicBridgeError } from '../errors.js';

interface Ticket {
  userId: string;
  sessionId: string;
  expiresAt: number;
}

interface PendingRequest {
  command: CommandName;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timeout: NodeJS.Timeout;
}

export interface DesktopConnection {
  userId: string;
  sessionId: string;
  socket: WebSocket;
  ready: boolean;
  appVersion?: string;
  lastPongAt: number;
  pending: Map<string, PendingRequest>;
}

export class BridgeRegistry {
  private readonly tickets = new Map<string, Ticket>();
  private readonly connections = new Map<string, DesktopConnection>();

  constructor(private readonly database: BackendDatabase) {}

  issueTicket(userId: string, sessionId: string): { ticket: string; expiresIn: number } {
    if (!this.database.isDesktopSessionActive(userId, sessionId)) {
      throw new PublicBridgeError('USER_NOT_LOGGED_IN');
    }
    this.cleanupTickets();
    const ticket = randomBytes(32).toString('base64url');
    this.tickets.set(ticket, {
      userId,
      sessionId,
      expiresAt: Date.now() + BRIDGE_TICKET_TTL_SECONDS * 1000,
    });
    return { ticket, expiresIn: BRIDGE_TICKET_TTL_SECONDS };
  }

  consumeTicket(ticket: string): Ticket | null {
    const value = this.tickets.get(ticket);
    this.tickets.delete(ticket);
    if (!value || value.expiresAt < Date.now()) return null;
    if (!this.database.isDesktopSessionActive(value.userId, value.sessionId)) return null;
    return value;
  }

  attach(userId: string, sessionId: string, socket: WebSocket): DesktopConnection {
    const current = this.connections.get(userId);
    if (current && current.socket !== socket) {
      this.closeConnection(current, new PublicBridgeError('NOTEX_OFFLINE'), 'A newer NoteX connection replaced this one.');
    }
    const connection: DesktopConnection = {
      userId,
      sessionId,
      socket,
      ready: false,
      lastPongAt: Date.now(),
      pending: new Map(),
    };
    this.connections.set(userId, connection);
    return connection;
  }

  markReady(connection: DesktopConnection, appVersion: string): void {
    if (!this.database.isDesktopSessionActive(connection.userId, connection.sessionId)) {
      throw new PublicBridgeError('USER_NOT_LOGGED_IN');
    }
    connection.ready = true;
    connection.appVersion = appVersion;
  }

  markPong(connection: DesktopConnection): void {
    connection.lastPongAt = Date.now();
  }

  detach(connection: DesktopConnection): void {
    if (this.connections.get(connection.userId) === connection) {
      this.connections.delete(connection.userId);
    }
    this.rejectPending(connection, new PublicBridgeError('NOTEX_OFFLINE'));
  }

  revokeUserConnection(userId: string, reason = 'Desktop session revoked.'): void {
    const connection = this.connections.get(userId);
    if (!connection) return;
    try {
      connection.socket.send(JSON.stringify({ type: 'session_revoked', reason }));
    } finally {
      this.closeConnection(connection, new PublicBridgeError('USER_NOT_LOGGED_IN'), reason);
    }
  }

  getPresence(userId: string): { loggedIn: boolean; online: boolean; appVersion?: string } {
    const loggedIn = this.database.hasActiveDesktopSession(userId);
    const connection = this.connections.get(userId);
    return {
      loggedIn,
      online: Boolean(loggedIn && connection?.ready && connection.socket.readyState === connection.socket.OPEN),
      ...(connection?.appVersion ? { appVersion: connection.appVersion } : {}),
    };
  }

  async dispatch<T extends CommandName>(userId: string, command: T, rawInput: unknown): Promise<CommandOutput<T>> {
    const input = parseCommandInput(command, rawInput) as CommandInput<T>;
    const presence = this.getPresence(userId);
    if (!presence.loggedIn) throw new PublicBridgeError('USER_NOT_LOGGED_IN');

    const connection = this.connections.get(userId);
    if (!connection?.ready || connection.socket.readyState !== connection.socket.OPEN) {
      if (command === 'notex_status') {
        return {
          state: 'offline',
          protocolVersion: BRIDGE_PROTOCOL_VERSION,
        } as CommandOutput<T>;
      }
      throw new PublicBridgeError('NOTEX_OFFLINE', { retryable: true });
    }
    if (!this.database.isDesktopSessionActive(userId, connection.sessionId)) {
      this.revokeUserConnection(userId);
      throw new PublicBridgeError('USER_NOT_LOGGED_IN');
    }

    const requestId = randomUUID();
    const deadlineAt = new Date(Date.now() + BRIDGE_REQUEST_TIMEOUT_MS).toISOString();
    const result = await new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => {
        connection.pending.delete(requestId);
        reject(new PublicBridgeError('TIMEOUT', { retryable: true }));
      }, BRIDGE_REQUEST_TIMEOUT_MS);
      connection.pending.set(requestId, { command, resolve, reject, timeout });
      connection.socket.send(
        JSON.stringify({ type: 'request', requestId, command, input, deadlineAt }),
        (error) => {
          if (!error) return;
          clearTimeout(timeout);
          connection.pending.delete(requestId);
          reject(new PublicBridgeError('NOTEX_OFFLINE', { retryable: true }));
        },
      );
    });
    return parseCommandOutput(command, result);
  }

  acceptResponse(connection: DesktopConnection, rawResponse: unknown): void {
    const response = bridgeResponseSchema.parse(rawResponse) as BridgeResponse;
    const pending = connection.pending.get(response.requestId);
    if (!pending) return;
    connection.pending.delete(response.requestId);
    clearTimeout(pending.timeout);
    if (response.ok) {
      try {
        pending.resolve(parseCommandOutput(pending.command, response.result));
      } catch {
        pending.reject(new PublicBridgeError('INTERNAL'));
      }
      return;
    }
    pending.reject(
      new PublicBridgeError(response.error.code, {
        retryable: response.error.retryable,
        currentVersion: response.error.currentVersion,
        message: response.error.message,
      }),
    );
  }

  closeStaleConnections(offlineAfterMs: number): void {
    const threshold = Date.now() - offlineAfterMs;
    for (const connection of this.connections.values()) {
      if (connection.lastPongAt < threshold) {
        this.closeConnection(connection, new PublicBridgeError('NOTEX_OFFLINE'), 'Heartbeat timed out.');
      }
    }
  }

  close(): void {
    this.tickets.clear();
    for (const connection of [...this.connections.values()]) {
      this.closeConnection(connection, new PublicBridgeError('NOTEX_OFFLINE'), 'Backend is shutting down.');
    }
  }

  private closeConnection(connection: DesktopConnection, error: PublicBridgeError, reason: string): void {
    this.detach(connection);
    connection.socket.close(4001, reason.slice(0, 120));
    this.rejectPending(connection, error);
  }

  private rejectPending(connection: DesktopConnection, error: PublicBridgeError): void {
    for (const pending of connection.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    connection.pending.clear();
  }

  private cleanupTickets(): void {
    const now = Date.now();
    for (const [ticket, value] of this.tickets) {
      if (value.expiresAt < now) this.tickets.delete(ticket);
    }
  }
}
