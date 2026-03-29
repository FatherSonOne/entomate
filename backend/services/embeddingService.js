/**
 * Embedding Service
 * Handles vector embeddings for semantic search
 * Week 6: AI Search & Semantic Assistant
 */

const ai = require('../config/ai');
const { supabase } = require('../config/supabase');
const log = require('../utils/log');

class EmbeddingService {
  constructor() {
    this.initialized = false;
    this.embeddingDimension = 1536; // OpenAI default, Gemini uses 768
  }

  /**
   * Check if service is ready
   */
  isReady() {
    return ai.isConfigured() && supabase;
  }

  /**
   * Generate embedding for text
   */
  async generateEmbedding(text) {
    try {
      if (!text || text.length === 0) {
        throw new Error('Text is required');
      }

      // Limit text to 20k characters
      const truncatedText = text.substring(0, 20000);

      const embedding = await ai.generateEmbedding(truncatedText);
      return embedding;
    } catch (error) {
      log.error('Embedding error:', { error: error.message || error });
      throw error;
    }
  }

  /**
   * Store embedding in database
   */
  async storeEmbedding(contentType, sourceId, sourceType, text) {
    try {
      if (!supabase) {
        log.warn('Supabase not configured, skipping embedding storage');
        return null;
      }

      // Generate embedding
      const embedding = await this.generateEmbedding(text);

      // Check if embeddings table exists
      const { data, error } = await supabase
        .from('embeddings')
        .insert({
          content_type: contentType,
          source_id: sourceId,
          source_type: sourceType,
          text_content: text.substring(0, 10000), // Limit stored text
          embedding: embedding
        })
        .select()
        .single();

      if (error) {
        // Table might not exist yet
        if (error.code === '42P01') {
          log.warn('Embeddings table not found. Run database migrations.');
          return null;
        }
        throw error;
      }

      log.info(`Stored embedding for ${sourceType}:${sourceId}`);
      return data;
    } catch (error) {
      log.error('Error storing embedding:', { error: error.message || error });
      // Don't throw - embedding storage is non-critical
      return null;
    }
  }

  /**
   * Search for similar content using semantic search
   */
  async semanticSearch(query, limit = 10, filters = {}) {
    try {
      log.info(`Semantic search: "${query}"`);
      const startTime = Date.now();

      if (!supabase) {
        return { results: [], executionTime: 0 };
      }

      // Generate embedding for query
      const queryEmbedding = await this.generateEmbedding(query);

      // Try vector search first
      try {
        const { data, error } = await supabase.rpc('search_embeddings', {
          query_embedding: queryEmbedding,
          match_count: limit,
          similarity_threshold: filters.threshold || 0.5
        });

        if (!error && data) {
          // Enrich results with source data
          const enrichedResults = await this.enrichResults(data);
          const executionTime = Date.now() - startTime;

          log.info(`Found ${enrichedResults.length} similar items in ${executionTime}ms`);
          return {
            results: enrichedResults,
            executionTime,
            searchType: 'vector'
          };
        }
      } catch (rpcError) {
        log.warn('Vector search not available:', rpcError.message);
      }

      // Fallback to text-based search
      return this.fallbackTextSearch(query, limit, filters);
    } catch (error) {
      log.error('Search error:', { error: error.message || error });
      throw error;
    }
  }

