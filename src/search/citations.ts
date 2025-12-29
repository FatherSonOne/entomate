/**
 * Citations Service
 * Creates and manages citation references for RAG answers
 */

import type { SearchSourceType, ContextItem, Citation } from './types';

// Citation prefix mapping by source type
const CITATION_PREFIXES: Record<SearchSourceType, string> = {
  meeting: 'M',
  task: 'T',
  project: 'P',
  crm_deal: 'D',
  crm_contact: 'C',
  pulse_message: 'PM'
};

/**
 * Generate citation ID (e.g., "M1", "T2", "D3")
 */
export function generateCitationId(sourceType: SearchSourceType, index: number): string {
  const prefix = CITATION_PREFIXES[sourceType] || 'X';
  return `${prefix}${index + 1}`;
}

/**
 * Build citations array from context items
 */
export function buildCitations(contextItems: ContextItem[]): Citation[] {
  const counters: Record<string, number> = {};
  const citations: Citation[] = [];

  for (const item of contextItems) {
    // Get counter for this source type
    const prefix = CITATION_PREFIXES[item.sourceType] || 'X';
    counters[prefix] = (counters[prefix] || 0) + 1;

    const citationId = `${prefix}${counters[prefix]}`;

    citations.push({
      id: citationId,
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      title: item.title,
      url: item.url,
      snippet: sanitizeSnippet(item.snippet),
      timestamp: item.metadata?.timestamp || item.metadata?.created_at
    });
  }

  return citations;
}

/**
 * Format context items for inclusion in RAG prompt
 */
export function formatContextForPrompt(
  contextItems: ContextItem[],
  citations: Citation[]
): string {
  if (contextItems.length === 0) {
    return 'No relevant context found.';
  }

  const lines: string[] = ['CONTEXT:'];

  for (let i = 0; i < contextItems.length; i++) {
    const item = contextItems[i];
    const citation = citations[i];

    lines.push(`[${citation.id}] (${item.sourceType}) ${item.title}`);
    lines.push(item.snippet);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Validate that an answer contains valid citations
 * Returns true if citations are valid, throws if invalid
 */
export function validateCitations(
  answer: string,
  validCitationIds: string[]
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Extract citation references from answer (e.g., [M1], [T2])
  const citationPattern = /\[([A-Z]+\d+)\]/g;
  const usedCitations = new Set<string>();
  let match;

  while ((match = citationPattern.exec(answer)) !== null) {
    usedCitations.add(match[1]);
  }

  // Check if answer has any citations at all
  if (usedCitations.size === 0) {
    issues.push('Answer contains no citations');
  }

  // Check if all cited references exist
  for (const cited of usedCitations) {
    if (!validCitationIds.includes(cited)) {
      issues.push(`Invalid citation reference: [${cited}]`);
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Get citation by ID from citations array
 */
export function getCitationById(citations: Citation[], id: string): Citation | undefined {
  return citations.find(c => c.id === id);
}

/**
 * Sanitize snippet text for safe display
 */
function sanitizeSnippet(text: string): string {
  if (!text) return '';

  return text
    .replace(/[\r\n]+/g, ' ')      // Replace newlines with spaces
    .replace(/\s+/g, ' ')           // Normalize whitespace
    .replace(/[<>]/g, '')           // Remove HTML-like chars
    .trim()
    .slice(0, 500);                 // Limit length
}

/**
 * Extract source type from citation ID
 */
export function getSourceTypeFromCitationId(citationId: string): SearchSourceType | null {
  const prefix = citationId.replace(/\d+$/, '');

  for (const [sourceType, p] of Object.entries(CITATION_PREFIXES)) {
    if (p === prefix) {
      return sourceType as SearchSourceType;
    }
  }

  return null;
}
