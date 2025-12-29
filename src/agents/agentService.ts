/**
 * Agent Service
 * CRUD operations for agents using Supabase
 */

import { supabase } from '../lib/supabase';
import { validateAgent } from './agentRegistry';
import type {
  Agent,
  AgentRun,
  AgentRunStep,
  TriggerType,
  ActionStep,
  AgentGuardrails,
  DEFAULT_GUARDRAILS
} from './types';

/**
 * Get all agents
 */
export async function getAllAgents(): Promise<Agent[]> {
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch agents: ${error.message}`);
  }

  return data || [];
}

/**
 * Get enabled agents only
 */
export async function getEnabledAgents(): Promise<Agent[]> {
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('enabled', true)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch enabled agents: ${error.message}`);
  }

  return data || [];
}

/**
 * Get a single agent by ID
 */
export async function getAgentById(id: string): Promise<Agent | null> {
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Failed to fetch agent: ${error.message}`);
  }

  return data;
}

/**
 * Create a new agent
 */
export async function createAgent(params: {
  name: string;
  description?: string;
  trigger_type: TriggerType;
  trigger_config?: Record<string, any>;
  actions: ActionStep[];
  guardrails?: Partial<AgentGuardrails>;
  created_by?: string;
}): Promise<Agent> {
  const agentData = {
    name: params.name,
    description: params.description || null,
    enabled: false, // Always start disabled
    trigger_type: params.trigger_type,
    trigger_config: params.trigger_config || {},
    actions: params.actions,
    guardrails: {
      maxPulseMessagesPerRun: 3,
      maxCrmTasksPerRun: 10,
      maxTotalActionsPerRun: 25,
      dryRunDefault: true,
      ...params.guardrails
    },
    created_by: params.created_by || null
  };

  // Validate before saving
  validateAgent(agentData);

  const { data, error } = await supabase
    .from('agents')
    .insert(agentData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create agent: ${error.message}`);
  }

  return data;
}

/**
 * Update an agent
 */
export async function updateAgent(
  id: string,
  updates: Partial<Omit<Agent, 'id' | 'created_at'>>
): Promise<Agent> {
  // If updating trigger or actions, validate
  if (updates.trigger_type || updates.actions) {
    const existing = await getAgentById(id);
    if (!existing) {
      throw new Error('Agent not found');
    }
    validateAgent({ ...existing, ...updates });
  }

  const { data, error } = await supabase
    .from('agents')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update agent: ${error.message}`);
  }

  return data;
}

/**
 * Enable an agent
 */
export async function enableAgent(id: string): Promise<Agent> {
  return updateAgent(id, { enabled: true });
}

/**
 * Disable an agent (kill switch)
 */
export async function disableAgent(id: string): Promise<Agent> {
  return updateAgent(id, { enabled: false });
}

/**
 * Delete an agent
 */
export async function deleteAgent(id: string): Promise<void> {
  const { error } = await supabase
    .from('agents')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete agent: ${error.message}`);
  }
}

/**
 * Get agent runs (audit log) for an agent
 */
export async function getAgentRuns(
  agentId: string,
  options: { limit?: number; status?: string } = {}
): Promise<AgentRun[]> {
  const { limit = 50, status } = options;

  let query = supabase
    .from('agent_runs')
    .select('*')
    .eq('agent_id', agentId)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch agent runs: ${error.message}`);
  }

  return data || [];
}

/**
 * Get a single agent run by ID
 */
export async function getAgentRunById(runId: string): Promise<AgentRun | null> {
  const { data, error } = await supabase
    .from('agent_runs')
    .select('*')
    .eq('id', runId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch agent run: ${error.message}`);
  }

  return data;
}

/**
 * Get steps for an agent run
 */
export async function getAgentRunSteps(runId: string): Promise<AgentRunStep[]> {
  const { data, error } = await supabase
    .from('agent_run_steps')
    .select('*')
    .eq('agent_run_id', runId)
    .order('step_index', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch agent run steps: ${error.message}`);
  }

  return data || [];
}

/**
 * Get agents by trigger type
 */
export async function getAgentsByTrigger(triggerType: TriggerType): Promise<Agent[]> {
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('trigger_type', triggerType)
    .eq('enabled', true);

  if (error) {
    throw new Error(`Failed to fetch agents by trigger: ${error.message}`);
  }

  return data || [];
}

/**
 * Get recent failed runs across all agents
 */
export async function getRecentFailedRuns(limit = 20): Promise<AgentRun[]> {
  const { data, error } = await supabase
    .from('agent_runs')
    .select('*')
    .eq('status', 'failed')
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch failed runs: ${error.message}`);
  }

  return data || [];
}

