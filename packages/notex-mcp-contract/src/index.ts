import { z } from 'zod';

export const BRIDGE_PROTOCOL_VERSION = '1.0' as const;
export const BRIDGE_REQUEST_TIMEOUT_MS = 20_000;
export const BRIDGE_HEARTBEAT_INTERVAL_MS = 15_000;
export const BRIDGE_OFFLINE_AFTER_MS = 45_000;
export const BRIDGE_TICKET_TTL_SECONDS = 30;
export const MAX_BRIDGE_FRAME_BYTES = 2 * 1024 * 1024;

export const bridgeDeliveryPolicy = {
  queue: 'none',
  replay: 'never',
  disconnect: 'fail-in-flight',
  ticketUse: 'single-use',
} as const;

export const mcpScopes = ['notex:read', 'notex:create', 'notex:edit'] as const;
export type McpScope = (typeof mcpScopes)[number];

export const bridgeErrorCodeSchema = z.enum([
  'USER_NOT_LOGGED_IN',
  'NOTEX_OFFLINE',
  'FORBIDDEN',
  'NOT_FOUND',
  'READ_ONLY_TRASH',
  'CONFLICT',
  'LOCAL_EDITS_PENDING',
  'INVALID_INPUT',
  'UNSUPPORTED_CONTENT',
  'TIMEOUT',
  'INTERNAL',
]);
export type BridgeErrorCode = z.infer<typeof bridgeErrorCodeSchema>;

export const bridgeErrorMessages: Record<BridgeErrorCode, string> = {
  USER_NOT_LOGGED_IN: 'User not logged in',
  NOTEX_OFFLINE: 'NoteX is offline',
  FORBIDDEN: 'The requested operation is not allowed',
  NOT_FOUND: 'The requested item was not found',
  READ_ONLY_TRASH: 'Notes in trash are read-only',
  CONFLICT: 'The note has changed; refresh it before trying again',
  LOCAL_EDITS_PENDING: 'The note has unsaved local edits',
  INVALID_INPUT: 'Invalid input',
  UNSUPPORTED_CONTENT: 'The content contains unsupported elements',
  TIMEOUT: 'NoteX did not respond in time',
  INTERNAL: 'An internal error occurred',
};

export const bridgeErrorSchema = z.object({
  code: bridgeErrorCodeSchema,
  message: z.string().min(1).max(500),
  retryable: z.boolean().default(false),
  currentVersion: z.number().int().positive().optional(),
});
export type BridgeError = z.infer<typeof bridgeErrorSchema>;

export const bridgePresenceStateSchema = z.enum([
  'logged_out',
  'offline',
  'connecting',
  'online',
  'error',
]);
export type BridgePresenceState = z.infer<typeof bridgePresenceStateSchema>;

export const bridgePresenceSchema = z
  .object({
    state: bridgePresenceStateSchema,
    protocolVersion: z.literal(BRIDGE_PROTOCOL_VERSION),
    appVersion: z.string().min(1).max(64).optional(),
    error: bridgeErrorSchema.optional(),
  })
  .superRefine((presence, context) => {
    if (presence.state === 'online' && !presence.appVersion) {
      context.addIssue({
        code: 'custom',
        path: ['appVersion'],
        message: 'Online presence requires an app version.',
      });
    }
    if (presence.state === 'error' && !presence.error) {
      context.addIssue({
        code: 'custom',
        path: ['error'],
        message: 'Error presence requires a typed error.',
      });
    }
  });
export type BridgePresence = z.infer<typeof bridgePresenceSchema>;

export const entityIdSchema = z.string().min(1).max(128);
export const richTextInputSchema = z.object({
  format: z.enum(['text', 'html']),
  value: z.string().max(500_000),
});
export const richTextOutputSchema = z.object({
  html: z.string(),
  text: z.string(),
});
export type RichTextInput = z.infer<typeof richTextInputSchema>;
export type RichTextOutput = z.infer<typeof richTextOutputSchema>;

export const noteLocationSchema = z.enum(['active', 'trash', 'all']);
export type NoteLocation = z.infer<typeof noteLocationSchema>;

