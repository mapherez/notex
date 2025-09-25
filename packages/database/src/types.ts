// Database types and schemas for NoteX
import { z } from 'zod';

// Content versioning schemas
export const ContentV1Schema = z.object({
  version: z.literal(1),
  summary: z.string(),
  body: z.string(),
  examples: z.array(z.string()).optional(),
  sources: z.array(z.string()).optional(),
});

export const ContentV2Schema = z.object({
  version: z.literal(2),
  summary: z.string(),
  body: z.string(),
  examples: z.array(z.string()).optional(),
  sources: z.array(z.string()).optional(),
  relatedCards: z.array(z.string()).optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
});

// Union type for all content versions
export const ContentSchema = z.union([ContentV1Schema, ContentV2Schema]);

// Metadata schema
export const MetadataSchema = z.object({
  tags: z.array(z.string()).optional(),
  language: z.string().optional(),
  region: z.string().optional(),
  lastModifiedBy: z.string().optional(),
}).passthrough(); // Allow additional fields

// Main knowledge card schema
export const KnowledgeCardSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  category: z.string(),
  status: z.enum(['draft', 'published', 'archived']),
  created_at: z.string().transform((str) => {
    // Ensure the timestamp is in a valid ISO format
    return new Date(str).toISOString();
  }),
  updated_at: z.string().transform((str) => {
    // Ensure the timestamp is in a valid ISO format
    return new Date(str).toISOString();
  }),
  content: ContentSchema,
  metadata: MetadataSchema,
});

// Database row type (before processing)
export const KnowledgeCardRowSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  category: z.string(),
  status: z.enum(['draft', 'published', 'archived']),
  created_at: z.string(),
  updated_at: z.string(),
  content: z.record(z.any()), // Raw JSONB
  metadata: z.record(z.any()), // Raw JSONB
});

// Insert/Update schemas (omit generated fields)
export const CreateKnowledgeCardSchema = z.object({
  slug: z.string(),
  title: z.string(),
  category: z.string(),
  content: ContentSchema,
  metadata: MetadataSchema.optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
});

export const UpdateKnowledgeCardSchema = CreateKnowledgeCardSchema.partial().extend({
  id: z.string().uuid(),
});

// Search and filter schemas
export const SearchFiltersSchema = z.object({
  categories: z.array(z.string()).default([]),
  difficulty: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  dateRange: z.object({
    from: z.date().optional(),
    to: z.date().optional(),
  }).optional(),
});

export const SearchResultSchema = z.object({
  card: KnowledgeCardSchema,
  score: z.number(),
  highlights: z.object({
    title: z.string().optional(),
    summary: z.string().optional(),
    body: z.string().optional(),
  }).optional(),
});

// Type exports
export type ContentV1 = z.infer<typeof ContentV1Schema>;
export type ContentV2 = z.infer<typeof ContentV2Schema>;
export type Content = z.infer<typeof ContentSchema>;
export type Metadata = z.infer<typeof MetadataSchema>;
export type KnowledgeCard = z.infer<typeof KnowledgeCardSchema>;
export type KnowledgeCardRow = z.infer<typeof KnowledgeCardRowSchema>;
export type CreateKnowledgeCard = z.infer<typeof CreateKnowledgeCardSchema>;
export type UpdateKnowledgeCard = z.infer<typeof UpdateKnowledgeCardSchema>;
export type SearchFilters = z.infer<typeof SearchFiltersSchema>;
export type SearchResult = z.infer<typeof SearchResultSchema>;

// Content migration utility
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const migrateContent = (content: any): Content => {
  // If no version or version 1, upgrade to version 2
  if (!content.version || content.version === 1) {
    return ContentV2Schema.parse({
      ...content,
      version: 2,
    });
  }
  
  return ContentSchema.parse(content);
};

// Default content for new cards
export const getDefaultContent = (): ContentV2 => ({
  version: 2,
  summary: '',
  body: '',
  examples: [],
  sources: [],
  relatedCards: [],
});

// Default metadata for new cards
export const getDefaultMetadata = (): Metadata => ({
  tags: [],
  language: 'pt-PT',
  region: 'PT',
});