/**
 * Agent Guardrails Tests
 * Phase 2 Week 7 - Testing & QA
 */

import { describe, it, expect } from 'vitest';
import type { AgentGuardrails, ActionCounters } from '../../src/agents/types';

/**
 * Default guardrails (mirrors types.ts)
 */
const DEFAULT_GUARDRAILS: AgentGuardrails = {
  maxPulseMessagesPerRun: 3,
  maxCrmTasksPerRun: 10,
  maxTotalActionsPerRun: 25,
  dryRunDefault: true
};

/**
 * Check if counters exceed guardrails (mirrors agentRunner.ts)
 * @throws Error if guardrails are exceeded
 */
function checkGuardrails(
  guardrails: AgentGuardrails | undefined,
  counters: ActionCounters
): void {
  const g = guardrails || DEFAULT_GUARDRAILS;

  if ((g.maxPulseMessagesPerRun ?? 3) < counters.pulseMessages) {
    throw new Error(`Guardrail exceeded: maxPulseMessagesPerRun (${counters.pulseMessages}/${g.maxPulseMessagesPerRun})`);
  }

  if ((g.maxCrmTasksPerRun ?? 10) < counters.crmTasks) {
    throw new Error(`Guardrail exceeded: maxCrmTasksPerRun (${counters.crmTasks}/${g.maxCrmTasksPerRun})`);
  }

  if ((g.maxTotalActionsPerRun ?? 25) < counters.totalActions) {
    throw new Error(`Guardrail exceeded: maxTotalActionsPerRun (${counters.totalActions}/${g.maxTotalActionsPerRun})`);
  }
}

