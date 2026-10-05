import { BridgeRegistry as NoXBridgeRegistry, type BridgeConnection } from '@nox/mcp/bridge';
import { BRIDGE_PROTOCOL_VERSION, bridgeResponseSchema, commandScope, parseCommandInput, parseCommandOutput, type CommandName, type CommandOutput, type BridgeErrorCode } from '@notex/mcp-contract';
import type { BackendDatabase } from '../database.js';
import { PublicBridgeError } from '../errors.js';

export type DesktopConnection = BridgeConnection;
/** NoteX owns domain schemas, public error names and its offline status tool. */
export class BridgeRegistry extends NoXBridgeRegistry {
  constructor(database: BackendDatabase) {
    super({ appId: 'notex', sessions: database, responseSchema: bridgeResponseSchema,
      parseInput: (command, input) => parseCommandInput(command as CommandName, input),
      parseOutput: (command, output) => parseCommandOutput(command as CommandName, output),
      isReadOnly: command => commandScope[command as CommandName] === 'notex:read',
      error: (code, options) => new PublicBridgeError((({ APP_OFFLINE: 'NOTEX_OFFLINE', CANCELLED: 'NOTEX_OFFLINE', OVERLOADED: 'INTERNAL' } as Record<string, string>)[code] ?? code) as BridgeErrorCode, options),
    });
  }
  override async dispatch<T extends CommandName>(userId: string, command: T, input: unknown, options: { signal?: AbortSignal; deadlineAt?: string } = {}): Promise<CommandOutput<T>> {
    if (command === 'notex_status') {
      parseCommandInput(command, input);
      const presence = this.getPresence(userId);
      if (!presence.loggedIn) throw new PublicBridgeError('USER_NOT_LOGGED_IN');
      if (!presence.online) return { state: 'offline', protocolVersion: BRIDGE_PROTOCOL_VERSION } as CommandOutput<T>;
    }
    return await super.dispatch(userId, command, input, options) as CommandOutput<T>;
  }
}
