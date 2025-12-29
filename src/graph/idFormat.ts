/**
 * ID formatting utilities for Knowledge Graph
 * Ensures consistent prefixed IDs: meeting:uuid, deal:logos_123, etc.
 */

export type EntityType =
  | 'meeting'
  | 'task'
  | 'project'
  | 'deal'
  | 'contact'
  | 'pulse_message'
  | 'crm_deal'
  | 'crm_contact';

/**
 * Format an entity ID with its type prefix
 * @param entityType - The type of entity (meeting, deal, task, etc.)
 * @param rawId - The raw ID (UUID or external ID)
 * @returns Prefixed ID like "meeting:abc-123" or "deal:logos_456"
 */
export function formatEntityId(entityType: string, rawId: string | number): string {
  if (!entityType) {
    throw new Error('entityType required');
  }
  if (rawId === undefined || rawId === null) {
    throw new Error('rawId required');
  }

  const s = String(rawId).trim();
  if (!s) {
    throw new Error('rawId empty');
  }

  // Already prefixed (meeting:..., deal:..., etc.)
  if (s.includes(':')) {
    return s;
  }

  return `${entityType}:${s}`;
}

/**
 * Parse a prefixed entity ID back into type and raw ID
 * @param prefixedId - The prefixed ID like "meeting:abc-123"
 * @returns Object with type and id
 */
export function parseEntityId(prefixedId: string): { type: string; id: string } {
  if (!prefixedId || !prefixedId.includes(':')) {
    throw new Error('Invalid prefixed ID format');
  }

  const colonIndex = prefixedId.indexOf(':');
  return {
    type: prefixedId.substring(0, colonIndex),
    id: prefixedId.substring(colonIndex + 1)
  };
}

/**
 * Validate that an ID has the correct prefix format
 */
export function isValidPrefixedId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  const colonIndex = id.indexOf(':');
  return colonIndex > 0 && colonIndex < id.length - 1;
}
