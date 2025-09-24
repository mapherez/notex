// Knowledge Cards Repository
// CRUD operations and queries for knowledge cards

import { supabase } from './client';
import type {
  KnowledgeCard,
  CreateKnowledgeCard,
  UpdateKnowledgeCard,
  SearchFilters,
  SearchResult,
} from './types';
import { 
  KnowledgeCardSchema, 
  migrateContent, 
  getDefaultContent, 
  getDefaultMetadata 
} from './types';

export class KnowledgeCardRepository {
  // Create a new knowledge card
  static async create(data: CreateKnowledgeCard): Promise<KnowledgeCard> {
    const cardData = {
      ...data,
      content: data.content || getDefaultContent(),
      metadata: data.metadata || getDefaultMetadata(),
      status: data.status || 'draft' as const,
    };

    const { data: result, error } = await supabase
      .from('knowledge_cards')
      .insert(cardData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create knowledge card: ${error.message}`);
    }

    return this.mapRowToCard(result);
  }

  // Get a knowledge card by ID
  static async getById(id: string): Promise<KnowledgeCard | null> {
    const { data, error } = await supabase
      .from('knowledge_cards')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to get knowledge card: ${error.message}`);
    }

    return this.mapRowToCard(data);
  }

  // Get a knowledge card by slug
  static async getBySlug(slug: string): Promise<KnowledgeCard | null> {
    const { data, error } = await supabase
      .from('knowledge_cards')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to get knowledge card: ${error.message}`);
    }

    return this.mapRowToCard(data);
  }

  // Update a knowledge card
  static async update(id: string, data: Partial<UpdateKnowledgeCard>): Promise<KnowledgeCard> {
    const updateData = {
      ...data,
      updated_at: new Date().toISOString(),
    };

    const { data: result, error } = await supabase
      .from('knowledge_cards')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update knowledge card: ${error.message}`);
    }

    return this.mapRowToCard(result);
  }

  // Delete a knowledge card
  static async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('knowledge_cards')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete knowledge card: ${error.message}`);
    }
  }

  // List knowledge cards with optional filters
  static async list(filters?: SearchFilters, limit = 20, offset = 0): Promise<KnowledgeCard[]> {
    let query = supabase
      .from('knowledge_cards')
      .select('*')
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (filters?.category) {
      query = query.eq('category', filters.category);
    }
    
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list knowledge cards: ${error.message}`);
    }

    return data.map(row => this.mapRowToCard(row));
  }

  // Search knowledge cards using full-text search
  static async search(query: string, filters?: SearchFilters, limit = 20): Promise<SearchResult[]> {
    // For now, use a simple title/content search
    // TODO: Implement proper full-text search with PostgreSQL
    let searchQuery = supabase
      .from('knowledge_cards')
      .select('*')
      .or(`title.ilike.%${query}%,content->>summary.ilike.%${query}%,content->>body.ilike.%${query}%`)
      .limit(limit);

    // Apply filters
    if (filters?.category) {
      searchQuery = searchQuery.eq('category', filters.category);
    }
    
    if (filters?.status) {
      searchQuery = searchQuery.eq('status', filters.status);
    }

    const { data, error } = await searchQuery;

    if (error) {
      throw new Error(`Failed to search knowledge cards: ${error.message}`);
    }

    // Map to search results with basic scoring
    return data.map(row => ({
      card: this.mapRowToCard(row),
      score: this.calculateScore(row, query),
      highlights: this.generateHighlights(row, query),
    }));
  }

  // Get published cards only (for public access)
  static async getPublished(limit = 20, offset = 0): Promise<KnowledgeCard[]> {
    return this.list({ status: 'published' }, limit, offset);
  }

  // Get cards by category
  static async getByCategory(category: string, limit = 20, offset = 0): Promise<KnowledgeCard[]> {
    return this.list({ category }, limit, offset);
  }

  // Private helper methods
  private static mapRowToCard(row: any): KnowledgeCard {
    // Migrate content to latest version
    const migratedContent = migrateContent(row.content);
    
    const card = {
      ...row,
      content: migratedContent,
    };

    // Validate and return
    return KnowledgeCardSchema.parse(card);
  }

  private static calculateScore(row: any, query: string): number {
    // Simple scoring algorithm
    let score = 0;
    const lowerQuery = query.toLowerCase();
    
    if (row.title.toLowerCase().includes(lowerQuery)) {
      score += 10;
    }
    
    if (row.content?.summary?.toLowerCase()?.includes(lowerQuery)) {
      score += 5;
    }
    
    if (row.content?.body?.toLowerCase()?.includes(lowerQuery)) {
      score += 2;
    }
    
    return score;
  }

  private static generateHighlights(row: any, query: string): SearchResult['highlights'] {
    // Simple highlight generation
    const lowerQuery = query.toLowerCase();
    const highlights: SearchResult['highlights'] = {};
    
    if (row.title.toLowerCase().includes(lowerQuery)) {
      highlights.title = row.title;
    }
    
    if (row.content?.summary?.toLowerCase()?.includes(lowerQuery)) {
      highlights.summary = row.content.summary;
    }
    
    if (row.content?.body?.toLowerCase()?.includes(lowerQuery)) {
      // Get a snippet around the match
      const body = row.content.body;
      const index = body.toLowerCase().indexOf(lowerQuery);
      if (index !== -1) {
        const start = Math.max(0, index - 50);
        const end = Math.min(body.length, index + query.length + 50);
        highlights.body = body.substring(start, end);
      }
    }
    
    return highlights;
  }
}