-- ============================================
-- ENTOMATE SEED DATA
-- Run this in your Supabase SQL Editor
-- ============================================

-- Clear existing data (optional - uncomment if needed)
-- DELETE FROM action_items;
-- DELETE FROM tasks;
-- DELETE FROM meetings;
-- DELETE FROM projects;
-- DELETE FROM workflows;
-- DELETE FROM automations;

-- ============================================
-- PROJECTS
-- ============================================
INSERT INTO projects (id, name, description, status, start_date, end_date, created_at, updated_at) VALUES
  ('a1b2c3d4-0001-4000-8000-000000000001', 'Website Redesign', 'Complete overhaul of the company website with new branding', 'active', NOW() - INTERVAL '30 days', NOW() + INTERVAL '60 days', NOW() - INTERVAL '30 days', NOW()),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'Mobile App v2.0', 'Major update with new features and performance improvements', 'active', NOW() - INTERVAL '45 days', NOW() + INTERVAL '45 days', NOW() - INTERVAL '45 days', NOW()),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'Q1 Marketing Campaign', 'Multi-channel marketing push for Q1 launch', 'active', NOW() - INTERVAL '60 days', NOW() + INTERVAL '30 days', NOW() - INTERVAL '60 days', NOW()),
  ('a1b2c3d4-0004-4000-8000-000000000004', 'Customer Portal', 'Self-service portal for customers to manage accounts', 'planning', NOW() - INTERVAL '14 days', NOW() + INTERVAL '90 days', NOW() - INTERVAL '14 days', NOW()),
  ('a1b2c3d4-0005-4000-8000-000000000005', 'Data Migration', 'Migrate legacy data to new cloud infrastructure', 'completed', NOW() - INTERVAL '90 days', NOW() - INTERVAL '5 days', NOW() - INTERVAL '90 days', NOW() - INTERVAL '5 days')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  status = EXCLUDED.status;

