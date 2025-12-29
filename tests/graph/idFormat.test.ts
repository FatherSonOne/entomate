/**
 * Entity ID Format Tests
 * Phase 2 Week 7 - Testing & QA
 */

import { describe, it, expect } from 'vitest';
import { formatEntityId, parseEntityId, isValidPrefixedId } from '../../src/graph/idFormat';

describe('formatEntityId', () => {
  describe('Basic Formatting', () => {
    it('should format meeting ID correctly', () => {
      const result = formatEntityId('meeting', 'abc-123');
      expect(result).toBe('meeting:abc-123');
    });

    it('should format deal ID correctly', () => {
      const result = formatEntityId('deal', 'logos_456');
      expect(result).toBe('deal:logos_456');
    });

    it('should format task ID correctly', () => {
      const result = formatEntityId('task', 'task-uuid-789');
      expect(result).toBe('task:task-uuid-789');
    });

    it('should format project ID correctly', () => {
      const result = formatEntityId('project', 'proj-001');
      expect(result).toBe('project:proj-001');
    });

    it('should format contact ID correctly', () => {
      const result = formatEntityId('contact', 'contact-uuid');
      expect(result).toBe('contact:contact-uuid');
    });

    it('should format pulse_message ID correctly', () => {
      const result = formatEntityId('pulse_message', 'msg-123');
      expect(result).toBe('pulse_message:msg-123');
    });
  });

  describe('Number Conversion', () => {
    it('should convert numeric IDs to strings', () => {
      const result = formatEntityId('deal', 12345);
      expect(result).toBe('deal:12345');
    });

    it('should handle numeric string IDs', () => {
      const result = formatEntityId('task', '67890');
      expect(result).toBe('task:67890');
    });
  });

  describe('Already Prefixed IDs', () => {
    it('should not double-prefix already prefixed IDs', () => {
      const result = formatEntityId('meeting', 'meeting:abc-123');
      expect(result).toBe('meeting:abc-123');
    });

    it('should preserve different prefix if already prefixed', () => {
      const result = formatEntityId('task', 'deal:xyz');
      expect(result).toBe('deal:xyz');
    });
  });

  describe('Whitespace Handling', () => {
    it('should trim whitespace from raw ID', () => {
      const result = formatEntityId('meeting', '  abc-123  ');
      expect(result).toBe('meeting:abc-123');
    });
  });

  describe('Validation Errors', () => {
    it('should throw on empty entityType', () => {
      expect(() => formatEntityId('', 'abc')).toThrow('entityType required');
    });

    it('should throw on null rawId', () => {
      expect(() => formatEntityId('meeting', null as any)).toThrow('rawId required');
    });

    it('should throw on undefined rawId', () => {
      expect(() => formatEntityId('meeting', undefined as any)).toThrow('rawId required');
    });

    it('should throw on empty string rawId', () => {
      expect(() => formatEntityId('meeting', '')).toThrow('rawId empty');
    });

    it('should throw on whitespace-only rawId', () => {
      expect(() => formatEntityId('meeting', '   ')).toThrow('rawId empty');
    });
  });
});

describe('parseEntityId', () => {
  describe('Basic Parsing', () => {
    it('should parse meeting ID correctly', () => {
      const result = parseEntityId('meeting:abc-123');
      expect(result).toEqual({ type: 'meeting', id: 'abc-123' });
    });

    it('should parse deal ID correctly', () => {
      const result = parseEntityId('deal:logos_456');
      expect(result).toEqual({ type: 'deal', id: 'logos_456' });
    });

    it('should parse task ID correctly', () => {
      const result = parseEntityId('task:uuid-789');
      expect(result).toEqual({ type: 'task', id: 'uuid-789' });
    });
  });

  describe('IDs with Multiple Colons', () => {
    it('should handle ID containing additional colons', () => {
      const result = parseEntityId('meeting:abc:def:123');
      expect(result).toEqual({ type: 'meeting', id: 'abc:def:123' });
    });
  });

  describe('Validation Errors', () => {
    it('should throw on empty string', () => {
      expect(() => parseEntityId('')).toThrow('Invalid prefixed ID format');
    });

    it('should throw on ID without colon', () => {
      expect(() => parseEntityId('abc123')).toThrow('Invalid prefixed ID format');
    });

    it('should throw on null', () => {
      expect(() => parseEntityId(null as any)).toThrow('Invalid prefixed ID format');
    });

    it('should throw on undefined', () => {
      expect(() => parseEntityId(undefined as any)).toThrow('Invalid prefixed ID format');
    });
  });
});

describe('isValidPrefixedId', () => {
  describe('Valid IDs', () => {
    it('should return true for valid meeting ID', () => {
      expect(isValidPrefixedId('meeting:abc-123')).toBe(true);
    });

    it('should return true for valid deal ID', () => {
      expect(isValidPrefixedId('deal:123')).toBe(true);
    });

    it('should return true for valid task ID', () => {
      expect(isValidPrefixedId('task:uuid')).toBe(true);
    });

    it('should return true for single character type and id', () => {
      expect(isValidPrefixedId('a:b')).toBe(true);
    });
  });

  describe('Invalid IDs', () => {
    it('should return false for empty string', () => {
      expect(isValidPrefixedId('')).toBe(false);
    });

    it('should return false for null', () => {
      expect(isValidPrefixedId(null as any)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isValidPrefixedId(undefined as any)).toBe(false);
    });

    it('should return false for non-string', () => {
      expect(isValidPrefixedId(123 as any)).toBe(false);
    });

    it('should return false for ID without colon', () => {
      expect(isValidPrefixedId('abc123')).toBe(false);
    });

    it('should return false for ID starting with colon', () => {
      expect(isValidPrefixedId(':abc')).toBe(false);
    });

    it('should return false for ID ending with colon', () => {
      expect(isValidPrefixedId('abc:')).toBe(false);
    });

    it('should return false for just a colon', () => {
      expect(isValidPrefixedId(':')).toBe(false);
    });
  });
});

describe('Round-trip Tests', () => {
  it('should format and parse back to original values', () => {
    const type = 'meeting';
    const id = 'test-uuid-123';

    const formatted = formatEntityId(type, id);
    const parsed = parseEntityId(formatted);

    expect(parsed.type).toBe(type);
    expect(parsed.id).toBe(id);
  });

  it('should work for all entity types', () => {
    const entityTypes = ['meeting', 'task', 'project', 'deal', 'contact', 'pulse_message'];

    for (const type of entityTypes) {
      const id = `${type}-uuid-456`;
      const formatted = formatEntityId(type, id);
      const parsed = parseEntityId(formatted);

      expect(parsed.type).toBe(type);
      expect(parsed.id).toBe(id);
      expect(isValidPrefixedId(formatted)).toBe(true);
    }
  });
});
