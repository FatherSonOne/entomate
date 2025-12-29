/**
 * Prediction Hook Helper Tests
 * Phase 2 Week 7 - Testing & QA
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Import the helper functions (not hooks, which need React context)
import {
  getProbabilityColor,
  getProbabilityBgColor,
  getConfidenceColor,
  formatPredictedDate
} from '../../src/hooks/usePredictions';

describe('getProbabilityColor', () => {
  describe('Green Range (>= 70)', () => {
    it('should return green for 70', () => {
      expect(getProbabilityColor(70)).toBe('#22c55e');
    });

    it('should return green for 85', () => {
      expect(getProbabilityColor(85)).toBe('#22c55e');
    });

    it('should return green for 100', () => {
      expect(getProbabilityColor(100)).toBe('#22c55e');
    });
  });

  describe('Amber Range (40-69)', () => {
    it('should return amber for 40', () => {
      expect(getProbabilityColor(40)).toBe('#f59e0b');
    });

    it('should return amber for 55', () => {
      expect(getProbabilityColor(55)).toBe('#f59e0b');
    });

    it('should return amber for 69', () => {
      expect(getProbabilityColor(69)).toBe('#f59e0b');
    });
  });

  describe('Red Range (< 40)', () => {
    it('should return red for 39', () => {
      expect(getProbabilityColor(39)).toBe('#ef4444');
    });

    it('should return red for 20', () => {
      expect(getProbabilityColor(20)).toBe('#ef4444');
    });

    it('should return red for 0', () => {
      expect(getProbabilityColor(0)).toBe('#ef4444');
    });
  });
});

describe('getProbabilityBgColor', () => {
  describe('Green Background (>= 70)', () => {
    it('should return green-100 for 70', () => {
      expect(getProbabilityBgColor(70)).toBe('#dcfce7');
    });

    it('should return green-100 for 100', () => {
      expect(getProbabilityBgColor(100)).toBe('#dcfce7');
    });
  });

  describe('Amber Background (40-69)', () => {
    it('should return amber-100 for 40', () => {
      expect(getProbabilityBgColor(40)).toBe('#fef3c7');
    });

    it('should return amber-100 for 69', () => {
      expect(getProbabilityBgColor(69)).toBe('#fef3c7');
    });
  });

  describe('Red Background (< 40)', () => {
    it('should return red-100 for 39', () => {
      expect(getProbabilityBgColor(39)).toBe('#fee2e2');
    });

    it('should return red-100 for 0', () => {
      expect(getProbabilityBgColor(0)).toBe('#fee2e2');
    });
  });
});

describe('getConfidenceColor', () => {
  it('should return green for high confidence', () => {
    expect(getConfidenceColor('high')).toBe('#22c55e');
  });

  it('should return amber for medium confidence', () => {
    expect(getConfidenceColor('medium')).toBe('#f59e0b');
  });

  it('should return gray for low confidence', () => {
    expect(getConfidenceColor('low')).toBe('#9ca3af');
  });
});

describe('formatPredictedDate', () => {
  // Mock the current date for consistent tests
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Relative Dates', () => {
    it('should return "Today" for current date', () => {
      expect(formatPredictedDate('2025-01-15')).toBe('Today');
    });

    it('should return "Tomorrow" for next day', () => {
      expect(formatPredictedDate('2025-01-16')).toBe('Tomorrow');
    });

    it('should return "In X days" for dates within a week', () => {
      expect(formatPredictedDate('2025-01-18')).toBe('In 3 days');
      expect(formatPredictedDate('2025-01-20')).toBe('In 5 days');
      expect(formatPredictedDate('2025-01-22')).toBe('In 7 days');
    });
  });

  describe('Overdue Dates', () => {
    it('should show overdue for past dates', () => {
      expect(formatPredictedDate('2025-01-14')).toBe('1 days overdue');
      expect(formatPredictedDate('2025-01-10')).toBe('5 days overdue');
    });
  });

  describe('Formatted Dates', () => {
    it('should format dates more than a week away', () => {
      const result = formatPredictedDate('2025-01-25');
      // Date formatting may vary by timezone, just verify month name appears
      expect(result).toMatch(/Jan\s+\d+/);
    });

    it('should format dates in different months', () => {
      const result = formatPredictedDate('2025-02-15');
      // Date formatting may vary by timezone, just verify month name appears
      expect(result).toMatch(/Feb\s+\d+/);
    });
  });
});

describe('Color Consistency', () => {
  it('probability and background colors should align at thresholds', () => {
    // At 70 threshold
    const color70 = getProbabilityColor(70);
    const bg70 = getProbabilityBgColor(70);
    expect(color70).toBe('#22c55e'); // green
    expect(bg70).toBe('#dcfce7'); // green-100

    // At 40 threshold
    const color40 = getProbabilityColor(40);
    const bg40 = getProbabilityBgColor(40);
    expect(color40).toBe('#f59e0b'); // amber
    expect(bg40).toBe('#fef3c7'); // amber-100

    // At 39 (below threshold)
    const color39 = getProbabilityColor(39);
    const bg39 = getProbabilityBgColor(39);
    expect(color39).toBe('#ef4444'); // red
    expect(bg39).toBe('#fee2e2'); // red-100
  });
});
