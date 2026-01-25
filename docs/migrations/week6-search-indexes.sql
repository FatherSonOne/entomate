-- ============================================
-- Week 6: Search Optimization Indexes
-- Run these in Supabase SQL Editor
-- ============================================

-- 1. Enable pg_trgm extension for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Enable pgvector extension for semantic search (if not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- MEETINGS TABLE INDEXES
-- ============================================

-- Index for text search on title (GIN trigram for ILIKE queries)
CREATE INDEX IF NOT EXISTS idx_meetings_title_trgm
ON meetings USING gin (title gin_trgm_ops);

-- Index for text search on summary
CREATE INDEX IF NOT EXISTS idx_meetings_summary_trgm
ON meetings USING gin (summary gin_trgm_ops);

-- Index for text search on transcript (if searching transcripts)
CREATE INDEX IF NOT EXISTS idx_meetings_transcript_trgm
ON meetings USING gin (transcript gin_trgm_ops);

-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_meetings_created_at
ON meetings (created_at DESC);

-- Index for sentiment filtering
CREATE INDEX IF NOT EXISTS idx_meetings_sentiment
ON meetings (sentiment_label);

-- Composite index for common query pattern (date + sentiment)
CREATE INDEX IF NOT EXISTS idx_meetings_date_sentiment
ON meetings (created_at DESC, sentiment_label);

-- ============================================
-- PROJECTS TABLE INDEXES
-- ============================================

-- Index for text search on project name
CREATE INDEX IF NOT EXISTS idx_projects_name_trgm
ON projects USING gin (name gin_trgm_ops);

-- Index for text search on description
CREATE INDEX IF NOT EXISTS idx_projects_description_trgm
ON projects USING gin (description gin_trgm_ops);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_projects_status
ON projects (status);

-- Index for date ordering
CREATE INDEX IF NOT EXISTS idx_projects_created_at
ON projects (created_at DESC);

-- ============================================
-- TASKS TABLE INDEXES
-- ============================================

-- Index for text search on task title
CREATE INDEX IF NOT EXISTS idx_tasks_title_trgm
ON tasks USING gin (title gin_trgm_ops);

-- Index for text search on description
CREATE INDEX IF NOT EXISTS idx_tasks_description_trgm
ON tasks USING gin (description gin_trgm_ops);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_tasks_status
ON tasks (status);

-- Index for priority filtering
CREATE INDEX IF NOT EXISTS idx_tasks_priority
ON tasks (priority);

-- Composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_tasks_status_priority
ON tasks (status, priority);

-- Index for date ordering
CREATE INDEX IF NOT EXISTS idx_tasks_created_at
ON tasks (created_at DESC);

-- Index for project lookup
CREATE INDEX IF NOT EXISTS idx_tasks_project_id
ON tasks (project_id);

-- ============================================
-- ACTION_ITEMS TABLE INDEXES
-- ============================================

-- Index for text search on task description
CREATE INDEX IF NOT EXISTS idx_action_items_description_trgm
ON action_items USING gin (task_description gin_trgm_ops);

-- Index for assignee search
CREATE INDEX IF NOT EXISTS idx_action_items_assigned_trgm
ON action_items USING gin (assigned_to_name gin_trgm_ops);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_action_items_status
ON action_items (status);

-- Index for priority filtering
CREATE INDEX IF NOT EXISTS idx_action_items_priority
ON action_items (priority);

-- Index for meeting lookup
CREATE INDEX IF NOT EXISTS idx_action_items_meeting_id
ON action_items (meeting_id);

-- Index for date ordering
CREATE INDEX IF NOT EXISTS idx_action_items_created_at
ON action_items (created_at DESC);

-- ============================================
-- SEARCH_HISTORY TABLE INDEXES
-- ============================================

-- Index for date range queries on search history
CREATE INDEX IF NOT EXISTS idx_search_history_created_at
ON search_history (created_at DESC);

-- Index for search type analytics
CREATE INDEX IF NOT EXISTS idx_search_history_type
ON search_history (search_type);

-- Composite for analytics queries
CREATE INDEX IF NOT EXISTS idx_search_history_analytics
ON search_history (created_at DESC, search_type, results_count);

-- ============================================
-- EMBEDDINGS TABLE INDEXES (if using pgvector)
-- ============================================

-- Vector similarity search index (IVFFlat for faster approximate search)
-- Note: Adjust lists parameter based on data size. Rule of thumb: sqrt(num_rows)
-- For <1000 rows: lists = 10
-- For 1000-10000 rows: lists = 100
-- For >10000 rows: lists = sqrt(rows)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'embeddings') THEN
    -- Drop existing index if it exists
    DROP INDEX IF EXISTS idx_embeddings_vector;

    -- Create IVFFlat index for cosine similarity
    CREATE INDEX idx_embeddings_vector
    ON embeddings USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

    RAISE NOTICE 'Created vector index on embeddings table';
  ELSE
    RAISE NOTICE 'Embeddings table does not exist, skipping vector index';
  END IF;
END $$;

-- Index for source lookup
CREATE INDEX IF NOT EXISTS idx_embeddings_source
ON embeddings (source_id, source_type);

-- Index for content type filtering
CREATE INDEX IF NOT EXISTS idx_embeddings_content_type
ON embeddings (content_type);

-- ============================================
-- CONVERSATIONS TABLE INDEXES
-- ============================================

-- Index for conversation listing
CREATE INDEX IF NOT EXISTS idx_conversations_started_at
ON conversations (started_at DESC);

-- ============================================
-- CONVERSATION_MESSAGES TABLE INDEXES
-- ============================================

-- Index for message retrieval by conversation
CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation
ON conversation_messages (conversation_id, created_at ASC);

-- ============================================
-- SAVED_SEARCHES TABLE INDEXES
-- ============================================

-- Index for saved searches listing
CREATE INDEX IF NOT EXISTS idx_saved_searches_created_at
ON saved_searches (created_at DESC);

-- ============================================
-- CREATE VECTOR SEARCH FUNCTION (if pgvector is enabled)
-- ============================================

-- Function for semantic search using embeddings
CREATE OR REPLACE FUNCTION search_embeddings(
  query_embedding vector(1536),
  match_count int DEFAULT 10,
  similarity_threshold float DEFAULT 0.5
)
RETURNS TABLE (
  id uuid,
  content_type text,
  source_id uuid,
  source_type text,
  text_content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.content_type,
    e.source_id,
    e.source_type,
    e.text_content,
    1 - (e.embedding <=> query_embedding) as similarity
  FROM embeddings e
  WHERE 1 - (e.embedding <=> query_embedding) > similarity_threshold
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================
-- ANALYZE TABLES (update statistics for query planner)
-- ============================================

ANALYZE meetings;
ANALYZE projects;
ANALYZE tasks;
ANALYZE action_items;
ANALYZE search_history;

-- Check if embeddings table exists before analyzing
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'embeddings') THEN
    ANALYZE embeddings;
  END IF;
END $$;

-- ============================================
-- VERIFY INDEXES CREATED
-- ============================================

-- List all custom indexes we created
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