export const tagDtoSchema = z.object({
  id: entityIdSchema,
  name: z.string(),
  color: z.string(),
});
export const collectionDtoSchema = z.object({
  id: entityIdSchema,
  name: z.string(),
  color: z.string(),
});
export type TagDto = z.infer<typeof tagDtoSchema>;
export type CollectionDto = z.infer<typeof collectionDtoSchema>;

export const noteSearchResultSchema = z.object({
  id: entityIdSchema,
  title: z.string(),
  subtitle: z.string(),
  snippet: z.string(),
  collectionId: entityIdSchema.nullable(),
  tagIds: z.array(entityIdSchema),
  isTrashed: z.boolean(),
  updatedAt: z.string(),
  version: z.number().int().positive(),
});

export const noteBlockSummarySchema = z.object({
  id: entityIdSchema,
  sortOrder: z.number().int().nonnegative(),
  title: richTextOutputSchema,
  contentPreview: z.string(),
  updatedAt: z.string(),
});

export const noteDetailSchema = z.object({
  id: entityIdSchema,
  title: richTextOutputSchema,
  subtitle: richTextOutputSchema,
  collectionId: entityIdSchema.nullable(),
  tagIds: z.array(entityIdSchema),
  isTrashed: z.boolean(),
  readOnly: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  version: z.number().int().positive(),
  blocks: z.array(noteBlockSummarySchema),
});

export const noteBlockDetailSchema = z.object({
  id: entityIdSchema,
  noteId: entityIdSchema,
  sortOrder: z.number().int().nonnegative(),
  title: richTextOutputSchema,
  content: richTextOutputSchema,
  updatedAt: z.string(),
  noteVersion: z.number().int().positive(),
  readOnly: z.boolean(),
});

const emptyInputSchema = z.object({}).strict();
const expectedVersionSchema = z.number().int().positive();

const updateNoteHeaderInputSchema = z
  .object({
    noteId: entityIdSchema,
    expectedVersion: expectedVersionSchema,
    title: richTextInputSchema.optional(),
    subtitle: richTextInputSchema.optional(),
    collectionId: entityIdSchema.nullable().optional(),
  })
  .refine(
    (input) => input.title !== undefined || input.subtitle !== undefined || input.collectionId !== undefined,
    { message: 'At least one header field is required.' },
  );

const updateNoteBlockInputSchema = z
  .object({
    noteId: entityIdSchema,
    blockId: entityIdSchema,
    expectedVersion: expectedVersionSchema,
    title: richTextInputSchema.optional(),
    content: richTextInputSchema.optional(),
  })
  .refine((input) => input.title !== undefined || input.content !== undefined, {
    message: 'At least one block field is required.',
  });

export const commandInputSchemas = {
  notex_status: emptyInputSchema,
  search_notes: z.object({
    query: z.string().max(500).default(''),
    location: noteLocationSchema.default('active'),
    limit: z.number().int().min(1).max(50).default(20),
  }),
  get_note: z.object({ noteId: entityIdSchema }),
  get_note_block: z.object({ noteId: entityIdSchema, blockId: entityIdSchema }),
  list_tags: z.object({
    query: z.string().max(200).default(''),
    limit: z.number().int().min(1).max(100).default(100),
  }),
  list_collections: z.object({
    query: z.string().max(200).default(''),
    limit: z.number().int().min(1).max(100).default(100),
  }),
  create_note: z.object({
    title: richTextInputSchema.optional(),
    subtitle: richTextInputSchema.optional(),
    collectionId: entityIdSchema.nullable().optional(),
    tagIds: z.array(entityIdSchema).max(50).default([]),
    blocks: z
      .array(
        z.object({
          title: richTextInputSchema.optional(),
          content: richTextInputSchema.optional(),
        }),
      )
      .max(100)
      .default([]),
  }),
  update_note_header: updateNoteHeaderInputSchema,
  add_note_block: z.object({
    noteId: entityIdSchema,
    expectedVersion: expectedVersionSchema,
    title: richTextInputSchema.optional(),
    content: richTextInputSchema.optional(),
  }),
  update_note_block: updateNoteBlockInputSchema,
  set_note_tags: z.object({
    noteId: entityIdSchema,
    expectedVersion: expectedVersionSchema,
    tagIds: z.array(entityIdSchema).max(50),
  }),
} as const;

