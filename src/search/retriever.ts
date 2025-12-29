/**
 * Retriever Service
 * Performs vector similarity search to find relevant documents
 */

import { supabase } from '../lib/supabase';
import { generateEmbedding } from './embedder';
import type { SearchSourceType, ContextItem, SearchFilters } from './types';

/**
 * Search for similar documents using vector similarity
 */
export async function searchDocuments(
  query: string,
  options: {
    filters?: SearchFilters;
    limit?: number;
    threshold?: number;
  } = {}
): Promise<ContextItem[]> {
  const { filters, limit = 20, threshold = 0.7 } = options;

  // Generate embedding for the query
  const { embedding } = await generateEmbedding(query);

  // Build the search query
  // Using Supabase's pgvector support via RPC function
  const { data, error } = await supabase.rpc('search_documents_by_embedding', {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: limit,
    filter_source_types: filters?.sourceTypes || null,
    filter_date_from: filters?.dateFrom || null,
    filter_date_to: filters?.dateTo || null
  });

  if (error) {
    console.error('[Retriever] Search failed:', error);
    throw new Error(`Document search failed: ${error.message}`);
  }

  // Transform results to ContextItem format
  return (data || []).map((doc: any) => ({
    sourceType: doc.source_type as SearchSourceType,
    sourceId: doc.source_id,
    title: doc.title || 'Untitled',
    snippet: truncateSnippet(doc.content, 300),
    url: buildSourceUrl(doc.source_type, doc.source_id),
    metadata: doc.metadata || {},
    score: doc.similarity || 0
  }));
}

/**
 * Search within specific source types
 */
export async function searchBySourceType(
  query: string,
  sourceType: SearchSourceType,
  limit = 6
): Promise<ContextItem[]> {
  return searchDocuments(query, {
    filters: { sourceTypes: [sourceType] },
    limit
  });
}

/**
 * Retrieve context for RAG from multiple sources
 * Returns merged and deduplicated results
 */
export async function retrieveContext(
  query: string,
  filters?: SearchFilters
): Promise<{
  items: ContextItem[];
  counts: { sourceType: SearchSourceType; count: number }[];
}> {
  // Define per-source limits
  const sourceLimits: Record<SearchSourceType, number> = {
    meeting: 6,
    task: 6,
    project: 4,
    crm_deal: 4,
    crm_contact: 2,
    pulse_message: 4
  };

  // Determine which sources to search
  const sourceTypes = filters?.sourceTypes || Object.keys(sourceLimits) as SearchSourceType[];

  // Search each source type in parallel
  const searchPromises = sourceTypes.map(async (sourceType) => {
    try {
      const items = await searchBySourceType(
        query,
        sourceType,
        sourceLimits[sourceType] || 4
      );
      return { sourceType, items };
    } catch (err) {
      console.error(`[Retriever] Failed to search ${sourceType}:`, err);
      return { sourceType, items: [] };
    }
  });

  const results = await Promise.all(searchPromises);

  // Merge all results
  const allItems: ContextItem[] = [];
  const counts: { sourceType: SearchSourceType; count: number }[] = [];

  for (const { sourceType, items } of results) {
    allItems.push(...items);
    if (items.length > 0) {
      counts.push({ sourceType, count: items.length });
    }
  }

  // Sort by score and deduplicate
  const dedupedItems = deduplicateItems(allItems);
  dedupedItems.sort((a, b) => b.score - a.score);

  return {
    items: dedupedItems,
    counts
  };
}

/**
 * Build internal URL for a source
 */
function buildSourceUrl(sourceType: string, sourceId: string): string {
  // Extract raw ID from prefixed format (e.g., "meeting:abc-123" -> "abc-123")
  const rawId = sourceId.includes(':') ? sourceId.split(':')[1] : sourceId;

  switch (sourceType) {
    case 'meeting':
      return `/meetings/${rawId}`;
    case 'task':
      return `/tasks/${rawId}`;
    case 'project':
      return `/projects/${rawId}`;
    case 'crm_deal':
      return `/crm/deals/${rawId}`;
    case 'crm_contact':
      return `/crm/contacts/${rawId}`;
    case 'pulse_message':
      return `/pulse/messages/${rawId}`;
    default:
      return `/${sourceType}/${rawId}`;
  }
}

/**
 * Truncate text to a snippet with ellipsis
 */
function truncateSnippet(text: string, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;

  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  return (lastSpace > maxLength / 2 ? truncated.slice(0, lastSpace) : truncated) + '...';
}

/**
 * Remove duplicate items (same source_id)
 */
function deduplicateItems(items: ContextItem[]): ContextItem[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = `${item.sourceType}:${item.sourceId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
