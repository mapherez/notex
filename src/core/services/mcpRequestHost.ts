import { getVersion } from '@tauri-apps/api/app';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  dispatchMcpCommand,
  type McpBridgeRequest,
  type McpBridgeResponse,
} from '../mcp/dispatcher';

let initialization: Promise<void> | null = null;

export async function initializeMcpRequestHost(): Promise<void> {
  if (!isTauri()) {
    return;
  }
  if (!initialization) {
    initialization = installMcpRequestHost().catch((error) => {
      initialization = null;
      throw error;
    });
  }
  await initialization;
}

async function installMcpRequestHost() {
  const appVersion = await getVersion();
  await listen<McpBridgeRequest>('notex://mcp-request', ({ payload }) => {
    void respondToMcpRequest(payload, appVersion);
  });
}

async function respondToMcpRequest(request: McpBridgeRequest, appVersion: string) {
  let response: McpBridgeResponse;
  try {
    // A renderer event may arrive after stop or timeout; never execute stale local work.
    const isActive = () => invoke<boolean>('notex_mcp_request_pending', { requestId: request.requestId, generation: request.generation ?? null });
    if (!(await isActive())) {
      return;
    }
    response = await dispatchMcpCommand({ ...request, isActive }, appVersion);
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
    await invoke<void>('notex_mcp_respond', { response: { ...response, generation: request.generation } });
  } catch {
    // The transport owns failure and cancellation; renderer responses are never replayed.
  }
}
