/**
 * Agent Runner
 * Executes agents safely with idempotency, retries, and guardrails
 */

import { supabase } from '../lib/supabase';
import { TRIGGERS, ACTIONS, validateAgent } from './agentRegistry';
import type {
  Agent,
  AgentRun,
  TriggerEvent,
  ActionCounters,
  AgentRunResult,
  AgentRunStatus
} from './types';

/**
 * Check if an agent has already run successfully for a given trigger event
 * (Idempotency check)
 */
async function hasSuccessfulRun(
  agentId: string,
  triggerEventId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('agent_runs')
    .select('id')
    .eq('agent_id', agentId)
    .eq('trigger_event_id', triggerEventId)
    .eq('status', 'success')
    .limit(1);

  if (error) {
    console.error('Error checking for successful run:', error);
    return false;
  }

  return (data?.length || 0) > 0;
}

/**
 * Create a new agent run record
 */
async function createRun(
  agentId: string,
  triggerEventId: string,
  input: Record<string, any>
): Promise<AgentRun> {
  const { data, error } = await supabase
    .from('agent_runs')
    .insert({
      agent_id: agentId,
      status: 'running',
      trigger_event_id: triggerEventId,
      input,
      attempt: 1
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create agent run: ${error.message}`);
  }

  return data;
}

/**
 * Update a run's status when finished
 */
async function finishRun(
  runId: string,
  status: AgentRunStatus,
  output: Record<string, any> | null,
  error: string | null
): Promise<void> {
  const { error: updateError } = await supabase
    .from('agent_runs')
    .update({
      status,
      output,
      error,
      finished_at: new Date().toISOString()
    })
    .eq('id', runId);

  if (updateError) {
    console.error('Failed to update agent run:', updateError);
    throw new Error(`Failed to finish agent run: ${updateError.message}`);
  }
}

/**
 * Record a step in the agent run
 */
async function recordStep(
  runId: string,
  stepIndex: number,
  stepType: string,
  status: 'running' | 'success' | 'failed',
  input: Record<string, any> | null,
  output: Record<string, any> | null,
  error: string | null
): Promise<void> {
  const now = new Date().toISOString();
  const { error: insertError } = await supabase
    .from('agent_run_steps')
    .insert({
      agent_run_id: runId,
      step_index: stepIndex,
      step_type: stepType,
      status,
      input,
      output,
      error,
      started_at: now,
      finished_at: status !== 'running' ? now : null
    });

  if (insertError) {
    console.error('Failed to record step:', insertError);
    throw new Error(`Failed to record agent step: ${insertError.message}`);
  }
}

/**
 * Check if counters exceed guardrails
 * @throws Error if guardrails are exceeded
 */
function checkGuardrails(
  guardrails: Agent['guardrails'],
  counters: ActionCounters
): void {
  const g = guardrails || {};

  if (counters.pulseMessages > (g.maxPulseMessagesPerRun ?? 3)) {
    throw new Error(`Guardrail exceeded: maxPulseMessagesPerRun (${counters.pulseMessages}/${g.maxPulseMessagesPerRun ?? 3})`);
  }

  if (counters.crmTasks > (g.maxCrmTasksPerRun ?? 10)) {
    throw new Error(`Guardrail exceeded: maxCrmTasksPerRun (${counters.crmTasks}/${g.maxCrmTasksPerRun ?? 10})`);
  }

  if (counters.totalActions > (g.maxTotalActionsPerRun ?? 25)) {
    throw new Error(`Guardrail exceeded: maxTotalActionsPerRun (${counters.totalActions}/${g.maxTotalActionsPerRun ?? 25})`);
  }
}

/**
 * Simple retry wrapper with exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; baseDelayMs?: number } = {}
): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 1000 } = options;
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
        const delay = baseDelayMs * Math.pow(2, attempt - 1); // 1s, 2s, 4s
        console.log(`[AgentRunner] Retry ${attempt}/${maxAttempts} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Run a single agent with a trigger event
 */
export async function runSingleAgent(
  agent: Agent,
  triggerPayload: TriggerEvent,
  options: { dryRun?: boolean } = {}
): Promise<AgentRunResult> {
  const { dryRun = agent.guardrails?.dryRunDefault ?? true } = options;

  // Validate agent configuration
  validateAgent(agent);

  const triggerEventId = triggerPayload.sourceId;
  if (!triggerEventId) {
    throw new Error('sourceId is required for idempotency');
  }

  // Idempotency check
  if (await hasSuccessfulRun(agent.id, triggerEventId)) {
    console.log(`[AgentRunner] Skipping ${agent.name}: already ran for ${triggerEventId}`);
    return {
      success: true,
      skipped: true,
      reason: 'Already ran successfully for this sourceId'
    };
  }

  // Create run record
  const run = await createRun(agent.id, triggerEventId, triggerPayload);

  const counters: ActionCounters = {
    pulseMessages: 0,
    crmTasks: 0,
    totalActions: 0
  };

  try {
    console.log(`[AgentRunner] Starting ${agent.name} (run: ${run.id}, dryRun: ${dryRun})`);

    // Execute each action step in order
    for (let i = 0; i < agent.actions.length; i++) {
      const step = agent.actions[i];
      counters.totalActions += 1;

      // Check guardrails before each step
      checkGuardrails(agent.guardrails, counters);

      // Record step start
      await recordStep(run.id, i, step.type, 'running', step.config, null, null);

      // Get action handler
      const actionHandler = ACTIONS[step.type];
      if (!actionHandler) {
        throw new Error(`Unknown action type: ${step.type}`);
      }

      // Execute action with retry
      const stepResult = await withRetry(async () => {
        return actionHandler.execute({
          agent,
          step,
          triggerPayload: triggerPayload.payload,
          dryRun
        });
      });

      // Update counters
      if (stepResult.countersDelta) {
        counters.pulseMessages += stepResult.countersDelta.pulseMessages || 0;
        counters.crmTasks += stepResult.countersDelta.crmTasks || 0;
      }

      // Record step success
      await recordStep(run.id, i, step.type, 'success', step.config, stepResult.result, null);

      console.log(`[AgentRunner] Step ${i + 1}/${agent.actions.length} (${step.type}) completed`);
    }

    // Success!
    await finishRun(run.id, 'success', { counters, dryRun }, null);

    console.log(`[AgentRunner] ${agent.name} completed successfully`);

    return {
      success: true,
      runId: run.id,
      counters
    };

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    console.error(`[AgentRunner] ${agent.name} failed:`, errorMessage);

    // Record failure
    await finishRun(run.id, 'failed', { counters, dryRun }, errorMessage);

    return {
      success: false,
      runId: run.id,
      counters,
      error: errorMessage
    };
  }
}

/**
 * Test run an agent with a specific context
 * Always runs in dry-run mode unless explicitly overridden
 */
export async function testRunAgent(
  agentId: string,
  context: {
    meetingId?: string;
    dealId?: string;
    taskId?: string;
  },
  options: { dryRun?: boolean } = { dryRun: true }
): Promise<AgentRunResult> {
  // Fetch agent
  const { data: agent, error } = await supabase
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .single();

  if (error || !agent) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  // Create a test trigger event
  const triggerEvent: TriggerEvent = {
    type: agent.trigger_type,
    payload: context,
    timestamp: new Date().toISOString(),
    sourceId: `test:${agentId}:${Date.now()}`
  };

  return runSingleAgent(agent, triggerEvent, { dryRun: options.dryRun ?? true });
}

/**
 * Run an agent for a trigger (alias for runSingleAgent)
 * This is the primary entry point from agentTriggerService
 */
export async function runAgentForTrigger(
  agent: Agent,
  triggerEvent: TriggerEvent,
  dryRun: boolean = false
): Promise<AgentRunResult> {
  return runSingleAgent(agent, triggerEvent, { dryRun });
}

/**
 * Process all enabled agents for a given trigger type
 */
export async function processTriggeredAgents(
  triggerType: string,
  triggerEvent: TriggerEvent,
  context: Record<string, any>
): Promise<AgentRunResult[]> {
  // Get enabled agents for this trigger type
  const { data: agents, error } = await supabase
    .from('agents')
    .select('*')
    .eq('trigger_type', triggerType)
    .eq('enabled', true);

  if (error) {
    console.error('Failed to fetch agents:', error);
    return [];
  }

  if (!agents || agents.length === 0) {
    console.log(`[AgentRunner] No enabled agents for trigger: ${triggerType}`);
    return [];
  }

  const results: AgentRunResult[] = [];

  for (const agent of agents) {
    // Evaluate trigger conditions
    const triggerHandler = TRIGGERS[agent.trigger_type as keyof typeof TRIGGERS];
    if (!triggerHandler) continue;

    const shouldRun = await triggerHandler.evaluate(agent.trigger_config, context);
    if (!shouldRun) {
      console.log(`[AgentRunner] Agent ${agent.name} trigger conditions not met`);
      continue;
    }

    // Run the agent
    const result = await runSingleAgent(agent, triggerEvent);
    results.push(result);
  }

  return results;
}
