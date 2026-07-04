-- Search Security & Missing Tables Fix
-- Date: 2026-03-31
-- Fixes: RLS, anon grants, missing tables + RPC
-- Defensive: creates tables if Week 6 migration was never run

-- =====================================================
-- 0. ENSURE BASE TABLES EXIST (from Week 6 migration)
-- =====================================================
-- These may not exist if 20251219_001_week6_search_tables.sql was skipped

DO $$
BEGIN
  -- embeddings table
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    CREATE TABLE IF NOT EXISTS embeddings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      content_type TEXT NOT NULL,
      source_id UUID NOT NULL,
      source_type TEXT NOT NULL,
      text_content TEXT,
      embedding vector(1536),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  ELSE
    CREATE TABLE IF NOT EXISTS embeddings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      content_type TEXT NOT NULL,
      source_id UUID NOT NULL,
      source_type TEXT NOT NULL,
      text_content TEXT,
      embedding JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_embeddings_source ON embeddings(source_id, source_type);

CREATE TABLE IF NOT EXISTS search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  query TEXT NOT NULL,
  search_type TEXT NOT NULL DEFAULT 'keyword',
  results_count INTEGER DEFAULT 0,
  execution_time INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_search_history_created ON search_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(user_id) WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  name TEXT NOT NULL,
  query TEXT NOT NULL,
  search_type TEXT NOT NULL DEFAULT 'semantic',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_saved_searches_created ON saved_searches(created_at DESC);

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  title TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_started ON conversations(started_at DESC);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  citations JSONB,
  confidence DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_conv_messages_conversation ON conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_messages_created ON conversation_messages(created_at);

-- =====================================================
-- 1. ENABLE RLS ON SEARCH TABLES
-- =====================================================
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 2. CREATE RLS POLICIES (skip if already exist)
-- =====================================================
DO $$
BEGIN
  -- search_history
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'search_history_select_own') THEN
    CREATE POLICY "search_history_select_own" ON search_history FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'search_history_insert_own') THEN
    CREATE POLICY "search_history_insert_own" ON search_history FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'search_history_delete_own') THEN
    CREATE POLICY "search_history_delete_own" ON search_history FOR DELETE USING (user_id = auth.uid());
  END IF;

  -- saved_searches
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'saved_searches_select_own') THEN
    CREATE POLICY "saved_searches_select_own" ON saved_searches FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'saved_searches_insert_own') THEN
    CREATE POLICY "saved_searches_insert_own" ON saved_searches FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'saved_searches_update_own') THEN
    CREATE POLICY "saved_searches_update_own" ON saved_searches FOR UPDATE USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'saved_searches_delete_own') THEN
    CREATE POLICY "saved_searches_delete_own" ON saved_searches FOR DELETE USING (user_id = auth.uid());
  END IF;

  -- conversations
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'conversations_select_own') THEN
    CREATE POLICY "conversations_select_own" ON conversations FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'conversations_insert_own') THEN
    CREATE POLICY "conversations_insert_own" ON conversations FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'conversations_update_own') THEN
    CREATE POLICY "conversations_update_own" ON conversations FOR UPDATE USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'conversations_delete_own') THEN
    CREATE POLICY "conversations_delete_own" ON conversations FOR DELETE USING (user_id = auth.uid());
  END IF;

  -- conversation_messages (via conversation ownership)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'conv_messages_select_own') THEN
    CREATE POLICY "conv_messages_select_own" ON conversation_messages
      FOR SELECT USING (conversation_id IN (SELECT id FROM conversations WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'conv_messages_insert_own') THEN
    CREATE POLICY "conv_messages_insert_own" ON conversation_messages
      FOR INSERT WITH CHECK (conversation_id IN (SELECT id FROM conversations WHERE user_id = auth.uid()));
  END IF;

  -- embeddings (read-only for authenticated)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'embeddings_select_authenticated') THEN
    CREATE POLICY "embeddings_select_authenticated" ON embeddings FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- =====================================================
-- 3. REVOKE DANGEROUS ANON GRANTS
-- =====================================================
-- These are safe to run even if the grants don't exist
REVOKE DELETE ON saved_searches FROM anon;
REVOKE DELETE ON conversations FROM anon;
REVOKE INSERT ON search_history FROM anon;
REVOKE INSERT ON saved_searches FROM anon;
REVOKE INSERT ON conversations FROM anon;
REVOKE INSERT ON conversation_messages FROM anon;

-- Ensure authenticated users still have proper access
GRANT SELECT, INSERT, UPDATE, DELETE ON embeddings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON search_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON saved_searches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON conversation_messages TO authenticated;

-- Anon gets read-only on safe tables
GRANT SELECT ON search_history TO anon;
GRANT SELECT ON saved_searches TO anon;
GRANT SELECT ON embeddings TO anon;

