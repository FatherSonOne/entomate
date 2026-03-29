/**
 * Vector Store Service
 * Handles pgvector integration for semantic search and RAG
 *
 * Features:
 * - Text embedding using OpenAI/Gemini
 * - Vector storage with metadata
 * - Similarity search (cosine, euclidean, inner product)
 * - Hybrid search (vector + keyword)
 * - Collection management
 */

const ai = require('../config/ai');
const { supabase } = require('../config/supabase');
const log = require('../utils/log');

class VectorStore {
  constructor() {
    this.initialized = false;
    this.embeddingDimension = 1536; // OpenAI default, Gemini uses 768
    this.defaultChunkSize = 1000;
    this.defaultChunkOverlap = 200;
  }

  // ========================================
  // INITIALIZATION
  // ========================================

  /**
   * Check if the vector store is ready
   */
  isReady() {
    return ai.isConfigured() && supabase;
  }

  /**
   * Get embedding dimension based on AI provider
   */
  getEmbeddingDimension() {
    const provider = ai.getProviderName();
    return provider === 'openai' ? 1536 : 768;
  }

  // ========================================
  // EMBEDDING GENERATION
  // ========================================

  /**
   * Generate embedding for text
   * @param {string} text - Text to embed
   * @returns {Promise<number[]>} Embedding vector
   */
  async generateEmbedding(text) {
    if (!text || text.length === 0) {
      throw new Error('Text is required for embedding generation');
    }

    try {
      // Truncate text if too long (most embedding models have limits)
      const truncatedText = text.substring(0, 20000);
      const embedding = await ai.generateEmbedding(truncatedText);
      return embedding;
    } catch (error) {
      log.error('[VectorStore] Embedding generation error:', { error: error.message || error });
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  /**
   * Generate embeddings for multiple texts (batch processing)
   * @param {string[]} texts - Array of texts to embed
   * @returns {Promise<number[][]>} Array of embedding vectors
   */
  async generateEmbeddings(texts) {
    if (!texts || texts.length === 0) {
      return [];
    }

    log.info(`[VectorStore] Generating embeddings for ${texts.length} texts`);
    const embeddings = [];

    for (const text of texts) {
      const embedding = await this.generateEmbedding(text);
      embeddings.push(embedding);
    }

    return embeddings;
  }

  // ========================================
  // TEXT CHUNKING
  // ========================================

  /**
   * Split text into chunks with overlap
   * @param {string} text - Text to split
   * @param {number} chunkSize - Maximum chunk size in characters
   * @param {number} overlap - Overlap between chunks in characters
   * @returns {Object[]} Array of chunk objects with text and metadata
   */
  chunkText(text, chunkSize = this.defaultChunkSize, overlap = this.defaultChunkOverlap) {
    if (!text || text.length === 0) {
      return [];
    }

    const chunks = [];
    let startIndex = 0;
    let chunkIndex = 0;

    while (startIndex < text.length) {
      let endIndex = startIndex + chunkSize;

      // Try to break at sentence boundary
      if (endIndex < text.length) {
        const breakPoints = ['. ', '! ', '? ', '\n\n', '\n', ', '];
        let foundBreak = false;

        for (const bp of breakPoints) {
          const bpIndex = text.lastIndexOf(bp, endIndex);
          if (bpIndex > startIndex + (chunkSize / 2)) {
            endIndex = bpIndex + bp.length;
            foundBreak = true;
            break;
          }
        }

        // If no break point found, break at word boundary
        if (!foundBreak) {
          const spaceIndex = text.lastIndexOf(' ', endIndex);
          if (spaceIndex > startIndex + (chunkSize / 2)) {
            endIndex = spaceIndex;
          }
        }
      }

      const chunkText = text.substring(startIndex, endIndex).trim();

      if (chunkText.length > 0) {
        chunks.push({
          text: chunkText,
          metadata: {
            chunkIndex,
            startChar: startIndex,
            endChar: endIndex,
            charCount: chunkText.length
          }
        });
        chunkIndex++;
      }

      // Move start position with overlap
      startIndex = endIndex - overlap;
      if (startIndex < 0) startIndex = 0;

      // Prevent infinite loop
      if (startIndex >= text.length - 1) break;
    }

    log.info(`[VectorStore] Split text into ${chunks.length} chunks`);
    return chunks;
  }

  /**
   * Split text by paragraphs
   * @param {string} text - Text to split
   * @param {number} maxChunkSize - Maximum chunk size
   * @returns {Object[]} Array of chunk objects
   */
  chunkByParagraphs(text, maxChunkSize = this.defaultChunkSize) {
    const paragraphs = text.split(/\n\n+/);
    const chunks = [];
    let currentChunk = '';
    let chunkIndex = 0;

    for (const para of paragraphs) {
      if (currentChunk.length + para.length + 2 <= maxChunkSize) {
        currentChunk += (currentChunk ? '\n\n' : '') + para;
      } else {
        if (currentChunk.length > 0) {
          chunks.push({
            text: currentChunk.trim(),
            metadata: { chunkIndex: chunkIndex++, type: 'paragraph' }
          });
        }
        currentChunk = para;
      }
    }

    if (currentChunk.length > 0) {
      chunks.push({
        text: currentChunk.trim(),
        metadata: { chunkIndex: chunkIndex++, type: 'paragraph' }
      });
    }

    return chunks;
  }

  // ========================================
  // DOCUMENT STORAGE
  // ========================================

  /**
   * Store a document with its embedding
   * @param {Object} options - Storage options
   * @returns {Promise<Object>} Stored document record
   */
  async storeDocument({
    collectionName,
    content,
    embedding = null,
    metadata = {},
    sourceType = 'text',
    sourceId = null
  }) {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    try {
      // Generate embedding if not provided
      const documentEmbedding = embedding || await this.generateEmbedding(content);

      const { data, error } = await supabase
        .from('vector_documents')
        .insert({
          collection_name: collectionName,
          content: content.substring(0, 50000), // Limit content size
          embedding: documentEmbedding,
          metadata: {
            ...metadata,
            sourceType,
            sourceId,
            contentLength: content.length,
            embeddedAt: new Date().toISOString()
          }
        })
        .select()
        .single();

      if (error) {
        if (error.code === '42P01') {
          throw new Error('Vector documents table not found. Run migration 005_vector_store.sql');
        }
        throw error;
      }

      log.info(`[VectorStore] Stored document in collection: ${collectionName}`);
      return data;

    } catch (error) {
      log.error('[VectorStore] Store document error:', { error: error.message || error });
      throw error;
    }
  }

  /**
   * Store multiple document chunks
   * @param {Object} options - Storage options
   * @returns {Promise<Object[]>} Array of stored document records
   */
  async storeDocumentChunks({
    collectionName,
    chunks,
    sourceType = 'text',
    sourceId = null,
    baseMetadata = {}
  }) {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    log.info(`[VectorStore] Storing ${chunks.length} chunks in collection: ${collectionName}`);

    const results = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await this.generateEmbedding(chunk.text);

      const result = await this.storeDocument({
        collectionName,
        content: chunk.text,
        embedding,
        metadata: {
          ...baseMetadata,
          ...chunk.metadata,
          chunkIndex: i,
          totalChunks: chunks.length
        },
        sourceType,
        sourceId
      });

      results.push(result);
    }

    log.info(`[VectorStore] Successfully stored ${results.length} chunks`);
    return results;
  }

  /**
   * Ingest a full document with automatic chunking
   * @param {Object} options - Ingestion options
   * @returns {Promise<Object>} Ingestion result
   */
  async ingestDocument({
    collectionName,
    content,
    sourceType = 'text',
    sourceId = null,
    metadata = {},
    chunkSize = this.defaultChunkSize,
    chunkOverlap = this.defaultChunkOverlap,
    chunkingStrategy = 'overlap' // 'overlap' | 'paragraph' | 'none'
  }) {
    log.info(`[VectorStore] Ingesting document (${content.length} chars) with strategy: ${chunkingStrategy}`);

    let chunks;

    switch (chunkingStrategy) {
      case 'paragraph':
        chunks = this.chunkByParagraphs(content, chunkSize);
        break;
      case 'none':
        chunks = [{ text: content, metadata: { chunkIndex: 0 } }];
        break;
      case 'overlap':
      default:
        chunks = this.chunkText(content, chunkSize, chunkOverlap);
    }

    const results = await this.storeDocumentChunks({
      collectionName,
      chunks,
      sourceType,
      sourceId,
      baseMetadata: metadata
    });

    return {
      success: true,
      documentCount: results.length,
      collectionName,
      sourceId,
      documents: results.map(r => r.id)
    };
  }

  // ========================================
  // SIMILARITY SEARCH
  // ========================================

  /**
   * Search for similar documents using vector similarity
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results
   */
  async similaritySearch({
    query,
    collectionName = null,
    topK = 5,
    threshold = 0.5,
    filters = {},
    metric = 'cosine' // 'cosine' | 'euclidean' | 'inner_product'
  }) {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const startTime = Date.now();
    log.info(`[VectorStore] Similarity search: "${query.substring(0, 50)}..."`);

    try {
      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query);

      // Select the appropriate RPC function based on metric
      const rpcFunction = this.getSearchFunction(metric);

      // Build the RPC call
      const rpcParams = {
        query_embedding: queryEmbedding,
        match_count: topK,
        similarity_threshold: threshold
      };

      if (collectionName) {
        rpcParams.p_collection_name = collectionName;
      }

      // Add metadata filters if provided
      if (Object.keys(filters).length > 0) {
        rpcParams.metadata_filter = filters;
      }

      const { data, error } = await supabase.rpc(rpcFunction, rpcParams);

      if (error) {
        // Fallback to basic similarity search if RPC not available
        if (error.code === '42883') {
          log.warn('[VectorStore] RPC function not found, using fallback search');
          return this.fallbackSimilaritySearch(queryEmbedding, collectionName, topK, threshold);
        }
        throw error;
      }

      const executionTime = Date.now() - startTime;
      log.info(`[VectorStore] Found ${data?.length || 0} results in ${executionTime}ms`);

      return {
        success: true,
        results: data || [],
        query,
        executionTime,
        metric,
        searchType: 'vector'
      };

    } catch (error) {
      log.error('[VectorStore] Similarity search error:', { error: error.message || error });
      throw error;
    }
  }