describe('Agent Guardrails', () => {
  describe('Default Guardrails', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_GUARDRAILS.maxPulseMessagesPerRun).toBe(3);
      expect(DEFAULT_GUARDRAILS.maxCrmTasksPerRun).toBe(10);
      expect(DEFAULT_GUARDRAILS.maxTotalActionsPerRun).toBe(25);
      expect(DEFAULT_GUARDRAILS.dryRunDefault).toBe(true);
    });
  });

  describe('Pulse Message Guardrails', () => {
    it('should allow pulseMessages within limit', () => {
      const counters: ActionCounters = {
        pulseMessages: 2,
        crmTasks: 0,
        totalActions: 2
      };

      expect(() => checkGuardrails(DEFAULT_GUARDRAILS, counters)).not.toThrow();
    });

    it('should allow pulseMessages exactly at limit', () => {
      const counters: ActionCounters = {
        pulseMessages: 3,
        crmTasks: 0,
        totalActions: 3
      };

      expect(() => checkGuardrails(DEFAULT_GUARDRAILS, counters)).not.toThrow();
    });

    it('should throw when pulseMessages exceeds limit', () => {
      const counters: ActionCounters = {
        pulseMessages: 4,
        crmTasks: 0,
        totalActions: 4
      };

      expect(() => checkGuardrails(DEFAULT_GUARDRAILS, counters)).toThrow(
        'Guardrail exceeded: maxPulseMessagesPerRun (4/3)'
      );
    });

    it('should respect custom pulse message limit', () => {
      const customGuardrails: AgentGuardrails = {
        ...DEFAULT_GUARDRAILS,
        maxPulseMessagesPerRun: 5
      };

      const counters: ActionCounters = {
        pulseMessages: 4,
        crmTasks: 0,
        totalActions: 4
      };

      expect(() => checkGuardrails(customGuardrails, counters)).not.toThrow();
    });
  });

  describe('CRM Task Guardrails', () => {
    it('should allow crmTasks within limit', () => {
      const counters: ActionCounters = {
        pulseMessages: 0,
        crmTasks: 5,
        totalActions: 5
      };

      expect(() => checkGuardrails(DEFAULT_GUARDRAILS, counters)).not.toThrow();
    });

    it('should allow crmTasks exactly at limit', () => {
      const counters: ActionCounters = {
        pulseMessages: 0,
        crmTasks: 10,
        totalActions: 10
      };

      expect(() => checkGuardrails(DEFAULT_GUARDRAILS, counters)).not.toThrow();
    });

    it('should throw when crmTasks exceeds limit', () => {
      const counters: ActionCounters = {
        pulseMessages: 0,
        crmTasks: 11,
        totalActions: 11
      };

      expect(() => checkGuardrails(DEFAULT_GUARDRAILS, counters)).toThrow(
        'Guardrail exceeded: maxCrmTasksPerRun (11/10)'
      );
    });

    it('should respect custom CRM task limit', () => {
      const customGuardrails: AgentGuardrails = {
        ...DEFAULT_GUARDRAILS,
        maxCrmTasksPerRun: 20
      };

      const counters: ActionCounters = {
        pulseMessages: 0,
        crmTasks: 15,
        totalActions: 15
      };

      expect(() => checkGuardrails(customGuardrails, counters)).not.toThrow();
    });
  });

  describe('Total Actions Guardrails', () => {
    it('should allow totalActions within limit', () => {
      const counters: ActionCounters = {
        pulseMessages: 0,
        crmTasks: 0,
        totalActions: 20
      };

      expect(() => checkGuardrails(DEFAULT_GUARDRAILS, counters)).not.toThrow();
    });

    it('should allow totalActions exactly at limit', () => {
      const counters: ActionCounters = {
        pulseMessages: 0,
        crmTasks: 0,
        totalActions: 25
      };

      expect(() => checkGuardrails(DEFAULT_GUARDRAILS, counters)).not.toThrow();
    });

    it('should throw when totalActions exceeds limit', () => {
      const counters: ActionCounters = {
        pulseMessages: 0,
        crmTasks: 0,
        totalActions: 26
      };

      expect(() => checkGuardrails(DEFAULT_GUARDRAILS, counters)).toThrow(
        'Guardrail exceeded: maxTotalActionsPerRun (26/25)'
      );
    });

    it('should respect custom total actions limit', () => {
      const customGuardrails: AgentGuardrails = {
        ...DEFAULT_GUARDRAILS,
        maxTotalActionsPerRun: 50
      };

      const counters: ActionCounters = {
        pulseMessages: 0,
        crmTasks: 0,
        totalActions: 40
      };

      expect(() => checkGuardrails(customGuardrails, counters)).not.toThrow();
    });
  });

  describe('Combined Guardrails', () => {
    it('should check all guardrails in order', () => {
      // First violation is pulseMessages
      const counters: ActionCounters = {
        pulseMessages: 10,
        crmTasks: 20,
        totalActions: 50
      };

      expect(() => checkGuardrails(DEFAULT_GUARDRAILS, counters)).toThrow(
        'maxPulseMessagesPerRun'
      );
    });

    it('should allow complex scenario within all limits', () => {
      const counters: ActionCounters = {
        pulseMessages: 2,
        crmTasks: 8,
        totalActions: 20
      };

      expect(() => checkGuardrails(DEFAULT_GUARDRAILS, counters)).not.toThrow();
    });

    it('should handle undefined guardrails with defaults', () => {
      const counters: ActionCounters = {
        pulseMessages: 2,
        crmTasks: 5,
        totalActions: 10
      };

      expect(() => checkGuardrails(undefined, counters)).not.toThrow();
    });
  });

  describe('Error Message Clarity', () => {
    it('should include current count in pulse message error', () => {
      const counters: ActionCounters = {
        pulseMessages: 7,
        crmTasks: 0,
        totalActions: 7
      };

      try {
        checkGuardrails(DEFAULT_GUARDRAILS, counters);
        expect.fail('Should have thrown');
      } catch (err) {
        expect((err as Error).message).toContain('7/3');
      }
    });

    it('should include current count in CRM task error', () => {
      const counters: ActionCounters = {
        pulseMessages: 0,
        crmTasks: 15,
        totalActions: 15
      };

      try {
        checkGuardrails(DEFAULT_GUARDRAILS, counters);
        expect.fail('Should have thrown');
      } catch (err) {
        expect((err as Error).message).toContain('15/10');
      }
    });

    it('should include current count in total actions error', () => {
      const counters: ActionCounters = {
        pulseMessages: 0,
        crmTasks: 0,
        totalActions: 30
      };

      try {
        checkGuardrails(DEFAULT_GUARDRAILS, counters);
        expect.fail('Should have thrown');
      } catch (err) {
        expect((err as Error).message).toContain('30/25');
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero counters', () => {
      const counters: ActionCounters = {
        pulseMessages: 0,
        crmTasks: 0,
        totalActions: 0
      };

      expect(() => checkGuardrails(DEFAULT_GUARDRAILS, counters)).not.toThrow();
    });

    it('should handle guardrails set to zero (no actions allowed)', () => {
      const strictGuardrails: AgentGuardrails = {
        maxPulseMessagesPerRun: 0,
        maxCrmTasksPerRun: 0,
        maxTotalActionsPerRun: 0,
        dryRunDefault: true
      };

      const counters: ActionCounters = {
        pulseMessages: 1,
        crmTasks: 0,
        totalActions: 1
      };

      expect(() => checkGuardrails(strictGuardrails, counters)).toThrow();
    });

    it('should handle very large limits', () => {
      const looseGuardrails: AgentGuardrails = {
        maxPulseMessagesPerRun: 1000,
        maxCrmTasksPerRun: 1000,
        maxTotalActionsPerRun: 10000,
        dryRunDefault: false
      };

      const counters: ActionCounters = {
        pulseMessages: 500,
        crmTasks: 500,
        totalActions: 5000
      };

      expect(() => checkGuardrails(looseGuardrails, counters)).not.toThrow();
    });
  });
});

