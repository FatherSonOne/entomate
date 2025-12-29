-- ========================================
-- Migration: 005_vector_store
-- Purpose: Vector store infrastructure for RAG and semantic search
-- Date: 2024-12-25
-- ========================================

-- ========================================
-- SECTION 1: ENABLE PGVECTOR EXTENSION
-- ========================================

-- Enable the pgvector extension for vector operations
-- Note: This requires the extension to be installed on your PostgreSQL instance
-- For Supabase, pgvector is pre-installed and just needs to be enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- ========================================
-- SECTION 2: VECTOR DOCUMENTS TABLE
-- Main storage for document chunks and embeddings
-- ========================================

CREATE TABLE IF NOT EXISTS vector_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Collection management
  collection_name VARCHAR(255) NOT NULL DEFAULT 'default',

  -- Document content
  content TEXT NOT NULL,

  -- Vector embedding (1536 dimensions for OpenAI, 768 for Gemini)
  -- Using 1536 as default for OpenAI compatibility
  embedding vector(1536),

  -- Flexible metadata storage
  metadata JSONB DEFAULT '{}',

  -- Ownership and tracking (no FK constraints - tables may not exist)
  user_id UUID,
  team_id UUID,

  -- Source tracking
  source_type VARCHAR(50) DEFAULT 'text',
  source_id VARCHAR(255),
  source_url TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- SECTION 3: INDEXES FOR PERFORMANCE
-- ========================================

-- Collection index for filtering
CREATE INDEX IF NOT EXISTS idx_vector_documents_collection
  ON vector_documents(collection_name);

-- User and team indexes
CREATE INDEX IF NOT EXISTS idx_vector_documents_user
  ON vector_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_vector_documents_team
  ON vector_documents(team_id);

-- Source tracking index
CREATE INDEX IF NOT EXISTS idx_vector_documents_source
  ON vector_documents(source_type, source_id);

-- Metadata GIN index for JSONB queries
CREATE INDEX IF NOT EXISTS idx_vector_documents_metadata
  ON vector_documents USING GIN(metadata);

-- Full-text search index on content
CREATE INDEX IF NOT EXISTS idx_vector_documents_content_fts
  ON vector_documents USING GIN(to_tsvector('english', content));

-- ========================================
-- SECTION 4: VECTOR INDEXES
-- Using HNSW for fast approximate nearest neighbor search
-- ========================================

-- Cosine similarity index (most common for text embeddings)
CREATE INDEX IF NOT EXISTS idx_vector_documents_embedding_cosine
  ON vector_documents
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Note: For large datasets, you may want to add additional indexes:
-- L2/Euclidean distance index:
-- CREATE INDEX idx_vector_documents_embedding_l2
--   ON vector_documents USING hnsw (embedding vector_l2_ops);
--
-- Inner product index (for normalized vectors):
-- CREATE INDEX idx_vector_documents_embedding_ip
--   ON vector_documents USING hnsw (embedding vector_ip_ops);

-- ========================================
-- SECTION 5: VECTOR SEARCH FUNCTIONS
-- ========================================

