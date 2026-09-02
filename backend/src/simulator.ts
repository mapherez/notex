import {
  BRIDGE_PROTOCOL_VERSION,
  commandOutputSchemas,
  serverBridgeMessageSchema,
  type CommandName,
} from '@notex/mcp-contract';
import WebSocket from 'ws';

const bridgeUrl = process.env.NOTEX_SIMULATOR_BRIDGE_URL;
const ticket = process.env.NOTEX_SIMULATOR_TICKET;
if (!bridgeUrl || !ticket) {
  throw new Error('Set NOTEX_SIMULATOR_BRIDGE_URL and NOTEX_SIMULATOR_TICKET.');
}

const fixtures: Record<CommandName, unknown> = {
  notex_status: { state: 'online', appVersion: 'simulator', protocolVersion: BRIDGE_PROTOCOL_VERSION },
  search_notes: { results: [] },
  get_note: null,
  get_note_block: null,
  list_tags: { tags: [] },
  list_collections: { collections: [] },
  create_note: { noteId: 'simulated-note', version: 1, blockIds: [] },
  update_note_header: { noteId: 'simulated-note', version: 2 },
  add_note_block: { noteId: 'simulated-note', version: 2, blockId: 'simulated-block' },
  update_note_block: { noteId: 'simulated-note', version: 2, blockId: 'simulated-block' },
  set_note_tags: { noteId: 'simulated-note', version: 2 },
};

const socket = new WebSocket(bridgeUrl);
socket.on('open', () => socket.send(JSON.stringify({ type: 'authenticate', ticket })));
socket.on('message', (data) => {
  const message = serverBridgeMessageSchema.parse(JSON.parse(data.toString('utf8')));
  if (message.type === 'authenticated') {
    socket.send(
      JSON.stringify({ type: 'ready', protocolVersion: BRIDGE_PROTOCOL_VERSION, appVersion: 'simulator' }),
    );
    return;
  }
  if (message.type === 'session_revoked') {
    socket.close();
    return;
  }
  const result = fixtures[message.command];
  const parsed = commandOutputSchemas[message.command].safeParse(result);
  socket.send(
    JSON.stringify(
      parsed.success
        ? { type: 'response', requestId: message.requestId, ok: true, result: parsed.data }
        : {
            type: 'response',
            requestId: message.requestId,
            ok: false,
            error: { code: 'NOT_FOUND', message: 'Simulator fixture not found', retryable: false },
          },
    ),
  );
});
