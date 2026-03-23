/**
 * RAG Handler Agent
 * Handles RAG (Retrieval Augmented Generation) workflow nodes
 *
 * Node Types:
 * - vector_store: Store document chunks with embeddings
 * - vector_search: Find similar documents
 * - rag_query: Search + LLM synthesis
 * - document_loader: Load PDF, web pages, text files
 */

const BaseAgent = require('./baseAgent');
const vectorStore = require('../vectorStore');
const ai = require('../../config/ai');
const log = require('../../utils/log');

class RAGHandler extends BaseAgent {
  constructor() {
    super('RAGHandler', 'Handles RAG and vector operations for workflows');
  }

  // ========================================
  // MAIN HANDLER - Route to specific node type
  // ========================================

  /**
   * Handle RAG node execution
   * @param {string} nodeType - The type of RAG node
   * @param {Object} config - Node configuration
   * @param {Object} inputData - Input data from previous node
   * @param {Object} context - Execution context
   * @returns {Object} Execution result
   */
  async handleNode(nodeType, config, inputData, context) {
    this.log(`Handling node type: ${nodeType}`);

    switch (nodeType) {
      case 'vector_store':
        return this.handleVectorStore(config, inputData, context);
      case 'vector_search':
        return this.handleVectorSearch(config, inputData, context);
      case 'rag_query':
        return this.handleRAGQuery(config, inputData, context);
      case 'document_loader':
        return this.handleDocumentLoader(config, inputData, context);
      default:
        throw new Error(`Unknown RAG node type: ${nodeType}`);
    }
  }

  // ========================================
  // VECTOR STORE NODE
  // ========================================

  /**
   * Store documents with embeddings in vector database
   */
  async handleVectorStore(config, inputData, context) {
    const {
      collectionName = 'default',
      chunkSize = 1000,
      overlap = 200,
      chunkingStrategy = 'overlap', // 'overlap' | 'paragraph' | 'none'
      inputField = 'content',
      metadataFields = []
    } = config;

    this.log(`Storing documents in collection: ${collectionName}`);

    try {
      // Get content from input data
      const content = this.getNestedValue(inputData, inputField);

      if (!content) {
        return {
          output: 'main',
          data: {
            ...inputData,
            vectorStore: {
              success: false,
              error: `No content found at field: ${inputField}`
            }
          }
        };
      }

      // Build metadata from specified fields
      const metadata = {};
      for (const field of metadataFields) {
        const value = this.getNestedValue(inputData, field);
        if (value !== undefined) {
          metadata[field] = value;
        }
      }

      // Add context metadata
      metadata.workflowId = context?.workflowId;
      metadata.executionId = context?.executionId;

      // Handle array of documents vs single document
      const documents = Array.isArray(content) ? content : [content];
      const results = [];

      for (const doc of documents) {
        const docContent = typeof doc === 'string' ? doc : JSON.stringify(doc);

        const result = await vectorStore.ingestDocument({
          collectionName,
          content: docContent,
          metadata: {
            ...metadata,
            originalType: typeof doc
          },
          chunkSize,
          chunkOverlap: overlap,
          chunkingStrategy
        });

        results.push(result);
      }

      const totalDocuments = results.reduce((sum, r) => sum + r.documentCount, 0);
      this.log(`Stored ${totalDocuments} document chunks`);

      return {
        output: 'main',
        data: {
          ...inputData,
          vectorStore: {
            success: true,
            collectionName,
            documentsStored: totalDocuments,
            chunkingStrategy,
            results
          }
        }
      };

    } catch (error) {
      log.error('[RAGHandler] Vector store error:', { error: error.message || error });
      return {
        output: 'main',
        data: {
          ...inputData,
          vectorStore: {
            success: false,
            error: error.message
          }
        }
      };
    }
  }

  // ========================================
  // VECTOR SEARCH NODE
  // ========================================

