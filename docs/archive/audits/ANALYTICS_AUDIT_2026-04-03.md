# Analytics Section Audit

**Date:** 2026-04-03
**Auditor:** Claude Opus 4.6 (Automated)
**Scope:** All analytics, predictions, reports, dashboard, and learning analytics subsystems

---

## 1. File Inventory

### Frontend — React/TypeScript (src/)

| File | Lines | Description |
|------|-------|-------------|
| `src/analytics/index.ts` | 9 | Module barrel — re-exports types, modelRegistry, dealProbability, taskEta |
| `src/analytics/types.ts` | 91 | TypeScript interfaces for predictions (DealProbabilityResult, TaskEtaResult, etc.) |
| `src/analytics/modelRegistry.ts` | 52 | Model version registry (baseline_v1 for both models) |
| `src/analytics/dealProbability.ts` | 362 | Rule-based deal close probability (Logos Vision CRM + local fallback) |
| `src/analytics/taskEta.ts` | 250 | Rule-based task ETA prediction with workload adjustments |
| `src/hooks/usePredictions.ts` | 185 | React hooks: `useDealProbability`, `useTaskEta`, color/format utils |
| `src/components/PredictionBadge.tsx` | 301 | `DealProbabilityBadge` and `TaskEtaBadge` with tooltips |
| `src/intelligence/analyticsService.ts` | 298 | Profile usage pipeline tracking + effectiveness aggregation |
| `src/components/intelligence/ProfileEffectivenessCard.tsx` | 101 | Compact card showing acceptance/completion/quality metrics |

### Frontend — React/JSX (frontend/src/)

| File | Lines | Description |
|------|-------|-------------|
| `frontend/src/pages/Analytics.jsx` | 837 | Main analytics dashboard (overview, meetings, tasks, AI, team tabs) |
| `frontend/src/pages/Dashboard.jsx` | 842 | Project dashboard with RingGauge, intelligence widgets |
| `frontend/src/pages/Reports.jsx` | 460 | Report generation page (PDF/CSV downloads) |
| `frontend/src/pages/ProjectDashboard.jsx` | 554 | Project-specific dashboard with task metrics |
| `frontend/src/components/intelligence/IntelligenceDashboard.jsx` | 580 | Intelligence dashboard (risk scores, prep cards, insights) |

### Backend — Node.js/Express

| File | Lines | Description |
|------|-------|-------------|
| `backend/routes/analytics.js` | 501 | Main analytics API: dashboard, trends, team-performance, ai-effectiveness, record |
| `backend/routes/dashboard.js` | 669 | Dashboard API: projects, action-items, team-workload, overdue, insights |
| `backend/routes/reports.js` | 486 | Report API: meeting PDF, goals PDF, project PDF, weekly PDF, CSV exports |
| `backend/routes/learning.js` | 703 | Learning system API: feedback, patterns, outcomes, effectiveness reports |
| `backend/routes/intelligence.js` | 421 | Intelligence API: risk scores, stakeholder intel, meeting prep |
| `backend/services/reportService.js` | 433 | PDF generation (pdfkit) and CSV export (json2csv) |
| `backend/services/learning/LearningEngine.js` | 375 | Applies learned patterns to AI agent decisions |
| `backend/services/learning/FeedbackService.js` | 252 | Feedback collection and override tracking |
| `backend/services/learning/OutcomeTracker.js` | 424 | Tracks outcomes for effectiveness measurement |
| `backend/services/learning/PatternDetectionService.js` | 529 | Detects behavioral patterns from override data |
| `backend/services/explainability/ExplanationAnalytics.js` | 319 | Tracks explanation engagement events |
| `backend/services/explainability/ExplanationService.js` | 341 | Generates natural language explanations |
| `backend/schemas/analytics.js` | 16 | Zod schema for `/analytics/record` endpoint |

### Database

| File | Lines | Description |
|------|-------|-------------|
| `supabase/migrations/20251216_003_create_predictions_table.sql` | 127 | `predictions` table with constraints and indexes |
| `supabase/migrations/20260124_001_enhanced_intelligence_dashboard.sql` | ~150 | `deal_risk_scores`, `stakeholder_intelligence`, `action_item_dependencies` |
| `supabase/migrations/20260328_002_mip_analytics.sql` | 117 | `intelligence_profile_analytics`, `intelligence_profile_effectiveness` |
| `docs/migrations/002_explanation_analytics.sql` | 51 | `explanation_analytics` table |
| `docs/migrations/dashboard-views.sql` | 97 | 5 materialized views: project_statistics, team_workload, overdue_items, action_item_trends, sentiment_trends |

