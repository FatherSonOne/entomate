/**
 * Agent Templates Index
 * Pre-configured agent blueprints for quick setup
 */

import {
  DEAL_RISK_MONITOR_TEMPLATE,
  DEAL_RISK_MONITOR_META
} from './dealRiskMonitor';

import {
  MEETING_OUTCOME_PROCESSOR_TEMPLATE,
  MEETING_OUTCOME_PROCESSOR_META
} from './meetingOutcomeProcessor';

import {
  TASK_AUTO_ASSIGNER_TEMPLATE,
  TASK_AUTO_ASSIGNER_META
} from './taskAutoAssigner';

import {
  CUSTOMER_SUCCESS_COORDINATOR_TEMPLATE,
  CUSTOMER_SUCCESS_COORDINATOR_META
} from './customerSuccessCoordinator';

/**
 * All available templates
 */
export const AGENT_TEMPLATES = {
  'deal-risk-monitor': DEAL_RISK_MONITOR_TEMPLATE,
  'meeting-outcome-processor': MEETING_OUTCOME_PROCESSOR_TEMPLATE,
  'task-auto-assigner': TASK_AUTO_ASSIGNER_TEMPLATE,
  'customer-success-coordinator': CUSTOMER_SUCCESS_COORDINATOR_TEMPLATE
};

/**
 * Template metadata for UI
 */
export const AGENT_TEMPLATE_META = {
  'deal-risk-monitor': DEAL_RISK_MONITOR_META,
  'meeting-outcome-processor': MEETING_OUTCOME_PROCESSOR_META,
  'task-auto-assigner': TASK_AUTO_ASSIGNER_META,
  'customer-success-coordinator': CUSTOMER_SUCCESS_COORDINATOR_META
};

/**
 * Get all template IDs
 */
export function getTemplateIds(): string[] {
  return Object.keys(AGENT_TEMPLATES);
}

/**
 * Get a template by ID
 */
export function getTemplate(templateId: string) {
  return AGENT_TEMPLATES[templateId as keyof typeof AGENT_TEMPLATES] || null;
}

/**
 * Get a template by ID (alias for getTemplate)
 */
export function getTemplateById(templateId: string) {
  return getTemplate(templateId);
}

/**
 * Get template metadata by ID
 */
export function getTemplateMeta(templateId: string) {
  return AGENT_TEMPLATE_META[templateId as keyof typeof AGENT_TEMPLATE_META] || null;
}

/**
 * Get all templates with metadata for UI display
 */
export function getAllTemplatesWithMeta() {
  return Object.entries(AGENT_TEMPLATE_META).map(([id, meta]) => ({
    id,
    ...meta,
    template: AGENT_TEMPLATES[id as keyof typeof AGENT_TEMPLATES]
  }));
}

// Re-export individual templates
export {
  DEAL_RISK_MONITOR_TEMPLATE,
  DEAL_RISK_MONITOR_META,
  MEETING_OUTCOME_PROCESSOR_TEMPLATE,
  MEETING_OUTCOME_PROCESSOR_META,
  TASK_AUTO_ASSIGNER_TEMPLATE,
  TASK_AUTO_ASSIGNER_META,
  CUSTOMER_SUCCESS_COORDINATOR_TEMPLATE,
  CUSTOMER_SUCCESS_COORDINATOR_META
};
