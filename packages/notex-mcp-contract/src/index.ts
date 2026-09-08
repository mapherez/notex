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

export const mcpScopes = ['notex:read', 'notex:create', 'notex:edit', 'notex:delete'] as const;
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
const richTextFormatSchema = z
  .enum(['text', 'html'])
  .describe('Use text for literal plain text or html for supported NoteX rich text.');

export const mcpInlineRichTextGuide =
  'For html, supported inline elements are <strong>, <em>, <u>, <s>, <code>, <a href="...">, ' +
  '<span style="color: ...">, and <mark style="background-color: ...">. ' +
  'Prefer NoteX palette colors as var(--nx-color-NAME), where NAME is red, rose, pink, fuchsia, purple, ' +
  'violet, indigo, blue, sky, cyan, teal, mint, green, lime, yellow, amber, orange, brown, slate, or neutral. ' +
  'For a palette highlight, use color-mix(in srgb, var(--nx-color-NAME) 28%, transparent).';

export const mcpBlockRichTextGuide =
  `${mcpInlineRichTextGuide} Block bodies additionally support paragraphs and line breaks (<p>, <br>), ` +
  'headings (<h1> through <h6>), bullet and ordered lists (<ul>, <ol>, <li>), quotes (<blockquote>), ' +
  'code blocks (<pre><code>), horizontal rules (<hr>), and text alignment via style="text-align: left|center|right|justify" ' +
  'on paragraphs or headings. For a checklist, use <ul data-type="taskList"><li data-type="taskItem" ' +
  'data-checked="true|false"><p>Item</p></li></ul>. For a NoteX tip, use <notex-tip title="Tip"><p>Content</p>' +
  '</notex-tip>. For a table, use <table> with one <tr> per row and one <th> or <td> per column; wrap cell ' +
  'content in <p>. Table cells may use colspan and rowspan. Images, files, scripts, embedded content, and unsafe ' +
  'link protocols are not supported.';

function createRichTextInputSchema(valueDescription: string) {
  return z.object({
    format: richTextFormatSchema,
    value: z.string().max(500_000).describe(valueDescription),
  });
}

export const richTextInputSchema = createRichTextInputSchema(
  'Complete literal text or supported NoteX HTML value for this field.',
);
export const inlineRichTextInputSchema = createRichTextInputSchema(mcpInlineRichTextGuide);
export const blockRichTextInputSchema = createRichTextInputSchema(mcpBlockRichTextGuide);
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
const expectedVersionSchema = z
  .number()
  .int()
  .positive()
  .describe('Current note version returned by get_note or get_note_block. The write fails if it is stale.');

const updateNoteHeaderInputSchema = z
  .object({
    noteId: entityIdSchema.describe('ID of the note whose header will be updated.'),
    expectedVersion: expectedVersionSchema,
    title: inlineRichTextInputSchema
      .describe('Complete new note title. Omit this field to preserve the current note title.')
      .optional(),
    subtitle: inlineRichTextInputSchema
      .describe('Complete new note subtitle. Omit this field to preserve the current note subtitle.')
      .optional(),
    collectionId: entityIdSchema
      .nullable()
      .describe('Existing collection ID for the note. Omit to preserve the current collection; use null to remove it.')
      .optional(),
  })
  .refine(
    (input) => input.title !== undefined || input.subtitle !== undefined || input.collectionId !== undefined,
    { message: 'At least one header field is required.' },
  );

const updateNoteBlockInputSchema = z
  .object({
    noteId: entityIdSchema.describe('ID of the note containing the block.'),
    blockId: entityIdSchema.describe('ID of the exact block to update, obtained from get_note or add_note_block.'),
    expectedVersion: expectedVersionSchema,
    title: inlineRichTextInputSchema
      .describe('Complete new title of this block. Omit this field to preserve the current block title.')
      .optional(),
    content: blockRichTextInputSchema
      .describe('Complete new body of this block. Omit this field to preserve the current block body.')
      .optional(),
  })
  .refine((input) => input.title !== undefined || input.content !== undefined, {
    message: 'At least one block field is required.',
  });

const noteVersionInputSchema = z.object({
  noteId: entityIdSchema.describe('ID of the note.'),
  expectedVersion: expectedVersionSchema,
});

const trashStateTokenSchema = z
  .string()
  .length(64)
  .regex(/^[a-f0-9]+$/)
  .describe('Trash state token returned by get_trash_status.');