/**
 * Get enabled agents by trigger type
 * Used by the trigger service to find agents to run
 */
export async function getEnabledAgentsByTrigger(triggerType: string): Promise<Agent[]> {
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('trigger_type', triggerType)
    .eq('enabled', true);

  if (error) {
    throw new Error(`Failed to fetch agents by trigger: ${error.message}`);
  }

  return data || [];
}

/**
 * Create an agent from a template
 */
export async function createAgentFromTemplate(templateId: string): Promise<Agent | null> {
  // Import templates dynamically to avoid circular deps
  const { getTemplateById } = await import('./templates');

  const template = getTemplateById(templateId);
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  // Create agent from template
  return createAgent({
    name: template.name,
    description: template.description,
    trigger_type: template.trigger_type,
    trigger_config: template.trigger_config || {},
    actions: template.actions,
    guardrails: template.guardrails
  });
}

// ============================================
// Emergency Kill Switch Functions
// ============================================

/**
 * EMERGENCY: Disable ALL agents immediately
 * Use this when spam or runaway automation is detected
 */
export async function emergencyDisableAllAgents(): Promise<{
  disabledCount: number;
  agentIds: string[];
}> {
  console.warn('[EMERGENCY] Disabling all agents');

  // Get currently enabled agents
  const { data: enabledAgents, error: fetchError } = await supabase
    .from('agents')
    .select('id, name')
    .eq('enabled', true);

  if (fetchError) {
    throw new Error(`Failed to fetch enabled agents: ${fetchError.message}`);
  }

  if (!enabledAgents || enabledAgents.length === 0) {
    return { disabledCount: 0, agentIds: [] };
  }

  // Disable all at once
  const { error: updateError } = await supabase
    .from('agents')
    .update({ enabled: false })
    .eq('enabled', true);

  if (updateError) {
    throw new Error(`Failed to disable agents: ${updateError.message}`);
  }

  const agentIds = enabledAgents.map(a => a.id);

  console.warn(`[EMERGENCY] Disabled ${agentIds.length} agents:`,
    enabledAgents.map(a => a.name).join(', '));

  return {
    disabledCount: agentIds.length,
    agentIds
  };
}

/**
 * Get agent health status summary
 */
export async function getAgentHealthSummary(): Promise<{
  totalAgents: number;
  enabledAgents: number;
  recentRuns24h: number;
  failedRuns24h: number;
  successRate: number;
}> {
  // Get agent counts
  const { count: totalAgents } = await supabase
    .from('agents')
    .select('*', { count: 'exact', head: true });

  const { count: enabledAgents } = await supabase
    .from('agents')
    .select('*', { count: 'exact', head: true })
    .eq('enabled', true);

  // Get run counts for last 24 hours
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count: recentRuns24h } = await supabase
    .from('agent_runs')
    .select('*', { count: 'exact', head: true })
    .gte('started_at', oneDayAgo);

  const { count: failedRuns24h } = await supabase
    .from('agent_runs')
    .select('*', { count: 'exact', head: true })
    .gte('started_at', oneDayAgo)
    .eq('status', 'failed');

  const total = totalAgents || 0;
  const enabled = enabledAgents || 0;
  const runs = recentRuns24h || 0;
  const failed = failedRuns24h || 0;
  const successRate = runs > 0 ? Math.round(((runs - failed) / runs) * 100) : 100;

  return {
    totalAgents: total,
    enabledAgents: enabled,
    recentRuns24h: runs,
    failedRuns24h: failed,
    successRate
  };
}

/**
 * Check if agents should be auto-disabled (spam detection)
 * Returns true if action rate exceeds safe threshold
 */
export async function checkSpamThreshold(
  options: { windowMinutes?: number; maxActions?: number } = {}
): Promise<{
  isSpamming: boolean;
  actionCount: number;
  threshold: number;
}> {
  const { windowMinutes = 5, maxActions = 50 } = options;

  const windowStart = new Date(
    Date.now() - windowMinutes * 60 * 1000
  ).toISOString();

  // Count actions in window
  const { count } = await supabase
    .from('agent_run_steps')
    .select('*', { count: 'exact', head: true })
    .gte('started_at', windowStart)
    .eq('status', 'success');

  const actionCount = count || 0;

  return {
    isSpamming: actionCount > maxActions,
    actionCount,
    threshold: maxActions
  };
}
