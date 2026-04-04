# Goals & OKRs Section Audit

**Date:** 2026-04-01
**Section:** Goals & OKRs
**Status:** Functional with significant gaps

---

## 1. File Inventory

| File | Lines | Purpose |
|------|-------|---------|
| `frontend/src/pages/Goals.jsx` | 819 | Main Goals page — list, hierarchy, detail panel, create modal |
| `backend/routes/goals.js` | 499 | REST API — CRUD, hierarchy, stats, key results, task linking |
| `backend/schemas/goals.js` | 73 | Zod validation schemas for all endpoints |
| `docs/migrations/goals-schema.sql` | 42 | PostgreSQL table schema + indexes + RLS + seed data |
| `backend/services/reportService.js` | 433 | PDF/CSV report generation (goals section: lines 115-349) |
| `backend/routes/reports.js` | 487 | Report endpoints (goals PDF: L62-106, goals CSV: L295-325) |
| `backend/services/calendarService.js` | ~100 | Goal-to-calendar sync (createEventFromGoal, buildGoalDescription) |
| `backend/services/schedulerService.js` | ~5 | References goals in weekly summary |
| `frontend/src/services/api.js` | ~50 | Goals report download URLs + calendar sync methods |
| `frontend/src/App.jsx` | 2 | Lazy-loaded route at `/goals` |
| `frontend/src/components/Layout.jsx` | 2 | Sidebar nav entry under "Work" section |
| `frontend/src/components/CommandPalette.jsx` | 1 | "Go to Goals" quick navigation |
| `src/intelligence/templates/strategicPlanning.ts` | 4 | Strategic goals extraction in AI templates |

**Total: ~2,500 lines of Goals-specific code across 13 files**

---

## 2. Architecture Map

```
Frontend                          Backend                         Database
========                          =======                         ========

Goals.jsx ----GET /goals--------> routes/goals.js ---SELECT-----> goals table
  |           GET /hierarchy         |                              |
  |           GET /stats/summary     |                              |- id (UUID PK)
  |           POST /goals            |                              |- title, description
  |           DELETE /goals/:id      |                              |- goal_type (company|team|individual)
  |           POST /:id/key-results  |                              |- parent_goal_id (FK self-ref)
  |           PUT /:id/key-results   |                              |- owner_id, team_id
  |                                  |                              |- quarter, status, progress
  |                                  |                              |- key_results (JSONB)
  |                                  |                              |- related_tasks (UUID[])
  |                                  |                              |- created_at, updated_at
  |                                  |
  |                                  +--schemas/goals.js (Zod)
  |
  +-- GoalCard (recursive)
  +-- GoalDetailPanel
  |     +-- Key Results list
  |     +-- Add KR form
  |     +-- Delete goal
  +-- CreateGoalModal
  |     +-- Title, description, type, quarter, parent
  +-- Stats overview (4 cards)
  +-- View toggle (hierarchy / list)

Integrations:
  reportService.js ------> /reports/goals/pdf, /reports/goals/csv
  calendarService.js -----> createEventFromGoal() (Google Calendar)
  schedulerService.js ----> weekly summary includes active goals
  strategicPlanning.ts ---> AI intelligence template references goals
```

**State Management:** Local React `useState` — no global store.
**Data Flow:** Direct API calls via axios (`api.get/post/put/delete`). Three parallel fetches on mount (goals, hierarchy, stats).

---

## 3. Feature Status Catalog

