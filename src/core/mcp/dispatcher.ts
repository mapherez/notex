import {
  BRIDGE_PROTOCOL_VERSION,
  bridgeErrorMessages,
  commandNames,
  parseCommandInput,
  parseCommandOutput,
  type BridgeError,
  type BridgeErrorCode,
  type CommandInput,
  type CommandName,
  type CommandOutput,
} from '@notex/mcp-contract';
import type { Collection, Note, NoteBlock, Tag } from '../models/models';
import { normalizeSearchValue, searchNotes } from '../utils/noteSearch';
import { useAppStore } from '../../store/useAppStore';
import { useKnowledgeStore } from '../../store/useKnowledgeStore';
import { useNotesStore } from '../../store/useNotesStore';
import { tryBeginMcpMutation } from './noteMutationCoordinator';
import {
  parseMcpBlockRichText,
  parseMcpInlineRichText,
  UnsupportedRichTextInputError,
} from './richTextInput';
import { blockRichTextOutput, inlineRichTextOutput } from './richTextOutput';

export type McpBridgeRequest = {
  requestId: string;
  command: string;
  input: unknown;
  deadlineAt: string;
};

export type McpBridgeError = BridgeError;

export type McpBridgeResponse =
  | { requestId: string; ok: true; result: unknown }
  | { requestId: string; ok: false; error: McpBridgeError };

const commandNameSet = new Set<string>(commandNames);

export async function dispatchMcpCommand(
  request: McpBridgeRequest,
  appVersion: string,
): Promise<McpBridgeResponse> {
  if (deadlineExpired(request.deadlineAt)) {
    return failure(request.requestId, 'TIMEOUT', true);
  }
  if (!isCommandName(request.command)) {
    return failure(request.requestId, 'INVALID_INPUT');
  }

  try {
    switch (request.command) {
      case 'notex_status': {
        parseInput('notex_status', request.input);
        return success(request.requestId, 'notex_status', {
          state: 'online',
          appVersion,
          protocolVersion: BRIDGE_PROTOCOL_VERSION,
        });
      }
      case 'search_notes': {
        const input = parseInput('search_notes', request.input);
        return success(request.requestId, 'search_notes', searchNotesCommand(input));
      }
      case 'get_note': {
        const input = parseInput('get_note', request.input);
        const note = findNote(input.noteId);
        if (!note) {
          return failure(request.requestId, 'NOT_FOUND');
        }
        return success(request.requestId, 'get_note', noteDetail(note));
      }
      case 'get_note_block': {
        const input = parseInput('get_note_block', request.input);
        const note = findNote(input.noteId);
        const block = note?.blocks?.find((item) => item.id === input.blockId);
        if (!note || !block) {
          return failure(request.requestId, 'NOT_FOUND');
        }
        return success(request.requestId, 'get_note_block', noteBlockDetail(note, block));
      }
      case 'get_trash_status': {
        parseInput('get_trash_status', request.input);
        return success(request.requestId, 'get_trash_status', await getTrashStatusCommand());
      }
      case 'list_tags': {
        const input = parseInput('list_tags', request.input);
        return success(request.requestId, 'list_tags', {
          tags: filterNamedEntities(useKnowledgeStore.getState().tags, input.query, input.limit).map(tagDto),
        });
      }
      case 'list_collections': {
        const input = parseInput('list_collections', request.input);
        return success(request.requestId, 'list_collections', {
          collections: filterNamedEntities(
            useKnowledgeStore.getState().collections,
            input.query,
            input.limit,
          ).map(collectionDto),
        });
      }
      case 'create_note': {
        const input = parseInput('create_note', request.input);
        return success(request.requestId, 'create_note', await createNoteCommand(request, input));
      }
      case 'update_note_header': {
        const input = parseInput('update_note_header', request.input);
        return success(
          request.requestId,
          'update_note_header',
          await updateNoteHeaderCommand(request, input),
        );
      }
      case 'add_note_block': {
        const input = parseInput('add_note_block', request.input);
        return success(request.requestId, 'add_note_block', await addNoteBlockCommand(request, input));
      }
      case 'update_note_block': {
        const input = parseInput('update_note_block', request.input);
        return success(
          request.requestId,
          'update_note_block',
          await updateNoteBlockCommand(request, input),
        );
      }
      case 'set_note_tags': {
        const input = parseInput('set_note_tags', request.input);
        return success(request.requestId, 'set_note_tags', await setNoteTagsCommand(request, input));
      }
      case 'move_note_to_trash': {
        const input = parseInput('move_note_to_trash', request.input);
        return success(
          request.requestId,
          'move_note_to_trash',
          await moveNoteToTrashCommand(request, input),
        );
      }
      case 'restore_note': {
        const input = parseInput('restore_note', request.input);
        return success(request.requestId, 'restore_note', await restoreNoteCommand(request, input));
      }
      case 'delete_note_permanently': {
        const input = parseInput('delete_note_permanently', request.input);
        return success(
          request.requestId,
          'delete_note_permanently',
          await deleteNotePermanentlyCommand(request, input),
        );
      }
      case 'clear_trash': {
        const input = parseInput('clear_trash', request.input);
        return success(request.requestId, 'clear_trash', await clearTrashCommand(request, input));
      }
      default:
        return failure(request.requestId, 'INTERNAL');
    }
  } catch (error) {
    if (error instanceof InvalidInputError) {
      return failure(request.requestId, 'INVALID_INPUT');
    }
    if (error instanceof UnsupportedRichTextInputError) {
      return failure(request.requestId, 'UNSUPPORTED_CONTENT');
    }
    if (error instanceof CommandFailure) {
      return failure(
        request.requestId,
        error.code,
        error.retryable,
        error.currentVersion,
      );
    }
    return failure(request.requestId, 'INTERNAL');
  }
}