export const mutationResultSchema = z.object({
  noteId: entityIdSchema,
  version: z.number().int().positive(),
});

export const commandOutputSchemas = {
  notex_status: z.object({
    state: bridgePresenceStateSchema.extract(['online', 'offline', 'logged_out']),
    appVersion: z.string().optional(),
    protocolVersion: z.string(),
  }),
  search_notes: z.object({ results: z.array(noteSearchResultSchema) }),
  get_note: noteDetailSchema,
  get_note_block: noteBlockDetailSchema,
  list_tags: z.object({ tags: z.array(tagDtoSchema) }),
  list_collections: z.object({ collections: z.array(collectionDtoSchema) }),
  create_note: mutationResultSchema.extend({ blockIds: z.array(entityIdSchema) }),
  update_note_header: mutationResultSchema,
  add_note_block: mutationResultSchema.extend({ blockId: entityIdSchema }),
  update_note_block: mutationResultSchema.extend({ blockId: entityIdSchema }),
  set_note_tags: mutationResultSchema,
} as const;

export type CommandName = keyof typeof commandInputSchemas;
export type CommandInput<T extends CommandName> = z.infer<(typeof commandInputSchemas)[T]>;
export type CommandOutput<T extends CommandName> = z.infer<(typeof commandOutputSchemas)[T]>;

export const commandNames = Object.keys(commandInputSchemas) as CommandName[];

export const commandScope: Record<CommandName, McpScope> = {
  notex_status: 'notex:read',
  search_notes: 'notex:read',
  get_note: 'notex:read',
  get_note_block: 'notex:read',
  list_tags: 'notex:read',
  list_collections: 'notex:read',
  create_note: 'notex:create',
  update_note_header: 'notex:edit',
  add_note_block: 'notex:edit',
  update_note_block: 'notex:edit',
  set_note_tags: 'notex:edit',
};

export type ToolAnnotations = {
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint: boolean;
  openWorldHint: boolean;
};

export type ToolMetadata = {
  title: string;
  description: string;
  annotations: ToolAnnotations;
};

const toolDescriptions: Record<CommandName, string> = {
  notex_status: 'Check whether NoteX is ready to handle MCP requests.',
  search_notes: 'Search NoteX notes by text, including active notes or trash when requested.',
  get_note: 'Read one NoteX note header and its ordered block summaries.',
  get_note_block: 'Read the exact supported rich-text content of one NoteX note block.',
  list_tags: 'List existing NoteX tags. Use returned IDs in write tools.',
  list_collections: 'List existing NoteX collections. Use returned IDs in write tools.',
  create_note: 'Create a NoteX note, optionally with blocks and existing tags.',
  update_note_header: 'Update selected header fields of a NoteX note using optimistic versioning.',
  add_note_block: 'Append a block to a NoteX note using optimistic versioning.',
  update_note_block: 'Update selected fields of a NoteX block using optimistic versioning.',
  set_note_tags: 'Replace a NoteX note tag set with existing tag IDs using optimistic versioning.',
};

function isIdempotentTool(command: CommandName): boolean {
  return (
    command.startsWith('get_') ||
    command.startsWith('list_') ||
    command === 'search_notes'
  );
}

export const toolMetadata = Object.fromEntries(
  commandNames.map((command) => [
    command,
    {
      title: command.replaceAll('_', ' '),
      description: toolDescriptions[command],
      annotations: {
        readOnlyHint: commandScope[command] === 'notex:read',
        destructiveHint: false,
        idempotentHint: isIdempotentTool(command),
        openWorldHint: false,
      },
    } satisfies ToolMetadata,
  ]),
) as Record<CommandName, ToolMetadata>;

export type ToolManifestEntry = ToolMetadata & {
  name: CommandName;
  scope: McpScope;
  inputSchema: Record<string, unknown>;
};

export type ToolManifest = {
  schemaVersion: 1;
  protocolVersion: typeof BRIDGE_PROTOCOL_VERSION;
  tools: ToolManifestEntry[];
};

