// Knowledge Cards Repository
// CRUD operations and queries for knowledge cards

import { supabase } from './client';
import type { Database } from './database.types';
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
    // Check authentication and permissions
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required');

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('can_create')
      .eq('id', user.id)
      .single();

    if (!profile?.can_create) {
      throw new Error('Create permission required');
    }

    const cardData: Database['public']['Tables']['knowledge_cards']['Insert'] = {
      ...data,
      content: data.content || getDefaultContent(),
      metadata: {
        ...getDefaultMetadata(),
        ...data.metadata,
        created_by: user.id,
      },
      status: data.status || 'draft',
    };

    const { data: result, error } = await supabase
      .from('knowledge_cards')
      .insert(cardData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create knowledge card: ${error.message}`);
    }

    return KnowledgeCardRepository.mapRowToCard(result);
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

    return KnowledgeCardRepository.mapRowToCard(data);
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

    return KnowledgeCardRepository.mapRowToCard(data);
  }

  // Update a knowledge card
  static async update(id: string, data: Partial<UpdateKnowledgeCard>): Promise<KnowledgeCard> {
    // Check authentication and permissions
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required');

    // Get current card to check permissions
    const currentCard = await KnowledgeCardRepository.getById(id);
    if (!currentCard) throw new Error('Card not found');

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    // Check permissions: admins can edit anything, normal users only if editable_by_others is true
    const canEdit = profile?.role === 'admin' ||
      (profile?.role === 'normal' && currentCard.editable_by_others);

    if (!canEdit) {
      throw new Error('Edit permission required');
    }

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

    return KnowledgeCardRepository.mapRowToCard(result);
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
  static async list(filters?: Partial<SearchFilters>, limit = 20, offset = 0): Promise<KnowledgeCard[]> {
    let query = supabase
      .from('knowledge_cards')
      .select('*')
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply category filters
    if (filters?.categories && filters.categories.length > 0) {
      query = query.in('category', filters.categories);
    }
    
    // Apply status filter
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    // Apply date range filters
    if (filters?.dateRange?.from) {
      query = query.gte('created_at', filters.dateRange.from.toISOString());
    }
    if (filters?.dateRange?.to) {
      query = query.lte('created_at', filters.dateRange.to.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list knowledge cards: ${error.message}`);
    }

    return data.map(row => KnowledgeCardRepository.mapRowToCard(row));
  }

  // Search knowledge cards using full-text search
  static async search(query: string = '', filters?: SearchFilters, limit = 20): Promise<SearchResult[]> {
    let searchQuery = supabase
      .from('knowledge_cards')
      .select('*')
      .limit(limit);

    // Apply text search if query provided
    if (query.trim()) {
      searchQuery = searchQuery.or(
        `title.ilike.%${query}%,content->>summary.ilike.%${query}%,content->>body.ilike.%${query}%`
      );
    }

    // Apply category filters
    if (filters?.categories && filters.categories.length > 0) {
      searchQuery = searchQuery.in('category', filters.categories);
    }
    
    // Apply status filter
    if (filters?.status) {
      searchQuery = searchQuery.eq('status', filters.status);
    }

    // Apply date range filters
    if (filters?.dateRange?.from) {
      searchQuery = searchQuery.gte('created_at', filters.dateRange.from.toISOString());
    }
    if (filters?.dateRange?.to) {
      searchQuery = searchQuery.lte('created_at', filters.dateRange.to.toISOString());
    }

    // Apply difficulty filters by checking metadata
    if (filters?.difficulty && filters.difficulty.length > 0) {
      // For difficulty, we need to filter by metadata->difficulty or content->difficulty
      const difficultyConditions = filters.difficulty.map(diff => 
        `metadata->>difficulty.eq.${diff},content->>difficulty.eq.${diff}`
      ).join(',');
      searchQuery = searchQuery.or(difficultyConditions);
    }

    // Apply tag filters
    if (filters?.tags && filters.tags.length > 0) {
      // Check if any of the selected tags are in the metadata->tags array
      const tagConditions = filters.tags.map(tag => 
        `metadata->>tags.cs.["${tag}"]`
      ).join(',');
      searchQuery = searchQuery.or(tagConditions);
    }

    // Order by relevance (updated_at for now, could be improved with proper scoring)
    searchQuery = searchQuery.order('updated_at', { ascending: false });

    const { data, error } = await searchQuery;

    if (error) {
      throw new Error(`Failed to search knowledge cards: ${error.message}`);
    }

    // Map to search results with basic scoring
    return data.map(row => ({
      card: KnowledgeCardRepository.mapRowToCard(row),
      score: KnowledgeCardRepository.calculateScore(row, query),
      highlights: KnowledgeCardRepository.generateHighlights(row, query),
    }));
  }

  // Get search suggestions based on existing cards
  static async getSearchSuggestions(query: string, limit = 8): Promise<string[]> {
    if (!query.trim()) return [];

    const { data, error } = await supabase
      .from('knowledge_cards')
      .select('title, category, metadata')
      .or(`title.ilike.%${query}%,category.ilike.%${query}%`)
      .limit(limit * 2); // Get more to deduplicate

    if (error) {
      console.warn('Failed to get search suggestions:', error.message);
      return [];
    }

    const suggestions = new Set<string>();
    
    data.forEach(row => {
      // Add matching titles
      if (row.title.toLowerCase().includes(query.toLowerCase())) {
        suggestions.add(row.title);
      }
      
      // Add matching categories
      if (row.category.toLowerCase().includes(query.toLowerCase())) {
        suggestions.add(row.category);
      }
      
      // Add matching tags
      if (row.metadata?.tags) {
        row.metadata.tags.forEach((tag: string) => {
          if (tag.toLowerCase().includes(query.toLowerCase())) {
            suggestions.add(tag);
          }
        });
      }
    });

    return Array.from(suggestions).slice(0, limit);
  }

  // Get all unique categories for filter options
  static async getCategories(): Promise<string[]> {
    const { data, error } = await supabase
      .from('knowledge_cards')
      .select('category')
      .not('category', 'is', null);

    if (error) {
      throw new Error(`Failed to get categories: ${error.message}`);
    }

    const categories = [...new Set(data.map(row => row.category))];
    return categories.sort();
  }

  // Get all unique tags for filter options
  static async getTags(): Promise<string[]> {
    const { data, error } = await supabase
      .from('knowledge_cards')
      .select('metadata')
      .not('metadata', 'is', null);

    if (error) {
      throw new Error(`Failed to get tags: ${error.message}`);
    }

    const allTags = new Set<string>();
    data.forEach(row => {
      if (row.metadata?.tags && Array.isArray(row.metadata.tags)) {
        row.metadata.tags.forEach((tag: string) => allTags.add(tag));
      }
    });

    return Array.from(allTags).sort();
  }

  // Get published cards only (for public access)
  static async getPublished(limit = 20, offset = 0): Promise<KnowledgeCard[]> {
    return this.list({ status: 'published' }, limit, offset);
  }

  // Get cards by category
  static async getByCategory(category: string, limit = 20, offset = 0): Promise<KnowledgeCard[]> {
    return this.list({ categories: [category] }, limit, offset);
  }

  // Private helper methods
  private static mapRowToCard(row: Database['public']['Tables']['knowledge_cards']['Row']): KnowledgeCard {
    // Migrate content to latest version
    const migratedContent = migrateContent(row.content);
    
    const card = {
      ...row,
      content: migratedContent,
    };

    // Validate and return
    return KnowledgeCardSchema.parse(card);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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