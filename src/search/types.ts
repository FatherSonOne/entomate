/**
 * Type definitions for Search/RAG functionality
 */

// Source types for searchable documents
export type SearchSourceType =
  | 'meeting'
  | 'task'
  | 'project'
  | 'crm_deal'
  | 'crm_contact'
  | 'pulse_message';

/**
 * A searchable document stored with embeddings
 */
export interface SearchDocument {
  id: string;
  source_type: SearchSourceType;
  source_id: string;
  title: string | null;
  content: string;
  metadata: Record<string, any>;
  embedding: number[] | null;
  chunk_index: number;
  created_at: string;
  updated_at: string;
}

/**
 * A retrieved context item for RAG
 */
export interface ContextItem {
  sourceType: SearchSourceType;
  sourceId: string;
  title: string;
  snippet: string;
  url: string;
  metadata: Record<string, any>;
  score: number;
}

/**
 * Citation reference in an answer
 */
export interface Citation {
  id: string;           // Short ID like "M1", "T2", "D3"
  sourceType: SearchSourceType;
  sourceId: string;
  title: string;
  url: string;
  snippet: string;
  timestamp?: string;
}

/**
 * Filters for search queries
 */
export interface SearchFilters {
  sourceTypes?: SearchSourceType[];
  dateFrom?: string;
  dateTo?: string;
  dealId?: string;
  projectId?: string;
  assignee?: string;
}

/**
 * Search request payload
 */
export interface SearchRequest {
  question: string;
  filters?: SearchFilters;
}

/**
 * Search response with answer and citations
 */
export interface SearchResponse {
  question: string;
  answer: string;
  citations: Citation[];
  retrieval: {
    count: number;
    topSources: { sourceType: SearchSourceType; count: number }[];
  };
}

/**
 * Embedding result from Gemini
 */
export interface EmbeddingResult {
  embedding: number[];
  tokenCount?: number;
}