describe('Retry Logic', () => {
  /**
   * Simple retry wrapper (mirrors agentRunner.ts)
   */
  async function withRetry<T>(
    fn: () => Promise<T>,
    options: { maxAttempts?: number; baseDelayMs?: number } = {}
  ): Promise<T> {
    const { maxAttempts = 3, baseDelayMs = 10 } = options; // Using 10ms for tests
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err as Error;

        // Don't retry on validation errors or permission errors
        if (
          lastError.message.includes('validation') ||
          lastError.message.includes('permission') ||
          lastError.message.includes('Guardrail exceeded')
        ) {
          throw lastError;
        }

        if (attempt < maxAttempts) {
          const delay = baseDelayMs * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  it('should succeed on first attempt', async () => {
    let attempts = 0;
    const result = await withRetry(async () => {
      attempts++;
      return 'success';
    });

    expect(result).toBe('success');
    expect(attempts).toBe(1);
  });

  it('should retry on transient failure', async () => {
    let attempts = 0;
    const result = await withRetry(async () => {
      attempts++;
      if (attempts < 2) {
        throw new Error('Temporary failure');
      }
      return 'success';
    }, { baseDelayMs: 1 });

    expect(result).toBe('success');
    expect(attempts).toBe(2);
  });

  it('should fail after max attempts', async () => {
    let attempts = 0;

    await expect(withRetry(async () => {
      attempts++;
      throw new Error('Persistent failure');
    }, { maxAttempts: 3, baseDelayMs: 1 })).rejects.toThrow('Persistent failure');

    expect(attempts).toBe(3);
  });

  it('should not retry on validation error', async () => {
    let attempts = 0;

    await expect(withRetry(async () => {
      attempts++;
      throw new Error('validation error: invalid input');
    })).rejects.toThrow('validation error');

    expect(attempts).toBe(1);
  });

  it('should not retry on permission error', async () => {
    let attempts = 0;

    await expect(withRetry(async () => {
      attempts++;
      throw new Error('permission denied');
    })).rejects.toThrow('permission denied');

    expect(attempts).toBe(1);
  });

  it('should not retry on guardrail error', async () => {
    let attempts = 0;

    await expect(withRetry(async () => {
      attempts++;
      throw new Error('Guardrail exceeded: maxPulseMessagesPerRun');
    })).rejects.toThrow('Guardrail exceeded');

    expect(attempts).toBe(1);
  });
});
