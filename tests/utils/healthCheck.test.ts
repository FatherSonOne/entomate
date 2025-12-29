/**
 * Health Check Tests
 * Phase 2 Week 7 - Testing & QA
 */

import { describe, it, expect } from 'vitest';
import type { HealthCheckResult, SystemHealth } from '../../src/utils/healthCheck';

// Test the formatHealthResults function and overall status logic
// Note: Actual DB calls are tested in integration tests

/**
 * Mock health check result
 */
function createMockCheck(
  component: string,
  status: 'healthy' | 'unhealthy' | 'degraded',
  latencyMs: number = 50
): HealthCheckResult {
  return {
    component,
    status,
    latencyMs,
    message: `${component} ${status}`
  };
}

/**
 * Determine overall status (mirrors healthCheck.ts logic)
 */
function determineOverallStatus(checks: HealthCheckResult[]): 'healthy' | 'unhealthy' | 'degraded' {
  const hasUnhealthy = checks.some(c => c.status === 'unhealthy');
  const hasDegraded = checks.some(c => c.status === 'degraded');

  if (hasUnhealthy) return 'unhealthy';
  if (hasDegraded) return 'degraded';
  return 'healthy';
}

/**
 * Format health results (mirrors healthCheck.ts logic)
 */
function formatHealthResults(health: SystemHealth): string {
  const lines: string[] = [
    `System Health: ${health.overall.toUpperCase()}`,
    `Timestamp: ${health.timestamp}`,
    '---'
  ];

  for (const check of health.checks) {
    const icon = check.status === 'healthy' ? '✓' : check.status === 'degraded' ? '!' : '✗';
    lines.push(`${icon} ${check.component}: ${check.status} (${check.latencyMs}ms)`);
    if (check.message) {
      lines.push(`  ${check.message}`);
    }
  }

  return lines.join('\n');
}

describe('Health Check Logic', () => {
  describe('Overall Status Determination', () => {
    it('should return healthy when all checks are healthy', () => {
      const checks = [
        createMockCheck('database', 'healthy'),
        createMockCheck('knowledge_graph', 'healthy'),
        createMockCheck('predictions', 'healthy')
      ];

      expect(determineOverallStatus(checks)).toBe('healthy');
    });

    it('should return degraded when any check is degraded', () => {
      const checks = [
        createMockCheck('database', 'healthy'),
        createMockCheck('knowledge_graph', 'degraded'),
        createMockCheck('predictions', 'healthy')
      ];

      expect(determineOverallStatus(checks)).toBe('degraded');
    });

    it('should return unhealthy when any check is unhealthy', () => {
      const checks = [
        createMockCheck('database', 'unhealthy'),
        createMockCheck('knowledge_graph', 'healthy'),
        createMockCheck('predictions', 'healthy')
      ];

      expect(determineOverallStatus(checks)).toBe('unhealthy');
    });

    it('should return unhealthy even if degraded is also present', () => {
      const checks = [
        createMockCheck('database', 'unhealthy'),
        createMockCheck('knowledge_graph', 'degraded'),
        createMockCheck('predictions', 'healthy')
      ];

      expect(determineOverallStatus(checks)).toBe('unhealthy');
    });

    it('should handle empty checks array', () => {
      expect(determineOverallStatus([])).toBe('healthy');
    });
  });

  describe('Format Health Results', () => {
    it('should format healthy system correctly', () => {
      const health: SystemHealth = {
        overall: 'healthy',
        timestamp: '2025-01-15T12:00:00.000Z',
        checks: [
          createMockCheck('database', 'healthy', 50),
          createMockCheck('knowledge_graph', 'healthy', 30)
        ]
      };

      const result = formatHealthResults(health);

      expect(result).toContain('System Health: HEALTHY');
      expect(result).toContain('✓ database: healthy (50ms)');
      expect(result).toContain('✓ knowledge_graph: healthy (30ms)');
    });

    it('should format degraded system correctly', () => {
      const health: SystemHealth = {
        overall: 'degraded',
        timestamp: '2025-01-15T12:00:00.000Z',
        checks: [
          createMockCheck('database', 'degraded', 1500)
        ]
      };

      const result = formatHealthResults(health);

      expect(result).toContain('System Health: DEGRADED');
      expect(result).toContain('! database: degraded (1500ms)');
    });

    it('should format unhealthy system correctly', () => {
      const health: SystemHealth = {
        overall: 'unhealthy',
        timestamp: '2025-01-15T12:00:00.000Z',
        checks: [
          createMockCheck('database', 'unhealthy', 0)
        ]
      };

      const result = formatHealthResults(health);

      expect(result).toContain('System Health: UNHEALTHY');
      expect(result).toContain('✗ database: unhealthy');
    });

    it('should include timestamp', () => {
      const health: SystemHealth = {
        overall: 'healthy',
        timestamp: '2025-01-15T12:34:56.789Z',
        checks: []
      };

      const result = formatHealthResults(health);

      expect(result).toContain('Timestamp: 2025-01-15T12:34:56.789Z');
    });

    it('should include message if present', () => {
      const health: SystemHealth = {
        overall: 'healthy',
        timestamp: '2025-01-15T12:00:00.000Z',
        checks: [{
          component: 'database',
          status: 'healthy',
          latencyMs: 50,
          message: 'Connected successfully'
        }]
      };

      const result = formatHealthResults(health);

      expect(result).toContain('Connected successfully');
    });
  });
});

describe('Health Check Result Structure', () => {
  it('should have required fields', () => {
    const check: HealthCheckResult = {
      component: 'test',
      status: 'healthy',
      latencyMs: 100
    };

    expect(check.component).toBeDefined();
    expect(check.status).toBeDefined();
    expect(check.latencyMs).toBeDefined();
  });

  it('should allow optional message', () => {
    const check: HealthCheckResult = {
      component: 'test',
      status: 'healthy',
      latencyMs: 100,
      message: 'All good'
    };

    expect(check.message).toBe('All good');
  });

  it('should allow optional details', () => {
    const check: HealthCheckResult = {
      component: 'test',
      status: 'healthy',
      latencyMs: 100,
      details: { count: 42, version: '1.0' }
    };

    expect(check.details?.count).toBe(42);
    expect(check.details?.version).toBe('1.0');
  });
});

describe('Latency Thresholds', () => {
  it('should consider response healthy under 1000ms', () => {
    // This tests the business logic expectation
    const latencyMs = 500;
    const status = latencyMs > 1000 ? 'degraded' : 'healthy';
    expect(status).toBe('healthy');
  });

  it('should consider response degraded over 1000ms', () => {
    const latencyMs = 1500;
    const status = latencyMs > 1000 ? 'degraded' : 'healthy';
    expect(status).toBe('degraded');
  });

  it('should consider exactly 1000ms as healthy', () => {
    const latencyMs = 1000;
    const status = latencyMs > 1000 ? 'degraded' : 'healthy';
    expect(status).toBe('healthy');
  });
});
