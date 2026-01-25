/**
 * Agent Templates Index
 * Pre-configured agent blueprints for quick setup
 */

// Original templates
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

// Cross-App Sync Templates
import {
  CONTACT_SYNC_AGENT_TEMPLATE,
  CONTACT_SYNC_AGENT_META
} from './contactSyncAgent';

import {
  DEAL_SYNC_AGENT_TEMPLATE,
  DEAL_SYNC_AGENT_META
} from './dealSyncAgent';

import {
  EVENT_SYNC_AGENT_TEMPLATE,
  EVENT_SYNC_AGENT_META
} from './eventSyncAgent';

// Sales Automation Templates
import {
  LEAD_ENRICHMENT_AGENT_TEMPLATE,
  LEAD_ENRICHMENT_AGENT_META
} from './leadEnrichmentAgent';

import {
  FOLLOW_UP_AUTOMATION_AGENT_TEMPLATE,
  FOLLOW_UP_AUTOMATION_AGENT_META
} from './followUpAutomationAgent';

import {
  DEAL_PROGRESSION_AGENT_TEMPLATE,
  DEAL_PROGRESSION_AGENT_META
} from './dealProgressionAgent';

// Customer Success Templates
import {
  CUSTOMER_HEALTH_MONITOR_TEMPLATE,
  CUSTOMER_HEALTH_MONITOR_META
} from './customerHealthMonitor';

import {
  RENEWAL_ALERT_AGENT_TEMPLATE,
  RENEWAL_ALERT_AGENT_META
} from './renewalAlertAgent';

import {
  EXPANSION_OPPORTUNITY_AGENT_TEMPLATE,
  EXPANSION_OPPORTUNITY_AGENT_META
} from './expansionOpportunityAgent';

// Communication Templates
import {
  TEAM_COORDINATION_AGENT_TEMPLATE,
  TEAM_COORDINATION_AGENT_META
} from './teamCoordinationAgent';

import {
  CROSS_APP_NOTIFICATION_AGENT_TEMPLATE,
  CROSS_APP_NOTIFICATION_AGENT_META
} from './crossAppNotificationAgent';

// Operations Templates
import {
  DATA_QUALITY_AGENT_TEMPLATE,
  DATA_QUALITY_AGENT_META
} from './dataQualityAgent';

import {
  REPORTING_AGENT_TEMPLATE,
  REPORTING_AGENT_META
} from './reportingAgent';

import {
  PROJECT_KICKOFF_AGENT_TEMPLATE,
  PROJECT_KICKOFF_AGENT_META
} from './projectKickoffAgent';

// Meeting Templates
import {
  MEETING_INSIGHTS_AGENT_TEMPLATE,
  MEETING_INSIGHTS_AGENT_META
} from './meetingInsightsAgent';

/**
 * All available templates
 */
export const AGENT_TEMPLATES = {
  // Original templates
  'deal-risk-monitor': DEAL_RISK_MONITOR_TEMPLATE,
  'meeting-outcome-processor': MEETING_OUTCOME_PROCESSOR_TEMPLATE,
  'task-auto-assigner': TASK_AUTO_ASSIGNER_TEMPLATE,
  'customer-success-coordinator': CUSTOMER_SUCCESS_COORDINATOR_TEMPLATE,
  
  // Cross-App Sync Templates
  'contact-sync-agent': CONTACT_SYNC_AGENT_TEMPLATE,
  'deal-sync-agent': DEAL_SYNC_AGENT_TEMPLATE,
  'event-sync-agent': EVENT_SYNC_AGENT_TEMPLATE,
  
  // Sales Automation Templates
  'lead-enrichment-agent': LEAD_ENRICHMENT_AGENT_TEMPLATE,
  'follow-up-automation-agent': FOLLOW_UP_AUTOMATION_AGENT_TEMPLATE,
  'deal-progression-agent': DEAL_PROGRESSION_AGENT_TEMPLATE,
  
  // Customer Success Templates
  'customer-health-monitor': CUSTOMER_HEALTH_MONITOR_TEMPLATE,
  'renewal-alert-agent': RENEWAL_ALERT_AGENT_TEMPLATE,
  'expansion-opportunity-agent': EXPANSION_OPPORTUNITY_AGENT_TEMPLATE,
  
  // Communication Templates
  'team-coordination-agent': TEAM_COORDINATION_AGENT_TEMPLATE,
  'cross-app-notification-agent': CROSS_APP_NOTIFICATION_AGENT_TEMPLATE,
  
  // Operations Templates
  'data-quality-agent': DATA_QUALITY_AGENT_TEMPLATE,
  'reporting-agent': REPORTING_AGENT_TEMPLATE,
  'project-kickoff-agent': PROJECT_KICKOFF_AGENT_TEMPLATE,
  
  // Meeting Templates
  'meeting-insights-agent': MEETING_INSIGHTS_AGENT_TEMPLATE
};