class InvalidInputError extends Error {}

class CommandFailure extends Error {
  constructor(
    readonly code: BridgeErrorCode,
    readonly retryable = false,
    readonly currentVersion?: number,
  ) {
    super(code);
  }
}

function parseInput<T extends CommandName>(name: T, input: unknown): CommandInput<T> {
  try {
    return parseCommandInput(name, input);
  } catch {
    throw new InvalidInputError();
  }
}

function success<T extends CommandName>(
  requestId: string,
  command: T,
  result: CommandOutput<T>,
): McpBridgeResponse {
  return {
    requestId,
    ok: true,
    result: parseCommandOutput(command, result),
  };
}

function failure(
  requestId: string,
  code: BridgeErrorCode,
  retryable = false,
  currentVersion?: number,
): McpBridgeResponse {
  return {
    requestId,
    ok: false,
    error: {
      code,
      message: bridgeErrorMessages[code],
      retryable,
      ...(currentVersion === undefined ? {} : { currentVersion }),
    },
  };
}

async function createNoteCommand(
  request: McpBridgeRequest,
  input: CommandInput<'create_note'>,
): Promise<CommandOutput<'create_note'>> {
  ensureDeadline(request.deadlineAt);
  const collectionId = resolveCreateCollectionId(input.collectionId);
  const tagIds = validateTagIds(input.tagIds);
  const title = input.title ? parseMcpInlineRichText(input.title) : '';
  const subtitle = input.subtitle ? parseMcpInlineRichText(input.subtitle) : '';
  const blocks = input.blocks.map((block) => {
    const content = block.content ? parseMcpBlockRichText(block.content) : undefined;
    return {
      title: block.title ? parseMcpInlineRichText(block.title) : '',
      ...(content ?? {}),
    };
  });

  ensureDeadline(request.deadlineAt);
  const note = await useNotesStore.getState().createNoteWithBlocks({
    title,
    subtitle,
    collectionId,
    tagIds,
    blocks,
  });

  return {
    noteId: note.id,
    version: note.version,
    blockIds: (note.blocks ?? []).map((block) => block.id),
  };
}

