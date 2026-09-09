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
      case 'create_tag': {
        const input = parseInput('create_tag', request.input);
        return success(request.requestId, 'create_tag', await createTagCommand(request, input));
      }
      case 'update_tag': {
        const input = parseInput('update_tag', request.input);
        return success(request.requestId, 'update_tag', await updateTagCommand(request, input));
      }
      case 'delete_tag': {
        const input = parseInput('delete_tag', request.input);
        return success(request.requestId, 'delete_tag', await deleteTagCommand(request, input));
      }
      case 'create_collection': {
        const input = parseInput('create_collection', request.input);
        return success(
          request.requestId,
          'create_collection',
          await createCollectionCommand(request, input),
        );
      }
      case 'update_collection': {
        const input = parseInput('update_collection', request.input);
        return success(
          request.requestId,
          'update_collection',
          await updateCollectionCommand(request, input),
        );
      }
      case 'delete_collection': {
        const input = parseInput('delete_collection', request.input);
        return success(
          request.requestId,
          'delete_collection',
          await deleteCollectionCommand(request, input),
        );
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
      case 'set_note_favorite': {
        const input = parseInput('set_note_favorite', request.input);
        return success(
          request.requestId,
          'set_note_favorite',
          await setNoteFavoriteCommand(request, input),
        );
      }
      case 'set_note_pinned': {
        const input = parseInput('set_note_pinned', request.input);
        return success(
          request.requestId,
          'set_note_pinned',
          await setNotePinnedCommand(request, input),
        );
      }
      case 'set_note_thumbnail': {
        const input = parseInput('set_note_thumbnail', request.input);
        return success(
          request.requestId,
          'set_note_thumbnail',
          await setNoteThumbnailCommand(request, input),
        );
      }
      case 'add_linked_note': {
        const input = parseInput('add_linked_note', request.input);
        return success(
          request.requestId,
          'add_linked_note',
          await addLinkedNoteCommand(request, input),
        );
      }
      case 'remove_linked_note': {
        const input = parseInput('remove_linked_note', request.input);
        return success(
          request.requestId,
          'remove_linked_note',
          await removeLinkedNoteCommand(request, input),
        );
      }
      case 'add_note_example': {
        const input = parseInput('add_note_example', request.input);
        return success(
          request.requestId,
          'add_note_example',
          await addNoteExampleCommand(request, input),
        );
      }
      case 'update_note_example': {
        const input = parseInput('update_note_example', request.input);
        return success(
          request.requestId,
          'update_note_example',
          await updateNoteExampleCommand(request, input),
        );
      }
      case 'delete_note_example': {
        const input = parseInput('delete_note_example', request.input);
        return success(
          request.requestId,
          'delete_note_example',
          await deleteNoteExampleCommand(request, input),
        );
      }
      case 'add_note_link': {
        const input = parseInput('add_note_link', request.input);
        return success(request.requestId, 'add_note_link', await addNoteLinkCommand(request, input));
      }
      case 'delete_note_link': {
        const input = parseInput('delete_note_link', request.input);
        return success(
          request.requestId,
          'delete_note_link',
          await deleteNoteLinkCommand(request, input),
        );
      }
      case 'delete_note_block': {
        const input = parseInput('delete_note_block', request.input);
        return success(
          request.requestId,
          'delete_note_block',
          await deleteNoteBlockCommand(request, input),
        );
      }
      case 'reorder_note_blocks': {
        const input = parseInput('reorder_note_blocks', request.input);
        return success(
          request.requestId,
          'reorder_note_blocks',
          await reorderNoteBlocksCommand(request, input),
        );
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

async function createTagCommand(
  request: McpBridgeRequest,
  input: CommandInput<'create_tag'>,
): Promise<CommandOutput<'create_tag'>> {
  ensureDeadline(request.deadlineAt);
  const tag = await useKnowledgeStore.getState().createTag(input.name, input.color);
  if (!tag) {
    throw new CommandFailure('INVALID_INPUT');
  }
  return { tag: tagDto(tag) };
}

async function updateTagCommand(
  request: McpBridgeRequest,
  input: CommandInput<'update_tag'>,
): Promise<CommandOutput<'update_tag'>> {
  ensureDeadline(request.deadlineAt);
  const current = findTag(input.tagId);
  if (!current) {
    throw new CommandFailure('NOT_FOUND');
  }
  await useKnowledgeStore.getState().updateTag(input.tagId, {
    name: input.name ?? current.name,
    color: input.color ?? current.color,
  });
  const updated = findTag(input.tagId);
  if (!updated) {
    throw new CommandFailure('NOT_FOUND');
  }
  return { tag: tagDto(updated) };
}

async function deleteTagCommand(
  request: McpBridgeRequest,
  input: CommandInput<'delete_tag'>,
): Promise<CommandOutput<'delete_tag'>> {
  ensureDeadline(request.deadlineAt);
  if (!findTag(input.tagId)) {
    throw new CommandFailure('NOT_FOUND');
  }
  const affectedNoteIds = useNotesStore
    .getState()
    .notes.filter((note) => note.tagIds.includes(input.tagId))
    .map((note) => note.id);

  return withNoteMutationLeases(request, affectedNoteIds, async () => {
    if (!findTag(input.tagId)) {
      throw new CommandFailure('NOT_FOUND');
    }
    await useKnowledgeStore.getState().deleteTag(input.tagId);
    return { tagId: input.tagId, deleted: true, affectedNoteCount: affectedNoteIds.length };
  });
}

async function createCollectionCommand(
  request: McpBridgeRequest,
  input: CommandInput<'create_collection'>,
): Promise<CommandOutput<'create_collection'>> {
  ensureDeadline(request.deadlineAt);
  const collection = await useKnowledgeStore.getState().createCollection(input.name, input.color);
  if (!collection) {
    throw new CommandFailure('INVALID_INPUT');
  }
  return { collection: collectionDto(collection) };
}

async function updateCollectionCommand(
  request: McpBridgeRequest,
  input: CommandInput<'update_collection'>,
): Promise<CommandOutput<'update_collection'>> {
  ensureDeadline(request.deadlineAt);
  const current = findCollection(input.collectionId);
  if (!current) {
    throw new CommandFailure('NOT_FOUND');
  }
  await useKnowledgeStore.getState().updateCollection(input.collectionId, {
    name: input.name ?? current.name,
    color: input.color ?? current.color,
  });
  const updated = findCollection(input.collectionId);
  if (!updated) {
    throw new CommandFailure('NOT_FOUND');
  }
  return { collection: collectionDto(updated) };
}

async function deleteCollectionCommand(
  request: McpBridgeRequest,
  input: CommandInput<'delete_collection'>,
): Promise<CommandOutput<'delete_collection'>> {
  ensureDeadline(request.deadlineAt);
  if (!findCollection(input.collectionId)) {
    throw new CommandFailure('NOT_FOUND');
  }
  const affectedNoteIds = useNotesStore
    .getState()
    .notes.filter((note) => note.collectionId === input.collectionId)
    .map((note) => note.id);

  return withNoteMutationLeases(request, affectedNoteIds, async () => {
    if (!findCollection(input.collectionId)) {
      throw new CommandFailure('NOT_FOUND');
    }
    await useKnowledgeStore.getState().deleteCollection(input.collectionId);
    return {
      collectionId: input.collectionId,
      deleted: true,
      affectedNoteCount: affectedNoteIds.length,
    };
  });
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

async function setNoteFavoriteCommand(
  request: McpBridgeRequest,
  input: CommandInput<'set_note_favorite'>,
): Promise<CommandOutput<'set_note_favorite'>> {
  return mutateExistingNote(request, input.noteId, input.expectedVersion, 'active', async () => {
    await useNotesStore.getState().setNoteFavorite(input.noteId, input.isFavorite);
    return currentMutationResult(input.noteId);
  });
}

async function setNotePinnedCommand(
  request: McpBridgeRequest,
  input: CommandInput<'set_note_pinned'>,
): Promise<CommandOutput<'set_note_pinned'>> {
  return mutateExistingNote(request, input.noteId, input.expectedVersion, 'active', async () => {
    await useNotesStore.getState().setNotePinned(input.noteId, input.isPinned);
    return currentMutationResult(input.noteId);
  });
}

async function setNoteThumbnailCommand(
  request: McpBridgeRequest,
  input: CommandInput<'set_note_thumbnail'>,
): Promise<CommandOutput<'set_note_thumbnail'>> {
  return mutateExistingNote(request, input.noteId, input.expectedVersion, 'active', async () => {
    await useNotesStore.getState().updateNoteThumbnail(input.noteId, { variant: input.variant });
    return currentMutationResult(input.noteId);
  });
}

async function addLinkedNoteCommand(
  request: McpBridgeRequest,
  input: CommandInput<'add_linked_note'>,
): Promise<CommandOutput<'add_linked_note'>> {
  if (input.noteId === input.linkedNoteId) {
    throw new CommandFailure('INVALID_INPUT');
  }

  return mutateExistingNote(request, input.noteId, input.expectedVersion, 'active', async (note) => {
    const linkedNote = findNote(input.linkedNoteId);
    if (!linkedNote) {
      throw new CommandFailure('NOT_FOUND');
    }
    if (linkedNote.isTrashed) {
      throw new CommandFailure('READ_ONLY_TRASH');
    }
    if (!note.linkedNoteIds.includes(input.linkedNoteId)) {
      await useNotesStore
        .getState()
        .updateNoteLinkedNotes(input.noteId, [...note.linkedNoteIds, input.linkedNoteId]);
    }
    return { ...currentMutationResult(input.noteId), linkedNoteId: input.linkedNoteId };
  });
}

async function removeLinkedNoteCommand(
  request: McpBridgeRequest,
  input: CommandInput<'remove_linked_note'>,
): Promise<CommandOutput<'remove_linked_note'>> {
  if (input.noteId === input.linkedNoteId) {
    throw new CommandFailure('INVALID_INPUT');
  }

  return mutateExistingNote(request, input.noteId, input.expectedVersion, 'active', async (note) => {
    if (note.linkedNoteIds.includes(input.linkedNoteId)) {
      await useNotesStore
        .getState()
        .updateNoteLinkedNotes(
          input.noteId,
          note.linkedNoteIds.filter((linkedNoteId) => linkedNoteId !== input.linkedNoteId),
        );
    }
    return { ...currentMutationResult(input.noteId), linkedNoteId: input.linkedNoteId };
  });
}

async function addNoteExampleCommand(
  request: McpBridgeRequest,
  input: CommandInput<'add_note_example'>,
): Promise<CommandOutput<'add_note_example'>> {
  return mutateExistingNote(request, input.noteId, input.expectedVersion, 'active', async (note) => {
    const exampleIndex = (note.additionalExamples ?? []).length;
    await useNotesStore.getState().addAdditionalExample(input.noteId, input.example);
    return { ...currentMutationResult(input.noteId), exampleIndex };
  });
}

async function updateNoteExampleCommand(
  request: McpBridgeRequest,
  input: CommandInput<'update_note_example'>,
): Promise<CommandOutput<'update_note_example'>> {
  return mutateExistingNote(request, input.noteId, input.expectedVersion, 'active', async (note) => {
    if (input.exampleIndex >= (note.additionalExamples ?? []).length) {
      throw new CommandFailure('NOT_FOUND');
    }
    await useNotesStore
      .getState()
      .updateAdditionalExample(input.noteId, input.exampleIndex, input.example);
    return { ...currentMutationResult(input.noteId), exampleIndex: input.exampleIndex };
  });
}

async function deleteNoteExampleCommand(
  request: McpBridgeRequest,
  input: CommandInput<'delete_note_example'>,
): Promise<CommandOutput<'delete_note_example'>> {
  return mutateExistingNote(request, input.noteId, input.expectedVersion, 'active', async (note) => {
    if (input.exampleIndex >= (note.additionalExamples ?? []).length) {
      throw new CommandFailure('NOT_FOUND');
    }
    await useNotesStore.getState().deleteAdditionalExample(input.noteId, input.exampleIndex);
    return {
      ...currentMutationResult(input.noteId),
      exampleIndex: input.exampleIndex,
      deleted: true,
    };
  });
}

async function addNoteLinkCommand(
  request: McpBridgeRequest,
  input: CommandInput<'add_note_link'>,
): Promise<CommandOutput<'add_note_link'>> {
  return mutateExistingNote(request, input.noteId, input.expectedVersion, 'active', async (note) => {
    const existingLinkIds = new Set((note.relatedLinks ?? []).map((link) => link.id));
    await useNotesStore.getState().addRelatedLink(input.noteId, input.title, input.href);
    const updatedNote = findNote(input.noteId);
    const link = updatedNote?.relatedLinks?.find((item) => !existingLinkIds.has(item.id));
    if (!link) {
      throw new CommandFailure('INTERNAL');
    }
    return { ...currentMutationResult(input.noteId), link: { ...link } };
  });
}

async function deleteNoteLinkCommand(
  request: McpBridgeRequest,
  input: CommandInput<'delete_note_link'>,
): Promise<CommandOutput<'delete_note_link'>> {
  return mutateExistingNote(request, input.noteId, input.expectedVersion, 'active', async (note) => {
    if (!(note.relatedLinks ?? []).some((link) => link.id === input.linkId)) {
      throw new CommandFailure('NOT_FOUND');
    }
    await useNotesStore.getState().deleteRelatedLink(input.noteId, input.linkId);
    return { ...currentMutationResult(input.noteId), linkId: input.linkId, deleted: true };
  });
}

async function deleteNoteBlockCommand(
  request: McpBridgeRequest,
  input: CommandInput<'delete_note_block'>,
): Promise<CommandOutput<'delete_note_block'>> {
  return mutateExistingNote(request, input.noteId, input.expectedVersion, 'active', async (note) => {
    if (!(note.blocks ?? []).some((block) => block.id === input.blockId)) {
      throw new CommandFailure('NOT_FOUND');
    }
    await useNotesStore.getState().deleteBlock(input.noteId, input.blockId);
    return { ...currentMutationResult(input.noteId), blockId: input.blockId, deleted: true };
  });
}

async function reorderNoteBlocksCommand(
  request: McpBridgeRequest,
  input: CommandInput<'reorder_note_blocks'>,
): Promise<CommandOutput<'reorder_note_blocks'>> {
  return mutateExistingNote(request, input.noteId, input.expectedVersion, 'active', async (note) => {
    const currentBlockIds = [...(note.blocks ?? [])]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((block) => block.id);
    const requestedBlockIds = input.blockIds;
    const currentBlockIdSet = new Set(currentBlockIds);
    if (
      requestedBlockIds.length !== currentBlockIds.length ||
      requestedBlockIds.some((blockId) => !currentBlockIdSet.has(blockId))
    ) {
      throw new CommandFailure('INVALID_INPUT');
    }
    if (!sameOrderedIds(currentBlockIds, requestedBlockIds)) {
      await useNotesStore.getState().reorderBlocks(input.noteId, requestedBlockIds);
    }
    return { ...currentMutationResult(input.noteId), blockIds: [...requestedBlockIds] };
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

async function withNoteMutationLeases<T>(
  request: McpBridgeRequest,
  noteIds: string[],
  mutation: () => Promise<T>,
): Promise<T> {
  ensureDeadline(request.deadlineAt);
  const leases: Array<{ release: () => void }> = [];
  try {
    for (const noteId of [...new Set(noteIds)].sort()) {
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
    return await mutation();
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
    linkedNoteIds: [...note.linkedNoteIds],
    additionalExamples: [...(note.additionalExamples ?? [])],
    relatedLinks: (note.relatedLinks ?? []).map((link) => ({ ...link })),
    isFavorite: note.isFavorite,
    isPinned: note.isPinned,
    thumbnail: note.thumbnail ? { ...note.thumbnail } : null,
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

function findTag(tagId: string) {
  return useKnowledgeStore.getState().tags.find((tag) => tag.id === tagId);
}

function findCollection(collectionId: string) {
  return useKnowledgeStore.getState().collections.find((collection) => collection.id === collectionId);
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

function sameOrderedIds(left: string[], right: string[]) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function deadlineExpired(deadlineAt: string) {
  const numericDeadline = Number(deadlineAt);
  const deadline = Number.isFinite(numericDeadline) ? numericDeadline : Date.parse(deadlineAt);
  return !Number.isFinite(deadline) || deadline <= Date.now();
}

function isCommandName(value: string): value is CommandName {
  return commandNameSet.has(value);
}