/**
 * Template metadata for UI
 */
export const AGENT_TEMPLATE_META = {
  // Original templates
  'deal-risk-monitor': DEAL_RISK_MONITOR_META,
  'meeting-outcome-processor': MEETING_OUTCOME_PROCESSOR_META,
  'task-auto-assigner': TASK_AUTO_ASSIGNER_META,
  'customer-success-coordinator': CUSTOMER_SUCCESS_COORDINATOR_META,
  
  // Cross-App Sync Templates
  'contact-sync-agent': CONTACT_SYNC_AGENT_META,
  'deal-sync-agent': DEAL_SYNC_AGENT_META,
  'event-sync-agent': EVENT_SYNC_AGENT_META,
  
  // Sales Automation Templates
  'lead-enrichment-agent': LEAD_ENRICHMENT_AGENT_META,
  'follow-up-automation-agent': FOLLOW_UP_AUTOMATION_AGENT_META,
  'deal-progression-agent': DEAL_PROGRESSION_AGENT_META,
  
  // Customer Success Templates
  'customer-health-monitor': CUSTOMER_HEALTH_MONITOR_META,
  'renewal-alert-agent': RENEWAL_ALERT_AGENT_META,
  'expansion-opportunity-agent': EXPANSION_OPPORTUNITY_AGENT_META,
  
  // Communication Templates
  'team-coordination-agent': TEAM_COORDINATION_AGENT_META,
  'cross-app-notification-agent': CROSS_APP_NOTIFICATION_AGENT_META,
  
  // Operations Templates
  'data-quality-agent': DATA_QUALITY_AGENT_META,
  'reporting-agent': REPORTING_AGENT_META,
  'project-kickoff-agent': PROJECT_KICKOFF_AGENT_META,
  
  // Meeting Templates
  'meeting-insights-agent': MEETING_INSIGHTS_AGENT_META
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
  // Original templates
  DEAL_RISK_MONITOR_TEMPLATE,
  DEAL_RISK_MONITOR_META,
  MEETING_OUTCOME_PROCESSOR_TEMPLATE,
  MEETING_OUTCOME_PROCESSOR_META,
  TASK_AUTO_ASSIGNER_TEMPLATE,
  TASK_AUTO_ASSIGNER_META,
  CUSTOMER_SUCCESS_COORDINATOR_TEMPLATE,
  CUSTOMER_SUCCESS_COORDINATOR_META,
  
  // Cross-App Sync Templates
  CONTACT_SYNC_AGENT_TEMPLATE,
  CONTACT_SYNC_AGENT_META,
  DEAL_SYNC_AGENT_TEMPLATE,
  DEAL_SYNC_AGENT_META,
  EVENT_SYNC_AGENT_TEMPLATE,
  EVENT_SYNC_AGENT_META,
  
  // Sales Automation Templates
  LEAD_ENRICHMENT_AGENT_TEMPLATE,
  LEAD_ENRICHMENT_AGENT_META,
  FOLLOW_UP_AUTOMATION_AGENT_TEMPLATE,
  FOLLOW_UP_AUTOMATION_AGENT_META,
  DEAL_PROGRESSION_AGENT_TEMPLATE,
  DEAL_PROGRESSION_AGENT_META,
  
  // Customer Success Templates
  CUSTOMER_HEALTH_MONITOR_TEMPLATE,
  CUSTOMER_HEALTH_MONITOR_META,
  RENEWAL_ALERT_AGENT_TEMPLATE,
  RENEWAL_ALERT_AGENT_META,
  EXPANSION_OPPORTUNITY_AGENT_TEMPLATE,
  EXPANSION_OPPORTUNITY_AGENT_META,
  
  // Communication Templates
  TEAM_COORDINATION_AGENT_TEMPLATE,
  TEAM_COORDINATION_AGENT_META,
  CROSS_APP_NOTIFICATION_AGENT_TEMPLATE,
  CROSS_APP_NOTIFICATION_AGENT_META,
  
  // Operations Templates
  DATA_QUALITY_AGENT_TEMPLATE,
  DATA_QUALITY_AGENT_META,
  REPORTING_AGENT_TEMPLATE,
  REPORTING_AGENT_META,
  PROJECT_KICKOFF_AGENT_TEMPLATE,
  PROJECT_KICKOFF_AGENT_META,
  
  // Meeting Templates
  MEETING_INSIGHTS_AGENT_TEMPLATE,
  MEETING_INSIGHTS_AGENT_META
};