| Feature | Status | Notes |
|---------|--------|-------|
| Goal listing (flat) | ✅ Working | List view renders all goals |
| Goal listing (hierarchy) | ✅ Working | Company > Team > Individual with expand/collapse |
| Goal creation | ✅ Working | Modal with title, description, type, quarter, parent |
| Goal deletion | ✅ Working | With confirmation dialog |
| Goal detail panel | ✅ Working | Shows title, description, progress, KRs, metadata |
| Key results display | ✅ Working | Shows title, progress bar, current/target |
| Key results inline edit | ✅ Working | Click edit icon, change current value, blur to save |
| Key results add | ✅ Working | Title + target form in detail panel |
| Stats overview | ✅ Working | Total, avg progress, on-track, at-risk cards |
| View mode toggle | ✅ Working | Hierarchy vs. list toggle |
| Empty state | ✅ Working | Shows CTA when no goals exist |
| Loading state | ✅ Working | Spinner on initial load |
| Error state | ✅ Working | ErrorState component with retry |
| Progress color coding | ✅ Working | Green >=70%, amber >=40%, red <40% |
| Status badges | ✅ Working | Color-coded VCBadge per status |
| Goal type icons | ✅ Working | Building2, Users, User per type |
| Backend CRUD | ✅ Working | Full REST API with validation |
| Backend hierarchy | ✅ Working | Builds 3-tier hierarchy server-side |
| Backend stats | ✅ Working | Aggregated stats with type/status breakdown |
| Backend key results | ✅ Working | Add + update with auto-progress recalculation |
| Backend task linking | ✅ Working | API endpoint wired, stores task UUIDs |
| Zod validation | ✅ Working | All endpoints validated |
| Missing table fallback | ✅ Working | Graceful empty responses if table doesn't exist |
| PDF report generation | ✅ Working | Goals grouped by type, with KRs and progress |
| CSV export | ✅ Working | Full goals export with filters |
| Route + nav + command palette | ✅ Working | `/goals` route, sidebar, command palette |
| **Goal editing (title/desc/status)** | ❌ Missing | PUT endpoint exists but no edit UI |
| **Status transitions** | ❌ Missing | No UI to change planning→active→completed |
| **Filter/search UI** | ❌ Missing | Backend supports filters, frontend doesn't expose them |
| **Quarter filter** | ❌ Missing | Backend supports `?quarter=`, no UI control |
| **Owner/team assignment** | ❌ Missing | Schema + backend support it, no UI |
| **Start/target date fields** | ❌ Missing | Schema has columns, create modal omits them |
| **Task linking UI** | ❌ Missing | Backend endpoint works, no frontend integration |
| **Calendar sync from Goals** | ❌ Missing | calendarService has `createEventFromGoal`, no UI trigger |
| **Report download from Goals** | ❌ Missing | Report endpoints exist, no buttons on Goals page |
| **Key result deletion** | ❌ Missing | Can add/edit KRs but cannot remove one |
| **Goal reordering/priority** | ❌ Missing | No ordering beyond created_at |

---

## 4. Issues Found

### 🔴 Critical (3)

**C1. `calendar_event_id` column missing from schema**
- `calendarService.js:348` writes `calendar_event_id` to the goals table
- `goals-schema.sql` does not define this column
- Calendar sync will silently fail or throw on UPDATE
- **Fix:** Add `calendar_event_id TEXT` column to migration

**C2. RLS policy is wide open**
- `goals-schema.sql:35`: `CREATE POLICY "Allow all access to goals" ON goals FOR ALL USING (true)`
- Any authenticated (or anonymous) user can read/modify/delete any goal
- No tenant isolation, no ownership checks
- **Fix:** Implement proper RLS policies tied to `owner_id` or org membership

**C3. Broken CSS variable in form validation**
- `Goals.jsx:701` and `:741`: `style={{ color: 'var(--c)', ... }}`
- `var(--c)` is not a valid CSS variable in the design system — error text will be invisible or inherit wrong color
- **Fix:** Change to `var(--semantic-error)` or `var(--accent-primary)`

### 🟡 Medium (10)

**M1. No goal edit UI**
- PUT `/api/goals/:id` is fully implemented on the backend
- Frontend has no way to edit title, description, type, or any other field
- Users must delete and recreate goals to make changes

**M2. No status transition UI**
- Goals start as `planning` but there's no button/dropdown to move through `active → completed → abandoned`
- This is a core OKR workflow gap

**M3. No date fields in create modal**
- `start_date` and `target_date` exist in schema and backend
- Create modal only captures title, description, type, quarter, parent
- Calendar sync requires `target_date` to work

**M4. Key result progress bar always crimson**
- `Goals.jsx:559`: `<VCProgress value={...} color="crimson" />` is hardcoded
- Should use dynamic color like the goal-level progress (mint/amber/crimson based on %)

**M5. Duplicate `getProgressBarStyle` function**
- Defined at `Goals.jsx:59-63` (parent component) and `:477-481` (GoalDetailPanel)
- Neither is actually used — both components use `VCProgress` with inline color logic instead
- Dead code

**M6. `newKRTarget` sent as string**
- `Goals.jsx:453`: `target: newKRTarget` — state is string from input, not cast to Number
- Backend Zod schema expects `z.number()` — will fail validation
- **Fix:** Send `target: Number(newKRTarget)`

**M7. No loading/error feedback for mutations**
- Delete, add KR, and update KR operations have no user-visible loading states or toast/error feedback
- Operations fail silently with only `console.error`

**M8. No filter/search UI**
- Backend supports filtering by `type`, `status`, `quarter`, `owner_id`, `team_id`
- Frontend fetches all goals unfiltered — no filter controls exist

