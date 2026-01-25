/**
 * Data Quality Agent Template
 * Monitors and improves data quality across the ecosystem
 *
 * Trigger: meeting.completed OR deal.stage_changed
 * Actions:
 *   1. Check data completeness and quality
 *   2. Identify missing or inconsistent data
 *   3. Create data cleanup tasks
 *   4. Sync corrections across apps
 */

import type { Agent, TriggerType, ActionStep, AgentGuardrails } from '../types';

export const DATA_QUALITY_AGENT_TEMPLATE: Omit<Agent, 'id' | 'created_at' | 'updated_at'> = {
  name: 'Data Quality Agent',
  description: 'Monitors and improves data quality across Entomate, Pulse, and CRM',
  enabled: false,
  trigger_type: 'meeting.completed' as TriggerType,
  trigger_config: {
    minDurationSec: 60,
    checkDataQuality: true,
    requireDataValidation: true
  },
  actions: [
    {
      type: 'extract_action_items',
      config: {
        checkDataCompleteness: true,
        identifyDataIssues: true,
        checkDataConsistency: true,
        validateDataFormat: true,
        detectDuplicates: true
      }
    },
    {
      type: 'assign_task',
      config: {
        strategy: 'by_data_owner',
        createDataCleanupTasks: true,
        prioritizeByImpact: true,
        linkToDataRecord: true
      }
    },
    {
      type: 'sync_to_crm',
      config: {
        updateType: 'data_quality',
        createDataQualityTasks: true,
        flagDataIssues: true,
        suggestCorrections: true,
        updateDataQualityScore: true
      }
    },
    {
      type: 'post_to_pulse',
      config: {
        channel: 'operations',
        messageTemplate: `🔍 Data Quality Check: {{recordType}}

**Issues Found:** {{issueCount}}
**Issues:**
{{issues}}

**Cleanup Tasks Created:** {{taskCount}}

View tasks: {{taskLink}}`,
        onlyIfIssuesFound: true
      }
    }
  ] as ActionStep[],
  guardrails: {
    maxPulseMessagesPerRun: 1,
    maxCrmTasksPerRun: 5,           // Up to 5 data cleanup tasks
    maxTotalActionsPerRun: 10,
    dryRunDefault: true
  } as AgentGuardrails,
  created_by: 'system'
};

/**
 * Template metadata for UI display
 */
export const DATA_QUALITY_AGENT_META = {
  id: 'data-quality-agent',
  name: 'Data Quality Agent',
  description: 'Monitors and improves data quality across all connected apps',
  category: 'Operations',
  icon: '🔍',
  recommendedFor: ['Operations', 'Data administrators', 'CRM administrators'],
  triggers: ['meeting.completed', 'deal.stage_changed'],
  actions: ['Check data quality', 'Create cleanup tasks', 'Sync corrections'],
  setupTime: '5 minutes'
};

