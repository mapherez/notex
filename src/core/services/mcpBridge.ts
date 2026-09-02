import { getVersion } from '@tauri-apps/api/app';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  dispatchMcpCommand,
  type McpBridgeRequest,
  type McpBridgeResponse,
} from '../mcp/dispatcher';

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

  const appVersion = await getVersion();
  await listen<McpPublicState>('notex://mcp-state', ({ payload }) => {
    onState(payload);
  });
  await listen<McpBridgeRequest>('notex://mcp-request', ({ payload }) => {
    void respondToBridgeRequest(payload, appVersion);
  });

  const state = await invoke<McpPublicState>('notex_mcp_initialize');
  onState(state);
  return state;
}

async function respondToBridgeRequest(request: McpBridgeRequest, appVersion: string) {
  let response: McpBridgeResponse;
  try {
    response = await dispatchMcpCommand(request, appVersion);
  } catch {
    response = {
      requestId: request.requestId,
      ok: false,
      error: {
        code: 'INTERNAL',
        message: 'An internal error occurred',
        retryable: false,
      },
    };
  }

  try {
    await invoke<void>('notex_mcp_respond', { response });
  } catch {
    // A disconnected bridge fails the in-flight request server-side; there is no replay.
  }
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