**M9. No `updated_at` database trigger**
- Backend manually sets `updated_at` in code (`new Date().toISOString()`)
- No `BEFORE UPDATE` trigger on the table — direct Supabase dashboard edits won't update timestamp
- Minor but inconsistent with typical Supabase patterns

**M10. No owner/team assignment in create flow**
- Backend auto-assigns from `req.user.id` / `req.user.teamId`
- But there's no UI to assign a goal to a different team member or team
- Owner display is completely absent from the UI

### 🟢 Nice-to-Have (8)

**N1. No report/export buttons on Goals page** — PDF and CSV endpoints exist but are only accessible via Reports page

**N2. No calendar sync button** — `calendarService.createEventFromGoal()` exists but no UI to trigger it from Goals

**N3. No task linking UI** — Backend has `POST /goals/:id/link-task` but no way to link tasks from the frontend

**N4. Key result IDs use `kr_${Date.now()}`** — Timestamp-based, could collide with rapid creation; should use crypto.randomUUID()

**N5. No pagination** — All goals fetched at once; will degrade at scale

**N6. No keyboard navigation** — Goal cards and detail panel are mouse-only

**N7. Hierarchy limited to 3 tiers** — Backend hardcodes company → team → individual; no deeper nesting or arbitrary hierarchy

**N8. No goal progress history** — No timeline or changelog of progress updates; only current snapshot

---

## 5. Dead Code / Unused References

| Item | Location | Issue |
|------|----------|-------|
| `getProgressBarStyle()` | `Goals.jsx:59-63` | Defined but never called — VCProgress used instead |
| `getProgressBarStyle()` | `Goals.jsx:477-481` | Same duplicate, also unused |
| `Edit2` import | `Goals.jsx:6` | Used only in KR edit — fine, but `BarChart3` is also imported for empty state |
| `Circle` import | `Goals.jsx:5` | Imported but never used |

---

## 6. Revisal Plan

### Phase 1: Fix Critical Issues (1-2 hours)

1. **Fix `calendar_event_id` missing column**
   - Add `calendar_event_id TEXT` to `goals-schema.sql`
   - Create a new migration file

2. **Fix broken CSS variable**
   - Replace `var(--c)` with `var(--semantic-error)` at lines 701 and 741

3. **Fix `newKRTarget` type coercion**
   - Send `Number(newKRTarget)` in addKeyResult

4. **Remove dead code**
   - Delete both `getProgressBarStyle` functions
   - Remove unused `Circle` import

### Phase 2: Wire Up Missing Core Functionality (3-4 hours)

5. **Add goal edit modal/inline editing**
   - Edit button in GoalDetailPanel
   - Editable fields: title, description, goal_type, quarter, status, start_date, target_date
   - Wire to existing PUT endpoint

6. **Add status transition controls**
   - Dropdown or button group in GoalDetailPanel: planning → active → completed / abandoned
   - Update via PUT endpoint

7. **Add date fields to create modal**
   - Start date + target date pickers
   - Wire to existing backend fields

8. **Fix KR progress bar color**
   - Dynamic color: mint >=70%, amber >=40%, crimson <40%

9. **Add user feedback for mutations**
   - Toast notifications for success/error on delete, add KR, update KR, create goal
   - Loading spinners on mutation buttons

10. **Add key result deletion**
    - Delete button per KR in detail panel
    - Filter out from JSONB array, recalculate progress

### Phase 3: Enhance with Filters and Integration (2-3 hours)

11. **Add filter bar**
    - Quarter dropdown, type pills, status pills
    - Pass query params to API calls
    - Refetch on filter change

12. **Add owner/team display and assignment**
    - Show owner avatar/name on goal cards
    - Team assignment dropdown in edit modal

13. **Add report download buttons**
    - "Export PDF" and "Export CSV" buttons in page header
    - Use existing `reportsApi.downloadGoalsPDF/CSV`

14. **Add calendar sync button**
    - "Sync to Calendar" action in GoalDetailPanel
    - Use existing `calendarApi.syncGoal`

### Phase 4: Security and Polish (2-3 hours)

15. **Implement proper RLS policies**
    - Replace `USING (true)` with ownership/org-based policies
    - Match pattern used by other Entomate tables

16. **Add `updated_at` trigger**
    - `BEFORE UPDATE` trigger to auto-set timestamp

17. **Add task linking UI**
    - Task search/select in GoalDetailPanel
    - Display linked tasks with status

18. **Pagination and performance**
    - Paginate goals list (or virtual scroll)
    - Memoize GoalCard components

