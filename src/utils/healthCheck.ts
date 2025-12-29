/**
 * Health Check Utilities
 * Phase 2 Week 7 - Testing & QA
 *
 * Provides smoke test functions for verifying system components
 */

import { supabase } from '../lib/supabase';

export interface HealthCheckResult {
  component: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  latencyMs: number;
  message?: string;
  details?: Record<string, any>;
}

export interface SystemHealth {
  overall: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  checks: HealthCheckResult[];
}

/**
 * Check Supabase database connectivity
 */
export async function checkDatabase(): Promise<HealthCheckResult> {
  const start = Date.now();

  try {
    // Simple query to verify connection
    const { data, error } = await supabase
      .from('entomate_projects')
      .select('id')
      .limit(1);

    const latencyMs = Date.now() - start;

    if (error) {
      return {
        component: 'database',
        status: 'unhealthy',
        latencyMs,
        message: error.message
      };
    }

    return {
      component: 'database',
      status: latencyMs > 1000 ? 'degraded' : 'healthy',
      latencyMs,
      message: latencyMs > 1000 ? 'Slow response' : 'Connected'
    };
  } catch (err) {
    return {
      component: 'database',
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      message: err instanceof Error ? err.message : 'Connection failed'
    };
  }
}

/**
 * Check relationships table (Knowledge Graph)
 */
export async function checkKnowledgeGraph(): Promise<HealthCheckResult> {
  const start = Date.now();

  try {
    const { count, error } = await supabase
      .from('relationships')
      .select('*', { count: 'exact', head: true });

    const latencyMs = Date.now() - start;

    if (error) {
      return {
        component: 'knowledge_graph',
        status: 'unhealthy',
        latencyMs,
        message: error.message
      };
    }

    return {
      component: 'knowledge_graph',
      status: 'healthy',
      latencyMs,
      message: 'Relationships table accessible',
      details: { relationshipCount: count }
    };
  } catch (err) {
    return {
      component: 'knowledge_graph',
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      message: err instanceof Error ? err.message : 'Check failed'
    };
  }
}

/**
 * Check predictions table (Analytics)
 */
export async function checkPredictions(): Promise<HealthCheckResult> {
  const start = Date.now();

  try {
    const { count, error } = await supabase
      .from('predictions')
      .select('*', { count: 'exact', head: true });

    const latencyMs = Date.now() - start;

    if (error) {
      return {
        component: 'predictions',
        status: 'unhealthy',
        latencyMs,
        message: error.message
      };
    }

    return {
      component: 'predictions',
      status: 'healthy',
      latencyMs,
      message: 'Predictions table accessible',
      details: { predictionCount: count }
    };
  } catch (err) {
    return {
      component: 'predictions',
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      message: err instanceof Error ? err.message : 'Check failed'
    };
  }
}

/**
 * Check agents table
 */
export async function checkAgents(): Promise<HealthCheckResult> {
  const start = Date.now();

  try {
    const { count, error } = await supabase
      .from('agents')
      .select('*', { count: 'exact', head: true });

    const latencyMs = Date.now() - start;

    if (error) {
      return {
        component: 'agents',
        status: 'unhealthy',
        latencyMs,
        message: error.message
      };
    }

    return {
      component: 'agents',
      status: 'healthy',
      latencyMs,
      message: 'Agents table accessible',
      details: { agentCount: count }
    };
  } catch (err) {
    return {
      component: 'agents',
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      message: err instanceof Error ? err.message : 'Check failed'
    };
  }
}

/**
 * Check project tasks (for ETA predictions)
 */
export async function checkProjectTasks(): Promise<HealthCheckResult> {
  const start = Date.now();

  try {
    const { count, error } = await supabase
      .from('entomate_project_tasks')
      .select('*', { count: 'exact', head: true });

    const latencyMs = Date.now() - start;

    if (error) {
      return {
        component: 'project_tasks',
        status: 'unhealthy',
        latencyMs,
        message: error.message
      };
    }

    return {
      component: 'project_tasks',
      status: 'healthy',
      latencyMs,
      message: 'Tasks table accessible',
      details: { taskCount: count }
    };
  } catch (err) {
    return {
      component: 'project_tasks',
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      message: err instanceof Error ? err.message : 'Check failed'
    };
  }
}

/**
 * Run all health checks
 */
export async function runAllHealthChecks(): Promise<SystemHealth> {
  const checks = await Promise.all([
    checkDatabase(),
    checkKnowledgeGraph(),
    checkPredictions(),
    checkAgents(),
    checkProjectTasks()
  ]);

  // Determine overall status
  const hasUnhealthy = checks.some(c => c.status === 'unhealthy');
  const hasDegraded = checks.some(c => c.status === 'degraded');

  let overall: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
  if (hasUnhealthy) {
    overall = 'unhealthy';
  } else if (hasDegraded) {
    overall = 'degraded';
  }

  return {
    overall,
    timestamp: new Date().toISOString(),
    checks
  };
}

/**
 * Format health check results for console output
 */
export function formatHealthResults(health: SystemHealth): string {
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
