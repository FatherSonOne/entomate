-- ========================================
-- Migration: convert the 9 `automations` rows into workflows
-- Date: 2026-11-22
-- Feature audit cut list item 6 (findings F6, F7): one automation engine.
--
-- Every converted workflow is created PAUSED (active = false), so nothing
-- starts sending until someone switches it on in Automations.
-- settings.migrated_from_automation keeps the source row id (and makes this
-- migration safe to re-run). The `automations` table itself is left in place.
-- Where the old rule used a trigger or action the workflow engine doesn't
-- have, settings.migration_note says so and the step is the nearest match.
-- ========================================

-- workflows.project_id was NOT NULL with no foreign key, and the workflow API
-- never sets it, so creating any workflow from the app failed in production.
-- Workflows belong to an org, not a project: allow it to be empty.
ALTER TABLE public.workflows ALTER COLUMN project_id DROP NOT NULL;

WITH src AS (
  SELECT a.*, row_number() OVER (PARTITION BY a.name ORDER BY a.created_at) AS dup
  FROM public.automations a
  WHERE NOT EXISTS (
    SELECT 1 FROM public.workflows w
    WHERE w.settings->>'migrated_from_automation' = a.id::text
  )
),
mapped AS (
  SELECT
    s.id AS automation_id,
    s.org_id,
    s.created_at,
    s.description,
    CASE WHEN s.dup > 1 THEN s.name || ' (copy)' ELSE s.name END AS name,
    s.trigger_type,
    s.actions,
    CASE s.trigger_type
      WHEN 'meeting_processed' THEN 'meeting_processed'
      WHEN 'meeting_ended'     THEN 'meeting_processed'
      ELSE NULL
    END AS mapped_trigger
  FROM src s
),
built AS (
  SELECT
    m.*,
    -- Steps per source row
    CASE
      WHEN m.name LIKE 'Meeting Follow-up%' THEN jsonb_build_array(
        jsonb_build_object('id','task','type','action','subtype','create_task','position',jsonb_build_object('x',100,'y',220),
          'config',jsonb_build_object('title','Follow up on: {{title}}','priority','medium')))
      WHEN m.name LIKE 'Meeting → CRM Sync%' THEN jsonb_build_array(
        jsonb_build_object('id','crm','type','action','subtype','sync_crm','position',jsonb_build_object('x',100,'y',220),
          'config',jsonb_build_object('objectType','task','operation','create')),
        jsonb_build_object('id','pulse','type','action','subtype','send_pulse','position',jsonb_build_object('x',100,'y',340),
          'config',jsonb_build_object('channel','meetings','message','Meeting "{{title}}" processed: {{action_items.length}} action items synced to CRM.')))
      WHEN m.name LIKE 'Meeting action item%' THEN jsonb_build_array(
        jsonb_build_object('id','deadline','type','ai','subtype','ai_agent','position',jsonb_build_object('x',100,'y',220),
          'config',jsonb_build_object('agent','deadline','autoApply',false)))
      WHEN m.name LIKE 'High Priority Task Alert%' THEN jsonb_build_array(
        jsonb_build_object('id','slack','type','action','subtype','send_slack','position',jsonb_build_object('x',100,'y',220),
          'config',jsonb_build_object('channel','#urgent','message','New high priority task: {{title}}')))
      WHEN m.name LIKE 'Project Completion Notification%' THEN jsonb_build_array(
        jsonb_build_object('id','email','type','action','subtype','send_email','position',jsonb_build_object('x',100,'y',220),
          'config',jsonb_build_object('to','','subject','Project completed: {{name}}','body','The project "{{name}}" is complete.')))
      WHEN m.name LIKE 'Deal → Project Kickoff%' THEN jsonb_build_array(
        jsonb_build_object('id','pulse','type','action','subtype','send_pulse','position',jsonb_build_object('x',100,'y',220),
          'config',jsonb_build_object('channel','general','message','New project created from deal')))
      WHEN m.name LIKE 'Stale Deal Alert%' THEN jsonb_build_array(
        jsonb_build_object('id','stale','type','crm','subtype','get_stale_deals','position',jsonb_build_object('x',100,'y',220),
          'config',jsonb_build_object('staleDays',7,'limit',50)),
        jsonb_build_object('id','slack','type','action','subtype','send_slack','position',jsonb_build_object('x',100,'y',340),
          'config',jsonb_build_object('channel','#sales-pipeline','message','{{staleDeals.length}} deals have had no activity in 7+ days.')))
      ELSE '[]'::jsonb
    END AS steps,
    CASE
      WHEN m.name LIKE 'Stale Deal Alert%' THEN jsonb_build_object('id','trigger','type','trigger','subtype','schedule','position',jsonb_build_object('x',100,'y',100),
        'config',jsonb_build_object('cron','0 9 * * 1-5','timezone','UTC'))
      WHEN m.name LIKE 'Meeting action item%' THEN jsonb_build_object('id','trigger','type','trigger','subtype','action_item_created','position',jsonb_build_object('x',100,'y',100),'config','{}'::jsonb)
      WHEN m.mapped_trigger IS NOT NULL THEN jsonb_build_object('id','trigger','type','trigger','subtype',m.mapped_trigger,'position',jsonb_build_object('x',100,'y',100),'config','{}'::jsonb)
      ELSE jsonb_build_object('id','trigger','type','trigger','subtype','manual','position',jsonb_build_object('x',100,'y',100),'config','{}'::jsonb)
    END AS trigger_node,
    CASE
      WHEN m.name LIKE 'High Priority Task Alert%' THEN 'Old trigger "task_created" (priority high) has no workflow trigger yet; set to Manual.'
      WHEN m.name LIKE 'Project Completion Notification%' THEN 'Old trigger "project_updated" (status completed) has no workflow trigger yet; set to Manual. Old recipient "stakeholders" needs an address.'
      WHEN m.name LIKE 'Deal → Project Kickoff%' THEN 'Old trigger "deal_created" and action "create_project" have no workflow equivalent; set to Manual with the notification only.'
      WHEN m.name LIKE 'Meeting → CRM Sync%' THEN 'CRM sync stays off until the workspace connects its own CRM.'
      WHEN m.name LIKE 'Meeting action item%' THEN 'The Deadline agent already runs on every meeting (Settings > Meeting agents).'
      WHEN m.name LIKE 'Test Automation%' THEN 'Test row with placeholder trigger and action; nothing to convert.'
      WHEN m.name LIKE 'Stale Deal Alert%' THEN 'Old row had empty step configs; converted to a daily stale-deal check.'
      ELSE NULL
    END AS migration_note
  FROM mapped m
)
INSERT INTO public.workflows (name, description, nodes, connections, edges, active, status, settings, org_id, created_at)
SELECT
  b.name,
  b.description,
  jsonb_build_array(b.trigger_node) || b.steps,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', 'c' || i,
      'sourceNodeId', CASE WHEN i = 1 THEN 'trigger' ELSE (b.steps->(i::int - 2))->>'id' END,
      'sourceOutput', 'main',
      'targetNodeId', (b.steps->(i::int - 1))->>'id',
      'targetInput', 'main') ORDER BY i)
    FROM generate_series(1, jsonb_array_length(b.steps)) AS i
  ), '[]'::jsonb),
  '[]'::jsonb,
  false,
  'draft',
  jsonb_strip_nulls(jsonb_build_object(
    'migrated_from_automation', b.automation_id::text,
    'migrated_at', now(),
    'old_trigger_type', b.trigger_type,
    'migration_note', b.migration_note)),
  b.org_id,
  b.created_at
FROM built b;
