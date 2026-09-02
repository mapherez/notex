export type McpBridgeRequest = {
  requestId: string;
  command: string;
  input: unknown;
  deadlineAt: string;
};

export type McpBridgeError = {
  code:
    | 'USER_NOT_LOGGED_IN'
    | 'NOTEX_OFFLINE'
    | 'FORBIDDEN'
    | 'NOT_FOUND'
    | 'READ_ONLY_TRASH'
    | 'CONFLICT'
    | 'LOCAL_EDITS_PENDING'
    | 'INVALID_INPUT'
    | 'UNSUPPORTED_CONTENT'
    | 'TIMEOUT'
    | 'INTERNAL';
  message: string;
  retryable: boolean;
  currentVersion?: number;
};

export type McpBridgeResponse =
  | { requestId: string; ok: true; result: unknown }
  | { requestId: string; ok: false; error: McpBridgeError };

export async function dispatchMcpCommand(
  request: McpBridgeRequest,
  appVersion: string,
): Promise<McpBridgeResponse> {
  const deadline = Date.parse(request.deadlineAt);
  if (!Number.isFinite(deadline) || deadline <= Date.now()) {
    return failure(request.requestId, 'TIMEOUT', 'NoteX did not respond in time', true);
  }

  if (request.command === 'notex_status') {
    return {
      requestId: request.requestId,
      ok: true,
      result: {
        state: 'online',
        appVersion,
        protocolVersion: '1.0',
      },
    };
  }

  // Read and write commands are added incrementally in phases 3 and 4.
  return failure(request.requestId, 'INTERNAL', 'An internal error occurred', false);
}

function failure(
  requestId: string,
  code: McpBridgeError['code'],
  message: string,
  retryable: boolean,
): McpBridgeResponse {
  return {
    requestId,
    ok: false,
    error: { code, message, retryable },
  };
}
