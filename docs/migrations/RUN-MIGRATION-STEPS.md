# How to Run Enhanced Intelligence Dashboard Migration

## ⚠️ IMPORTANT: Follow Steps in Order

You're getting the error because the tables don't exist yet. You need to run the **migration** first, then the **verification**.

---

## Step 1: Run the Migration

### Option A: Supabase Dashboard (Easiest)

1. **Open Supabase Dashboard**
   - Go to https://app.supabase.com/
   - Select your Entomate project

2. **Open SQL Editor**
   - Click **SQL Editor** in the left sidebar
   - Click **New Query**

3. **Copy the Migration SQL (FIXED VERSION)**
   - Open the file: `f:\entomate\supabase\migrations\20260124_002_enhanced_intelligence_dashboard_fixed.sql`
   - Select ALL contents (Ctrl+A)
   - Copy (Ctrl+C)

4. **Paste and Run**
   - Paste into the SQL Editor
   - Click **Run** button or press `Ctrl+Enter`

5. **Wait for Success**
   - You should see "Success. No rows returned"
   - This is normal - the migration creates tables, doesn't return data

### Option B: Supabase CLI

```bash
# From the entomate directory
cd f:\entomate

# Push the migration to Supabase
supabase db push
```

---

## Step 2: Verify the Migration

**Only AFTER Step 1 succeeds**, run the verification:

1. **Open SQL Editor again**
   - New Query

2. **Copy Verification SQL**
   - Open: `f:\entomate\docs\migrations\verify-enhanced-intelligence.sql`
   - Copy all contents

3. **Paste and Run**
   - You should now see multiple result sets with ✅ PASS statuses

---

## Expected Results After Verification

### Query 1: Tables Created
```
check_type       | count | status
-----------------|-------|--------
Tables Created   | 4     | ✅ PASS
```

### Query 3: RLS Enabled
```
check_type   | tablename                   | status
-------------|----------------------------|------------
RLS Enabled  | deal_risk_scores          | ✅ Enabled
RLS Enabled  | stakeholder_intelligence  | ✅ Enabled
RLS Enabled  | action_item_dependencies  | ✅ Enabled
RLS Enabled  | intelligence_preferences  | ✅ Enabled
```

### Query 10: Summary
```
summary                              | tables_created | indexes_created | policies_created | triggers_created
-------------------------------------|----------------|-----------------|------------------|------------------
=== MIGRATION VERIFICATION SUMMARY ===| 4              | ~10             | ~16-20           | 4
```

---

## Troubleshooting

### Error: "relation already exists"

If some tables were created from a previous attempt:

```sql
-- Drop existing tables first (DEVELOPMENT ONLY!)
DROP TABLE IF EXISTS action_item_dependencies CASCADE;
DROP TABLE IF EXISTS deal_risk_scores CASCADE;
DROP TABLE IF EXISTS stakeholder_intelligence CASCADE;
DROP TABLE IF EXISTS intelligence_preferences CASCADE;

-- Then run the migration again
```

### Error: "policy already exists"

The migration script already has `DROP POLICY IF EXISTS` statements, so this shouldn't happen. But if it does:

```sql
-- Drop all policies manually
DROP POLICY IF EXISTS "Users can view their own deal risk scores" ON deal_risk_scores;
-- ... repeat for all policies

-- Then run the migration again
```

---

## Quick Check: Are Tables Created?

Run this simple query first to check if tables exist:

```sql
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'deal_risk_scores',
    'stakeholder_intelligence',
    'action_item_dependencies',
    'intelligence_preferences'
  );
```

**If this returns 0 rows:** Tables don't exist → Run Step 1 (Migration)
**If this returns 4 rows:** Tables exist → Run Step 2 (Verification)

---

## After Successful Migration

Once you see ✅ PASS in the verification results, you're ready for:

✅ Phase 1: Backend Services Implementation
- MeetingPrepService.js
- DealRiskService.js
- ActionItemTrackerService.js
- RelationshipIntelligenceService.js

Let me know when migration is complete!