export function createToolManifest(): ToolManifest {
  return {
    schemaVersion: 1,
    protocolVersion: BRIDGE_PROTOCOL_VERSION,
    tools: commandNames.map((command) => ({
      name: command,
      scope: commandScope[command],
      ...toolMetadata[command],
      inputSchema: z.toJSONSchema(commandInputSchemas[command], {
        target: 'draft-07',
        io: 'input',
        reused: 'inline',
      }) as Record<string, unknown>,
    })),
  };
}

export function parseCommandInput<T extends CommandName>(name: T, input: unknown): CommandInput<T> {
  return commandInputSchemas[name].parse(input) as CommandInput<T>;
}

export function parseCommandOutput<T extends CommandName>(name: T, output: unknown): CommandOutput<T> {
  return commandOutputSchemas[name].parse(output) as CommandOutput<T>;
}

export const bridgeTicketSchema = z.string().min(32).max(512).regex(/^[A-Za-z0-9_-]+$/);

export const bridgeAuthenticateSchema = z.object({
  type: z.literal('authenticate'),
  ticket: bridgeTicketSchema,
});

export const bridgeReadySchema = z.object({
  type: z.literal('ready'),
  protocolVersion: z.literal(BRIDGE_PROTOCOL_VERSION),
  appVersion: z.string().min(1).max(64),
});
export type BridgeReady = z.infer<typeof bridgeReadySchema>;

export const bridgeRequestSchema = z.object({
  type: z.literal('request'),
  requestId: z.string().uuid(),
  command: z.enum(commandNames as [CommandName, ...CommandName[]]),
  input: z.unknown(),
  deadlineAt: z.iso.datetime({ offset: true }),
});
export type BridgeRequest = z.infer<typeof bridgeRequestSchema>;

export const bridgeResponseSchema = z.discriminatedUnion('ok', [
  z.object({
    type: z.literal('response'),
    requestId: z.string().uuid(),
    ok: z.literal(true),
    result: z.unknown(),
  }),
  z.object({
    type: z.literal('response'),
    requestId: z.string().uuid(),
    ok: z.literal(false),
    error: bridgeErrorSchema,
  }),
]);
export type BridgeResponse = z.infer<typeof bridgeResponseSchema>;

export const desktopBridgeMessageSchema = z.discriminatedUnion('type', [
  bridgeAuthenticateSchema,
  bridgeReadySchema,
  bridgeResponseSchema,
]);

export const serverBridgeMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('authenticated') }),
  bridgeRequestSchema,
  z.object({ type: z.literal('session_revoked'), reason: z.string().max(200) }),
]);

export type DesktopBridgeMessage = z.infer<typeof desktopBridgeMessageSchema>;
export type ServerBridgeMessage = z.infer<typeof serverBridgeMessageSchema>;

export type BridgeFrame = string | Uint8Array | ArrayBuffer;

function decodeBridgeFrame(frame: BridgeFrame): string {
  if (typeof frame === 'string') {
    if (new TextEncoder().encode(frame).byteLength > MAX_BRIDGE_FRAME_BYTES) {
      throw new RangeError(`Bridge frame exceeds ${MAX_BRIDGE_FRAME_BYTES} bytes.`);
    }
    return frame;
  }

  const bytes = frame instanceof Uint8Array ? frame : new Uint8Array(frame);
  if (bytes.byteLength > MAX_BRIDGE_FRAME_BYTES) {
    throw new RangeError(`Bridge frame exceeds ${MAX_BRIDGE_FRAME_BYTES} bytes.`);
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

function parseBridgeJson(frame: BridgeFrame): unknown {
  return JSON.parse(decodeBridgeFrame(frame)) as unknown;
}

export function parseDesktopBridgeFrame(frame: BridgeFrame): DesktopBridgeMessage {
  return desktopBridgeMessageSchema.parse(parseBridgeJson(frame));
}

export function parseServerBridgeFrame(frame: BridgeFrame): ServerBridgeMessage {
  return serverBridgeMessageSchema.parse(parseBridgeJson(frame));
}
