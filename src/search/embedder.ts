/**
 * Embedder Service
 * Generates embeddings using Gemini API for vector search
 */

import { GoogleGenAI } from '@google/genai';
import { getEnvVar } from '../lib/env';
import type { EmbeddingResult } from './types';

// Initialize Gemini client
let genAI: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI {
  if (!genAI) {
    const apiKey = getEnvVar('GEMINI_API_KEY');
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

/**
 * Generate embedding for a single text
 * Uses Gemini's text-embedding model
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  if (!text || text.trim().length === 0) {
    throw new Error('Text is required for embedding');
  }

  const ai = getGenAI();

  try {
    const response = await ai.models.embedContent({
      model: 'text-embedding-004',
      contents: [{ parts: [{ text: text.trim() }] }]
    });

    if (!response.embeddings || response.embeddings.length === 0) {
      throw new Error('No embedding returned from Gemini');
    }

    return {
      embedding: response.embeddings[0].values || [],
      tokenCount: undefined // Gemini doesn't return token count for embeddings
    };
  } catch (err) {
    console.error('[Embedder] Failed to generate embedding:', err);
    throw new Error(`Embedding generation failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Generate embeddings for multiple texts (batch)
 */
export async function generateEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
  // Process in parallel with concurrency limit
  const results: EmbeddingResult[] = [];
  const batchSize = 5; // Process 5 at a time to avoid rate limits

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(text => generateEmbedding(text))
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * Chunk text into smaller pieces for embedding
 * Meetings/long documents need to be chunked for better retrieval
 */
export function chunkText(
  text: string,
  options: {
    maxTokens?: number;
    overlap?: number;
  } = {}
): string[] {
  const { maxTokens = 800, overlap = 100 } = options;

  // Rough estimation: 1 token ≈ 4 characters
  const maxChars = maxTokens * 4;
  const overlapChars = overlap * 4;

  if (text.length <= maxChars) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + maxChars;

    // Try to break at sentence boundary
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf('.', end);
      const lastNewline = text.lastIndexOf('\n', end);
      const breakPoint = Math.max(lastPeriod, lastNewline);

      if (breakPoint > start + maxChars / 2) {
        end = breakPoint + 1;
      }
    }

    chunks.push(text.slice(start, end).trim());

    // Move start with overlap
    start = end - overlapChars;
    if (start >= text.length) break;
  }

  return chunks.filter(chunk => chunk.length > 0);
}

/**
 * Prepare text for embedding (clean and normalize)
 */
export function prepareTextForEmbedding(text: string): string {
  return text
    .replace(/\s+/g, ' ')           // Normalize whitespace
    .replace(/[^\x20-\x7E\n]/g, '') // Remove non-printable chars (keep newlines)
    .trim();
}