-- Cosine similarity search function
CREATE OR REPLACE FUNCTION search_vectors_cosine(
  query_embedding vector(1536),
  match_count INTEGER DEFAULT 5,
  similarity_threshold FLOAT DEFAULT 0.5,
  p_collection_name TEXT DEFAULT NULL,
  metadata_filter JSONB DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    vd.id,
    vd.content,
    vd.metadata,
    1 - (vd.embedding <=> query_embedding) AS similarity
  FROM vector_documents vd
  WHERE
    (p_collection_name IS NULL OR vd.collection_name = p_collection_name)
    AND (metadata_filter IS NULL OR vd.metadata @> metadata_filter)
    AND 1 - (vd.embedding <=> query_embedding) >= similarity_threshold
  ORDER BY vd.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Euclidean distance search function
CREATE OR REPLACE FUNCTION search_vectors_euclidean(
  query_embedding vector(1536),
  match_count INTEGER DEFAULT 5,
  similarity_threshold FLOAT DEFAULT 0.5,
  p_collection_name TEXT DEFAULT NULL,
  metadata_filter JSONB DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  distance FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    vd.id,
    vd.content,
    vd.metadata,
    vd.embedding <-> query_embedding AS distance
  FROM vector_documents vd
  WHERE
    (p_collection_name IS NULL OR vd.collection_name = p_collection_name)
    AND (metadata_filter IS NULL OR vd.metadata @> metadata_filter)
  ORDER BY vd.embedding <-> query_embedding
  LIMIT match_count;
END;
$$;

-- Inner product search function
CREATE OR REPLACE FUNCTION search_vectors_inner_product(
  query_embedding vector(1536),
  match_count INTEGER DEFAULT 5,
  similarity_threshold FLOAT DEFAULT 0.5,
  p_collection_name TEXT DEFAULT NULL,
  metadata_filter JSONB DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  score FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    vd.id,
    vd.content,
    vd.metadata,
    (vd.embedding <#> query_embedding) * -1 AS score
  FROM vector_documents vd
  WHERE
    (p_collection_name IS NULL OR vd.collection_name = p_collection_name)
    AND (metadata_filter IS NULL OR vd.metadata @> metadata_filter)
  ORDER BY vd.embedding <#> query_embedding
  LIMIT match_count;
END;
$$;

-- ========================================
-- SECTION 6: COLLECTION MANAGEMENT FUNCTIONS
-- ========================================

-- Get all collections with document counts
CREATE OR REPLACE FUNCTION get_vector_collections()
RETURNS TABLE (
  name TEXT,
  document_count BIGINT,
  last_updated TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    vd.collection_name AS name,
    COUNT(*) AS document_count,
    MAX(vd.created_at) AS last_updated
  FROM vector_documents vd
  GROUP BY vd.collection_name
  ORDER BY document_count DESC;
END;
$$;

-- Get collection statistics
CREATE OR REPLACE FUNCTION get_collection_stats(p_collection_name TEXT)
RETURNS TABLE (
  collection_name TEXT,
  document_count BIGINT,
  total_content_length BIGINT,
  avg_content_length NUMERIC,
  earliest_document TIMESTAMP WITH TIME ZONE,
  latest_document TIMESTAMP WITH TIME ZONE,
  unique_sources BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    vd.collection_name,
    COUNT(*) AS document_count,
    SUM(LENGTH(vd.content))::BIGINT AS total_content_length,
    AVG(LENGTH(vd.content)) AS avg_content_length,
    MIN(vd.created_at) AS earliest_document,
    MAX(vd.created_at) AS latest_document,
    COUNT(DISTINCT vd.source_id) AS unique_sources
  FROM vector_documents vd
  WHERE vd.collection_name = p_collection_name
  GROUP BY vd.collection_name;
END;
$$;

-- ========================================
-- SECTION 7: HYBRID SEARCH FUNCTION
-- Combines vector similarity with full-text search
-- ========================================

CREATE OR REPLACE FUNCTION hybrid_search(
  query_text TEXT,
  query_embedding vector(1536),
  match_count INTEGER DEFAULT 5,
  vector_weight FLOAT DEFAULT 0.7,
  text_weight FLOAT DEFAULT 0.3,
  p_collection_name TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  vector_score FLOAT,
  text_score FLOAT,
  combined_score FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH vector_results AS (
    SELECT
      vd.id,
      vd.content,
      vd.metadata,
      1 - (vd.embedding <=> query_embedding) AS v_score
    FROM vector_documents vd
    WHERE p_collection_name IS NULL OR vd.collection_name = p_collection_name
    ORDER BY vd.embedding <=> query_embedding
    LIMIT match_count * 2
  ),
  text_results AS (
    SELECT
      vd.id,
      ts_rank(to_tsvector('english', vd.content), websearch_to_tsquery('english', query_text)) AS t_score
    FROM vector_documents vd
    WHERE
      (p_collection_name IS NULL OR vd.collection_name = p_collection_name)
      AND to_tsvector('english', vd.content) @@ websearch_to_tsquery('english', query_text)
    LIMIT match_count * 2
  )
  SELECT
    vr.id,
    vr.content,
    vr.metadata,
    vr.v_score AS vector_score,
    COALESCE(tr.t_score, 0) AS text_score,
    (vr.v_score * vector_weight) + (COALESCE(tr.t_score, 0) * text_weight) AS combined_score
  FROM vector_results vr
  LEFT JOIN text_results tr ON vr.id = tr.id
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

-- ========================================
-- SECTION 8: ROW LEVEL SECURITY
-- ========================================

-- Enable RLS on vector_documents
ALTER TABLE vector_documents ENABLE ROW LEVEL SECURITY;

-- Users can manage their own documents or anonymous documents
CREATE POLICY "Users manage own vector documents" ON vector_documents
  FOR ALL USING (
    user_id = auth.uid() OR
    user_id IS NULL  -- Allow anonymous/system documents
  );

-- Service role bypass for backend operations
CREATE POLICY "Service role full access" ON vector_documents
  FOR ALL
  USING (auth.role() = 'service_role');

-- ========================================
-- SECTION 9: UPDATE TRIGGER
-- ========================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_vector_document_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS vector_document_update_trigger ON vector_documents;
CREATE TRIGGER vector_document_update_trigger
  BEFORE UPDATE ON vector_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_vector_document_timestamp();

-- ========================================
-- SECTION 10: HELPER VIEWS
-- ========================================

-- View for collection overview
CREATE OR REPLACE VIEW vector_collections_overview AS
SELECT
  collection_name,
  COUNT(*) AS document_count,
  SUM(LENGTH(content)) AS total_chars,
  COUNT(DISTINCT source_type) AS source_types,
  MIN(created_at) AS first_document,
  MAX(created_at) AS last_document
FROM vector_documents
GROUP BY collection_name
ORDER BY document_count DESC;

-- ========================================
-- SECTION 11: COMMENTS AND DOCUMENTATION
-- ========================================

COMMENT ON TABLE vector_documents IS
  'Stores document chunks with vector embeddings for semantic search and RAG';

COMMENT ON COLUMN vector_documents.collection_name IS
  'Logical grouping of documents for scoped searches';

COMMENT ON COLUMN vector_documents.embedding IS
  'Vector embedding (1536 dimensions for OpenAI, 768 for Gemini)';

COMMENT ON COLUMN vector_documents.metadata IS
  'Flexible JSON metadata for filtering and context';

COMMENT ON FUNCTION search_vectors_cosine IS
  'Search for similar documents using cosine similarity';

COMMENT ON FUNCTION hybrid_search IS
  'Combined vector and full-text search for improved relevance';

-- ========================================
-- SECTION 12: SAMPLE DATA (Optional)
-- Uncomment to add test data
-- ========================================

-- INSERT INTO vector_documents (collection_name, content, metadata, source_type)
-- VALUES
--   ('test', 'This is a sample document for testing vector search.',
--    '{"category": "test", "priority": "low"}', 'text'),
--   ('test', 'Another sample document with different content.',
--    '{"category": "test", "priority": "medium"}', 'text');

-- ========================================
-- MIGRATION COMPLETE
-- ========================================

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON vector_documents TO authenticated;
GRANT EXECUTE ON FUNCTION search_vectors_cosine TO authenticated;
GRANT EXECUTE ON FUNCTION search_vectors_euclidean TO authenticated;
GRANT EXECUTE ON FUNCTION search_vectors_inner_product TO authenticated;
GRANT EXECUTE ON FUNCTION hybrid_search TO authenticated;
GRANT EXECUTE ON FUNCTION get_vector_collections TO authenticated;
GRANT EXECUTE ON FUNCTION get_collection_stats TO authenticated;
