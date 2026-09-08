import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { initializeMcpRequestHost } from './mcpRequestHost';

export type McpConnectionState =
  | 'logged_out'
  | 'authorizing'
  | 'connecting'
  | 'online'
  | 'offline'
  | 'error';

export type McpPublicState = {
  state: McpConnectionState;
  email?: string;
  errorCode?: string;
  errorMessage?: string;
};

export type McpAuthorizationMode = 'register' | 'login';

const loggedOutState: McpPublicState = { state: 'logged_out' };

export async function initializeMcpBridge(
  onState: (state: McpPublicState) => void,
): Promise<McpPublicState> {
  if (!isTauri()) {
    onState(loggedOutState);
    return loggedOutState;
  }

  await initializeMcpRequestHost();
  await listen<McpPublicState>('notex://mcp-state', ({ payload }) => {
    onState(payload);
  });

  const state = await invoke<McpPublicState>('notex_mcp_initialize');
  onState(state);
  return state;
}

export async function getMcpState(): Promise<McpPublicState> {
  if (!isTauri()) {
    return loggedOutState;
  }
  return invoke<McpPublicState>('notex_mcp_get_state');
}

export function startMcpAuthorization(mode: McpAuthorizationMode) {
  return invoke<McpPublicState>('notex_mcp_start_authorization', { mode });
}

export function cancelMcpAuthorization() {
  return invoke<McpPublicState>('notex_mcp_cancel_authorization');
}

export function logoutMcp() {
  return invoke<McpPublicState>('notex_mcp_logout');
}

export function revokeMcpAiAccess() {
  return invoke<void>('notex_mcp_revoke_ai_access');
}

export function deleteMcpAccount() {
  return invoke<McpPublicState>('notex_mcp_delete_account');
}
