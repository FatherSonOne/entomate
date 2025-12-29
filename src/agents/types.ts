/**
 * Type definitions for the Agents Framework
 */

// Trigger types supported in Phase 2
export type TriggerType =
  | 'meeting.completed'
  | 'task.overdue'
  | 'deal.stage_changed'
  | 'action_item.missed_deadline';

// Action types supported in Phase 2
export type ActionType =
  | 'extract_action_items'
  | 'sync_to_crm'
  | 'post_to_pulse'
  | 'create_onboarding_project'
  | 'assign_task';

// Agent run statuses
export type AgentRunStatus = 'running' | 'success' | 'failed' | 'skipped';

// Agent step statuses
export type AgentStepStatus = 'running' | 'success' | 'failed' | 'skipped';

/**
 * Guardrails configuration to prevent spam and runaway agents
 */
export interface AgentGuardrails {
  maxPulseMessagesPerRun: number;
  maxCrmTasksPerRun: number;
  maxTotalActionsPerRun: number;
  dryRunDefault: boolean;
}

/**
 * Configuration for a trigger
 */
export interface TriggerConfig {
  // meeting.completed
  minDurationSec?: number;
  mustHaveTranscript?: boolean;

  // task.overdue
  overdueByDays?: number;
  priorityFilter?: 'high' | 'medium' | 'low' | 'all';

  // deal.stage_changed
  fromStage?: string;
  toStage?: string;

  [key: string]: any;
}

/**
 * Configuration for an action step
 */
export interface ActionStep {
  type: ActionType;
  config: Record<string, any>;
}

/**
 * Agent definition (stored in database)
 */
export interface Agent {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  trigger_type: TriggerType;
  trigger_config: TriggerConfig;
  actions: ActionStep[];
  guardrails: AgentGuardrails;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Trigger event payload (input to agent run)
 */
export interface TriggerEvent {
  type: TriggerType | string;
  payload: Record<string, any>;
  timestamp: string;       // ISO timestamp when event occurred
  sourceId: string;        // Unique ID for idempotency (e.g., "meeting:uuid")
}

/**
 * Agent run record (audit log)
 */
export interface AgentRun {
  id: string;
  agent_id: string;
  status: AgentRunStatus;
  trigger_event_id: string;
  started_at: string;
  finished_at: string | null;
  input: Record<string, any>;
  output: Record<string, any> | null;
  error: string | null;
  attempt: number;
}

/**
 * Agent run step record (detailed debugging)
 */
export interface AgentRunStep {
  id: string;
  agent_run_id: string;
  step_index: number;
  step_type: string;
  status: AgentStepStatus;
  started_at: string;
  finished_at: string | null;
  input: Record<string, any> | null;
  output: Record<string, any> | null;
  error: string | null;
}

/**
 * Counters tracked during agent execution
 */
export interface ActionCounters {
  pulseMessages: number;
  crmTasks: number;
  totalActions: number;
}

/**
 * Result from executing an action
 */
export interface ActionResult {
  success: boolean;
  result?: any;
  countersDelta?: Partial<ActionCounters>;
  error?: string;
}

/**
 * Result from running an agent
 */
export interface AgentRunResult {
  success: boolean;
  skipped?: boolean;
  reason?: string;
  runId?: string;
  counters?: ActionCounters;
  error?: string;
}

/**
 * Default guardrails for new agents
 */
export const DEFAULT_GUARDRAILS: AgentGuardrails = {
  maxPulseMessagesPerRun: 3,
  maxCrmTasksPerRun: 10,
  maxTotalActionsPerRun: 25,
  dryRunDefault: true
};
