-- Seed 19 agent automation templates into automation_templates
-- Idempotent: uses ON CONFLICT (id) DO UPDATE SET
--
-- NOTE: This seeds the `automation_templates` table used by the AUTOMATIONS page
-- (frontend/src/pages/Automations.jsx via GET /api/automations/templates).
-- The AGENTS page (frontend/src/pages/Agents.jsx via GET /api/agents/templates)
-- reads templates from backend/services/agentTemplates.js instead.
-- These are intentionally separate: automations and agents have different schemas.

INSERT INTO automation_templates (id, name, description, category, icon, trigger_type, trigger_config, actions)
VALUES
  (
    'deal-risk-monitor',
    'Deal Risk Monitor',
    'Monitors deals for overdue tasks and missed deadlines, alerts the team',
    'ai',
    'alert-triangle',
    'task_overdue',
    '{}',
    '[{"type":"extract_action_items","config":{"analysisType":"risk_assessment"}},{"type":"post_to_pulse","config":{"channel":"sales-alerts","mentionOwner":true}},{"type":"sync_to_crm","config":{"updateType":"deal_notes"}}]'
  ),
  (
    'meeting-outcome-processor',
    'Meeting Outcome Processor',
    'Processes meeting outcomes — extracts action items, posts summary, syncs to CRM',
    'ai',
    'file-text',
    'meeting_ended',
    '{}',
    '[{"type":"extract_action_items","config":{}},{"type":"post_to_pulse","config":{"includeActionItems":true}},{"type":"sync_to_crm","config":{}}]'
  ),
  (
    'task-auto-assigner',
    'Task Auto-Assigner',
    'AI-powered task assignment based on team skills and workload',
    'ai',
    'user-plus',
    'action_item_created',
    '{}',
    '[{"type":"assign_task","config":{"strategy":"balanced"}}]'
  ),
  (
    'customer-success-coordinator',
    'Customer Success Coordinator',
    'Coordinates customer success workflows across deals and meetings',
    'ai',
    'users',
    'deal_stage_changed',
    '{}',
    '[{"type":"extract_action_items","config":{}},{"type":"post_to_pulse","config":{}},{"type":"sync_to_crm","config":{}}]'
  ),
  (
    'contact-sync-agent',
    'Contact Sync Agent',
    'Syncs contact data between Entomate and CRM',
    'crm',
    'refresh-cw',
    'deal_created',
    '{}',
    '[{"type":"sync_to_crm","config":{"objectType":"contact"}}]'
  ),
  (
    'deal-sync-agent',
    'Deal Sync Agent',
    'Keeps deal data synchronized between systems',
    'crm',
    'refresh-cw',
    'deal_stage_changed',
    '{}',
    '[{"type":"sync_to_crm","config":{"objectType":"deal"}}]'
  ),
  (
    'event-sync-agent',
    'Event Sync Agent',
    'Syncs calendar events and meeting data across platforms',
    'crm',
    'calendar',
    'meeting_ended',
    '{}',
    '[{"type":"sync_to_crm","config":{"objectType":"event"}}]'
  ),
  (
    'lead-enrichment-agent',
    'Lead Enrichment Agent',
    'Enriches lead data with AI-gathered intelligence from meetings',
    'ai',
    'trending-up',
    'meeting_ended',
    '{}',
    '[{"type":"extract_action_items","config":{"analysisType":"lead_enrichment"}},{"type":"sync_to_crm","config":{"objectType":"contact","enrichment":true}}]'
  ),
  (
    'follow-up-automation-agent',
    'Follow-up Automation',
    'Automatically creates and assigns follow-up tasks from meetings',
    'ai',
    'git-branch',
    'meeting_ended',
    '{}',
    '[{"type":"extract_action_items","config":{"focusOn":"followups"}},{"type":"assign_task","config":{}}]'
  ),
  (
    'deal-progression-agent',
    'Deal Progression Agent',
    'Monitors deal pipeline and suggests next actions',
    'ai',
    'trending-up',
    'deal_stage_changed',
    '{}',
    '[{"type":"extract_action_items","config":{"analysisType":"deal_progression"}},{"type":"post_to_pulse","config":{}}]'
  ),
  (
    'customer-health-monitor',
    'Customer Health Monitor',
    'Monitors customer health signals and engagement patterns',
    'ai',
    'bar-chart-2',
    'task_overdue',
    '{}',
    '[{"type":"extract_action_items","config":{"analysisType":"health_check"}},{"type":"post_to_pulse","config":{"channel":"customer-success"}}]'
  ),
  (
    'renewal-alert-agent',
    'Renewal Alert Agent',
    'Alerts team about upcoming renewals and churn risks',
    'ai',
    'alert-octagon',
    'deal_stage_changed',
    '{}',
    '[{"type":"post_to_pulse","config":{"channel":"renewals"}},{"type":"sync_to_crm","config":{}}]'
  ),
  (
    'expansion-opportunity-agent',
    'Expansion Opportunity Agent',
    'Identifies upsell and cross-sell opportunities from conversations',
    'ai',
    'trending-up',
    'meeting_ended',
    '{}',
    '[{"type":"extract_action_items","config":{"analysisType":"expansion"}},{"type":"post_to_pulse","config":{}}]'
  ),
  (
    'team-coordination-agent',
    'Team Coordination Agent',
    'Coordinates team activities and ensures alignment across projects',
    'ai',
    'users',
    'meeting_ended',
    '{}',
    '[{"type":"post_to_pulse","config":{"broadcastToTeam":true}},{"type":"assign_task","config":{}}]'
  ),
  (
    'cross-app-notification-agent',
    'Cross-App Notification Agent',
    'Sends notifications across Pulse, CRM, and project tools',
    'integration',
    'globe',
    'action_item_created',
    '{}',
    '[{"type":"post_to_pulse","config":{}},{"type":"sync_to_crm","config":{}}]'
  ),
  (
    'data-quality-agent',
    'Data Quality Agent',
    'Monitors and improves data quality across systems',
    'ai',
    'database',
    'scheduled',
    '{"cron":"0 6 * * 1"}',
    '[{"type":"extract_action_items","config":{"analysisType":"data_quality"}}]'
  ),
  (
    'reporting-agent',
    'Reporting Agent',
    'Generates automated reports from meeting and project data',
    'ai',
    'bar-chart-2',
    'scheduled',
    '{"cron":"0 9 * * 5"}',
    '[{"type":"extract_action_items","config":{"analysisType":"weekly_report"}},{"type":"post_to_pulse","config":{}}]'
  ),
  (
    'project-kickoff-agent',
    'Project Kickoff Agent',
    'Automates project setup when deals close',
    'ai',
    'layers',
    'deal_stage_changed',
    '{"toStage":"Closed Won"}',
    '[{"type":"create_onboarding_project","config":{}},{"type":"assign_task","config":{}},{"type":"post_to_pulse","config":{}}]'
  ),
  (
    'meeting-insights-agent',
    'Meeting Insights Agent',
    'Extracts deep insights and trends from meeting conversations',
    'ai',
    'sparkles',
    'meeting_ended',
    '{}',
    '[{"type":"extract_action_items","config":{"analysisType":"deep_insights"}},{"type":"post_to_pulse","config":{}}]'
  )
ON CONFLICT (id) DO UPDATE SET
  name           = EXCLUDED.name,
  description    = EXCLUDED.description,
  category       = EXCLUDED.category,
  icon           = EXCLUDED.icon,
  trigger_type   = EXCLUDED.trigger_type,
  trigger_config = EXCLUDED.trigger_config,
  actions        = EXCLUDED.actions;