async function updateNoteHeaderCommand(
  request: McpBridgeRequest,
  input: CommandInput<'update_note_header'>,
): Promise<CommandOutput<'update_note_header'>> {
  const update: { collectionId?: string | null; subtitle?: string; title?: string } = {};
  if (input.title !== undefined) {
    update.title = parseMcpInlineRichText(input.title);
  }
  if (input.subtitle !== undefined) {
    update.subtitle = parseMcpInlineRichText(input.subtitle);
  }
  if (input.collectionId !== undefined) {
    validateCollectionId(input.collectionId);
    update.collectionId = input.collectionId;
  }

  return mutateExistingNote(request, input.noteId, input.expectedVersion, 'active', async () => {
    await useNotesStore.getState().updateNoteHeader(input.noteId, update);
    return currentMutationResult(input.noteId);
  });
}

async function addNoteBlockCommand(
  request: McpBridgeRequest,
  input: CommandInput<'add_note_block'>,
): Promise<CommandOutput<'add_note_block'>> {
  const title = input.title ? parseMcpInlineRichText(input.title) : '';
  const content = input.content ? parseMcpBlockRichText(input.content) : undefined;

  return mutateExistingNote(request, input.noteId, input.expectedVersion, 'active', async () => {
    const block = await useNotesStore.getState().addBlock(input.noteId, {
      title,
      ...(content ?? {}),
    });
    if (!block) {
      throw new CommandFailure('NOT_FOUND');
    }
    return {
      ...currentMutationResult(input.noteId),
      blockId: block.id,
    };
  });
}

async function updateNoteBlockCommand(
  request: McpBridgeRequest,
  input: CommandInput<'update_note_block'>,
): Promise<CommandOutput<'update_note_block'>> {
  const update: {
    contentJson?: NoteBlock['contentJson'];
    contentText?: string;
    title?: string;
  } = {};
  if (input.title !== undefined) {
    update.title = parseMcpInlineRichText(input.title);
  }
  if (input.content !== undefined) {
    Object.assign(update, parseMcpBlockRichText(input.content));
  }

  return mutateExistingNote(request, input.noteId, input.expectedVersion, 'active', async (note) => {
    if (!(note.blocks ?? []).some((block) => block.id === input.blockId)) {
      throw new CommandFailure('NOT_FOUND');
    }
    await useNotesStore.getState().updateBlock(input.noteId, input.blockId, update);
    return {
      ...currentMutationResult(input.noteId),
      blockId: input.blockId,
    };
  });
}

async function setNoteTagsCommand(
  request: McpBridgeRequest,
  input: CommandInput<'set_note_tags'>,
): Promise<CommandOutput<'set_note_tags'>> {
  const tagIds = validateTagIds(input.tagIds);
  return mutateExistingNote(request, input.noteId, input.expectedVersion, 'active', async () => {
    await useNotesStore.getState().updateNoteTags(input.noteId, tagIds);
    return currentMutationResult(input.noteId);
  });
}

async function moveNoteToTrashCommand(
  request: McpBridgeRequest,
  input: CommandInput<'move_note_to_trash'>,
): Promise<CommandOutput<'move_note_to_trash'>> {
  return mutateExistingNote(request, input.noteId, input.expectedVersion, 'active', async () => {
    await useNotesStore.getState().moveNoteToTrash(input.noteId);
    return currentMutationResult(input.noteId);
  });
}

async function restoreNoteCommand(
  request: McpBridgeRequest,
  input: CommandInput<'restore_note'>,
): Promise<CommandOutput<'restore_note'>> {
  return mutateExistingNote(request, input.noteId, input.expectedVersion, 'trash', async () => {
    await useNotesStore.getState().restoreNote(input.noteId);
    return currentMutationResult(input.noteId);
  });
}

async function deleteNotePermanentlyCommand(
  request: McpBridgeRequest,
  input: CommandInput<'delete_note_permanently'>,
): Promise<CommandOutput<'delete_note_permanently'>> {
  return mutateExistingNote(request, input.noteId, input.expectedVersion, 'trash', async () => {
    await useNotesStore.getState().deleteNotesPermanently([input.noteId]);
    return { noteId: input.noteId, deleted: true };
  });
}