**Total: ~40 files, ~9,500+ lines**

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (React)                               │
│                                                                         │
│  ┌─────────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │
│  │ Analytics.jsx    │  │ Reports.jsx  │  │ Dashboard.jsx            │   │
│  │ (5 tabs:         │  │ (PDF/CSV     │  │ (RingGauges,             │   │
│  │  overview,       │  │  downloads)  │  │  Intelligence widgets,   │   │
│  │  meetings,       │  └──────┬───────┘  │  SentimentTrendMini)     │   │
│  │  tasks,          │         │           └────────────┬─────────────┘   │
│  │  ai, team)       │         │                        │                 │
│  └────────┬─────────┘         │                        │                 │
│           │                   │                        │                 │
│  ┌────────┴─────────────┐     │     ┌──────────────────┴──────────┐     │
│  │ PredictionBadge.tsx  │     │     │ IntelligenceDashboard.jsx   │     │
│  │ usePredictions.ts    │     │     │ ProfileEffectivenessCard.tsx │     │
│  └────────┬─────────────┘     │     └──────────────┬──────────────┘     │
│           │                   │                    │                     │
│  ┌────────┴─────────────────┐ │     ┌──────────────┴──────────────┐     │
│  │ analytics/ (TypeScript)  │ │     │ analyticsService.ts         │     │
│  │  dealProbability.ts      │ │     │ (profile effectiveness      │     │
│  │  taskEta.ts              │ │     │  tracking pipeline)         │     │
│  │  modelRegistry.ts        │ │     └──────────────┬──────────────┘     │
│  └────────┬─────────────────┘ │                    │                     │
│           │ (direct Supabase)  │                    │ (direct Supabase)   │
└───────────┼───────────────────┼────────────────────┼─────────────────────┘
            │                   │                    │
            ▼                   ▼                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                          SUPABASE (PostgreSQL)                            │
│                                                                           │
│  predictions ─── intelligence_profile_analytics ─── deal_risk_scores      │
│  intelligence_profile_effectiveness    stakeholder_intelligence            │
│  explanation_analytics    action_item_dependencies                         │
│                                                                           │
│  VIEWS: project_statistics | team_workload | overdue_items                │
│         action_item_trends | sentiment_trends                             │
└───────────────────────────────────────────────────────────────────────────┘
            ▲                   ▲                    ▲
            │                   │                    │