---

## 7. Agent Prompt for Revisal Implementation

```
You are implementing the Goals & OKRs revisal for the Entomate project.

## Project Context
- React 19 + Vite frontend at f:\entomate\frontend\
- Express + Supabase backend at f:\entomate\backend\
- UI uses custom VC component system (VCButton, VCBadge, VCProgress) + Lucide icons
- Styling via CSS custom properties (--text-primary, --bg-elevated, --accent-primary, etc.)
- No global state — local React useState

## Files to Modify

### Phase 1 — Critical Fixes

1. **f:\entomate\docs\migrations\goals-schema.sql**
   - Add column: `calendar_event_id TEXT` after `related_tasks`
   - Create new migration file for this ALTER TABLE

2. **f:\entomate\frontend\src\pages\Goals.jsx**
   - Line 701, 741: Replace `var(--c)` with `var(--semantic-error)`
   - Line 453: Change `target: newKRTarget` to `target: Number(newKRTarget)`
   - Delete `getProgressBarStyle` at lines 59-63 and 477-481 (dead code)
   - Remove `Circle` from import on line 5 (unused)

### Phase 2 — Wire Core Features

3. **f:\entomate\frontend\src\pages\Goals.jsx** — Add to GoalDetailPanel:
   - Edit button that opens inline edit or modal for title, description, status, quarter, dates
   - Status transition dropdown (planning / active / completed / abandoned)
   - Wire edits to `api.put('/goals/${goal.id}', updates)` — endpoint exists
   - Add toast feedback for all mutations (use existing toast/notification system if available)
   - Fix KR progress bar: change `color="crimson"` at line 559 to dynamic color logic
   - Add KR delete functionality: filter from array, PUT updated key_results + recalculated progress
   - Add start_date and target_date fields to CreateGoalModal

### Phase 3 — Filters and Integration

4. **f:\entomate\frontend\src\pages\Goals.jsx** — Add filter bar:
   - Quarter dropdown using `getQuarterOptions()`
   - Goal type pills (All / Company / Team / Individual)
   - Status pills (All / Planning / Active / Completed / Abandoned)
   - Pass as query params: `api.get('/goals', { params: { type, status, quarter } })`
   - Also pass quarter to hierarchy and stats endpoints

5. **f:\entomate\frontend\src\pages\Goals.jsx** — Add header buttons:
   - "Export PDF" → `window.open(reportsApi.downloadGoalsPDF(currentQuarter))`
   - "Export CSV" → `window.open(reportsApi.downloadGoalsCSV({ quarter: currentQuarter }))`
   - "Sync to Calendar" in GoalDetailPanel → `calendarApi.syncGoal(goal.id, calendarId)`
   - Import `reportsApi` and `calendarApi` from `../services/api`

### Phase 4 — Security

6. **f:\entomate\docs\migrations\goals-schema.sql** + new migration:
   - Replace `USING (true)` RLS policy with proper ownership checks
   - Add `updated_at` trigger function

## Backend Endpoints Already Working (do NOT modify unless fixing bugs):
- GET    /api/goals              — list with filters
- GET    /api/goals/hierarchy    — hierarchical view
- GET    /api/goals/stats/summary — aggregated stats
- POST   /api/goals              — create
- GET    /api/goals/:id          — detail with children + tasks
- PUT    /api/goals/:id          — update any field
- DELETE /api/goals/:id          — delete
- POST   /api/goals/:id/key-results     — add KR
- PUT    /api/goals/:id/key-results/:krId — update KR
- POST   /api/goals/:id/link-task        — link task

## Style Patterns
- Use VC components: VCButton, VCBadge, VCProgress
- CSS variables: var(--text-primary), var(--text-secondary), var(--text-tertiary),
  var(--bg-elevated), var(--accent-primary), var(--accent-secondary), var(--accent-tertiary)
- Font: var(--font-display) for headings, var(--font-mono) for metadata
- Border color: rgba(248,240,242,.08)
- Card class: "vc" (applies card styling)
- Input class: "input" (applies input styling)
```

---

## 8. Summary

The Goals section has a **solid backend** (full CRUD, hierarchy, stats, key results, task linking, report generation, calendar sync) but a **feature-sparse frontend** that only exposes about 60% of the backend's capabilities. The three critical issues (missing schema column, open RLS, broken CSS variable) should be fixed immediately. The biggest UX gap is the inability to edit goals after creation — users can only delete and recreate. Adding edit, status transitions, filters, and date fields would bring this section to production-ready.
