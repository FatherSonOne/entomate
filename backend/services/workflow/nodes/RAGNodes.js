/**
 * RAG Node Handlers
 *
 * Vector store, search, and RAG nodes for workflow automation
 */

const BaseNode = require('./BaseNode');

/**
 * Vector Store Node - Store documents with embeddings
 */
class VectorStoreNode extends BaseNode {
  static async execute(config, inputData, context) {
    const {
      collectionName = 'default',
      inputField = 'content',
      chunkSize = 1000,
      overlap = 200,
      chunkingStrategy = 'overlap',
      metadataFields = []
    } = config;

    console.log(`[VectorStoreNode] Storing in collection: ${collectionName}`);

    try {
      const ragHandler = require('../../agents/ragHandler');

      const result = await ragHandler.handleNode('vector_store', {
        collectionName,
        inputField,
        chunkSize,
        overlap,
        chunkingStrategy,
        metadataFields
      }, inputData, context);

      return result;

    } catch (error) {
      console.error('[VectorStoreNode] Error:', error);
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

  static getTestData() {
    return {
      content: 'This is sample content for vector storage testing. It contains multiple sentences to demonstrate chunking functionality.'
    };
  }

  static validate(config) {
    const errors = [];

    if (!config.collectionName) {
      errors.push('Collection name is required');
    }

    if (config.chunkSize && (config.chunkSize < 100 || config.chunkSize > 10000)) {
      errors.push('Chunk size must be between 100 and 10000');
    }

    if (config.overlap && config.overlap >= config.chunkSize) {
      errors.push('Overlap must be less than chunk size');
    }

    return { valid: errors.length === 0, errors };
  }
}

/**
 * Vector Search Node - Search for similar documents
 */
class VectorSearchNode extends BaseNode {
  static async execute(config, inputData, context) {
    const {
      queryField = 'query',
      query: staticQuery = null,
      collectionName = null,
      topK = 5,
      threshold = 0.5,
      searchType = 'similarity',
      metric = 'cosine',
      vectorWeight = 0.7,
      keywordWeight = 0.3,
      filters = {},
      outputField = 'searchResults'
    } = config;

    const searchQuery = staticQuery || this.getNestedValue(inputData, queryField);

    console.log(`[VectorSearchNode] Searching: "${searchQuery?.substring(0, 50) || 'N/A'}..."`);

    try {
      const ragHandler = require('../../agents/ragHandler');

      const result = await ragHandler.handleNode('vector_search', {
        queryField,
        query: staticQuery,
        collectionName,
        topK,
        threshold,
        searchType,
        metric,
        vectorWeight,
        keywordWeight,
        filters,
        outputField
      }, inputData, context);

      return result;

    } catch (error) {
      console.error('[VectorSearchNode] Error:', error);
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

  static getTestData() {
    return {
      query: 'sample search query for testing'
    };
  }

  static validate(config) {
    const errors = [];

    if (!config.query && !config.queryField) {
      errors.push('Either query or queryField is required');
    }

    if (config.topK && (config.topK < 1 || config.topK > 100)) {
      errors.push('topK must be between 1 and 100');
    }

    if (config.threshold && (config.threshold < 0 || config.threshold > 1)) {
      errors.push('threshold must be between 0 and 1');
    }

    if (config.searchType && !['similarity', 'hybrid'].includes(config.searchType)) {
      errors.push('searchType must be "similarity" or "hybrid"');
    }

    if (config.metric && !['cosine', 'euclidean', 'inner_product'].includes(config.metric)) {
      errors.push('metric must be "cosine", "euclidean", or "inner_product"');
    }

    return { valid: errors.length === 0, errors };
  }
}

/**
 * RAG Query Node - Retrieve and Generate
 */
class RAGQueryNode extends BaseNode {
  static async execute(config, inputData, context) {
    const {
      queryField = 'query',
      query: staticQuery = null,
      collectionName = null,
      topK = 5,
      threshold = 0.5,
      systemPrompt = 'You are a helpful assistant. Answer based on the provided context.',
      model = 'default',
      temperature = 0.7,
      maxContextLength = 8000,
      includeSourceReferences = true,
      outputField = 'ragResponse'
    } = config;

    const userQuery = staticQuery || this.getNestedValue(inputData, queryField);

    console.log(`[RAGQueryNode] RAG query: "${userQuery?.substring(0, 50) || 'N/A'}..."`);

    try {
      const ragHandler = require('../../agents/ragHandler');

      const result = await ragHandler.handleNode('rag_query', {
        queryField,
        query: staticQuery,
        collectionName,
        topK,
        threshold,
        systemPrompt,
        model,
        temperature,
        maxContextLength,
        includeSourceReferences,
        outputField
      }, inputData, context);

      return result;

    } catch (error) {
      console.error('[RAGQueryNode] Error:', error);
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

  static getTestData() {
    return {
      query: 'What information do you have about this topic?'
    };
  }

  static validate(config) {
    const errors = [];

    if (!config.query && !config.queryField) {
      errors.push('Either query or queryField is required');
    }

    if (config.temperature && (config.temperature < 0 || config.temperature > 2)) {
      errors.push('temperature must be between 0 and 2');
    }

    if (config.maxContextLength && config.maxContextLength < 500) {
      errors.push('maxContextLength must be at least 500');
    }

    return { valid: errors.length === 0, errors };
  }
}

/**
 * Document Loader Node - Load documents from various sources
 */
class DocumentLoaderNode extends BaseNode {
  static async execute(config, inputData, context) {
    const {
      sourceType = 'text',
      sourceField = 'source',
      source: staticSource = null,
      outputField = 'loadedContent',
      extractText = true,
      parseJSON = false
    } = config;

    const source = staticSource || this.getNestedValue(inputData, sourceField);

    console.log(`[DocumentLoaderNode] Loading ${sourceType} from: ${String(source)?.substring(0, 50) || 'N/A'}...`);

    try {
      const ragHandler = require('../../agents/ragHandler');

      const result = await ragHandler.handleNode('document_loader', {
        sourceType,
        sourceField,
        source: staticSource,
        outputField,
        extractText,
        parseJSON
      }, inputData, context);

      return result;

    } catch (error) {
      console.error('[DocumentLoaderNode] Error:', error);
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

  static getTestData() {
    return {
      source: 'This is sample text content to load.'
    };
  }

  static validate(config) {
    const errors = [];

    if (!['text', 'url', 'file', 'json'].includes(config.sourceType)) {
      errors.push('sourceType must be "text", "url", "file", or "json"');
    }

    if (!config.source && !config.sourceField) {
      errors.push('Either source or sourceField is required');
    }

    return { valid: errors.length === 0, errors };
  }
}

/**
 * Embedding Node - Generate embeddings for text
 */
class EmbeddingNode extends BaseNode {
  static async execute(config, inputData, context) {
    const {
      inputField = 'text',
      text: staticText = null,
      outputField = 'embedding'
    } = config;

    const textToEmbed = staticText || this.getNestedValue(inputData, inputField);

    if (!textToEmbed) {
      return {
        output: 'main',
        data: {
          ...inputData,
          [outputField]: {
            success: false,
            error: 'No text provided for embedding'
          }
        }
      };
    }

    console.log(`[EmbeddingNode] Generating embedding for ${textToEmbed.length} chars`);

    try {
      const vectorStore = require('../../vectorStore');
      const embedding = await vectorStore.generateEmbedding(textToEmbed);

      return {
        output: 'main',
        data: {
          ...inputData,
          [outputField]: {
            success: true,
            embedding,
            dimensions: embedding.length,
            textLength: textToEmbed.length
          }
        }
      };

    } catch (error) {
      console.error('[EmbeddingNode] Error:', error);
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

  static getTestData() {
    return {
      text: 'Sample text to generate embeddings for.'
    };
  }

  static validate(config) {
    const errors = [];

    if (!config.text && !config.inputField) {
      errors.push('Either text or inputField is required');
    }

    return { valid: errors.length === 0, errors };
  }
}

/**
 * Chunk Text Node - Split text into chunks
 */
class ChunkTextNode extends BaseNode {
  static async execute(config, inputData, context) {
    const {
      inputField = 'text',
      text: staticText = null,
      chunkSize = 1000,
      overlap = 200,
      strategy = 'overlap',
      outputField = 'chunks'
    } = config;

    const textToChunk = staticText || this.getNestedValue(inputData, inputField);

    if (!textToChunk) {
      return {
        output: 'main',
        data: {
          ...inputData,
          [outputField]: {
            success: false,
            error: 'No text provided for chunking',
            chunks: []
          }
        }
      };
    }

    console.log(`[ChunkTextNode] Chunking ${textToChunk.length} chars with strategy: ${strategy}`);

    try {
      const vectorStore = require('../../vectorStore');
      let chunks;

      switch (strategy) {
        case 'paragraph':
          chunks = vectorStore.chunkByParagraphs(textToChunk, chunkSize);
          break;
        case 'overlap':
        default:
          chunks = vectorStore.chunkText(textToChunk, chunkSize, overlap);
      }

      return {
        output: 'main',
        data: {
          ...inputData,
          [outputField]: {
            success: true,
            chunks: chunks.map(c => c.text),
            chunkCount: chunks.length,
            metadata: chunks.map(c => c.metadata),
            strategy,
            originalLength: textToChunk.length
          }
        }
      };

    } catch (error) {
      console.error('[ChunkTextNode] Error:', error);
      return {
        output: 'main',
        data: {
          ...inputData,
          [outputField]: {
            success: false,
            error: error.message,
            chunks: []
          }
        }
      };
    }
  }

  static getTestData() {
    return {
      text: 'This is the first paragraph with some content.\n\nThis is the second paragraph. It has multiple sentences. Here is another one.\n\nAnd a third paragraph to demonstrate chunking.'
    };
  }

  static validate(config) {
    const errors = [];

    if (config.chunkSize && (config.chunkSize < 50 || config.chunkSize > 20000)) {
      errors.push('chunkSize must be between 50 and 20000');
    }

    if (config.overlap && config.overlap >= config.chunkSize) {
      errors.push('overlap must be less than chunkSize');
    }

    if (config.strategy && !['overlap', 'paragraph'].includes(config.strategy)) {
      errors.push('strategy must be "overlap" or "paragraph"');
    }

    return { valid: errors.length === 0, errors };
  }
}

/**
 * Semantic Compare Node - Compare similarity between texts
 */
class SemanticCompareNode extends BaseNode {
  static async execute(config, inputData, context) {
    const {
      text1Field = 'text1',
      text2Field = 'text2',
      text1: staticText1 = null,
      text2: staticText2 = null,
      outputField = 'comparison'
    } = config;

    const textA = staticText1 || this.getNestedValue(inputData, text1Field);
    const textB = staticText2 || this.getNestedValue(inputData, text2Field);

    if (!textA || !textB) {
      return {
        output: 'main',
        data: {
          ...inputData,
          [outputField]: {
            success: false,
            error: 'Both text1 and text2 are required'
          }
        }
      };
    }

    console.log(`[SemanticCompareNode] Comparing texts (${textA.length} vs ${textB.length} chars)`);

    try {
      const vectorStore = require('../../vectorStore');

      // Generate embeddings for both texts
      const [embedding1, embedding2] = await Promise.all([
        vectorStore.generateEmbedding(textA),
        vectorStore.generateEmbedding(textB)
      ]);

      // Calculate cosine similarity
      const similarity = vectorStore.cosineSimilarity(embedding1, embedding2);

      // Interpret similarity
      let interpretation;
      if (similarity >= 0.9) {
        interpretation = 'nearly identical';
      } else if (similarity >= 0.7) {
        interpretation = 'highly similar';
      } else if (similarity >= 0.5) {
        interpretation = 'moderately similar';
      } else if (similarity >= 0.3) {
        interpretation = 'somewhat similar';
      } else {
        interpretation = 'not similar';
      }

      return {
        output: 'main',
        data: {
          ...inputData,
          [outputField]: {
            success: true,
            similarity,
            interpretation,
            text1Length: textA.length,
            text2Length: textB.length
          }
        }
      };

    } catch (error) {
      console.error('[SemanticCompareNode] Error:', error);
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

  static getTestData() {
    return {
      text1: 'The quick brown fox jumps over the lazy dog.',
      text2: 'A fast brown fox leaps over a sleeping dog.'
    };
  }

  static validate(config) {
    const errors = [];

    if (!config.text1 && !config.text1Field) {
      errors.push('Either text1 or text1Field is required');
    }

    if (!config.text2 && !config.text2Field) {
      errors.push('Either text2 or text2Field is required');
    }

    return { valid: errors.length === 0, errors };
  }
}

module.exports = {
  VectorStoreNode,
  VectorSearchNode,
  RAGQueryNode,
  DocumentLoaderNode,
  EmbeddingNode,
  ChunkTextNode,
  SemanticCompareNode
};
