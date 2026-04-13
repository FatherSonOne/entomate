# Supabase CLI Setup Guide

## Current Status
✅ Supabase CLI is already installed at: `C:\Users\Aegis{FM}\scoop\shims\supabase.exe`

---

## Quick Commands

### 1. Login to Supabase
```bash
supabase login
```
This will open a browser window to authenticate with your Supabase account.

### 2. Link Project to Supabase
```bash
supabase link --project-ref your-project-ref
```
Replace `your-project-ref` with your project ID from Supabase dashboard.

To find your project ref:
- Go to https://app.supabase.com/
- Open your Entomate project
- Look at the URL: `https://app.supabase.com/project/[YOUR-PROJECT-REF]`

### 3. Run Migration (Option 1: CLI)
```bash
supabase db push
```
This pushes local migrations to your remote database.

### 4. Run Migration (Option 2: Direct SQL - RECOMMENDED FOR NOW)
1. Go to https://app.supabase.com/
2. Open your Entomate project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy the entire contents of `docs/migrations/enhanced-intelligence-schema-v2.sql`
6. Paste into the SQL editor
7. Click **Run** or press `Ctrl+Enter`

---

## Fix for the `user_id` Error

The original migration had an issue - it referenced `action_items.user_id` which doesn't exist.

**The action_items table actually has:**
- `assigned_to_id` - references users(id)
- `meeting_id` - references meetings(id)

**Solution:** Use the new file `enhanced-intelligence-schema-v2.sql` which has been fixed to use the correct columns.

---

## What Changed in v2?

### RLS Policies for Action Item Dependencies (Fixed)
The policies now correctly check:
- ✅ `assigned_to_id = auth.uid()` (user is assigned to the action item)
- ✅ Joins with `meetings` table to check if user owns the meeting that created the action item
- ✅ Handles both blocker and blocked items correctly

### Added Service Role Policies
All tables now have service role policies so the backend can write data using the service key:
```sql
CREATE POLICY "Service role can manage all ..."
  ON table_name FOR ALL
  USING (auth.role() = 'service_role');
```

---

## Running the Fixed Migration

### Option 1: Supabase Dashboard (Easiest)
1. Open Supabase Dashboard → SQL Editor
2. Copy contents of `docs/migrations/enhanced-intelligence-schema-v2.sql`
3. Paste and run
4. Verify with the verification queries at the bottom

### Option 2: Supabase CLI
```bash
# Create a new migration file
supabase migration new enhanced_intelligence_dashboard

# Copy the SQL from enhanced-intelligence-schema-v2.sql to the generated file
# Then push to remote
supabase db push
```

---

## Verification After Migration

Run these queries in SQL Editor to verify:

```sql
-- Check all tables were created
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

Expected output: 4 rows

```sql
-- Check table structures
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name IN (
  'deal_risk_scores',
  'stakeholder_intelligence',
  'action_item_dependencies',
  'intelligence_preferences'
)
ORDER BY table_name, ordinal_position;
```

```sql
-- Check RLS is enabled
SELECT
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN (
  'deal_risk_scores',
  'stakeholder_intelligence',
  'action_item_dependencies',
  'intelligence_preferences'
);
```

All should show `rowsecurity = true`

---

## Troubleshooting

### Error: "relation already exists"
If you already ran the first migration, some tables may exist. You can either:

**Option A: Drop and recreate (DEVELOPMENT ONLY)**
```sql
DROP TABLE IF EXISTS action_item_dependencies CASCADE;
DROP TABLE IF EXISTS deal_risk_scores CASCADE;
DROP TABLE IF EXISTS stakeholder_intelligence CASCADE;
DROP TABLE IF EXISTS intelligence_preferences CASCADE;

-- Then run the full migration again
```

**Option B: Create only missing tables**
Comment out the tables that already exist and run only what's needed.

### Error: "policy already exists"
```sql
-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view dependencies for their action items" ON action_item_dependencies;
-- ... repeat for other policies

-- Then run the migration
```

---

## Next Steps After Migration

Once the migration is successful:

1. ✅ Tables created
2. ✅ Indexes created
3. ✅ RLS policies applied
4. ✅ Triggers set up

→ **Proceed to Phase 1: Backend Services Implementation**

The backend will now be able to:
- Cache deal risk scores in `deal_risk_scores`
- Store AI-classified stakeholder data in `stakeholder_intelligence`
- Track action item dependencies in `action_item_dependencies`
- Save user preferences in `intelligence_preferences`

---

## Environment Variables to Verify

Make sure these are set in your `.env` files:

```bash
# backend/.env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key  # For writing cached data

# frontend/.env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

The service key is needed for backend services to write to the intelligence tables.
