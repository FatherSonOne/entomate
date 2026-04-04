-- ========================================
-- Migration: Materialize Heavy Dashboard Views
-- Date: 2026-04-03
-- Purpose: Convert project_statistics and team_workload to
--          materialized views for faster dashboard loads.
--          Adds unique indexes for CONCURRENTLY refresh and
--          a helper function callable by pg_cron or app code.
-- ========================================

-- =====================================================
-- 1. DROP existing regular views (safe — backend has fallbacks)
-- =====================================================
DROP VIEW IF EXISTS project_statistics CASCADE;
DROP VIEW IF EXISTS team_workload CASCADE;

-- =====================================================
-- 2. MATERIALIZED VIEW: project_statistics
-- =====================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS project_statistics AS
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

-- Unique index required for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_statistics_id ON project_statistics(id);

-- =====================================================
-- 3. MATERIALIZED VIEW: team_workload
-- =====================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS team_workload AS
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

-- Unique index required for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_workload_member ON team_workload(team_member, email);

-- =====================================================
-- 4. REFRESH FUNCTION
--    Callable via pg_cron, Supabase scheduled function,
--    or POST /api/dashboard/refresh-views
-- =====================================================
CREATE OR REPLACE FUNCTION refresh_dashboard_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY project_statistics;
  REFRESH MATERIALIZED VIEW CONCURRENTLY team_workload;
END;
$$;

-- Grant execute to service role (for backend calls)
GRANT EXECUTE ON FUNCTION refresh_dashboard_views() TO service_role;

-- =====================================================
-- 5. INITIAL REFRESH (populate data)
-- =====================================================
REFRESH MATERIALIZED VIEW project_statistics;
REFRESH MATERIALIZED VIEW team_workload;

-- =====================================================
-- 6. SCHEDULE REFRESH (if pg_cron is available)
--    Refreshes every 15 minutes
-- =====================================================
DO $$
BEGIN
  -- pg_cron may not be enabled — this is a best-effort schedule
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'refresh-dashboard-views',
      '*/15 * * * *',
      'SELECT refresh_dashboard_views()'
    );
    RAISE NOTICE 'pg_cron job scheduled: refresh-dashboard-views every 15 minutes';
  ELSE
    RAISE NOTICE 'pg_cron not available — call refresh_dashboard_views() manually or via backend cron';
  END IF;
END $$;

SELECT 'Dashboard materialized views created' as status;
