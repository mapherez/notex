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
import { useKnowledgeStore } from '../../store/useKnowledgeStore';
import { useNotesStore } from '../../store/useNotesStore';
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
      default:
        return failure(request.requestId, 'INTERNAL');
    }
  } catch (error) {
    return failure(request.requestId, error instanceof InvalidInputError ? 'INVALID_INPUT' : 'INTERNAL');
  }
}

class InvalidInputError extends Error {}

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
): McpBridgeResponse {
  return {
    requestId,
    ok: false,
    error: {
      code,
      message: bridgeErrorMessages[code],
      retryable,
    },
  };
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
  const deadline = Date.parse(deadlineAt);
  return !Number.isFinite(deadline) || deadline <= Date.now();
}

function isCommandName(value: string): value is CommandName {
  return commandNameSet.has(value);
}
