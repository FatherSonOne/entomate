-- ========================================
-- QUICK CHECK: Do the intelligence tables exist?
-- Run this FIRST to see if you need to run the migration
-- ========================================

SELECT
  CASE
    WHEN COUNT(*) = 0 THEN '❌ Tables DO NOT exist - Run the migration first!'
    WHEN COUNT(*) = 4 THEN '✅ All 4 tables exist - You can run verification'
    ELSE '⚠️ Only ' || COUNT(*) || ' tables exist - Something is wrong'
  END as status,
  COUNT(*) as tables_found
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'deal_risk_scores',
    'stakeholder_intelligence',
    'action_item_dependencies',
    'intelligence_preferences'
  );

-- List which tables exist (if any)
SELECT
  'Existing Tables:' as info,
  tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'deal_risk_scores',
    'stakeholder_intelligence',
    'action_item_dependencies',
    'intelligence_preferences'
  );
