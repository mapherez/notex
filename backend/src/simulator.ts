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
  get_trash_status: { noteCount: 0, stateToken: '0'.repeat(64) },
  list_tags: { tags: [] },
  list_collections: { collections: [] },
  create_tag: { tag: { id: 'simulated-tag', name: 'Simulated', color: 'neutral' } },
  update_tag: { tag: { id: 'simulated-tag', name: 'Simulated', color: 'neutral' } },
  delete_tag: { tagId: 'simulated-tag', deleted: true, affectedNoteCount: 0 },
  create_collection: {
    collection: { id: 'simulated-collection', name: 'Simulated', color: 'neutral' },
  },
  update_collection: {
    collection: { id: 'simulated-collection', name: 'Simulated', color: 'neutral' },
  },
  delete_collection: {
    collectionId: 'simulated-collection', deleted: true, affectedNoteCount: 0,
  },
  create_note: { noteId: 'simulated-note', version: 1, blockIds: [] },
  update_note_header: { noteId: 'simulated-note', version: 2 },
  add_note_block: { noteId: 'simulated-note', version: 2, blockId: 'simulated-block' },
  update_note_block: { noteId: 'simulated-note', version: 2, blockId: 'simulated-block' },
  set_note_tags: { noteId: 'simulated-note', version: 2 },
  set_note_favorite: { noteId: 'simulated-note', version: 2 },
  set_note_pinned: { noteId: 'simulated-note', version: 2 },
  set_note_thumbnail: { noteId: 'simulated-note', version: 2 },
  add_linked_note: { noteId: 'simulated-note', version: 2, linkedNoteId: 'simulated-linked-note' },
  remove_linked_note: { noteId: 'simulated-note', version: 2, linkedNoteId: 'simulated-linked-note' },
  add_note_example: { noteId: 'simulated-note', version: 2, exampleIndex: 0 },
  update_note_example: { noteId: 'simulated-note', version: 2, exampleIndex: 0 },
  delete_note_example: { noteId: 'simulated-note', version: 2, exampleIndex: 0, deleted: true },
  add_note_link: {
    noteId: 'simulated-note',
    version: 2,
    link: { id: 'simulated-link', title: 'Simulated', href: 'https://example.com' },
  },
  delete_note_link: { noteId: 'simulated-note', version: 2, linkId: 'simulated-link', deleted: true },
  delete_note_block: { noteId: 'simulated-note', version: 2, blockId: 'simulated-block', deleted: true },
  reorder_note_blocks: { noteId: 'simulated-note', version: 2, blockIds: ['simulated-block'] },
  move_note_to_trash: { noteId: 'simulated-note', version: 3 },
  restore_note: { noteId: 'simulated-note', version: 4 },
  delete_note_permanently: { noteId: 'simulated-note', deleted: true },
  clear_trash: { deletedCount: 0 },
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
