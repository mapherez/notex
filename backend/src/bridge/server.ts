import type { Server } from 'node:http';
import { installBridgeServer as installGateway } from '@nox/mcp/bridge/server';
import { parseDesktopBridgeFrame } from '@notex/mcp-contract';
import type { BackendConfig } from '../config.js';
import type { AppLogger } from '../logger.js';
import type { BridgeRegistry } from './registry.js';
export { closeSocket } from '@nox/mcp/bridge/server';
export function installBridgeServer(server: Server, config: BackendConfig, registry: BridgeRegistry, logger: AppLogger) {
  return installGateway(server, { ...config, parseDesktopFrame: parseDesktopBridgeFrame }, registry, logger);
}
