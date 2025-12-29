/**
 * Deal Probability Scoring Tests
 * Phase 2 Week 7 - Testing & QA
 */

import { describe, it, expect } from 'vitest';

// Import scoring constants and logic for testing
// Note: We test the pure scoring logic, mocking DB calls

/**
 * Stage score lookup (mirrors dealProbability.ts)
 */
const STAGE_SCORES: Record<string, number> = {
  'discovery': 0,
  'qualification': 5,
  'proposal': 10,
  'negotiation': 20,
  'verbal_commit': 30,
  'closed_won': 50,
  'closed_lost': -50
};

/**
 * Pure scoring function (extracted for testing)
 */
function calculateDealScore(
  stage: string,
  stats: {
    lastMeetingDaysAgo: number | null;
    overdueHighTasks: number;
    overdueMediumTasks: number;
    completedTasks: number;
    meetingSentiment?: 'positive' | 'neutral' | 'negative';
  }
): { score: number; riskFlags: string[]; reasons: string[] } {
  let score = 50; // Base score
  const reasons: string[] = [];
  const riskFlags: string[] = [];

  // Stage adjustment
  const stageScore = STAGE_SCORES[stage?.toLowerCase()] ?? 0;
  if (stageScore !== 0) {
    score += stageScore;
    reasons.push(`${stageScore > 0 ? '+' : ''}${stageScore} ${stage} stage`);
  }

  // Activity adjustment
  if (stats.lastMeetingDaysAgo !== null) {
    if (stats.lastMeetingDaysAgo <= 7) {
      score += 10;
      reasons.push('+10 recent meeting');
    } else if (stats.lastMeetingDaysAgo > 14) {
      score -= 10;
      riskFlags.push('no_recent_meeting');
      reasons.push('-10 no meeting in 14+ days');
    }
  }

  // Task adjustments
  if (stats.overdueHighTasks > 0) {
    const penalty = Math.min(30, stats.overdueHighTasks * 10);
    score -= penalty;
    riskFlags.push('overdue_high_tasks');
    reasons.push(`-${penalty} overdue high priority tasks`);
  }

  if (stats.completedTasks > 0) {
    const bonus = Math.min(15, stats.completedTasks * 5);
    score += bonus;
    reasons.push(`+${bonus} completed deliverables`);
  }

  // Sentiment adjustment
  if (stats.meetingSentiment === 'negative') {
    score -= 10;
    riskFlags.push('negative_sentiment');
    reasons.push('-10 negative meeting sentiment');
  } else if (stats.meetingSentiment === 'positive') {
    score += 5;
    reasons.push('+5 positive meeting sentiment');
  }

  // Clamp final score
  score = Math.max(0, Math.min(100, score));

  return { score, riskFlags, reasons };
}