  /**
   * Search for similar documents using vector similarity
   */
  async handleVectorSearch(config, inputData, context) {
    const {
      queryField = 'query',
      query: staticQuery = null,
      collectionName = null,
      topK = 5,
      threshold = 0.5,
      searchType = 'similarity', // 'similarity' | 'hybrid'
      metric = 'cosine', // 'cosine' | 'euclidean' | 'inner_product'
      vectorWeight = 0.7,
      keywordWeight = 0.3,
      filters = {},
      outputField = 'searchResults'
    } = config;

    // Get query from config or input data
    const searchQuery = staticQuery || this.getNestedValue(inputData, queryField);

    if (!searchQuery) {
      return {
        output: 'main',
        data: {
          ...inputData,
          [outputField]: {
            success: false,
            error: 'No query provided'
          }
        }
      };
    }

    this.log(`Searching for: "${searchQuery.substring(0, 50)}..." (${searchType})`);

    try {
      let result;

      if (searchType === 'hybrid') {
        result = await vectorStore.hybridSearch({
          query: searchQuery,
          collectionName,
          topK,
          threshold,
          vectorWeight,
          keywordWeight,
          filters
        });
      } else {
        result = await vectorStore.similaritySearch({
          query: searchQuery,
          collectionName,
          topK,
          threshold,
          filters,
          metric
        });
      }

      this.log(`Found ${result.results.length} results`);

      return {
        output: 'main',
        data: {
          ...inputData,
          [outputField]: {
            success: true,
            query: searchQuery,
            results: result.results,
            resultCount: result.results.length,
            searchType: result.searchType,
            executionTime: result.executionTime
          }
        }
      };

    } catch (error) {
      log.error('[RAGHandler] Vector search error:', { error: error.message || error });
      return {
        output: 'main',
        data: {
          ...inputData,
          [outputField]: {
            success: false,
            error: error.message
          }
        }
      };
    }
  }

  // ========================================
  // RAG QUERY NODE
  // ========================================

  /**
   * Perform RAG: retrieve relevant documents and synthesize answer with LLM
   */
  async handleRAGQuery(config, inputData, context) {
    const {
      queryField = 'query',
      query: staticQuery = null,
      collectionName = null,
      topK = 5,
      threshold = 0.5,
      systemPrompt = 'You are a helpful assistant. Answer the question based on the provided context. If the context does not contain relevant information, say so.',
      model = 'default',
      temperature = 0.7,
      maxContextLength = 8000,
      includeSourceReferences = true,
      outputField = 'ragResponse'
    } = config;

    // Get query
    const userQuery = staticQuery || this.getNestedValue(inputData, queryField);

    if (!userQuery) {
      return {
        output: 'main',
        data: {
          ...inputData,
          [outputField]: {
            success: false,
            error: 'No query provided'
          }
        }
      };
    }

    this.log(`RAG query: "${userQuery.substring(0, 50)}..."`);

    try {
      // Step 1: Retrieve relevant documents
      const searchResult = await vectorStore.similaritySearch({
        query: userQuery,
        collectionName,
        topK,
        threshold
      });

      const documents = searchResult.results;

      if (documents.length === 0) {
        this.log('No relevant documents found');

        // Still query LLM but without context
        const response = await this.queryLLM(
          userQuery,
          'No relevant context was found in the knowledge base.',
          systemPrompt,
          temperature
        );

        return {
          output: 'main',
          data: {
            ...inputData,
            [outputField]: {
              success: true,
              query: userQuery,
              answer: response,
              sources: [],
              noContextFound: true
            }
          }
        };
      }

      // Step 2: Build context from retrieved documents
      const { context: retrievedContext, sources } = this.buildRAGContext(
        documents,
        maxContextLength,
        includeSourceReferences
      );

      this.log(`Built context from ${documents.length} documents`);

      // Step 3: Query LLM with context
      const response = await this.queryLLM(
        userQuery,
        retrievedContext,
        systemPrompt,
        temperature
      );

      this.log('Generated RAG response');

      return {
        output: 'main',
        data: {
          ...inputData,
          [outputField]: {
            success: true,
            query: userQuery,
            answer: response,
            sources: includeSourceReferences ? sources : [],
            documentsUsed: documents.length,
            executionTime: searchResult.executionTime
          }
        }
      };

    } catch (error) {
      log.error('[RAGHandler] RAG query error:', { error: error.message || error });
      return {
        output: 'main',
        data: {
          ...inputData,
          [outputField]: {
            success: false,
            error: error.message
          }
        }
      };
    }
  }

