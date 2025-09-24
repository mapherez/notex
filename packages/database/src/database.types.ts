// Generated database types for Supabase
// This file should be generated using: supabase gen types typescript --local

export interface Database {
  public: {
    Tables: {
      knowledge_cards: {
        Row: {
          id: string;
          slug: string;
          title: string;
          category: string;
          status: 'draft' | 'published' | 'archived';
          created_at: string;
          updated_at: string;
          content: Record<string, any>;
          metadata: Record<string, any>;
          search_vector?: string; // Generated column
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          category: string;
          status?: 'draft' | 'published' | 'archived';
          created_at?: string;
          updated_at?: string;
          content?: Record<string, any>;
          metadata?: Record<string, any>;
        };
        Update: {
          id?: string;
          slug?: string;
          title?: string;
          category?: string;
          status?: 'draft' | 'published' | 'archived';
          created_at?: string;
          updated_at?: string;
          content?: Record<string, any>;
          metadata?: Record<string, any>;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      search_knowledge_cards: {
        Args: {
          search_query: string;
          match_limit?: number;
        };
        Returns: {
          id: string;
          slug: string;
          title: string;
          category: string;
          status: string;
          created_at: string;
          updated_at: string;
          content: Record<string, any>;
          metadata: Record<string, any>;
          similarity: number;
        }[];
      };
    };
    Enums: {
      card_status: 'draft' | 'published' | 'archived';
      difficulty_level: 'beginner' | 'intermediate' | 'advanced';
    };
  };
}