  /**
   * Get the appropriate search function based on metric
   */
  getSearchFunction(metric) {
    switch (metric) {
      case 'euclidean':
        return 'search_vectors_euclidean';
      case 'inner_product':
        return 'search_vectors_inner_product';
      case 'cosine':
      default:
        return 'search_vectors_cosine';
    }
  }

  /**
   * Fallback similarity search when RPC functions are not available
   */
  async fallbackSimilaritySearch(queryEmbedding, collectionName, topK, threshold) {
    // Direct table query with client-side similarity calculation
    let query = supabase
      .from('vector_documents')
      .select('id, content, metadata, embedding');

    if (collectionName) {
      query = query.eq('collection_name', collectionName);
    }

    const { data, error } = await query.limit(100);

    if (error) throw error;

    // Calculate cosine similarity client-side
    const results = (data || [])
      .map(doc => ({
        ...doc,
        similarity: this.cosineSimilarity(queryEmbedding, doc.embedding)
      }))
      .filter(doc => doc.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK)
      .map(({ embedding, ...rest }) => rest); // Remove embedding from results

    return {
      success: true,
      results,
      searchType: 'fallback'
    };
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // ========================================
  // HYBRID SEARCH
  // ========================================

  /**
   * Hybrid search combining vector similarity and keyword matching
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results
   */
  async hybridSearch({
    query,
    collectionName = null,
    topK = 5,
    threshold = 0.3,
    vectorWeight = 0.7,
    keywordWeight = 0.3,
    filters = {}
  }) {
    const startTime = Date.now();
    log.info(`[VectorStore] Hybrid search: "${query.substring(0, 50)}..."`);

    try {
      // Perform vector search
      const vectorResults = await this.similaritySearch({
        query,
        collectionName,
        topK: topK * 2, // Get more results for re-ranking
        threshold: threshold * 0.5, // Lower threshold for vector search
        filters
      });

      // Perform keyword search
      const keywordResults = await this.keywordSearch({
        query,
        collectionName,
        topK: topK * 2,
        filters
      });

      // Combine and re-rank results
      const combinedResults = this.combineSearchResults(
        vectorResults.results,
        keywordResults.results,
        vectorWeight,
        keywordWeight
      );

      // Take top K after re-ranking
      const finalResults = combinedResults
        .filter(r => r.combinedScore >= threshold)
        .slice(0, topK);

      const executionTime = Date.now() - startTime;
      log.info(`[VectorStore] Hybrid search found ${finalResults.length} results in ${executionTime}ms`);

      return {
        success: true,
        results: finalResults,
        query,
        executionTime,
        searchType: 'hybrid',
        vectorWeight,
        keywordWeight
      };

    } catch (error) {
      log.error('[VectorStore] Hybrid search error:', { error: error.message || error });
      throw error;
    }
  }

  /**
   * Keyword-based search using PostgreSQL full-text search
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results
   */
  async keywordSearch({ query, collectionName = null, topK = 10, filters = {} }) {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    try {
      // Try full-text search first
      let dbQuery = supabase
        .from('vector_documents')
        .select('id, content, metadata')
        .textSearch('content', query.split(' ').join(' | '), {
          type: 'websearch',
          config: 'english'
        })
        .limit(topK);

      if (collectionName) {
        dbQuery = dbQuery.eq('collection_name', collectionName);
      }

      const { data, error } = await dbQuery;

      if (error) {
        // Fallback to ILIKE search
        log.warn('[VectorStore] Full-text search failed, using ILIKE fallback');
        return this.ilikeSearch({ query, collectionName, topK });
      }

      // Assign keyword relevance scores
      const scoredResults = (data || []).map((doc, index) => ({
        ...doc,
        keywordScore: 1 - (index / topK) // Simple position-based scoring
      }));

      return {
        success: true,
        results: scoredResults,
        searchType: 'keyword'
      };

    } catch (error) {
      log.error('[VectorStore] Keyword search error:', { error: error.message || error });
      return { success: false, results: [], error: error.message };
    }
  }

  /**
   * Fallback ILIKE search
   */
  async ilikeSearch({ query, collectionName, topK }) {
    let dbQuery = supabase
      .from('vector_documents')
      .select('id, content, metadata')
      .ilike('content', `%${query}%`)
      .limit(topK);

    if (collectionName) {
      dbQuery = dbQuery.eq('collection_name', collectionName);
    }

    const { data, error } = await dbQuery;

    if (error) throw error;

    const scoredResults = (data || []).map((doc, index) => ({
      ...doc,
      keywordScore: 0.5 - (index / (topK * 2)) // Lower scores for ILIKE
    }));

    return {
      success: true,
      results: scoredResults,
      searchType: 'ilike'
    };
  }

  /**
   * Combine and re-rank vector and keyword search results
   */
  combineSearchResults(vectorResults, keywordResults, vectorWeight, keywordWeight) {
    const resultMap = new Map();

    // Add vector results
    for (const result of vectorResults) {
      resultMap.set(result.id, {
        ...result,
        vectorScore: result.similarity || 0,
        keywordScore: 0
      });
    }

    // Merge keyword results
    for (const result of keywordResults) {
      if (resultMap.has(result.id)) {
        const existing = resultMap.get(result.id);
        existing.keywordScore = result.keywordScore || 0;
      } else {
        resultMap.set(result.id, {
          ...result,
          vectorScore: 0,
          keywordScore: result.keywordScore || 0
        });
      }
    }

    // Calculate combined scores and sort
    const combined = Array.from(resultMap.values())
      .map(result => ({
        ...result,
        combinedScore: (result.vectorScore * vectorWeight) + (result.keywordScore * keywordWeight)
      }))
      .sort((a, b) => b.combinedScore - a.combinedScore);

    return combined;
  }

  // ========================================
  // COLLECTION MANAGEMENT
  // ========================================

  /**
   * Get all collections
   * @returns {Promise<Object[]>} Array of collection names and stats
   */
  async getCollections() {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
      .rpc('get_vector_collections');

    if (error) {
      // Fallback to manual aggregation
      const { data: docs, error: docsError } = await supabase
        .from('vector_documents')
        .select('collection_name');

      if (docsError) throw docsError;

      const collections = {};
      for (const doc of (docs || [])) {
        collections[doc.collection_name] = (collections[doc.collection_name] || 0) + 1;
      }

      return Object.entries(collections).map(([name, count]) => ({
        name,
        documentCount: count
      }));
    }

    return data || [];
  }

  /**
   * Delete a collection
   * @param {string} collectionName - Collection to delete
   * @returns {Promise<Object>} Deletion result
   */
  async deleteCollection(collectionName) {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
      .from('vector_documents')
      .delete()
      .eq('collection_name', collectionName)
      .select('id');

    if (error) throw error;

    log.info(`[VectorStore] Deleted collection: ${collectionName} (${data?.length || 0} documents)`);

    return {
      success: true,
      collectionName,
      deletedCount: data?.length || 0
    };
  }

  /**
   * Get collection statistics
   * @param {string} collectionName - Collection name
   * @returns {Promise<Object>} Collection stats
   */
  async getCollectionStats(collectionName) {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const { data, error, count } = await supabase
      .from('vector_documents')
      .select('id, metadata, created_at', { count: 'exact' })
      .eq('collection_name', collectionName)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    return {
      collectionName,
      documentCount: count || 0,
      lastUpdated: data?.[0]?.created_at || null
    };
  }

  // ========================================
  // DOCUMENT MANAGEMENT
  // ========================================

  /**
   * Delete a document by ID
   * @param {string} documentId - Document ID
   * @returns {Promise<Object>} Deletion result
   */
  async deleteDocument(documentId) {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
      .from('vector_documents')
      .delete()
      .eq('id', documentId)
      .select();

    if (error) throw error;

    return {
      success: true,
      deleted: data?.length > 0
    };
  }

  /**
   * Delete documents by source
   * @param {string} sourceType - Source type
   * @param {string} sourceId - Source ID
   * @returns {Promise<Object>} Deletion result
   */
  async deleteBySource(sourceType, sourceId) {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
      .from('vector_documents')
      .delete()
      .contains('metadata', { sourceType, sourceId })
      .select('id');

    if (error) throw error;

    log.info(`[VectorStore] Deleted ${data?.length || 0} documents for source: ${sourceType}:${sourceId}`);

    return {
      success: true,
      deletedCount: data?.length || 0
    };
  }

  /**
   * Update document metadata
   * @param {string} documentId - Document ID
   * @param {Object} metadata - New metadata (merged with existing)
   * @returns {Promise<Object>} Updated document
   */
  async updateMetadata(documentId, metadata) {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    // Get existing metadata
    const { data: existing, error: fetchError } = await supabase
      .from('vector_documents')
      .select('metadata')
      .eq('id', documentId)
      .single();

    if (fetchError) throw fetchError;

    // Merge metadata
    const mergedMetadata = {
      ...existing.metadata,
      ...metadata,
      updatedAt: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('vector_documents')
      .update({ metadata: mergedMetadata })
      .eq('id', documentId)
      .select()
      .single();

    if (error) throw error;

    return data;
  }
}

module.exports = new VectorStore();