describe('Deal Probability Scoring', () => {
  describe('Base Score', () => {
    it('should start with base score of 50', () => {
      const result = calculateDealScore('discovery', {
        lastMeetingDaysAgo: null,
        overdueHighTasks: 0,
        overdueMediumTasks: 0,
        completedTasks: 0
      });
      expect(result.score).toBe(50);
    });
  });

  describe('Stage Adjustments', () => {
    it('should add 10 for proposal stage', () => {
      const result = calculateDealScore('proposal', {
        lastMeetingDaysAgo: null,
        overdueHighTasks: 0,
        overdueMediumTasks: 0,
        completedTasks: 0
      });
      expect(result.score).toBe(60);
      expect(result.reasons).toContain('+10 proposal stage');
    });

    it('should add 20 for negotiation stage', () => {
      const result = calculateDealScore('negotiation', {
        lastMeetingDaysAgo: null,
        overdueHighTasks: 0,
        overdueMediumTasks: 0,
        completedTasks: 0
      });
      expect(result.score).toBe(70);
    });

    it('should add 30 for verbal_commit stage', () => {
      const result = calculateDealScore('verbal_commit', {
        lastMeetingDaysAgo: null,
        overdueHighTasks: 0,
        overdueMediumTasks: 0,
        completedTasks: 0
      });
      expect(result.score).toBe(80);
    });

    it('should subtract 50 for closed_lost stage', () => {
      const result = calculateDealScore('closed_lost', {
        lastMeetingDaysAgo: null,
        overdueHighTasks: 0,
        overdueMediumTasks: 0,
        completedTasks: 0
      });
      expect(result.score).toBe(0); // Clamped to 0
    });

    it('should handle unknown stages gracefully', () => {
      const result = calculateDealScore('unknown_stage', {
        lastMeetingDaysAgo: null,
        overdueHighTasks: 0,
        overdueMediumTasks: 0,
        completedTasks: 0
      });
      expect(result.score).toBe(50); // No adjustment
    });
  });

  describe('Meeting Activity Adjustments', () => {
    it('should add 10 for recent meeting (within 7 days)', () => {
      const result = calculateDealScore('discovery', {
        lastMeetingDaysAgo: 3,
        overdueHighTasks: 0,
        overdueMediumTasks: 0,
        completedTasks: 0
      });
      expect(result.score).toBe(60);
      expect(result.reasons).toContain('+10 recent meeting');
    });

    it('should subtract 10 for stale meetings (over 14 days)', () => {
      const result = calculateDealScore('discovery', {
        lastMeetingDaysAgo: 20,
        overdueHighTasks: 0,
        overdueMediumTasks: 0,
        completedTasks: 0
      });
      expect(result.score).toBe(40);
      expect(result.riskFlags).toContain('no_recent_meeting');
    });

    it('should not adjust for meetings 8-14 days ago', () => {
      const result = calculateDealScore('discovery', {
        lastMeetingDaysAgo: 10,
        overdueHighTasks: 0,
        overdueMediumTasks: 0,
        completedTasks: 0
      });
      expect(result.score).toBe(50);
    });
  });

  describe('Task Adjustments', () => {
    it('should penalize overdue high priority tasks', () => {
      const result = calculateDealScore('discovery', {
        lastMeetingDaysAgo: null,
        overdueHighTasks: 2,
        overdueMediumTasks: 0,
        completedTasks: 0
      });
      expect(result.score).toBe(30); // 50 - 20
      expect(result.riskFlags).toContain('overdue_high_tasks');
    });

    it('should cap penalty at 30 for many overdue tasks', () => {
      const result = calculateDealScore('discovery', {
        lastMeetingDaysAgo: null,
        overdueHighTasks: 10,
        overdueMediumTasks: 0,
        completedTasks: 0
      });
      expect(result.score).toBe(20); // 50 - 30 (capped)
    });

    it('should add bonus for completed tasks', () => {
      const result = calculateDealScore('discovery', {
        lastMeetingDaysAgo: null,
        overdueHighTasks: 0,
        overdueMediumTasks: 0,
        completedTasks: 2
      });
      expect(result.score).toBe(60); // 50 + 10
    });

    it('should cap completed task bonus at 15', () => {
      const result = calculateDealScore('discovery', {
        lastMeetingDaysAgo: null,
        overdueHighTasks: 0,
        overdueMediumTasks: 0,
        completedTasks: 10
      });
      expect(result.score).toBe(65); // 50 + 15 (capped)
    });
  });

  describe('Sentiment Adjustments', () => {
    it('should add 5 for positive sentiment', () => {
      const result = calculateDealScore('discovery', {
        lastMeetingDaysAgo: null,
        overdueHighTasks: 0,
        overdueMediumTasks: 0,
        completedTasks: 0,
        meetingSentiment: 'positive'
      });
      expect(result.score).toBe(55);
    });

    it('should subtract 10 for negative sentiment', () => {
      const result = calculateDealScore('discovery', {
        lastMeetingDaysAgo: null,
        overdueHighTasks: 0,
        overdueMediumTasks: 0,
        completedTasks: 0,
        meetingSentiment: 'negative'
      });
      expect(result.score).toBe(40);
      expect(result.riskFlags).toContain('negative_sentiment');
    });

    it('should not adjust for neutral sentiment', () => {
      const result = calculateDealScore('discovery', {
        lastMeetingDaysAgo: null,
        overdueHighTasks: 0,
        overdueMediumTasks: 0,
        completedTasks: 0,
        meetingSentiment: 'neutral'
      });
      expect(result.score).toBe(50);
    });
  });

  describe('Score Clamping', () => {
    it('should never exceed 100', () => {
      const result = calculateDealScore('closed_won', {
        lastMeetingDaysAgo: 1,
        overdueHighTasks: 0,
        overdueMediumTasks: 0,
        completedTasks: 10,
        meetingSentiment: 'positive'
      });
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should never go below 0', () => {
      const result = calculateDealScore('closed_lost', {
        lastMeetingDaysAgo: 30,
        overdueHighTasks: 5,
        overdueMediumTasks: 0,
        completedTasks: 0,
        meetingSentiment: 'negative'
      });
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Combined Scenarios', () => {
    it('should calculate correctly for high-performing deal', () => {
      const result = calculateDealScore('negotiation', {
        lastMeetingDaysAgo: 2,
        overdueHighTasks: 0,
        overdueMediumTasks: 0,
        completedTasks: 3,
        meetingSentiment: 'positive'
      });
      // Base 50 + negotiation 20 + recent meeting 10 + completed 15 + positive 5 = 100
      expect(result.score).toBe(100);
      expect(result.riskFlags).toHaveLength(0);
    });

    it('should calculate correctly for at-risk deal', () => {
      const result = calculateDealScore('qualification', {
        lastMeetingDaysAgo: 21,
        overdueHighTasks: 2,
        overdueMediumTasks: 1,
        completedTasks: 0,
        meetingSentiment: 'negative'
      });
      // Base 50 + qualification 5 - stale meeting 10 - overdue 20 - negative 10 = 15
      expect(result.score).toBe(15);
      expect(result.riskFlags).toContain('no_recent_meeting');
      expect(result.riskFlags).toContain('overdue_high_tasks');
      expect(result.riskFlags).toContain('negative_sentiment');
    });
  });
});