-- =====================================================
-- 4. CREATE search_documents TABLE
-- =====================================================
-- Used by src/search/indexer.ts and retriever.ts
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    CREATE TABLE IF NOT EXISTS search_documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      title TEXT,
      content TEXT,
      embedding vector(768),  -- Gemini text-embedding-004 produces 768-dim vectors
      metadata JSONB DEFAULT '{}',
      indexed_at TIMESTAMPTZ DEFAULT NOW(),
      chunk_index INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(source_type, source_id)
    );
    RAISE NOTICE 'Created search_documents table with vector(768) support';
  ELSE
    CREATE TABLE IF NOT EXISTS search_documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      title TEXT,
      content TEXT,
      embedding JSONB,  -- Fallback if pgvector not available
      metadata JSONB DEFAULT '{}',
      indexed_at TIMESTAMPTZ DEFAULT NOW(),
      chunk_index INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(source_type, source_id)
    );
    RAISE NOTICE 'Created search_documents table WITHOUT vector support';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_search_docs_source ON search_documents(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_search_docs_indexed ON search_documents(indexed_at DESC);

-- RLS for search_documents
ALTER TABLE search_documents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'search_docs_select_authenticated') THEN
    CREATE POLICY "search_docs_select_authenticated" ON search_documents FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

GRANT SELECT ON search_documents TO authenticated;
GRANT SELECT ON search_documents TO anon;

-- =====================================================
-- 5. CREATE search_documents_by_embedding RPC
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    CREATE OR REPLACE FUNCTION search_documents_by_embedding(
      query_embedding vector(768),
      match_threshold FLOAT DEFAULT 0.7,
      match_count INT DEFAULT 20,
      filter_source_types TEXT[] DEFAULT NULL,
      filter_date_from TIMESTAMPTZ DEFAULT NULL,
      filter_date_to TIMESTAMPTZ DEFAULT NULL
    )
    RETURNS TABLE (
      id UUID,
      source_type TEXT,
      source_id TEXT,
      title TEXT,
      content TEXT,
      metadata JSONB,
      similarity FLOAT
    )
    LANGUAGE plpgsql
    AS $func$
    BEGIN
      RETURN QUERY
      SELECT
        sd.id,
        sd.source_type,
        sd.source_id,
        sd.title,
        sd.content,
        sd.metadata,
        1 - (sd.embedding <=> query_embedding) AS similarity
      FROM search_documents sd
      WHERE 1 - (sd.embedding <=> query_embedding) > match_threshold
        AND (filter_source_types IS NULL OR sd.source_type = ANY(filter_source_types))
        AND (filter_date_from IS NULL OR sd.indexed_at >= filter_date_from)
        AND (filter_date_to IS NULL OR sd.indexed_at <= filter_date_to)
      ORDER BY sd.embedding <=> query_embedding
      LIMIT match_count;
    END;
    $func$;
    RAISE NOTICE 'Created search_documents_by_embedding RPC function';
  END IF;
END $$;

-- =====================================================
-- 6. FIX EMBEDDING DIMENSION ON EXISTING TABLE
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'embeddings'
      AND column_name = 'embedding'
      AND udt_name = 'vector'
    ) THEN
      -- Drop the old 1536-dim search function
      DROP FUNCTION IF EXISTS search_embeddings(vector(1536), INT, FLOAT);

      -- Alter column to 768-dim
      BEGIN
        ALTER TABLE embeddings ALTER COLUMN embedding TYPE vector(768);
        RAISE NOTICE 'Updated embeddings.embedding to vector(768)';
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not alter embeddings dimension - may have existing data. Skipping.';
      END;

      -- Recreate search function with correct 768-dim
      CREATE OR REPLACE FUNCTION search_embeddings(
        query_embedding vector(768),
        match_count INT DEFAULT 10,
        similarity_threshold FLOAT DEFAULT 0.5
      )
      RETURNS TABLE (
        id UUID,
        content_type TEXT,
        source_id UUID,
        source_type TEXT,
        text_content TEXT,
        similarity FLOAT
      )
      LANGUAGE plpgsql
      AS $func$
      BEGIN
        RETURN QUERY
        SELECT
          e.id,
          e.content_type,
          e.source_id,
          e.source_type,
          e.text_content,
          1 - (e.embedding <=> query_embedding) AS similarity
        FROM embeddings e
        WHERE 1 - (e.embedding <=> query_embedding) > similarity_threshold
        ORDER BY e.embedding <=> query_embedding
        LIMIT match_count;
      END;
      $func$;
      RAISE NOTICE 'Recreated search_embeddings function with vector(768)';
    END IF;
  END IF;
END $$;

-- =====================================================
-- 7. TABLE COMMENTS
-- =====================================================
COMMENT ON TABLE search_documents IS 'Indexed documents for RAG vector search (Search Revisal 2026-03-31)';
COMMENT ON TABLE embeddings IS 'Stores vector embeddings for semantic search';
COMMENT ON TABLE search_history IS 'Tracks user search queries for analytics and suggestions';
COMMENT ON TABLE saved_searches IS 'User-saved search queries for quick access';
COMMENT ON TABLE conversations IS 'Ask AI conversation threads';
COMMENT ON TABLE conversation_messages IS 'Individual messages in Ask AI conversations';