-- ============================================
-- MEETINGS
-- ============================================
INSERT INTO meetings (id, title, summary, transcript, key_points, sentiment_score, sentiment_label, duration_minutes, attendees, project_id, created_by, created_at) VALUES
  (
    'b2c3d4e5-0001-4000-8000-000000000001',
    'Sprint Planning - Website Redesign',
    'Discussed homepage wireframes and navigation structure. Team agreed on mobile-first approach. Design handoff scheduled for next week.',
    'John: Let''s start with the homepage layout. Sarah: I think we should go mobile-first. Mike: Agreed, our analytics show 60% mobile traffic...',
    '["Mobile-first approach approved", "Design handoff next Tuesday", "Homepage hero section needs A/B testing", "Navigation simplified to 5 main items"]'::jsonb,
    0.7,
    'Positive',
    45,
    '["John Smith", "Sarah Chen", "Mike Johnson"]'::jsonb,
    'a1b2c3d4-0001-4000-8000-000000000001',
    'system',
    NOW() - INTERVAL '2 days'
  ),
  (
    'b2c3d4e5-0002-4000-8000-000000000002',
    'Client Feedback - Q1 Campaign',
    'Client reviewed campaign materials. Minor revisions requested on social media assets. Overall positive reception.',
    'Client: The overall direction is great. We''d like to see more vibrant colors in the social posts...',
    '["Social media colors need adjustment", "Email templates approved", "Landing page copy needs revision", "Budget approved for paid ads"]'::jsonb,
    0.8,
    'Positive',
    60,
    '["Emily Davis", "Client: Mark Wilson", "Creative Team"]'::jsonb,
    'a1b2c3d4-0003-4000-8000-000000000003',
    'system',
    NOW() - INTERVAL '3 days'
  ),
  (
    'b2c3d4e5-0003-4000-8000-000000000003',
    'Technical Architecture Review',
    'Reviewed microservices architecture for the mobile app. Concerns raised about API latency. Need to implement caching layer.',
    'Dev Lead: The current response times are around 800ms. We need to get that under 200ms...',
    '["API latency is critical issue", "Redis caching recommended", "Database indexing needed", "Load testing scheduled"]'::jsonb,
    0.3,
    'Neutral',
    90,
    '["Dev Team", "Alex Kumar", "Infrastructure Lead"]'::jsonb,
    'a1b2c3d4-0002-4000-8000-000000000002',
    'system',
    NOW() - INTERVAL '5 days'
  ),
  (
    'b2c3d4e5-0004-4000-8000-000000000004',
    'Weekly Standup - All Hands',
    'General team update. Several blockers identified. Resource allocation discussed for next sprint.',
    'PM: Let''s go around and share updates. Designer: I''m blocked on the icon set approval...',
    '["Icon set approval pending", "Two team members on PTO next week", "New hire starting Monday", "Quarterly review coming up"]'::jsonb,
    0.5,
    'Neutral',
    30,
    '["Full Team"]'::jsonb,
    NULL,
    'system',
    NOW() - INTERVAL '1 day'
  ),
  (
    'b2c3d4e5-0005-4000-8000-000000000005',
    'Customer Portal Kickoff',
    'Initial planning meeting for customer portal project. Scope defined, timeline established. Risk of scope creep discussed.',
    'PM: This is our kickoff for the customer portal. Let''s define the MVP scope first...',
    '["MVP scope: account management + billing", "3-month timeline for Phase 1", "Integration with existing CRM needed", "Security audit required before launch"]'::jsonb,
    0.6,
    'Positive',
    75,
    '["Product Team", "Engineering Lead", "Security Officer"]'::jsonb,
    'a1b2c3d4-0004-4000-8000-000000000004',
    'system',
    NOW() - INTERVAL '7 days'
  ),
  (
    'b2c3d4e5-0006-4000-8000-000000000006',
    'Budget Review - Mobile App',
    'Budget overrun discussion. Need to cut features or extend timeline. Difficult decisions ahead.',
    'Finance: We''re 20% over budget. PM: We can either cut the analytics module or push the deadline...',
    '["20% budget overrun", "Analytics module may be cut", "Timeline extension option discussed", "Stakeholder approval needed"]'::jsonb,
    -0.3,
    'Negative',
    45,
    '["Finance Team", "PM", "Executive Sponsor"]'::jsonb,
    'a1b2c3d4-0002-4000-8000-000000000002',
    'system',
    NOW() - INTERVAL '4 days'
  ),
  (
    'b2c3d4e5-0007-4000-8000-000000000007',
    'Design System Workshop',
    'Team workshop to establish design tokens and component library. Great collaboration and alignment achieved.',
    'Designer: I''ve prepared the color palette based on our brand guidelines. Dev: These CSS variables look great...',
    '["Design tokens finalized", "Component library structure agreed", "Figma to code workflow established", "Documentation templates created"]'::jsonb,
    0.9,
    'Positive',
    120,
    '["Design Team", "Frontend Devs", "Brand Manager"]'::jsonb,
    'a1b2c3d4-0001-4000-8000-000000000001',
    'system',
    NOW() - INTERVAL '6 days'
  )
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  sentiment_score = EXCLUDED.sentiment_score,
  sentiment_label = EXCLUDED.sentiment_label;

