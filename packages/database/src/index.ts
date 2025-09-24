// Database types, queries, and utilities
// Main exports for the database package

// Client and configuration
export { supabase } from './client';
export type { Database } from './database.types';

// Re-export Supabase types for convenience
export type { User, Session, AuthError } from '@supabase/supabase-js';

// Types and schemas
export * from './types';

// Repository and operations
export { KnowledgeCardRepository } from './repository';

// Utilities
export { migrateContent, getDefaultContent, getDefaultMetadata } from './types';