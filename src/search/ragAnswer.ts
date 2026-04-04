/**
 * RAG Answer Service
 * Generates answers using retrieved context with Gemini
 */

import { GoogleGenAI } from '@google/genai';
import { getEnvVar } from '../lib/env';
import { retrieveContext } from './retriever';
import { buildCitations, formatContextForPrompt, validateCitations } from './citations';
import type { SearchFilters, SearchResponse, Citation, ContextItem } from './types';

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
 * RAG system prompt for generating answers with citations
 */
const RAG_SYSTEM_PROMPT = `You are an assistant for Entomate, a meeting and project management platform.

RULES:
1. Answer ONLY using the provided CONTEXT below
2. Every factual statement MUST include a citation like [M1], [T2], [D3]
3. If the information is not in the CONTEXT, respond exactly: "I couldn't find that information in your data."
4. Be concise and direct
5. Use multiple citations when combining information from different sources
6. Never make up information not present in the CONTEXT

Citation format:
- [M#] = Meeting
- [T#] = Task
- [P#] = Project
- [D#] = Deal
- [C#] = Contact
- [PM#] = Pulse Message`;

/**
 * Generate a RAG answer for a question
 */
export async function generateAnswer(
  question: string,
  filters?: SearchFilters
): Promise<SearchResponse> {
  // Retrieve relevant context
  const { items: contextItems, counts } = await retrieveContext(question, filters);

  // If no context found, return "not found" response
  if (contextItems.length === 0) {
    return {
      question,
      answer: "I couldn't find that information in your data.",
      citations: [],
      retrieval: {
        count: 0,
        topSources: []
      }
    };
  }

  // Build citations
  const citations = buildCitations(contextItems);

  // Format context for prompt
  const contextText = formatContextForPrompt(contextItems, citations);

  // Build the full prompt
  const userPrompt = `QUESTION: ${question}

${contextText}

Please answer the question using only the context provided. Include citations for every factual statement.`;

  // Generate answer with Gemini
  const ai = getGenAI();
  const model = ai.models.get('gemini-2.0-flash');

  try {
    const response = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: RAG_SYSTEM_PROMPT }] },
        { role: 'model', parts: [{ text: 'I understand. I will only answer using the provided context and include citations for every factual statement.' }] },
        { role: 'user', parts: [{ text: userPrompt }] }
      ],
      generationConfig: {
        temperature: 0.3,  // Lower temperature for more factual responses
        maxOutputTokens: 1024
      }
    });

    let answer = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Check if the AI legitimately says it couldn't find the info — accept without citations
    const notFoundPatterns = ["couldn't find", "could not find", 'not found', 'no information',
      'no relevant', 'unable to find', "don't have", 'do not have', 'no data', 'no matching'];
    const isNotFoundAnswer = notFoundPatterns.some(p => answer.toLowerCase().includes(p));

    if (isNotFoundAnswer) {
      return {
        question,
        answer,
        citations: [],
        retrieval: {
          count: contextItems.length,
          topSources: counts
        }
      };
    }

    // Validate citations in the answer
    const validCitationIds = citations.map(c => c.id);
    const validation = validateCitations(answer, validCitationIds);

    if (!validation.valid) {
      console.warn('[RAG] Citation validation failed:', validation.issues);
      // The model may be hallucinating — reject the answer
      answer = "I couldn't find that information in your data.";
    }

    return {
      question,
      answer,
      citations: validation.valid ? citations : [],
      retrieval: {
        count: contextItems.length,
        topSources: counts
      }
    };

  } catch (err) {
    console.error('[RAG] Failed to generate answer:', err);
    throw new Error(`Answer generation failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Simple search without RAG (just retrieval)
 */
export async function searchOnly(
  query: string,
  filters?: SearchFilters
): Promise<{
  items: ContextItem[];
  citations: Citation[];
  counts: { sourceType: string; count: number }[];
}> {
  const { items, counts } = await retrieveContext(query, filters);
  const citations = buildCitations(items);

  return { items, citations, counts };
}

/**
 * Ask a question with RAG - main entry point
 */
export async function ask(
  question: string,
  filters?: SearchFilters
): Promise<SearchResponse> {
  if (!question || question.trim().length === 0) {
    throw new Error('Question is required');
  }

  return generateAnswer(question.trim(), filters);
}
