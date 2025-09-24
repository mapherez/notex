-- NoteX Database Schema Migration
-- Creates the core knowledge_cards table with search capabilities

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create enums
CREATE TYPE card_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE difficulty_level AS ENUM ('beginner', 'intermediate', 'advanced');

-- Create the main knowledge_cards table
CREATE TABLE knowledge_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  status card_status DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Flexible content stored as JSONB
  content JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  
  -- Generated search vector for full-text search
  search_vector TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('portuguese', title), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(content->>'summary', '')), 'B') ||
    setweight(to_tsvector('portuguese', coalesce(content->>'body', '')), 'C')
  ) STORED
);

-- Create indexes for performance
CREATE INDEX idx_knowledge_cards_search ON knowledge_cards USING GIN(search_vector);
CREATE INDEX idx_knowledge_cards_category ON knowledge_cards(category);
CREATE INDEX idx_knowledge_cards_status ON knowledge_cards(status);
CREATE INDEX idx_knowledge_cards_created_at ON knowledge_cards(created_at DESC);
CREATE INDEX idx_knowledge_cards_updated_at ON knowledge_cards(updated_at DESC);
CREATE INDEX idx_knowledge_cards_slug ON knowledge_cards(slug);

-- Create GIN index for JSONB content searches
CREATE INDEX idx_knowledge_cards_content ON knowledge_cards USING GIN(content);
CREATE INDEX idx_knowledge_cards_metadata ON knowledge_cards USING GIN(metadata);

-- Create trigram indexes for fuzzy search
CREATE INDEX idx_knowledge_cards_title_trgm ON knowledge_cards USING GIN(title gin_trgm_ops);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER trigger_knowledge_cards_updated_at
  BEFORE UPDATE ON knowledge_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Function for advanced search with ranking
CREATE OR REPLACE FUNCTION search_knowledge_cards(
  search_query TEXT,
  match_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  title TEXT,
  category TEXT,
  status card_status,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  content JSONB,
  metadata JSONB,
  similarity REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    kc.id,
    kc.slug,
    kc.title,
    kc.category,
    kc.status,
    kc.created_at,
    kc.updated_at,
    kc.content,
    kc.metadata,
    (
      ts_rank(kc.search_vector, websearch_to_tsquery('portuguese', search_query)) +
      word_similarity(search_query, kc.title) * 0.5
    )::REAL as similarity
  FROM knowledge_cards kc
  WHERE 
    kc.search_vector @@ websearch_to_tsquery('portuguese', search_query)
    OR kc.title % search_query
  ORDER BY similarity DESC
  LIMIT match_limit;
END;
$$ LANGUAGE plpgsql;

-- Insert some sample data for testing
INSERT INTO knowledge_cards (slug, title, category, content, metadata, status) VALUES
(
  'acordo-ortografico-1990',
  'Acordo Ortográfico de 1990',
  'ortografia',
  '{
    "version": 2,
    "summary": "Principais mudanças introduzidas pelo Acordo Ortográfico da Língua Portuguesa de 1990.",
    "body": "O Acordo Ortográfico de 1990 trouxe várias mudanças à grafia das palavras em português. As principais alterações incluem a eliminação do trema, mudanças no uso do hífen, e alterações na acentuação de algumas palavras.",
    "examples": [
      "linguiça (antes: lingüiça)",
      "antissocial (antes: anti-social)",
      "ideia (antes: idéia)"
    ],
    "sources": [
      "Portal da Língua Portuguesa",
      "Academia Brasileira de Letras"
    ]
  }',
  '{
    "tags": ["acordo-ortográfico", "reforma", "ortografia"],
    "language": "pt-PT",
    "region": "CPLP",
    "difficulty": "intermediate"
  }',
  'published'
),
(
  'uso-crase',
  'Uso da Crase',
  'sintaxe',
  '{
    "version": 2,
    "summary": "Regras para o uso correto da crase em português.",
    "body": "A crase é a fusão da preposição ''a'' com o artigo definido feminino ''a'' ou com o pronome demonstrativo ''aquela'' e suas variantes. É indicada pelo acento grave (à).",
    "examples": [
      "Vou à escola.",
      "Refiro-me àquela situação.",
      "Das 14h às 18h."
    ],
    "sources": [
      "Gramática da Língua Portuguesa",
      "Manual de Redação"
    ]
  }',
  '{
    "tags": ["crase", "acentuação", "sintaxe"],
    "language": "pt-PT",
    "region": "PT",
    "difficulty": "advanced"
  }',
  'published'
);

-- Row Level Security (RLS) policies
ALTER TABLE knowledge_cards ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read published cards
CREATE POLICY "Anyone can read published cards" ON knowledge_cards
  FOR SELECT USING (status = 'published');

-- Policy: Authenticated users can read all their cards
CREATE POLICY "Users can read their own cards" ON knowledge_cards
  FOR SELECT USING (auth.uid()::text = metadata->>'created_by');

-- Policy: Authenticated users can insert cards
CREATE POLICY "Authenticated users can insert cards" ON knowledge_cards
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policy: Users can update their own cards
CREATE POLICY "Users can update their own cards" ON knowledge_cards
  FOR UPDATE USING (auth.uid()::text = metadata->>'created_by');

-- Policy: Users can delete their own cards
CREATE POLICY "Users can delete their own cards" ON knowledge_cards
  FOR DELETE USING (auth.uid()::text = metadata->>'created_by');