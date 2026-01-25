-- ========================================
-- Verification Script for Enhanced Intelligence Dashboard Migration
-- Run this AFTER the migration to verify everything works
-- ========================================

-- 1. Check all tables exist
SELECT
  'Tables Created' as check_type,
  COUNT(*) as count,
  CASE WHEN COUNT(*) = 4 THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'deal_risk_scores',
    'stakeholder_intelligence',
    'action_item_dependencies',
    'intelligence_preferences'
  );

-- 2. List all created tables with row counts
SELECT
  'Table Inventory' as check_type,
  t.tablename as table_name,
  pg_size_pretty(pg_total_relation_size(quote_ident(t.tablename)::regclass)) as table_size,
  (SELECT COUNT(*) FROM deal_risk_scores) as risk_scores_count,
  (SELECT COUNT(*) FROM stakeholder_intelligence) as stakeholder_intel_count,
  (SELECT COUNT(*) FROM action_item_dependencies) as dependencies_count,
  (SELECT COUNT(*) FROM intelligence_preferences) as preferences_count
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND t.tablename = 'deal_risk_scores'
LIMIT 1;

-- 3. Check RLS is enabled
SELECT
  'RLS Enabled' as check_type,
  tablename,
  CASE
    WHEN rowsecurity = true THEN '✅ Enabled'
    ELSE '❌ Disabled'
  END as status
FROM pg_tables
WHERE tablename IN (
  'deal_risk_scores',
  'stakeholder_intelligence',
  'action_item_dependencies',
  'intelligence_preferences'
);

-- 4. Check indexes were created
SELECT
  'Indexes Created' as check_type,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN (
  'deal_risk_scores',
  'stakeholder_intelligence',
  'action_item_dependencies'
)
ORDER BY tablename, indexname;

-- 5. Check policies exist
SELECT
  'RLS Policies' as check_type,
  tablename,
  policyname,
  cmd as command,
  CASE
    WHEN policyname LIKE '%service role%' THEN 'Service'
    WHEN policyname LIKE '%Users can%' THEN 'User'
    ELSE 'Other'
  END as policy_type
FROM pg_policies
WHERE tablename IN (
  'deal_risk_scores',
  'stakeholder_intelligence',
  'action_item_dependencies',
  'intelligence_preferences'
)
ORDER BY tablename, policyname;

-- 6. Verify column structure for deal_risk_scores
SELECT
  'deal_risk_scores Columns' as check_type,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'deal_risk_scores'
ORDER BY ordinal_position;

-- 7. Verify column structure for stakeholder_intelligence
SELECT
  'stakeholder_intelligence Columns' as check_type,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'stakeholder_intelligence'
ORDER BY ordinal_position;

-- 8. Verify column structure for action_item_dependencies
SELECT
  'action_item_dependencies Columns' as check_type,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'action_item_dependencies'
ORDER BY ordinal_position;

-- 9. Verify triggers exist
SELECT
  'Triggers' as check_type,
  trigger_name,
  event_object_table as table_name,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE event_object_table IN (
  'deal_risk_scores',
  'stakeholder_intelligence',
  'action_item_dependencies',
  'intelligence_preferences'
)
ORDER BY event_object_table, trigger_name;

-- 10. Test INSERT permissions (will only work if you run as authenticated user)
-- This is a dry-run test - no data will be persisted
DO $$
BEGIN
  -- Test if we can select from all tables (should work for authenticated users)
  PERFORM 1 FROM deal_risk_scores LIMIT 0;
  PERFORM 1 FROM stakeholder_intelligence LIMIT 0;
  PERFORM 1 FROM action_item_dependencies LIMIT 0;
  PERFORM 1 FROM intelligence_preferences LIMIT 0;

  RAISE NOTICE '✅ All tables are queryable';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ Error querying tables: %', SQLERRM;
END $$;

-- ========================================
-- Summary Report
-- ========================================
SELECT
  '=== MIGRATION VERIFICATION SUMMARY ===' as summary,
  (SELECT COUNT(*) FROM pg_tables WHERE tablename IN ('deal_risk_scores', 'stakeholder_intelligence', 'action_item_dependencies', 'intelligence_preferences')) as tables_created,
  (SELECT COUNT(*) FROM pg_indexes WHERE tablename IN ('deal_risk_scores', 'stakeholder_intelligence', 'action_item_dependencies')) as indexes_created,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename IN ('deal_risk_scores', 'stakeholder_intelligence', 'action_item_dependencies', 'intelligence_preferences')) as policies_created,
  (SELECT COUNT(*) FROM information_schema.triggers WHERE event_object_table IN ('deal_risk_scores', 'stakeholder_intelligence', 'action_item_dependencies', 'intelligence_preferences')) as triggers_created;

-- ========================================
-- Expected Results:
-- - tables_created: 4
-- - indexes_created: ~10
-- - policies_created: ~16-20
-- - triggers_created: 4
-- ========================================