  /**
   * Fallback text-based search when vector search is not available
   */
  async fallbackTextSearch(query, limit, filters) {
    const startTime = Date.now();
    const searchTerm = `%${query}%`;

    const { data: meetings, error } = await supabase
      .from('meetings')
      .select('id, title, summary, sentiment_label, created_at')
      .or(`title.ilike.${searchTerm},summary.ilike.${searchTerm}`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const results = (meetings || []).map(m => ({
      source_id: m.id,
      source_type: 'meeting',
      text_content: m.summary,
      similarity: 0.7, // Estimated for text match
      meeting: m
    }));

    return {
      results,
      executionTime: Date.now() - startTime,
      searchType: 'text_fallback'
    };
  }

  /**
   * Enrich results with source data
   */
  async enrichResults(results) {
    if (!results || results.length === 0) return [];

    const enriched = await Promise.all(
      results.map(async (result) => {
        if (result.source_type === 'meeting') {
          const { data: meeting } = await supabase
            .from('meetings')
            .select('id, title, created_at, sentiment_label, summary')
            .eq('id', result.source_id)
            .single();

          return {
            ...result,
            meeting: meeting
          };
        } else if (result.source_type === 'action_item') {
          const { data: actionItem } = await supabase
            .from('action_items')
            .select('id, task_description, assigned_to_name, status, meeting_id')
            .eq('id', result.source_id)
            .single();

          return {
            ...result,
            actionItem: actionItem
          };
        }
        return result;
      })
    );

    return enriched.filter(r => r.meeting || r.actionItem);
  }

  /**
   * Generate embeddings for a meeting
   */
  async generateEmbeddingsForMeeting(meetingId, meeting, actionItems = []) {
    try {
      log.info(`Generating embeddings for meeting: ${meetingId}`);
      const generated = [];

      // 1. Embed summary
      if (meeting.summary) {
        const result = await this.storeEmbedding(
          'summary',
          meetingId,
          'meeting',
          meeting.summary
        );
        if (result) generated.push('summary');
      }

      // 2. Embed key points
      if (meeting.key_points && meeting.key_points.length > 0) {
        const keyPointsText = Array.isArray(meeting.key_points)
          ? meeting.key_points.join(' ')
          : meeting.key_points;

        const result = await this.storeEmbedding(
          'key_points',
          meetingId,
          'meeting',
          keyPointsText
        );
        if (result) generated.push('key_points');
      }

      // 3. Embed decisions
      if (meeting.decisions && meeting.decisions.length > 0) {
        const decisionsText = Array.isArray(meeting.decisions)
          ? meeting.decisions.join(' ')
          : meeting.decisions;

        const result = await this.storeEmbedding(
          'decisions',
          meetingId,
          'meeting',
          decisionsText
        );
        if (result) generated.push('decisions');
      }

      // 4. Embed action items
      for (const item of actionItems) {
        const result = await this.storeEmbedding(
          'action_item',
          item.id,
          'action_item',
          `${item.task_description} assigned to ${item.assigned_to_name || 'Unassigned'}`
        );
        if (result) generated.push(`action_item:${item.id}`);
      }

      // 5. Embed transcript chunks (if available and not too long)
      if (meeting.transcript && meeting.transcript.length > 0) {
        const chunks = this.chunkText(meeting.transcript, 5000);
        for (let i = 0; i < Math.min(chunks.length, 5); i++) { // Limit to 5 chunks
          const result = await this.storeEmbedding(
            `transcript_chunk_${i}`,
            meetingId,
            'meeting',
            chunks[i]
          );
          if (result) generated.push(`transcript_chunk_${i}`);
        }
      }

      log.info(`Generated ${generated.length} embeddings for meeting`);
      return generated;
    } catch (error) {
      log.error('Error generating embeddings:', { error: error.message || error });
      return [];
    }
  }

  /**
   * Split text into chunks
   */
  chunkText(text, chunkSize) {
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.substring(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Re-rank results by recency and relevance
   */
  reRankResults(results, weights = { similarity: 0.7, recency: 0.3 }) {
    const now = new Date();

    return results.sort((a, b) => {
      // Normalize similarity (0-1)
      const similarityA = a.similarity || 0.5;
      const similarityB = b.similarity || 0.5;

      // Normalize recency (newer = higher score)
      const ageA = (now - new Date(a.meeting?.created_at || now)) / (1000 * 60 * 60 * 24);
      const ageB = (now - new Date(b.meeting?.created_at || now)) / (1000 * 60 * 60 * 24);

      const recencyScoreA = Math.exp(-ageA / 30); // Decay over 30 days
      const recencyScoreB = Math.exp(-ageB / 30);

      // Combined score
      const scoreA = (similarityA * weights.similarity) + (recencyScoreA * weights.recency);
      const scoreB = (similarityB * weights.similarity) + (recencyScoreB * weights.recency);

      return scoreB - scoreA;
    });
  }

  /**
   * Delete embeddings for a source
   */
  async deleteEmbeddings(sourceId, sourceType) {
    try {
      if (!supabase) return;

      const { error } = await supabase
        .from('embeddings')
        .delete()
        .eq('source_id', sourceId)
        .eq('source_type', sourceType);

      if (error && error.code !== '42P01') {
        throw error;
      }

      log.info(`Deleted embeddings for ${sourceType}:${sourceId}`);
    } catch (error) {
      log.error('Error deleting embeddings:', { error: error.message || error });
    }
  }
}

module.exports = new EmbeddingService();
