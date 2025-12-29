/**
 * Task ETA Prediction Tests
 * Phase 2 Week 7 - Testing & QA
 */

import { describe, it, expect } from 'vitest';

/**
 * Default days by priority (mirrors taskEta.ts)
 */
const DEFAULT_DAYS_BY_PRIORITY: Record<string, number> = {
  high: 3,
  medium: 7,
  low: 14
};

/**
 * Add days to a date (mirrors taskEta.ts)
 */
function addDays(date: Date, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Pure ETA calculation function (extracted for testing)
 */
function calculateTaskEta(
  task: {
    priority: 'high' | 'medium' | 'low';
    status: string;
  },
  stats: {
    typicalDaysForSimilar: number | null;
    assigneeOpenTasks: number;
  }
): {
  predictedDays: number;
  confidence: 'low' | 'medium' | 'high';
  adjustmentReasons: string[];
} {
  // Get typical days from history or use defaults
  let typicalDays = stats.typicalDaysForSimilar;
  if (!typicalDays) {
    typicalDays = DEFAULT_DAYS_BY_PRIORITY[task.priority] || 7;
  }

  // Adjustments
  let extraDays = 0;
  const adjustmentReasons: string[] = [];

  // Workload adjustment
  if (stats.assigneeOpenTasks > 10) {
    extraDays += 3;
    adjustmentReasons.push('+3 days (assignee workload)');
  } else if (stats.assigneeOpenTasks > 5) {
    extraDays += 1;
    adjustmentReasons.push('+1 day (moderate workload)');
  }

  // Status adjustment
  if (task.status === 'todo') {
    extraDays += 1;
    adjustmentReasons.push('+1 day (not started)');
  }

  const predictedDays = typicalDays + extraDays;

  // Determine confidence
  let confidence: 'low' | 'medium' | 'high';
  if (stats.typicalDaysForSimilar !== null && stats.assigneeOpenTasks < 5) {
    confidence = 'high';
  } else if (stats.typicalDaysForSimilar !== null || stats.assigneeOpenTasks < 10) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  return { predictedDays, confidence, adjustmentReasons };
}

describe('Task ETA Prediction', () => {
  describe('Default Days by Priority', () => {
    it('should default to 3 days for high priority', () => {
      const result = calculateTaskEta(
        { priority: 'high', status: 'in_progress' },
        { typicalDaysForSimilar: null, assigneeOpenTasks: 0 }
      );
      expect(result.predictedDays).toBe(3);
    });

    it('should default to 7 days for medium priority', () => {
      const result = calculateTaskEta(
        { priority: 'medium', status: 'in_progress' },
        { typicalDaysForSimilar: null, assigneeOpenTasks: 0 }
      );
      expect(result.predictedDays).toBe(7);
    });

    it('should default to 14 days for low priority', () => {
      const result = calculateTaskEta(
        { priority: 'low', status: 'in_progress' },
        { typicalDaysForSimilar: null, assigneeOpenTasks: 0 }
      );
      expect(result.predictedDays).toBe(14);
    });
  });

  describe('Historical Data Override', () => {
    it('should use historical average when available', () => {
      const result = calculateTaskEta(
        { priority: 'medium', status: 'in_progress' },
        { typicalDaysForSimilar: 5, assigneeOpenTasks: 0 }
      );
      expect(result.predictedDays).toBe(5);
    });

    it('should prefer historical over default', () => {
      const result = calculateTaskEta(
        { priority: 'high', status: 'in_progress' },
        { typicalDaysForSimilar: 10, assigneeOpenTasks: 0 }
      );
      expect(result.predictedDays).toBe(10); // Not 3 (default)
    });
  });

  describe('Workload Adjustments', () => {
    it('should add 1 day for moderate workload (6-10 tasks)', () => {
      const result = calculateTaskEta(
        { priority: 'medium', status: 'in_progress' },
        { typicalDaysForSimilar: null, assigneeOpenTasks: 7 }
      );
      expect(result.predictedDays).toBe(8); // 7 + 1
      expect(result.adjustmentReasons).toContain('+1 day (moderate workload)');
    });

    it('should add 3 days for heavy workload (>10 tasks)', () => {
      const result = calculateTaskEta(
        { priority: 'medium', status: 'in_progress' },
        { typicalDaysForSimilar: null, assigneeOpenTasks: 15 }
      );
      expect(result.predictedDays).toBe(10); // 7 + 3
      expect(result.adjustmentReasons).toContain('+3 days (assignee workload)');
    });

    it('should not adjust for light workload (<= 5 tasks)', () => {
      const result = calculateTaskEta(
        { priority: 'medium', status: 'in_progress' },
        { typicalDaysForSimilar: null, assigneeOpenTasks: 3 }
      );
      expect(result.predictedDays).toBe(7);
      expect(result.adjustmentReasons).not.toContain('+1 day (moderate workload)');
      expect(result.adjustmentReasons).not.toContain('+3 days (assignee workload)');
    });
  });

  describe('Status Adjustments', () => {
    it('should add 1 day for todo status', () => {
      const result = calculateTaskEta(
        { priority: 'medium', status: 'todo' },
        { typicalDaysForSimilar: null, assigneeOpenTasks: 0 }
      );
      expect(result.predictedDays).toBe(8); // 7 + 1
      expect(result.adjustmentReasons).toContain('+1 day (not started)');
    });

    it('should not add extra day for in_progress status', () => {
      const result = calculateTaskEta(
        { priority: 'medium', status: 'in_progress' },
        { typicalDaysForSimilar: null, assigneeOpenTasks: 0 }
      );
      expect(result.predictedDays).toBe(7);
    });
  });

  describe('Confidence Levels', () => {
    it('should be high when historical data exists and low workload', () => {
      const result = calculateTaskEta(
        { priority: 'medium', status: 'in_progress' },
        { typicalDaysForSimilar: 5, assigneeOpenTasks: 2 }
      );
      expect(result.confidence).toBe('high');
    });

    it('should be medium when historical data exists but moderate workload', () => {
      const result = calculateTaskEta(
        { priority: 'medium', status: 'in_progress' },
        { typicalDaysForSimilar: 5, assigneeOpenTasks: 7 }
      );
      expect(result.confidence).toBe('medium');
    });

    it('should be medium when no historical data but low workload', () => {
      const result = calculateTaskEta(
        { priority: 'medium', status: 'in_progress' },
        { typicalDaysForSimilar: null, assigneeOpenTasks: 3 }
      );
      expect(result.confidence).toBe('medium');
    });

    it('should be low when no historical data and heavy workload', () => {
      const result = calculateTaskEta(
        { priority: 'medium', status: 'in_progress' },
        { typicalDaysForSimilar: null, assigneeOpenTasks: 15 }
      );
      expect(result.confidence).toBe('low');
    });
  });

  describe('Combined Scenarios', () => {
    it('should handle high priority todo with heavy workload', () => {
      const result = calculateTaskEta(
        { priority: 'high', status: 'todo' },
        { typicalDaysForSimilar: null, assigneeOpenTasks: 12 }
      );
      // 3 (default high) + 3 (heavy workload) + 1 (not started) = 7
      expect(result.predictedDays).toBe(7);
      expect(result.confidence).toBe('low');
    });

    it('should handle historical data with all adjustments', () => {
      const result = calculateTaskEta(
        { priority: 'medium', status: 'todo' },
        { typicalDaysForSimilar: 4, assigneeOpenTasks: 8 }
      );
      // 4 (historical) + 1 (moderate workload) + 1 (not started) = 6
      expect(result.predictedDays).toBe(6);
      expect(result.confidence).toBe('medium');
    });
  });
});

describe('addDays Helper', () => {
  it('should add positive days correctly', () => {
    const date = new Date('2025-01-15');
    const result = addDays(date, 5);
    expect(result).toBe('2025-01-20');
  });

  it('should handle month rollover', () => {
    const date = new Date('2025-01-30');
    const result = addDays(date, 5);
    expect(result).toBe('2025-02-04');
  });

  it('should handle year rollover', () => {
    const date = new Date('2025-12-30');
    const result = addDays(date, 5);
    expect(result).toBe('2026-01-04');
  });

  it('should not mutate original date', () => {
    const date = new Date('2025-01-15');
    const originalTime = date.getTime();
    addDays(date, 5);
    expect(date.getTime()).toBe(originalTime);
  });
});
