-- Dashboard Views for Entomate
-- Run this in Supabase SQL Editor

-- View 1: Project Statistics (based on meetings)
CREATE OR REPLACE VIEW project_statistics AS
SELECT
  m.id,
  m.title,
  m.summary,
  m.created_at,
  m.updated_at,
  m.project_id,
  COUNT(ai.id) as total_items,
  COUNT(CASE WHEN ai.status = 'pending' OR ai.status = 'open' THEN 1 END) as open_items,
  COUNT(CASE WHEN ai.status = 'in_progress' THEN 1 END) as in_progress_items,
  COUNT(CASE WHEN ai.status = 'done' OR ai.status = 'complete' THEN 1 END) as complete_items,
  CASE
    WHEN COUNT(ai.id) > 0 THEN
      ROUND(COUNT(CASE WHEN ai.status = 'done' OR ai.status = 'complete' THEN 1 END)::numeric / COUNT(ai.id) * 100, 0)
    ELSE 0
  END as progress_percent,
  COUNT(CASE WHEN ai.due_date < NOW() AND ai.status NOT IN ('done', 'complete') THEN 1 END) as overdue_items,
  COUNT(DISTINCT ai.assigned_to_name) as team_size,
  MIN(CASE WHEN ai.status NOT IN ('done', 'complete') THEN ai.due_date END) as next_deadline,
  m.sentiment_label,
  m.sentiment_score
FROM meetings m
LEFT JOIN action_items ai ON m.id = ai.meeting_id
GROUP BY m.id, m.title, m.summary, m.created_at, m.updated_at, m.project_id, m.sentiment_label, m.sentiment_score;

-- View 2: Team Workload
CREATE OR REPLACE VIEW team_workload AS
SELECT
  ai.assigned_to_name as team_member,
  ai.assigned_to_email as email,
  COUNT(ai.id) as total_assigned,
  COUNT(CASE WHEN ai.status = 'pending' OR ai.status = 'open' THEN 1 END) as pending_items,
  COUNT(CASE WHEN ai.status = 'in_progress' THEN 1 END) as in_progress_items,
  COUNT(CASE WHEN ai.status = 'done' OR ai.status = 'complete' THEN 1 END) as completed_items,
  CASE
    WHEN COUNT(ai.id) > 0 THEN
      ROUND(COUNT(CASE WHEN ai.status = 'done' OR ai.status = 'complete' THEN 1 END)::numeric / COUNT(ai.id) * 100, 0)
    ELSE 0
  END as completion_rate,
  COUNT(CASE WHEN ai.due_date < NOW() AND ai.status NOT IN ('done', 'complete') THEN 1 END) as overdue_count,
  MIN(CASE WHEN ai.status NOT IN ('done', 'complete') THEN ai.due_date END) as next_deadline,
  COUNT(CASE WHEN ai.priority = 'high' AND ai.status NOT IN ('done', 'complete') THEN 1 END) as high_priority_count
FROM action_items ai
WHERE ai.assigned_to_name IS NOT NULL AND ai.assigned_to_name != ''
GROUP BY ai.assigned_to_name, ai.assigned_to_email;

-- View 3: Overdue Items
CREATE OR REPLACE VIEW overdue_items AS
SELECT
  ai.id,
  ai.task_description,
  ai.assigned_to_name,
  ai.assigned_to_email,
  ai.due_date,
  ai.priority,
  ai.status,
  m.title as meeting_title,
  m.id as meeting_id,
  EXTRACT(DAY FROM NOW() - ai.due_date)::integer as days_overdue
FROM action_items ai
JOIN meetings m ON ai.meeting_id = m.id
WHERE ai.due_date < NOW()
  AND ai.status NOT IN ('done', 'complete')
ORDER BY ai.due_date ASC;

-- View 4: Action Item Trends (for charts)
CREATE OR REPLACE VIEW action_item_trends AS
SELECT
  DATE_TRUNC('day', ai.created_at)::DATE as date,
  COUNT(ai.id) as total_created,
  COUNT(CASE WHEN ai.status = 'done' OR ai.status = 'complete' THEN 1 END) as completed,
  COUNT(CASE WHEN ai.priority = 'high' THEN 1 END) as high_priority,
  COUNT(CASE WHEN ai.priority = 'medium' THEN 1 END) as medium_priority,
  COUNT(CASE WHEN ai.priority = 'low' THEN 1 END) as low_priority
FROM action_items ai
GROUP BY DATE_TRUNC('day', ai.created_at)
ORDER BY date DESC
LIMIT 30;

-- View 5: Meeting Sentiment Trends
CREATE OR REPLACE VIEW sentiment_trends AS
SELECT
  DATE_TRUNC('day', m.created_at)::DATE as date,
  COUNT(m.id) as total_meetings,
  COUNT(CASE WHEN m.sentiment_label = 'Positive' THEN 1 END) as positive_count,
  COUNT(CASE WHEN m.sentiment_label = 'Neutral' THEN 1 END) as neutral_count,
  COUNT(CASE WHEN m.sentiment_label = 'Negative' THEN 1 END) as negative_count,
  ROUND(AVG(m.sentiment_score)::numeric, 2) as avg_sentiment_score
FROM meetings m
GROUP BY DATE_TRUNC('day', m.created_at)
ORDER BY date DESC
LIMIT 30;

SELECT 'Dashboard views created' as status;