async function clearTrashCommand(
  request: McpBridgeRequest,
  input: CommandInput<'clear_trash'>,
): Promise<CommandOutput<'clear_trash'>> {
  ensureDeadline(request.deadlineAt);
  const initialSnapshot = await createTrashSnapshot();
  if (initialSnapshot.stateToken !== input.expectedStateToken) {
    throw new CommandFailure('CONFLICT', true);
  }

  const leases: Array<ReturnType<typeof tryBeginMcpMutation> & { acquired: true }> = [];
  try {
    for (const noteId of initialSnapshot.noteIds) {
      const lease = tryBeginMcpMutation(noteId);
      if (!lease.acquired) {
        const currentVersion = findNote(noteId)?.version;
        if (lease.blockedBy === 'local') {
          throw new CommandFailure('LOCAL_EDITS_PENDING', true, currentVersion);
        }
        throw new CommandFailure('CONFLICT', true, currentVersion);
      }
      leases.push(lease);
    }

    ensureDeadline(request.deadlineAt);
    const currentSnapshot = await createTrashSnapshot();
    if (currentSnapshot.stateToken !== input.expectedStateToken) {
      throw new CommandFailure('CONFLICT', true);
    }
    await useNotesStore.getState().deleteNotesPermanently(initialSnapshot.noteIds);
    return {
      deletedCount: initialSnapshot.noteIds.length,
    };
  } finally {
    for (const lease of leases) {
      lease.release();
    }
  }
}

async function mutateExistingNote<T>(
  request: McpBridgeRequest,
  noteId: string,
  expectedVersion: number,
  requiredLocation: 'active' | 'trash',
  mutation: (note: Note) => Promise<T>,
): Promise<T> {
  ensureDeadline(request.deadlineAt);
  assertNoteForMutation(noteId, expectedVersion, requiredLocation);

  const lease = tryBeginMcpMutation(noteId);
  if (!lease.acquired) {
    const currentVersion = findNote(noteId)?.version;
    if (lease.blockedBy === 'local') {
      throw new CommandFailure('LOCAL_EDITS_PENDING', true, currentVersion);
    }
    throw new CommandFailure('CONFLICT', true, currentVersion);
  }

  try {
    ensureDeadline(request.deadlineAt);
    const note = assertNoteForMutation(noteId, expectedVersion, requiredLocation);
    return await mutation(note);
  } finally {
    lease.release();
  }
}

function assertNoteForMutation(
  noteId: string,
  expectedVersion: number,
  requiredLocation: 'active' | 'trash',
) {
  const note = findNote(noteId);
  if (!note) {
    throw new CommandFailure('NOT_FOUND');
  }
  if (note.version !== expectedVersion) {
    throw new CommandFailure('CONFLICT', false, note.version);
  }
  if (requiredLocation === 'active' && note.isTrashed) {
    throw new CommandFailure('READ_ONLY_TRASH');
  }
  if (requiredLocation === 'trash' && !note.isTrashed) {
    throw new CommandFailure('INVALID_INPUT');
  }
  return note;
}

async function getTrashStatusCommand(): Promise<CommandOutput<'get_trash_status'>> {
  const snapshot = await createTrashSnapshot();
  return { noteCount: snapshot.noteIds.length, stateToken: snapshot.stateToken };
}

async function createTrashSnapshot() {
  const notes = useNotesStore
    .getState()
    .notes.filter((note) => note.isTrashed)
    .sort((left, right) => left.id.localeCompare(right.id));
  const encodedState = new TextEncoder().encode(
    JSON.stringify(notes.map((note) => [note.id, note.version])),
  );
  const digest = await globalThis.crypto.subtle.digest('SHA-256', encodedState);
  const stateToken = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return { noteIds: notes.map((note) => note.id), stateToken };
}

function currentMutationResult(noteId: string) {
  const note = findNote(noteId);
  if (!note) {
    throw new CommandFailure('NOT_FOUND');
  }
  return { noteId, version: note.version };
}

function resolveCreateCollectionId(collectionId: string | null | undefined) {
  if (collectionId !== undefined) {
    validateCollectionId(collectionId);
    return collectionId;
  }

  const preferredId = useAppStore.getState().settings.primaryCollectionId;
  return useKnowledgeStore.getState().collections.some((collection) => collection.id === preferredId)
    ? preferredId
    : null;
}

