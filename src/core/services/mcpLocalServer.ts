import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { defaultUserSettings } from '../../config/appSettings';
import { initializeMcpRequestHost } from './mcpRequestHost';

export const MIN_LOCAL_MCP_PORT = 1024;
export const MAX_LOCAL_MCP_PORT = 65535;
export const DEFAULT_LOCAL_MCP_PORT = defaultUserSettings.mcpPort;

export type LocalMcpLifecycleState =
  | 'stopped'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'error';

export type LocalMcpPublicState = {
  state: LocalMcpLifecycleState;
  rendererReady: boolean;
  port?: number;
  url?: string;
  errorCode?: string;
  errorMessage?: string;
};

const browserFallbackState: LocalMcpPublicState = {
  state: 'stopped',
  rendererReady: false,
  port: DEFAULT_LOCAL_MCP_PORT,
  url: localMcpUrl(DEFAULT_LOCAL_MCP_PORT),
};

let initialization: Promise<LocalMcpPublicState> | null = null;

export async function initializeLocalMcpServer(
  onState: (state: LocalMcpPublicState) => void,
): Promise<LocalMcpPublicState> {
  if (!isTauri()) {
    onState(browserFallbackState);
    return browserFallbackState;
  }
  if (!initialization) {
    initialization = installLocalMcpServer(onState).catch((error) => {
      initialization = null;
      throw error;
    });
  }
  return initialization;
}

async function installLocalMcpServer(
  onState: (state: LocalMcpPublicState) => void,
): Promise<LocalMcpPublicState> {
  await initializeMcpRequestHost();
  await listen<LocalMcpPublicState>('notex://mcp-local-state', ({ payload }) => {
    onState(payload);
  });

  const state = await invoke<LocalMcpPublicState>('notex_local_mcp_set_renderer_ready', {
    ready: true,
  });
  onState(state);
  return state;
}

export async function getLocalMcpState(): Promise<LocalMcpPublicState> {
  if (!isTauri()) {
    return browserFallbackState;
  }
  return invoke<LocalMcpPublicState>('notex_local_mcp_get_state');
}

export function startLocalMcpServer(port: number) {
  return invoke<LocalMcpPublicState>('notex_local_mcp_start', { port });
}

export function stopLocalMcpServer() {
  return invoke<LocalMcpPublicState>('notex_local_mcp_stop');
}

export function localMcpUrl(port: number) {
  return `http://127.0.0.1:${port}/mcp`;
}

export function isValidLocalMcpPort(value: number) {
  return Number.isInteger(value) && value >= MIN_LOCAL_MCP_PORT && value <= MAX_LOCAL_MCP_PORT;
}