  /**
   * Build context string from retrieved documents
   */
  buildRAGContext(documents, maxLength, includeReferences) {
    const sources = [];
    let context = '';
    let currentLength = 0;

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      const content = doc.content || '';
      const sourceRef = `[${i + 1}]`;

      // Check if adding this document would exceed max length
      const addition = includeReferences
        ? `${sourceRef} ${content}\n\n`
        : `${content}\n\n`;

      if (currentLength + addition.length > maxLength) {
        // Truncate content to fit
        const remaining = maxLength - currentLength - (includeReferences ? sourceRef.length + 2 : 0);
        if (remaining > 100) {
          context += includeReferences
            ? `${sourceRef} ${content.substring(0, remaining)}...\n\n`
            : `${content.substring(0, remaining)}...\n\n`;
        }
        break;
      }

      context += addition;
      currentLength += addition.length;

      // Track sources
      sources.push({
        reference: sourceRef,
        id: doc.id,
        similarity: doc.similarity,
        metadata: doc.metadata,
        excerpt: content.substring(0, 200) + (content.length > 200 ? '...' : '')
      });
    }

    return { context: context.trim(), sources };
  }

  /**
   * Query LLM with context
   */
  async queryLLM(query, context, systemPrompt, temperature) {
    const fullPrompt = `${systemPrompt}

Context:
${context}

Question: ${query}

Please provide a comprehensive answer based on the context above.`;

    try {
      // Use the AI service's answer question capability
      const result = await ai.answerQuestion(query, context);
      return result.answer || result;
    } catch (error) {
      // Fallback to basic chat
      const gemini = require('../../config/gemini');
      const response = await gemini.chat([
        { role: 'user', content: fullPrompt }
      ], { temperature });

      return response;
    }
  }

  // ========================================
  // DOCUMENT LOADER NODE
  // ========================================

  /**
   * Load documents from various sources
   */
  async handleDocumentLoader(config, inputData, context) {
    const {
      sourceType = 'text', // 'text' | 'url' | 'file' | 'json'
      sourceField = 'source',
      source: staticSource = null,
      outputField = 'loadedContent',
      extractText = true,
      parseJSON = false
    } = config;

    // Get source from config or input data
    const source = staticSource || this.getNestedValue(inputData, sourceField);

    if (!source) {
      return {
        output: 'main',
        data: {
          ...inputData,
          [outputField]: {
            success: false,
            error: 'No source provided'
          }
        }
      };
    }

    this.log(`Loading document from ${sourceType}: ${String(source).substring(0, 50)}...`);

    try {
      let content;
      let metadata = {};

      switch (sourceType) {
        case 'text':
          content = typeof source === 'string' ? source : JSON.stringify(source);
          metadata = { type: 'text', length: content.length };
          break;

        case 'url':
          const urlResult = await this.loadFromURL(source, extractText);
          content = urlResult.content;
          metadata = { type: 'url', url: source, ...urlResult.metadata };
          break;

        case 'file':
          const fileResult = await this.loadFromFile(source, extractText);
          content = fileResult.content;
          metadata = { type: 'file', path: source, ...fileResult.metadata };
          break;

        case 'json':
          if (typeof source === 'string') {
            const parsed = JSON.parse(source);
            content = parseJSON ? parsed : JSON.stringify(parsed, null, 2);
          } else {
            content = parseJSON ? source : JSON.stringify(source, null, 2);
          }
          metadata = { type: 'json' };
          break;

        default:
          throw new Error(`Unknown source type: ${sourceType}`);
      }

      this.log(`Loaded ${content.length} characters`);

      return {
        output: 'main',
        data: {
          ...inputData,
          [outputField]: {
            success: true,
            content,
            metadata,
            contentLength: content.length,
            sourceType
          }
        }
      };

    } catch (error) {
      log.error('[RAGHandler] Document loader error:', { error: error.message || error });
      return {
        output: 'main',
        data: {
          ...inputData,
          [outputField]: {
            success: false,
            error: error.message,
            sourceType
          }
        }
      };
    }
  }

  /**
   * Load content from a URL
   */
  async loadFromURL(url, extractText = true) {
    const https = require('https');
    const http = require('http');

    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;

      const request = protocol.get(url, {
        headers: {
          'User-Agent': 'Entomate-RAG-Loader/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7'
        },
        timeout: 30000
      }, (response) => {
        // Handle redirects
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          return this.loadFromURL(response.headers.location, extractText)
            .then(resolve)
            .catch(reject);
        }

        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: Failed to fetch URL`));
          return;
        }

        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
          const contentType = response.headers['content-type'] || '';

          if (extractText && contentType.includes('text/html')) {
            // Extract text from HTML
            const textContent = this.extractTextFromHTML(data);
            resolve({
              content: textContent,
              metadata: {
                contentType,
                originalLength: data.length,
                extractedLength: textContent.length
              }
            });
          } else {
            resolve({
              content: data,
              metadata: {
                contentType,
                length: data.length
              }
            });
          }
        });
      });

      request.on('error', reject);
      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  /**
   * Extract text content from HTML
   */
  extractTextFromHTML(html) {
    // Remove script and style elements
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');

    // Replace common block elements with newlines
    text = text
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<\/tr>/gi, '\n');

    // Remove all remaining HTML tags
    text = text.replace(/<[^>]+>/g, '');

    // Decode HTML entities
    text = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/');

    // Clean up whitespace
    text = text
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .trim();

    return text;
  }

  /**
   * Load content from a file
   */
  async loadFromFile(filePath, extractText = true) {
    const fs = require('fs').promises;
    const path = require('path');

    const extension = path.extname(filePath).toLowerCase();
    const content = await fs.readFile(filePath);

    let textContent;
    const metadata = {
      extension,
      size: content.length
    };

    switch (extension) {
      case '.txt':
      case '.md':
      case '.csv':
      case '.json':
      case '.xml':
      case '.html':
      case '.htm':
        textContent = content.toString('utf-8');
        if (extension === '.html' || extension === '.htm') {
          textContent = extractText ? this.extractTextFromHTML(textContent) : textContent;
        }
        break;

      case '.pdf':
        try {
          const pdfParse = require('pdf-parse');
          const pdfData = await pdfParse(content);
          textContent = pdfData.text;
          metadata.pages = pdfData.numpages;
          metadata.info = pdfData.info;
        } catch (pdfError) {
          log.error('[RAGHandler] PDF parse failed:', pdfError.message);
          textContent = '[PDF content could not be extracted]';
          metadata.error = pdfError.message;
        }
        break;

      default:
        // Try to read as text
        try {
          textContent = content.toString('utf-8');
        } catch {
          textContent = '[Binary content - cannot extract text]';
          metadata.binary = true;
        }
    }

    return {
      content: textContent,
      metadata
    };
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  /**
   * Get nested value from object using dot notation
   */
  getNestedValue(obj, path) {
    if (!obj || !path) return undefined;

    if (path.startsWith('$input.')) {
      path = path.substring(7);
    }

    return path.split('.').reduce((curr, key) => {
      if (curr === undefined || curr === null) return undefined;
      return curr[key];
    }, obj);
  }

  /**
   * Get agent capabilities
   */
  getCapabilities() {
    return [
      'vector_storage',
      'similarity_search',
      'hybrid_search',
      'rag_query',
      'document_loading',
      'text_extraction',
      'chunking'
    ];
  }

  /**
   * Analyze context (BaseAgent interface)
   */
  async analyze(context, automation) {
    return {
      hasContent: !!context.content,
      hasQuery: !!context.query,
      contentLength: context.content?.length || 0
    };
  }

  /**
   * Suggest action (BaseAgent interface)
   */
  async suggest(context, automation) {
    if (context.content && !context.query) {
      return {
        action: 'store',
        confidence: 0.9,
        reason: 'Content provided without query - suggest storing in vector database'
      };
    }

    if (context.query && !context.content) {
      return {
        action: 'search',
        confidence: 0.9,
        reason: 'Query provided without content - suggest searching vector database'
      };
    }

    if (context.query && context.content) {
      return {
        action: 'rag',
        confidence: 0.9,
        reason: 'Both query and content provided - suggest RAG query'
      };
    }

    return {
      action: 'none',
      confidence: 0.5,
      reason: 'Insufficient context to determine action'
    };
  }

  /**
   * Execute action (BaseAgent interface)
   */
  async execute(suggestion, context) {
    switch (suggestion.action) {
      case 'store':
        return this.handleVectorStore(
          { inputField: 'content' },
          context,
          {}
        );
      case 'search':
        return this.handleVectorSearch(
          { queryField: 'query' },
          context,
          {}
        );
      case 'rag':
        return this.handleRAGQuery(
          { queryField: 'query' },
          context,
          {}
        );
      default:
        return { success: false, error: 'Unknown action' };
    }
  }
}

module.exports = new RAGHandler();