┌───────────┼───────────────────┼────────────────────┼─────────────────────┐
│           │                   │                    │                      │
│  ┌────────┴─────────┐  ┌─────┴──────────┐  ┌─────┴──────────────────┐   │
│  │ analytics.js     │  │ reports.js     │  │ learning.js            │   │
│  │ /api/analytics/* │  │ /api/reports/* │  │ /api/learning/*        │   │
│  │                  │  │                │  │                        │   │
│  │ - dashboard      │  │ - meeting PDF  │  │ - feedback/override    │   │
│  │ - trends         │  │ - goals PDF    │  │ - patterns CRUD        │   │
│  │ - team-perf      │  │ - project PDF  │  │ - outcomes tracking    │   │
│  │ - ai-effective   │  │ - weekly PDF   │  │ - effectiveness report │   │
│  │ - record         │  │ - CSV exports  │  │ - insights             │   │
│  └──────────────────┘  └────────────────┘  └────────────────────────┘   │
│                                                                          │
│  ┌──────────────────┐  ┌────────────────┐  ┌────────────────────────┐   │
│  │ dashboard.js     │  │ intelligence.js│  │ Services:              │   │
│  │ /api/dashboard/* │  │ /api/intel/*   │  │ reportService.js       │   │
│  │                  │  │                │  │ FeedbackService.js     │   │
│  │ - projects       │  │ - morning brief│  │ OutcomeTracker.js      │   │
│  │ - action-items   │  │ - deal risk    │  │ PatternDetection.js    │   │
│  │ - team-workload  │  │ - stakeholder  │  │ LearningEngine.js      │   │
│  │ - overdue        │  │ - meeting prep │  │ ExplanationAnalytics.js│   │
│  │ - insights       │  │               │  │ ExplanationService.js  │   │
│  └──────────────────┘  └────────────────┘  └────────────────────────┘   │
│                                                                          │
│                          BACKEND (Express.js)                            │
└──────────────────────────────────────────────────────────────────────────┘

DATA FLOW:
  Frontend Analytics.jsx ──HTTP──▶ backend/routes/analytics.js ──SQL──▶ Supabase
  Frontend analytics/   ──direct Supabase client──▶ predictions table
  Frontend analyticsService.ts ──direct Supabase──▶ profile_analytics tables

EXTERNAL:
  dealProbability.ts ──▶ Logos Vision CRM (logosVisionSupabase client)
```

---

## 3. Feature Status Catalog

### 3A. Analytics Dashboard (Analytics.jsx + analytics.js)

| Feature | Status | Notes |
|---------|--------|-------|
| Overview tab — key metrics | ✅ Working | Meetings, tasks, action items, automations counts |
| Overview tab — time saved highlight | ✅ Working | Calculated from AI effectiveness data |
| Overview tab — task status bars | ✅ Working | Completed/in-progress/open/blocked |
| Overview tab — meeting sentiment | ✅ Working | Positive/neutral/negative emoji display |
| Overview tab — projects summary | ✅ Working | Total, active, completed, planning, deal value |
| Meetings tab — metrics cards | ✅ Working | Total, duration, avg duration, avg action items |
| Meetings tab — bar chart | ⚠️ Partial | Custom DIV-based bars, no real charting library. Tooltip works but axis labels minimal |
| Tasks tab — metrics + priority bars | ✅ Working | Total, completed, completion rate, priority distribution |
| AI tab — transcription/action/auto metrics | ✅ Working | Success rates, time saved breakdown |
| AI tab — automation performance | ✅ Working | Execution counts, success/fail, avg duration |
| AI tab — agent performance | ✅ Working | Execution counts, success rate, feedback rating |
| Team tab — performance table | ✅ Working | Per-member stats: tasks, completion rate, avg days |
| Period selector (7d/30d/90d/1y) | ⚠️ Partial | Selector exists but backend trends only use period for grouping — dashboard endpoint ignores period param, always uses 30d default unless custom dates passed |
| Export/download from analytics | ❌ Broken | No export button on Analytics page — Reports page is separate |
| Refresh button | ✅ Working | Calls fetchData() |

### 3B. Predictive Analytics (src/analytics/)

| Feature | Status | Notes |
|---------|--------|-------|
| Deal probability — rule engine | ✅ Working | Stage scores, activity, tasks, sentiment adjustments |
| Deal probability — Logos Vision CRM fetch | ⚠️ Partial | Queries `entomate_deal_id` column which may not exist in Logos Vision schema |
| Deal probability — local fallback | ✅ Working | Falls back to local `deals` table |
| Deal probability — prediction storage | ✅ Working | Stores to `predictions` table via Supabase |
| Deal probability — cached retrieval | ⚠️ Partial | Retrieves latest but no staleness check — comment says ">1 hour" but no TTL logic |
| Task ETA — rule engine | ✅ Working | Priority defaults, historical avg, workload adjustment |
| Task ETA — historical stats | ✅ Working | Queries completed tasks of same priority for avg days |
| Task ETA — batch compute | ✅ Working | Sequential batch (not parallel — potential perf issue) |
| Model registry | ✅ Working | Simple version tracking, both at baseline_v1 |
| PredictionBadge UI | ✅ Working | Tooltip with explanation, risk flags, model version |
| usePredictions hook | ✅ Working | Auto-load on mount, manual refresh/compute |

### 3C. Profile Effectiveness (analyticsService.ts)

| Feature | Status | Notes |
|---------|--------|-------|
| Track suggestion event | ✅ Working | Inserts into `intelligence_profile_analytics` |
| Track accepted/dismissed | ✅ Working | Updates record by ID |
| Track manual selection | ✅ Working | New insert with `was_manually_selected` |
| Track context assembled | ✅ Working | Updates sources count + token count |
| Track meeting completed | ✅ Working | Updates meeting metrics, triggers effectiveness refresh |
| Track feedback (rating) | ✅ Working | Updates user_rating, triggers effectiveness refresh |
| Effectiveness aggregation | ✅ Working | Full recalculation from raw records on each event |
| Output quality scoring | ✅ Working | Heuristic scoring based on summary length, action items, etc. |
| ProfileEffectivenessCard UI | ✅ Working | MetricBar with color thresholds, star ratings |
| Bulk effectiveness update | ✅ Working | Iterates all active profiles (sequential) |

### 3D. Dashboard APIs (dashboard.js)

| Feature | Status | Notes |
|---------|--------|-------|
| Project listing with stats | ✅ Working | Uses `project_statistics` view, supports search/sort/limit |
| Project detail | ✅ Working | Stats + action items + team + meeting summary |
| Action items with filtering | ✅ Working | Status/priority/assignee filters, Kanban grouping |
| Action item status update | ✅ Working | PATCH for drag-drop, auto-sets completed_at |
| Team workload | ✅ Working | Falls back to direct query if view missing |
| Overdue items | ✅ Working | Falls back to direct query if view missing |
| Dashboard insights | ✅ Working | Aggregated from project_statistics view |
| Project-based insights | ✅ Working | From projects + tasks tables with generated insight messages |
| Quick summary stats | ✅ Working | Counts for header badges |

### 3E. Reports (reports.js + reportService.js)

| Feature | Status | Notes |
|---------|--------|-------|
| Meeting recap PDF | ✅ Working | pdfkit with header, summary, key points, decisions, action items |
| Goals report PDF | ✅ Working | By type (company/team/individual), progress bars |
| Project report PDF | ✅ Working | Stats, team workload, action items by status |
| Weekly summary PDF | ✅ Working | Quick stats, meetings, overdue items |
| Meetings CSV export | ✅ Working | json2csv with proper field mapping |
| Action items CSV export | ✅ Working | Filterable by status and meeting |
| Goals CSV export | ✅ Working | Filterable by quarter and type |
| Available reports listing | ✅ Working | GET /api/reports/available |
| Scheduler status check | ✅ Working | Checks schedulerService + emailService |
| Manual trigger (weekly/overdue) | ✅ Working | POST endpoints for testing |
| Email meeting recap | ✅ Working | Sends via emailService |
| Reports page UI | ✅ Working | Download buttons for each report type |

### 3F. Learning System Analytics (learning.js + services)

| Feature | Status | Notes |
|---------|--------|-------|
| Override capture | ✅ Working | With validation, stores to agent_overrides |
| Should-prompt check | ✅ Working | User preference check per agent type |
| Feedback preference update | ✅ Working | PUT endpoint with validation |
| Recent overrides | ✅ Working | Paginated with agent type filter |
| Override statistics | ✅ Working | Aggregated by days window |
| Pattern CRUD | ✅ Working | List (filter by status/agent), approve, reject, deactivate |
| Pattern validation metrics | ✅ Working | Performance levels: excellent/good/moderate/poor/insufficient |
| Outcome tracking | ✅ Working | POST with override verification |
| Effectiveness report | ✅ Working | Via OutcomeTracker.getEffectivenessReport |
| Learning insights (dashboard widget) | ✅ Working | Active patterns, pending approvals, effectiveness, week-over-week |
| Learning report | ⚠️ Partial | Returns basic stats + "Phase 5 message" — full report TBD |
| Frontend learning components | ❌ Missing | LearningDashboard.jsx, PatternCard.jsx, PatternApprovalModal.jsx, FeedbackPrompt.jsx, EffectivenessReport.jsx, SearchAnalytics.jsx — all missing from filesystem |

### 3G. Explanation Analytics (ExplanationAnalytics.js)

| Feature | Status | Notes |
|---------|--------|-------|
| Event tracking (view/expand/override) | ✅ Working | Service methods implemented |
| Event storage | ⚠️ Partial | Migration exists in `docs/migrations/` but unclear if deployed |
| Frontend integration | 🔇 Unknown | No visible frontend consumption found |

### 3H. Database Views

| View | Status | Notes |
|------|--------|-------|
| project_statistics | ⚠️ Partial | In `docs/migrations/`, not in `supabase/migrations/` — may not be auto-deployed |
| team_workload | ⚠️ Partial | Same — backend has fallback if missing |
| overdue_items | ⚠️ Partial | Same — backend has fallback |
| action_item_trends | ⚠️ Partial | Same — used by dashboard insights route |
| sentiment_trends | ⚠️ Partial | Same — defined but no consumer found |

---

## 4. Issues Found

### 🔴 Critical

1. **Missing frontend learning components** — 6 components referenced in the exploration agent's initial findings (LearningDashboard.jsx, PatternCard.jsx, PatternApprovalModal.jsx, FeedbackPrompt.jsx, EffectivenessReport.jsx, SearchAnalytics.jsx) do not exist on disk. The entire learning analytics UI is backend-only — users cannot view patterns, approve/reject them, or see effectiveness reports.

2. **Dashboard views not in Supabase migrations folder** — `dashboard-views.sql` lives in `docs/migrations/` instead of `supabase/migrations/`. This means they won't auto-deploy with `supabase db push` or CI. The backend has fallback queries but performance will degrade at scale since they bypass the materialized views.

3. **Analytics route lacks authentication** — `backend/routes/analytics.js` does NOT use `authenticate` middleware (compare to `dashboard.js` line 12 which does). Any unauthenticated request can access all analytics data. This is a **security vulnerability**.

4. **Reports route lacks authentication** — `backend/routes/reports.js` also has no `authenticate` middleware. Anyone can generate PDFs and CSV exports of all meetings, action items, and goals.

5. **RLS policies too permissive** — `intelligence_profile_analytics` RLS allows ANY authenticated user to SELECT/INSERT/UPDATE all rows. There's no `user_id` column or user-scoping. One user can see all other users' analytics data. Same issue with `predictions` table (SELECT/INSERT for all authenticated users, no user_id column).

### 🟡 Medium

6. **Period selector doesn't work for dashboard endpoint** — The Analytics.jsx period selector sends `period` to trends but the main `/api/analytics/dashboard` endpoint uses `start_date`/`end_date` query params. The frontend passes `period` but never converts it to date range for the dashboard call, so it always gets the default 30-day window regardless of selection.

7. **No staleness check for cached predictions** — `usePredictions.ts:31` has a comment saying "if stale (>1 hour)" but the actual code only checks if a prediction exists at all (`if (!result)`). Predictions never refresh automatically after initial computation.

8. **Batch task ETA is sequential** — `computeTaskEtasBatch` processes tasks one-by-one in a for loop. With many tasks, this will be slow. Should use `Promise.all` with concurrency limit.

9. **`explanation_analytics` migration in docs/migrations/** — Same issue as dashboard views. Won't auto-deploy. The `ExplanationAnalytics.js` service may fail silently if the table doesn't exist.

10. **PredictionBadge injects style tag at module load** — Lines 290-298 create a `<style>` element and append it to `document.head` at import time. This is a side effect that breaks SSR, runs before React hydration, and can cause duplicate style tags if the module is hot-reloaded.

11. **Hardcoded tooltip colors in PredictionBadge** — Uses hardcoded `#1f2937`, `#f9fafb`, `#d1d5db` instead of CSS variables. Won't respect light/dark mode theming.

12. **Time saved calculation is a rough estimate** — `ai-effectiveness` endpoint uses `meetingsProcessed * 45 + automations.length * 5` minutes. This is a fixed heuristic, not measured. Should at least be configurable or disclosed as estimated.

13. **No date-range filtering on team-performance** — Frontend passes `period` but never sends `start_date`/`end_date`. The backend defaults to 30d regardless.

14. **Learning report endpoint explicitly says "Phase 5 will implement"** — `learning.js:449` returns a stub message. This is visible to API consumers.

15. **Dual Supabase client in learning.js** — `backend/routes/learning.js` creates its own Supabase client (line 18-21) instead of using the shared `config/supabase` import that every other route uses. Risk of inconsistent configuration.

16. **`deals` table may not exist** — `dealProbability.ts` falls back to a local `deals` table, but no migration creates this table. If Logos Vision isn't configured and `deals` doesn't exist, every deal probability call silently returns null.

### 🟢 Nice-to-Have

17. **No real charting library** — Analytics.jsx uses custom `<div>` bars for charts. Consider integrating Recharts, Chart.js, or similar for proper axes, legends, and interactions.

18. **No export button on Analytics page** — Users must navigate to Reports page to download data. Adding a "Download CSV" or "Export" option to each analytics tab would improve UX.

19. **Profile effectiveness recalculation is full-scan** — `updateProfileEffectiveness` fetches ALL records for a profile and recalculates from scratch on every event. At scale, this should be incremental.

20. **No loading/error states in Analytics tabs** — If individual tab data fails (e.g., team performance returns null), the tab silently shows nothing. Should show error state per tab.

21. **MetricCard color mapping is misleading** — `purple` maps to amber/tertiary colors, which is confusing for maintenance.

22. **No pagination on team performance** — Large teams will render all members at once.

23. **Dashboard views are not materialized** — They use `CREATE OR REPLACE VIEW` (not `MATERIALIZED VIEW`). For dashboards with many meetings/action items, these could be slow. Consider materializing with periodic refresh.

24. **Missing TypeScript types in Analytics.jsx** — The main analytics page is JSX not TSX. Dashboard data shapes are untyped (`useState(null)`).

25. **No data export for predictions** — Predictions are stored but there's no API to list/export them for analysis.

26. **Week-over-week calculation in learning insights is incorrect** — Computes "last 14 days" as the comparison period, but that includes the current 7 days. Should be days 8-14 vs days 1-7.

---

## 5. Dead Code & Cleanup

| Item | Location | Issue |
|------|----------|-------|
| `overdue_tasks` risk flag in formatRiskFlag | PredictionBadge.tsx:278 | Code references `overdue_tasks` but dealProbability produces `overdue_tasks` — matches, OK |
| `sentiment_trends` view | dashboard-views.sql:86 | Defined but no backend route or frontend consumer uses it |
| `usePredictions` default export | usePredictions.ts:185 | Exports `{ useDealProbability, useTaskEta }` as default — redundant with named exports |
| `PredictionBadge` default export | PredictionBadge.tsx:301 | Same pattern — default export of named exports object |
| `stale_deal` risk flag | PredictionBadge.tsx:282 | Defined in formatRiskFlag but never produced by dealProbability engine |

---

## 6. Revisal Plan

### Phase 1: Fix Critical Issues (Security + Missing Data)

1. **Add authentication middleware to analytics.js and reports.js**
   - Import `authenticate` from `../middleware/auth`
   - Add `router.use(authenticate)` at the top of both route files
   - Files: `backend/routes/analytics.js`, `backend/routes/reports.js`

2. **Fix RLS policies for user-scoped data**
   - Add `user_id` column to `intelligence_profile_analytics` and `predictions` tables
   - Update RLS policies to scope by `auth.uid()`
   - Update insert logic to include `req.user.id` / authenticated user
   - Files: new migration SQL, `src/intelligence/analyticsService.ts`, `src/analytics/dealProbability.ts`, `src/analytics/taskEta.ts`

3. **Move dashboard-views.sql and explanation_analytics.sql to supabase/migrations/**
   - Rename with proper timestamp prefix
   - Ensure they run in correct order
   - Files: `docs/migrations/dashboard-views.sql` -> `supabase/migrations/20260403000001_dashboard_views.sql`

4. **Fix dual Supabase client in learning.js**
   - Replace inline `createClient` with shared `require('../config/supabase')` import
   - File: `backend/routes/learning.js`

### Phase 2: Wire Up Partial/Stub Functionality

5. **Fix period selector in Analytics.jsx**
   - Convert period value (7d/30d/90d/1y) to `start_date`/`end_date` params
   - Pass to all API calls, not just trends
   - File: `frontend/src/pages/Analytics.jsx`

6. **Add staleness check to usePredictions**
   - Compare `created_at` of cached prediction to current time
   - Recompute if older than configurable TTL (default 1 hour)
   - File: `src/hooks/usePredictions.ts`

7. **Create missing learning frontend components**
   - `LearningDashboard.jsx` — main view for patterns + effectiveness
   - `PatternCard.jsx` — displays individual learning pattern with approve/reject actions
   - `PatternApprovalModal.jsx` — modal for reviewing and customizing a pattern before approval
   - `FeedbackPrompt.jsx` — inline prompt for capturing feedback after AI suggestions
   - `EffectivenessReport.jsx` — visual report of pattern performance over time
   - Location: `frontend/src/components/intelligence/`
   - Wire to existing `backend/routes/learning.js` endpoints

8. **Complete learning report endpoint**
   - Remove "Phase 5 message" stub
   - Implement full report using OutcomeTracker + FeedbackService data
   - File: `backend/routes/learning.js:438-477`

9. **Create `deals` table migration or remove dead path**
   - Either add migration for local `deals` table, or remove the fallback query in `dealProbability.ts`
   - Check if Logos Vision `projects` table has `entomate_deal_id` column

### Phase 3: Refactor and Improve

10. **Fix PredictionBadge style injection**
    - Replace `document.head.appendChild` with CSS-in-JS or a proper stylesheet
    - Use CSS variables instead of hardcoded colors
    - File: `src/components/PredictionBadge.tsx`

11. **Parallelize batch task ETA**
    - Replace sequential for-loop with `Promise.allSettled` with concurrency limit (e.g., 5)
    - File: `src/analytics/taskEta.ts:235-250`

12. **Fix week-over-week calculation**
    - Change comparison to proper 7-day windows (days 1-7 vs days 8-14)
    - File: `backend/routes/learning.js:674`

13. **Add error states per Analytics tab**
    - Track error state per tab, show error component if data fails
    - File: `frontend/src/pages/Analytics.jsx`

14. **Make effectiveness recalculation incremental**
    - Instead of full-scan, use SQL aggregates or maintain running counters
    - File: `src/intelligence/analyticsService.ts:171-211`

### Phase 4: New Features and Polish

15. **Integrate charting library**
    - Add Recharts or Chart.js for proper time-series charts, pie charts, etc.
    - Replace custom `<div>` bar charts in Analytics.jsx
    - Add trend lines, tooltips, legends

16. **Add export buttons to Analytics page**
    - "Export CSV" on each tab (overview, meetings, tasks, AI, team)
    - Reuse existing backend CSV endpoints or add new analytics-specific ones

17. **Add predictions API**
    - `GET /api/analytics/predictions` — list stored predictions with filters
    - `GET /api/analytics/predictions/:entityId` — latest prediction for entity
    - Wire to frontend for prediction history view

18. **Convert Analytics.jsx to TypeScript**
    - Create types for dashboard, trends, teamPerformance, aiEffectiveness response shapes
    - Rename to Analytics.tsx

19. **Materialize dashboard views**
    - Convert to `MATERIALIZED VIEW` with `REFRESH MATERIALIZED VIEW CONCURRENTLY`
    - Add cron or trigger to refresh periodically

20. **Wire sentiment_trends view**
    - Create backend endpoint for sentiment trends over time
    - Add sentiment trend chart to Analytics meetings tab

---

## 7. Agent Prompt for Revisal

```markdown
# Entomate Analytics Revisal — Implementation Prompt

You are implementing a phased revisal of the Analytics section of the Entomate
application. The project uses React (JSX frontend in frontend/src/, TypeScript
modules in src/), Express.js backend, Supabase (PostgreSQL), and pdfkit/json2csv
for reports.

## Current State
- Analytics dashboard (frontend/src/pages/Analytics.jsx) works but has no auth,
  no period filtering on main dashboard, and no export.
- Predictive analytics (src/analytics/) has working deal probability and task
  ETA but cached predictions never expire and batch compute is sequential.
- Profile effectiveness tracking (src/intelligence/analyticsService.ts) works
  end-to-end but recalculates from scratch on every event.
- Backend routes at backend/routes/analytics.js and backend/routes/reports.js
  LACK authentication middleware — this is a security vulnerability.
- RLS policies on predictions and intelligence_profile_analytics are too
  permissive (any authenticated user sees all data, no user_id scoping).
- Dashboard views (docs/migrations/dashboard-views.sql) are not in the
  supabase/migrations/ folder so they don't auto-deploy.
- 6 learning frontend components (LearningDashboard, PatternCard,
  PatternApprovalModal, FeedbackPrompt, EffectivenessReport, SearchAnalytics)
  are referenced in design docs but DON'T EXIST on disk. The learning system
  backend (backend/routes/learning.js) is fully implemented with no UI.
- PredictionBadge.tsx injects a <style> tag via document.head at import time
  and uses hardcoded colors instead of CSS variables.

## Phase 1: Security Fixes (DO FIRST)

### 1a. Add auth to analytics.js
File: backend/routes/analytics.js
- Add: const { authenticate } = require('../middleware/auth');
- Add: router.use(authenticate); after line 6
- Pattern: identical to backend/routes/dashboard.js line 12

### 1b. Add auth to reports.js
File: backend/routes/reports.js
- Same pattern as above

### 1c. Fix RLS policies
Create: supabase/migrations/20260404000001_fix_analytics_rls.sql
- Add user_id column to predictions table (nullable, default auth.uid())
- Add user_id column to intelligence_profile_analytics
- Update RLS policies to: USING (user_id = auth.uid())
- Update analyticsService.ts to include user_id in inserts
- Update dealProbability.ts and taskEta.ts storePrediction to include user_id

### 1d. Move migrations
- Copy docs/migrations/dashboard-views.sql to
  supabase/migrations/20260404000002_dashboard_views.sql
- Copy docs/migrations/002_explanation_analytics.sql to
  supabase/migrations/20260404000003_explanation_analytics.sql

### 1e. Fix dual Supabase client
File: backend/routes/learning.js
- Replace lines 17-21 (createClient) with:
  const { supabase } = require('../config/supabase');
- Remove @supabase/supabase-js import

## Phase 2: Wire Stubs

### 2a. Fix period selector
File: frontend/src/pages/Analytics.jsx
- In fetchData(), convert period to start_date/end_date:
  const periodMap = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
  const days = periodMap[period] || 30;
  const start_date = new Date(Date.now() - days * 86400000).toISOString();
  const end_date = new Date().toISOString();
- Pass start_date and end_date to dashboard and team-performance API calls

### 2b. Add prediction staleness
File: src/hooks/usePredictions.ts
- In refresh(), after fetching cached prediction, check:
  const createdAt = new Date(result.created_at || 0);
  const isStale = Date.now() - createdAt.getTime() > 3600000;
  if (!result || isStale) { result = await compute...(); }
- Note: requires predictions table to include created_at in response

### 2c. Build learning UI components
Create 6 files in frontend/src/components/intelligence/:
- LearningDashboard.jsx — fetches /api/learning/insights, /api/learning/patterns
  Displays: active patterns count, pending approvals, effectiveness gauge,
  week-over-week trend. Lists patterns with PatternCard.
- PatternCard.jsx — single pattern card showing type, confidence, status,
  agent_type. Buttons: Approve (-> /api/learning/patterns/:id/approve),
  Reject, Deactivate.
- PatternApprovalModal.jsx — modal with customization textarea, confirm button
- FeedbackPrompt.jsx — checks /api/learning/feedback/should-prompt, shows
  inline rating stars + optional text. Posts to /api/learning/feedback/override
- EffectivenessReport.jsx — fetches /api/learning/effectiveness-report,
  shows success rate, pattern performance table, outcome breakdown
- SearchAnalytics.jsx — placeholder for search query analytics

### 2d. Complete learning report
File: backend/routes/learning.js, /api/learning/report endpoint
- Remove "Phase 5 message"
- Call OutcomeTracker.getEffectivenessReport(userId, days)
- Return full report data

## Phase 3: Refactor

### 3a. Fix PredictionBadge
File: src/components/PredictionBadge.tsx
- Remove lines 290-299 (style tag injection)
- Add CSS keyframes to a proper stylesheet or use CSS module
- Replace hardcoded colors (#1f2937 etc.) with CSS variables

### 3b. Parallelize batch ETA
File: src/analytics/taskEta.ts
- Replace sequential for-loop in computeTaskEtasBatch with:
  const results = await Promise.allSettled(
    taskIds.map(id => computeTaskEta(id))
  );

### 3c. Fix week-over-week
File: backend/routes/learning.js ~line 674
- thisWeek = getOverrideStats(userId, 7)
- Need separate call for ONLY days 8-14, not "last 14 days"

## Testing Checklist
- [ ] Unauthenticated requests to /api/analytics/* return 401
- [ ] Unauthenticated requests to /api/reports/* return 401
- [ ] Period selector changes data range in all Analytics tabs
- [ ] Cached predictions refresh after 1 hour
- [ ] Learning patterns page shows patterns from /api/learning/patterns
- [ ] Approve/reject/deactivate pattern actions work from UI
- [ ] Dashboard views exist in Supabase after migration
- [ ] PredictionBadge renders correctly in both light and dark mode
```

---

## 8. Summary

The Analytics section is **architecturally sound** with a well-separated concern model across frontend, backend routes, services, and database. The predictive analytics engine (deal probability + task ETA) is thoughtfully designed with a model registry for future versioning.

**Biggest risks:**
1. Two route files completely lack authentication — must fix before any production exposure
2. RLS policies allow cross-user data access
3. The entire learning analytics UI is backend-only with no frontend

**Biggest strengths:**
1. Clean service layer separation (reportService, FeedbackService, OutcomeTracker, PatternDetection)
2. Comprehensive API coverage — every feature has working backend endpoints
3. Graceful fallbacks when views don't exist
4. Well-structured database schema with proper constraints and indexes
