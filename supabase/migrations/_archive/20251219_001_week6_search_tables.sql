-- Week 6: AI Search & Semantic Assistant
-- Migration: Create tables for embeddings, search history, saved searches, and conversations

-- =====================================================
-- EMBEDDINGS TABLE (for semantic search)
-- =====================================================
-- Note: Requires pgvector extension to be enabled first
-- Run in Supabase Dashboard: Database > Extensions > Search "vector" > Enable

-- Check if pgvector is available, create table accordingly
DO $$
BEGIN
    -- Try to create with vector type if pgvector is enabled
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
        CREATE TABLE IF NOT EXISTS embeddings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            content_type TEXT NOT NULL, -- 'summary', 'action_item', 'key_points', 'decisions', 'transcript_chunk_N'
            source_id UUID NOT NULL, -- meeting_id or action_item_id
            source_type TEXT NOT NULL, -- 'meeting', 'action_item'
            text_content TEXT, -- Original text that was embedded
            embedding vector(1536), -- OpenAI embeddings are 1536-dim, Gemini are 768-dim
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Create index for faster vector search
        CREATE INDEX IF NOT EXISTS idx_embeddings_source ON embeddings(source_id, source_type);

        -- Create IVFFlat index for approximate nearest neighbor search
        -- Note: This requires at least 100 rows to work effectively
        -- CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON embeddings USING ivfflat (embedding vector_cosine_ops);

        RAISE NOTICE 'Created embeddings table with vector support';
    ELSE
        -- Fallback: Create table without vector type
        CREATE TABLE IF NOT EXISTS embeddings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            content_type TEXT NOT NULL,
            source_id UUID NOT NULL,
            source_type TEXT NOT NULL,
            text_content TEXT,
            embedding JSONB, -- Store as JSON array if vector not available
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_embeddings_source ON embeddings(source_id, source_type);

        RAISE NOTICE 'Created embeddings table WITHOUT vector support (pgvector not enabled)';
    END IF;
END $$;

-- =====================================================
-- SEARCH HISTORY TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS search_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID, -- Optional: for user-specific history
    query TEXT NOT NULL,
    search_type TEXT NOT NULL DEFAULT 'keyword', -- 'keyword', 'semantic'
    results_count INTEGER DEFAULT 0,
    execution_time INTEGER DEFAULT 0, -- milliseconds
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_history_created ON search_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(user_id) WHERE user_id IS NOT NULL;

-- =====================================================
-- SAVED SEARCHES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS saved_searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID, -- Optional: for user-specific saved searches
    name TEXT NOT NULL,
    query TEXT NOT NULL,
    search_type TEXT NOT NULL DEFAULT 'semantic',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_saved_searches_created ON saved_searches(created_at DESC);

-- =====================================================
-- CONVERSATIONS TABLE (for Ask AI chat history)
-- =====================================================
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID, -- Optional: for user-specific conversations
    title TEXT, -- Auto-generated from first question
    started_at TIMESTAMPTZ DEFAULT NOW(),
    last_message_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_started ON conversations(started_at DESC);

-- =====================================================
-- CONVERSATION MESSAGES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS conversation_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL, -- 'user', 'assistant'
    content TEXT NOT NULL,
    citations JSONB, -- Array of {type, id, title, relevance}
    confidence DECIMAL(3,2), -- 0.00 to 1.00
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conv_messages_conversation ON conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_messages_created ON conversation_messages(created_at);

-- =====================================================
-- VECTOR SEARCH FUNCTION (if pgvector is enabled)
-- =====================================================
-- This function will be used for semantic search
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
        -- Create or replace the search function
        CREATE OR REPLACE FUNCTION search_embeddings(
            query_embedding vector(1536),
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

        RAISE NOTICE 'Created search_embeddings function';
    END IF;
END $$;

-- =====================================================
-- RLS POLICIES (optional, for multi-tenant setup)
-- =====================================================
-- Enable RLS on tables if needed
-- ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- GRANTS
-- =====================================================
-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON embeddings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON search_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON saved_searches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON conversation_messages TO authenticated;

-- Grant to anon for public access (adjust as needed)
GRANT SELECT, INSERT ON search_history TO anon;
GRANT SELECT, INSERT, DELETE ON saved_searches TO anon;
GRANT SELECT, INSERT, DELETE ON conversations TO anon;
GRANT SELECT, INSERT ON conversation_messages TO anon;
GRANT SELECT ON embeddings TO anon;

COMMENT ON TABLE embeddings IS 'Stores vector embeddings for semantic search (Week 6)';
COMMENT ON TABLE search_history IS 'Tracks user search queries for analytics and suggestions (Week 6)';
COMMENT ON TABLE saved_searches IS 'User-saved search queries for quick access (Week 6)';
COMMENT ON TABLE conversations IS 'Ask AI conversation threads (Week 6)';
COMMENT ON TABLE conversation_messages IS 'Individual messages in Ask AI conversations (Week 6)';