-- ============================================
-- TASKS
-- Valid status: todo, in_progress, review, completed
-- Valid priority: low, medium, high, critical
-- ============================================
INSERT INTO tasks (id, title, description, status, priority, due_date, created_at) VALUES
  -- Website Redesign Tasks
  ('c3d4e5f6-0001-4000-8000-000000000001', 'Finalize homepage wireframes', 'Complete high-fidelity wireframes for desktop and mobile', 'in_progress', 'high', NOW() + INTERVAL '2 days', NOW() - INTERVAL '5 days'),
  ('c3d4e5f6-0002-4000-8000-000000000002', 'Set up A/B testing framework', 'Configure Optimizely for hero section testing', 'todo', 'medium', NOW() + INTERVAL '7 days', NOW() - INTERVAL '2 days'),
  ('c3d4e5f6-0003-4000-8000-000000000003', 'Update navigation structure', 'Simplify nav to 5 main items as discussed', 'completed', 'high', NOW() - INTERVAL '1 day', NOW() - INTERVAL '5 days'),

  -- Mobile App Tasks
  ('c3d4e5f6-0004-4000-8000-000000000004', 'Implement Redis caching', 'Add caching layer for API responses', 'todo', 'high', NOW() + INTERVAL '3 days', NOW() - INTERVAL '5 days'),
  ('c3d4e5f6-0005-4000-8000-000000000005', 'Database index optimization', 'Add indexes to frequently queried tables', 'in_progress', 'high', NOW() + INTERVAL '1 day', NOW() - INTERVAL '5 days'),
  ('c3d4e5f6-0006-4000-8000-000000000006', 'Load testing setup', 'Configure k6 for performance testing', 'todo', 'medium', NOW() + INTERVAL '10 days', NOW() - INTERVAL '5 days'),

  -- Q1 Campaign Tasks
  ('c3d4e5f6-0007-4000-8000-000000000007', 'Revise social media colors', 'Update color palette per client feedback', 'todo', 'medium', NOW() + INTERVAL '2 days', NOW() - INTERVAL '3 days'),
  ('c3d4e5f6-0008-4000-8000-000000000008', 'Update landing page copy', 'Revise headlines and CTA text', 'in_progress', 'high', NOW() + INTERVAL '1 day', NOW() - INTERVAL '3 days'),
  ('c3d4e5f6-0009-4000-8000-000000000009', 'Launch paid ad campaigns', 'Set up Google and Meta ad campaigns', 'todo', 'critical', NOW() + INTERVAL '5 days', NOW() - INTERVAL '3 days'),

  -- Customer Portal Tasks
  ('c3d4e5f6-0010-4000-8000-000000000010', 'Define API endpoints', 'Document REST API for account management', 'todo', 'high', NOW() + INTERVAL '7 days', NOW() - INTERVAL '7 days'),
  ('c3d4e5f6-0011-4000-8000-000000000011', 'CRM integration research', 'Evaluate Salesforce vs HubSpot integration options', 'in_progress', 'medium', NOW() + INTERVAL '5 days', NOW() - INTERVAL '7 days'),
  ('c3d4e5f6-0012-4000-8000-000000000012', 'Security requirements doc', 'Draft security requirements for audit', 'review', 'high', NOW() + INTERVAL '14 days', NOW() - INTERVAL '7 days'),

  -- General/Standalone Tasks
  ('c3d4e5f6-0013-4000-8000-000000000013', 'Approve icon set', 'Review and approve new icon library', 'review', 'medium', NOW() - INTERVAL '2 days', NOW() - INTERVAL '10 days'),
  ('c3d4e5f6-0014-4000-8000-000000000014', 'Onboard new team member', 'Prepare onboarding materials and schedule', 'todo', 'low', NOW() + INTERVAL '1 day', NOW() - INTERVAL '1 day'),
  ('c3d4e5f6-0015-4000-8000-000000000015', 'Prepare quarterly review', 'Compile metrics and achievements for Q review', 'todo', 'medium', NOW() + INTERVAL '14 days', NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  status = EXCLUDED.status,
  priority = EXCLUDED.priority,
  due_date = EXCLUDED.due_date;

-- ============================================
-- ACTION ITEMS (extracted from meetings)
-- ============================================
INSERT INTO action_items (id, meeting_id, task_description, assigned_to_name, due_date, status, created_at) VALUES
  ('d4e5f6a7-0001-4000-8000-000000000001', 'b2c3d4e5-0001-4000-8000-000000000001', 'Complete mobile wireframes by Tuesday', 'Sarah Chen', NOW() + INTERVAL '2 days', 'open', NOW() - INTERVAL '2 days'),
  ('d4e5f6a7-0002-4000-8000-000000000002', 'b2c3d4e5-0001-4000-8000-000000000001', 'Set up A/B testing tool', 'Mike Johnson', NOW() + INTERVAL '7 days', 'open', NOW() - INTERVAL '2 days'),
  ('d4e5f6a7-0003-4000-8000-000000000003', 'b2c3d4e5-0002-4000-8000-000000000002', 'Revise social media color palette', 'Creative Team', NOW() + INTERVAL '2 days', 'open', NOW() - INTERVAL '3 days'),
  ('d4e5f6a7-0004-4000-8000-000000000004', 'b2c3d4e5-0002-4000-8000-000000000002', 'Send revised landing page copy', 'Emily Davis', NOW() + INTERVAL '1 day', 'in_progress', NOW() - INTERVAL '3 days'),
  ('d4e5f6a7-0005-4000-8000-000000000005', 'b2c3d4e5-0003-4000-8000-000000000003', 'Implement Redis caching layer', 'Alex Kumar', NOW() + INTERVAL '5 days', 'open', NOW() - INTERVAL '5 days'),
  ('d4e5f6a7-0006-4000-8000-000000000006', 'b2c3d4e5-0003-4000-8000-000000000003', 'Run database index analysis', 'DBA', NOW() + INTERVAL '2 days', 'completed', NOW() - INTERVAL '5 days'),
  ('d4e5f6a7-0007-4000-8000-000000000007', 'b2c3d4e5-0005-4000-8000-000000000005', 'Draft MVP feature list', 'Product Team', NOW() + INTERVAL '3 days', 'completed', NOW() - INTERVAL '7 days'),
  ('d4e5f6a7-0008-4000-8000-000000000008', 'b2c3d4e5-0005-4000-8000-000000000005', 'Schedule security audit', 'Security Officer', NOW() + INTERVAL '30 days', 'open', NOW() - INTERVAL '7 days'),
  ('d4e5f6a7-0009-4000-8000-000000000009', 'b2c3d4e5-0006-4000-8000-000000000006', 'Prepare feature cut proposal', 'PM', NOW() + INTERVAL '2 days', 'open', NOW() - INTERVAL '4 days'),
  ('d4e5f6a7-0010-4000-8000-000000000010', 'b2c3d4e5-0007-4000-8000-000000000007', 'Export design tokens to JSON', 'Design Lead', NOW() + INTERVAL '1 day', 'completed', NOW() - INTERVAL '6 days')
ON CONFLICT (id) DO UPDATE SET
  task_description = EXCLUDED.task_description,
  status = EXCLUDED.status;

-- ============================================
-- WORKFLOWS (visual automation)
-- project_id is required (NOT NULL)
-- Valid status: draft, published, archived
-- ============================================
INSERT INTO workflows (id, project_id, name, description, nodes, edges, version, status, execution_config, created_at, updated_at, last_executed_at) VALUES
  (
    'e5f6a7b8-0001-4000-8000-000000000001',
    'a1b2c3d4-0001-4000-8000-000000000001',  -- Website Redesign
    'Meeting Summary to Slack',
    'Automatically posts meeting summaries to the team Slack channel',
    '[{"id":"trigger","type":"meeting_created","position":{"x":100,"y":100}},{"id":"summarize","type":"ai_summarize","position":{"x":300,"y":100}},{"id":"slack","type":"send_slack","position":{"x":500,"y":100}}]'::jsonb,
    '[{"source":"trigger","target":"summarize"},{"source":"summarize","target":"slack"}]'::jsonb,
    1,
    'published',
    '{}'::jsonb,
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '1 hour',
    NOW() - INTERVAL '1 hour'
  ),
  (
    'e5f6a7b8-0002-4000-8000-000000000002',
    'a1b2c3d4-0002-4000-8000-000000000002',  -- Mobile App v2.0
    'Task Assignment Notification',
    'Notifies team members when they are assigned a new task',
    '[{"id":"trigger","type":"task_assigned","position":{"x":100,"y":100}},{"id":"notify","type":"send_email","position":{"x":300,"y":100}}]'::jsonb,
    '[{"source":"trigger","target":"notify"}]'::jsonb,
    2,
    'published',
    '{}'::jsonb,
    NOW() - INTERVAL '45 days',
    NOW() - INTERVAL '30 minutes',
    NOW() - INTERVAL '30 minutes'
  ),
  (
    'e5f6a7b8-0003-4000-8000-000000000003',
    'a1b2c3d4-0003-4000-8000-000000000003',  -- Q1 Marketing Campaign
    'Daily Standup Reminder',
    'Sends a daily reminder at 9 AM for standup meeting',
    '[{"id":"schedule","type":"schedule","position":{"x":100,"y":100},"data":{"cron":"0 9 * * 1-5"}},{"id":"slack","type":"send_slack","position":{"x":300,"y":100}}]'::jsonb,
    '[{"source":"schedule","target":"slack"}]'::jsonb,
    1,
    'published',
    '{"schedule": "0 9 * * 1-5"}'::jsonb,
    NOW() - INTERVAL '60 days',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
  ),
  (
    'e5f6a7b8-0004-4000-8000-000000000004',
    'a1b2c3d4-0004-4000-8000-000000000004',  -- Customer Portal
    'Overdue Task Escalation',
    'Escalates overdue tasks to project manager',
    '[{"id":"schedule","type":"schedule","position":{"x":100,"y":100}},{"id":"check","type":"condition","position":{"x":300,"y":100}},{"id":"escalate","type":"send_email","position":{"x":500,"y":100}}]'::jsonb,
    '[{"source":"schedule","target":"check"},{"source":"check","target":"escalate"}]'::jsonb,
    1,
    'draft',
    '{}'::jsonb,
    NOW() - INTERVAL '7 days',
    NOW() - INTERVAL '7 days',
    NULL
  ),
  (
    'e5f6a7b8-0005-4000-8000-000000000005',
    'a1b2c3d4-0005-4000-8000-000000000005',  -- Data Migration
    'Weekly Progress Report',
    'Generates weekly progress report from completed tasks',
    '[{"id":"schedule","type":"schedule","position":{"x":100,"y":100}},{"id":"gather","type":"data_query","position":{"x":300,"y":100}},{"id":"format","type":"transform","position":{"x":500,"y":100}},{"id":"send","type":"send_email","position":{"x":700,"y":100}}]'::jsonb,
    '[{"source":"schedule","target":"gather"},{"source":"gather","target":"format"},{"source":"format","target":"send"}]'::jsonb,
    1,
    'draft',
    '{"schedule": "0 9 * * 5"}'::jsonb,
    NOW() - INTERVAL '14 days',
    NOW() - INTERVAL '14 days',
    NULL
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  status = EXCLUDED.status,
  updated_at = EXCLUDED.updated_at;

-- ============================================
-- AUTOMATIONS (rule-based)
-- created_by is required (NOT NULL) - using 'system' as placeholder
-- ============================================
INSERT INTO automations (id, name, description, trigger_type, trigger_config, actions, enabled, execution_count, last_executed_at, created_by, created_at) VALUES
  (
    'f6a7b8c9-0001-4000-8000-000000000001',
    'High Priority Task Alert',
    'Send Slack alert when high priority task is created',
    'task_created',
    '{"priority": "high"}'::jsonb,
    '[{"type": "slack_message", "config": {"channel": "#urgent", "template": "New high priority task: {{task.title}}"}}]'::jsonb,
    true,
    12,
    NOW() - INTERVAL '2 hours',
    'system',
    NOW() - INTERVAL '30 days'
  ),
  (
    'f6a7b8c9-0002-4000-8000-000000000002',
    'Meeting Follow-up',
    'Create follow-up task 24 hours after meeting',
    'meeting_processed',
    '{}'::jsonb,
    '[{"type": "create_task", "config": {"title": "Follow up on: {{meeting.title}}", "due_days": 1}}]'::jsonb,
    true,
    7,
    NOW() - INTERVAL '1 day',
    'system',
    NOW() - INTERVAL '20 days'
  ),
  (
    'f6a7b8c9-0003-4000-8000-000000000003',
    'Project Completion Notification',
    'Notify stakeholders when project is completed',
    'project_updated',
    '{"status": "completed"}'::jsonb,
    '[{"type": "email", "config": {"to": "stakeholders", "template": "project_complete"}}]'::jsonb,
    true,
    1,
    NOW() - INTERVAL '5 days',
    'system',
    NOW() - INTERVAL '40 days'
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  enabled = EXCLUDED.enabled,
  execution_count = EXCLUDED.execution_count;

-- ============================================
-- VERIFY DATA
-- ============================================
SELECT 'Projects' as table_name, COUNT(*) as count FROM projects
UNION ALL
SELECT 'Meetings', COUNT(*) FROM meetings
UNION ALL
SELECT 'Tasks', COUNT(*) FROM tasks
UNION ALL
SELECT 'Action Items', COUNT(*) FROM action_items
UNION ALL
SELECT 'Workflows', COUNT(*) FROM workflows
UNION ALL
SELECT 'Automations', COUNT(*) FROM automations;