export const commandInputSchemas = {
  notex_status: emptyInputSchema,
  search_notes: z.object({
    query: z
      .string()
      .max(500)
      .describe('Search terms. A note matches when any term appears in its header, blocks, tags, or collection.')
      .default(''),
    location: noteLocationSchema.default('active'),
    limit: z.number().int().min(1).max(50).default(20),
  }),
  get_note: z.object({ noteId: entityIdSchema }),
  get_note_block: z.object({ noteId: entityIdSchema, blockId: entityIdSchema }),
  get_trash_status: emptyInputSchema,
  list_tags: z.object({
    query: z.string().max(200).default(''),
    limit: z.number().int().min(1).max(100).default(100),
  }),
  list_collections: z.object({
    query: z.string().max(200).default(''),
    limit: z.number().int().min(1).max(100).default(100),
  }),
  create_note: z.object({
    title: inlineRichTextInputSchema.describe('Title of the new note. Omit to create an empty note title.').optional(),
    subtitle: inlineRichTextInputSchema
      .describe('Subtitle of the new note. Omit to create an empty note subtitle.')
      .optional(),
    collectionId: entityIdSchema
      .nullable()
      .describe('Existing collection ID for the new note. Omit or use null for no collection.')
      .optional(),
    tagIds: z
      .array(entityIdSchema)
      .max(50)
      .describe('Existing tag IDs to assign to the new note. Omit for no tags.')
      .default([]),
    blocks: z
      .array(
        z.object({
          title: inlineRichTextInputSchema.describe('Optional title of this new block.').optional(),
          content: blockRichTextInputSchema.describe('Optional body of this new block.').optional(),
        }),
      )
      .max(100)
      .describe('Ordered blocks to create in the new note. Omit to create the note without blocks.')
      .default([]),
  }),
  update_note_header: updateNoteHeaderInputSchema,
  add_note_block: z.object({
    noteId: entityIdSchema.describe('ID of the note that will receive the new block.'),
    expectedVersion: expectedVersionSchema,
    title: inlineRichTextInputSchema
      .describe('Optional title of the new block. Omit for an empty block title.')
      .optional(),
    content: blockRichTextInputSchema
      .describe('Optional body of the new block. Omit for an empty block body.')
      .optional(),
  }),
  update_note_block: updateNoteBlockInputSchema,
  set_note_tags: z.object({
    noteId: entityIdSchema.describe('ID of the note whose tags will be replaced.'),
    expectedVersion: expectedVersionSchema,
    tagIds: z
      .array(entityIdSchema)
      .max(50)
      .describe('Complete replacement set of existing tag IDs. Use an empty array to remove all tags.'),
  }),
  move_note_to_trash: noteVersionInputSchema,
  restore_note: noteVersionInputSchema,
  delete_note_permanently: noteVersionInputSchema,
  clear_trash: z.object({
    expectedStateToken: trashStateTokenSchema,
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
  get_trash_status: z.object({
    noteCount: z.number().int().nonnegative(),
    stateToken: trashStateTokenSchema,
  }),
  list_tags: z.object({ tags: z.array(tagDtoSchema) }),
  list_collections: z.object({ collections: z.array(collectionDtoSchema) }),
  create_note: mutationResultSchema.extend({ blockIds: z.array(entityIdSchema) }),
  update_note_header: mutationResultSchema,
  add_note_block: mutationResultSchema.extend({ blockId: entityIdSchema }),
  update_note_block: mutationResultSchema.extend({ blockId: entityIdSchema }),
  set_note_tags: mutationResultSchema,
  move_note_to_trash: mutationResultSchema,
  restore_note: mutationResultSchema,
  delete_note_permanently: z.object({
    noteId: entityIdSchema,
    deleted: z.literal(true),
  }),
  clear_trash: z.object({
    deletedCount: z.number().int().nonnegative(),
  }),
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
  get_trash_status: 'notex:read',
  list_tags: 'notex:read',
  list_collections: 'notex:read',
  create_note: 'notex:create',
  update_note_header: 'notex:edit',
  add_note_block: 'notex:edit',
  update_note_block: 'notex:edit',
  set_note_tags: 'notex:edit',
  move_note_to_trash: 'notex:edit',
  restore_note: 'notex:edit',
  delete_note_permanently: 'notex:delete',
  clear_trash: 'notex:delete',
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
  search_notes: 'Search NoteX notes by independent terms across note headers, blocks, tags, and collections, ranked by relevance.',
  get_note: 'Read one NoteX note header and its ordered block summaries.',
  get_note_block: 'Read the exact supported rich-text content of one NoteX note block.',
  get_trash_status: 'Read the current trash count and state token required by clear_trash.',
  list_tags: 'List existing NoteX tags. Use returned IDs in write tools.',
  list_collections: 'List existing NoteX collections. Use returned IDs in write tools.',
  create_note: 'Create a NoteX note, optionally with rich-text blocks and existing tags.',
  update_note_header: 'Update selected inline-rich-text header fields using optimistic versioning.',
  add_note_block: 'Append a rich-text block to a NoteX note using optimistic versioning.',
  update_note_block: 'Replace selected block fields using optimistic versioning. Content is the complete new body.',
  set_note_tags: 'Replace a NoteX note tag set with existing tag IDs using optimistic versioning.',
  move_note_to_trash: 'Move an active NoteX note to trash using optimistic versioning.',
  restore_note: 'Restore a NoteX note from trash using optimistic versioning.',
  delete_note_permanently: 'Permanently delete one NoteX note that is already in trash.',
  clear_trash: 'Permanently delete the complete NoteX trash if its state has not changed.',
};

const destructiveCommands = new Set<CommandName>([
  'move_note_to_trash',
  'delete_note_permanently',
  'clear_trash',
]);

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
        destructiveHint: destructiveCommands.has(command),
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