function validateCollectionId(collectionId: string | null) {
  if (
    collectionId !== null &&
    !useKnowledgeStore.getState().collections.some((collection) => collection.id === collectionId)
  ) {
    throw new CommandFailure('NOT_FOUND');
  }
}

function validateTagIds(tagIds: string[]) {
  const uniqueTagIds = [...new Set(tagIds)];
  const knownTagIds = new Set(useKnowledgeStore.getState().tags.map((tag) => tag.id));
  if (uniqueTagIds.some((tagId) => !knownTagIds.has(tagId))) {
    throw new CommandFailure('NOT_FOUND');
  }
  return uniqueTagIds;
}

function ensureDeadline(deadlineAt: string) {
  if (deadlineExpired(deadlineAt)) {
    throw new CommandFailure('TIMEOUT', true);
  }
}

function searchNotesCommand(
  input: CommandInput<'search_notes'>,
): CommandOutput<'search_notes'> {
  const { collections, tags } = useKnowledgeStore.getState();
  const results = searchNotes({
    collections,
    limit: input.limit,
    location: input.location,
    notes: useNotesStore.getState().notes,
    query: input.query,
    tags,
  });

  return {
    results: results.map(({ note, snippet }) => ({
      id: note.id,
      title: inlineRichTextOutput(note.title).text,
      subtitle: inlineRichTextOutput(note.subtitle).text,
      snippet,
      collectionId: note.collectionId,
      tagIds: [...note.tagIds],
      isTrashed: note.isTrashed,
      updatedAt: note.updatedAt,
      version: note.version,
    })),
  };
}

function noteDetail(note: Note): CommandOutput<'get_note'> {
  return {
    id: note.id,
    title: inlineRichTextOutput(note.title),
    subtitle: inlineRichTextOutput(note.subtitle),
    collectionId: note.collectionId,
    tagIds: [...note.tagIds],
    isTrashed: note.isTrashed,
    readOnly: note.isTrashed,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    version: note.version,
    blocks: [...(note.blocks ?? [])]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((block) => ({
        id: block.id,
        sortOrder: block.sortOrder,
        title: inlineRichTextOutput(block.title),
        contentPreview: truncatePreview(blockRichTextOutput(block.contentJson, block.contentText).text),
        updatedAt: block.updatedAt,
      })),
  };
}

function noteBlockDetail(note: Note, block: NoteBlock): CommandOutput<'get_note_block'> {
  return {
    id: block.id,
    noteId: note.id,
    sortOrder: block.sortOrder,
    title: inlineRichTextOutput(block.title),
    content: blockRichTextOutput(block.contentJson, block.contentText),
    updatedAt: block.updatedAt,
    noteVersion: note.version,
    readOnly: note.isTrashed,
  };
}

function findNote(noteId: string) {
  return useNotesStore.getState().notes.find((note) => note.id === noteId);
}

function filterNamedEntities<T extends { name: string }>(entities: T[], query: string, limit: number) {
  const normalizedQuery = normalizeSearchValue(query);
  return entities
    .filter((entity) => !normalizedQuery || normalizeSearchValue(entity.name).includes(normalizedQuery))
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' }))
    .slice(0, limit);
}

function tagDto(tag: Tag) {
  return {
    id: tag.id,
    name: tag.name,
    color: tag.color ?? 'neutral',
  };
}

function collectionDto(collection: Collection) {
  return {
    id: collection.id,
    name: collection.name,
    color: collection.color ?? 'neutral',
  };
}

function truncatePreview(value: string) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length <= 240 ? normalized : `${normalized.slice(0, 237).trimEnd()}...`;
}

function deadlineExpired(deadlineAt: string) {
  const numericDeadline = Number(deadlineAt);
  const deadline = Number.isFinite(numericDeadline) ? numericDeadline : Date.parse(deadlineAt);
  return !Number.isFinite(deadline) || deadline <= Date.now();
}

function isCommandName(value: string): value is CommandName {
  return commandNameSet.has(value);
}
