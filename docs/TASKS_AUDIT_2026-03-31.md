# Tasks Section Audit — Entomate

**Date:** 2026-03-31
**Auditor:** Claude Opus 4.6
**Scope:** All files related to the Tasks module — frontend, backend, services, agents, analytics, schema, tests

---

## 1. File Inventory

| File | Lines | Role |
|------|-------|------|
| `frontend/src/pages/Tasks.jsx` | 507 | Main Tasks page (list, create, filter, complete, delete) |
| `frontend/src/components/intelligence/QuickTaskModal.jsx` | 103 | Quick-create modal from Intelligence Dashboard |
| `frontend/src/components/KanbanBoard.jsx` | ~180 | Kanban board view (used in Project Dashboard, not Tasks page) |
| `frontend/src/components/intelligence/AgentRecommendationPanel.jsx` | ~150 | AI recommendation UI for task creation |
| `frontend/src/components/explainability/ExplanationModal.jsx` | ~100 | AI decision explainability modal |
| `frontend/src/services/api.js` (lines 301-331) | 30 | `tasksApi` client — 10 endpoints |
| `backend/routes/tasks.js` | 473 | REST API — 10 routes (CRUD + complete/reopen/assign/bulk) |
| `backend/schemas/tasks.js` | 90 | Zod validation schemas for all endpoints |
| `src/agents/actions/assignTask.ts` | 339 | Agent action: auto-assign tasks by strategy |
| `src/agents/templates/taskAutoAssigner.ts` | 67 | Agent template: auto-assign unassigned/overdue tasks |
| `src/agents/triggers/taskOverdue.ts` | 157 | Trigger: detect overdue tasks |
| `src/analytics/taskEta.ts` | 250 | Predictive model: task completion ETA |
| `src/analytics/types.ts` | 90 | Shared types for predictions |
| `tests/analytics/taskEta.test.ts` | 259 | Unit tests for ETA prediction |
| `docs/migrations/schema.sql` (tasks table) | ~18 | Tasks table DDL |

**Total primary LOC:** ~2,813

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND                                                       │
│                                                                 │
│  ┌──────────────────────┐    ┌────────────────────────────┐     │
│  │  Tasks.jsx (page)    │    │  KanbanBoard.jsx           │     │
│  │  - Task list view    │    │  - Drag-drop columns       │     │
│  │  - Create form       │    │  - Used in ProjectDashboard │     │
│  │  - Filter/search     │    │  - NOT linked from Tasks   │     │
│  │  - Complete/delete   │    └─────────────┬──────────────┘     │
│  │  - AI recs panel     │                  │                    │
│  └──────┬───────────────┘                  │                    │
│         │                                  │                    │
│  ┌──────┴───────────────┐   ┌──────────────┴─────────┐         │
│  │ AgentRecommendation  │   │  QuickTaskModal.jsx    │         │
│  │ Panel.jsx            │   │  (from Intelligence)   │         │
│  │ + ExplanationModal   │   └────────────────────────┘         │
│  └──────────────────────┘                                       │
│         │                                                       │
│  ┌──────┴───────────────┐                                       │
│  │  tasksApi (api.js)   │                                       │
│  │  10 client methods   │                                       │
│  └──────────┬───────────┘                                       │
└─────────────┼───────────────────────────────────────────────────┘
              │ HTTP
┌─────────────┼───────────────────────────────────────────────────┐
│  BACKEND    │                                                   │
│  ┌──────────┴───────────┐                                       │
│  │  routes/tasks.js     │                                       │
│  │  10 REST endpoints   │                                       │
│  │  + Zod validation    │                                       │
│  └──────────┬───────────┘                                       │
│             │                                                   │
│  ┌──────────┴───────────┐    ┌───────────────────────┐          │
│  │  Supabase (tasks)    │    │  /api/agents/recs     │          │
│  │  - tasks table       │    │  ❌ ENDPOINT MISSING  │          │
│  │  - action_items      │    └───────────────────────┘          │
│  └──────────────────────┘                                       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  AGENT / ANALYTICS LAYER (TypeScript, not wired to backend)     │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │ assignTask.ts    │  │ taskOverdue.ts   │  │ taskEta.ts   │  │
│  │ (agent action)   │  │ (trigger)        │  │ (analytics)  │  │
│  │ 4 strategies     │  │ finds overdue    │  │ ETA predict  │  │
│  └──────────────────┘  └──────────────────┘  └──────────────┘  │
│         │                       │                    │          │
│         └───────────────────────┴────────────────────┘          │
│                   Uses `assignee_id` column                     │
│                   ⚠️ DB schema uses `assigned_to`               │
└─────────────────────────────────────────────────────────────────┘

DATABASE SCHEMA (tasks table):
┌───────────────────────────────────────────────────────┐
│  tasks                                                │
│  ─────                                                │
│  id              UUID PK                              │
│  project_id      UUID FK → projects                   │
│  parent_task_id  UUID FK → tasks (self-ref)           │
│  title           VARCHAR(255) NOT NULL                │
│  description     TEXT                                 │
│  assigned_to     UUID FK → users    ← DB column name  │
│  status          VARCHAR(20) DEFAULT 'open'           │
│  priority        VARCHAR(20) DEFAULT 'medium'         │
│  due_date        DATE                                 │
│  start_date      DATE                                 │
│  crm_task_id     VARCHAR(256)                         │
│  tags            JSONB DEFAULT '[]'                   │
│  custom_fields   JSONB DEFAULT '{}'                   │
│  created_at      TIMESTAMPTZ                          │
│  updated_at      TIMESTAMPTZ                          │
│  completed_at    TIMESTAMPTZ                          │
└───────────────────────────────────────────────────────┘
```

---

## 3. Feature Status Catalog

| Feature | Status | Notes |
|---------|--------|-------|
| **Task CRUD (Create/Read/Update/Delete)** | ✅ Working | Backend fully wired. Frontend has create + delete. No inline edit UI. |
| **Task List View** | ✅ Working | Displays title, priority badge, status badge, due date, overdue indicator |
| **Task Status Filters** | ⚠️ Partial | Only `all`, `open`, `in_progress`, `done` shown. Missing `review` and `blocked` from filter buttons — both are valid DB statuses |
| **Task Search** | ✅ Working | Client-side title search on loaded tasks |
| **Task Completion Toggle** | ✅ Working | Click circle to complete, click again to reopen |
| **Task Delete** | ✅ Working | With confirmation dialog |
| **Task Create Form** | ⚠️ Partial | Only title, priority, dueDate fields. Missing: description, tags, assignee, project, start date, parent task |
| **AI Recommendations Panel** | ❌ Broken | Calls `POST /api/agents/recommendations` — **endpoint does not exist** on backend. Will always 404 silently. |
| **AI Learning Feedback** | ⚠️ Partial | Calls `POST /api/learning/feedback` — route exists in `routes/learning.js` but panel never renders because recommendations never load |
| **Explanation Modal** | 🔇 Stub | Component exists and is imported but never triggers because AI recs never load |
| **Task Wizard Steps** | ⚠️ Cosmetic | GuideCard shows 3 steps but logic is simplistic: step 0 on open form, step 1 after create (immediately overwritten by loadTasks → step 2), step 2 when tasks exist. Steps 1 is unreachable. |
| **Task Update (inline edit)** | ❌ Missing | `tasksApi.update()` exists, backend supports it, but no UI to edit task title/description/status/priority/assignee |
| **Task Assignment** | ❌ Missing | `tasksApi.assign()` exists, backend supports it, no UI to assign tasks |
| **Bulk Operations** | ❌ Missing | `tasksApi.bulkCreate()` and `bulkUpdateStatus()` exist, no UI |
| **Kanban Board View** | ⚠️ Disconnected | `KanbanBoard.jsx` exists with full drag-drop but is only used in `ProjectDashboard.jsx`, not accessible from Tasks page |
| **Subtask Support** | ⚠️ Partial | Backend fetches subtasks on GET /:id, schema supports `parentTaskId`, but no UI to create or view subtasks |
| **Quick Task Modal** | ✅ Working | Used from Intelligence Dashboard to create tasks contextually. Uses `api.tasks.create` but sends `source` and `related_id` fields that backend ignores (not in `allowedFields`) |
| **Task ETA Prediction** | 🔇 Standalone | `taskEta.ts` computes predictions but is not called from any API route or UI. Reads from `entomate_project_tasks` table (may not exist — schema only has `tasks` table). |
| **Auto-Assign Agent** | 🔇 Standalone | `assignTask.ts` is a well-built action but uses `assignee_id` column — DB schema uses `assigned_to`. Would fail on write. |
| **Overdue Task Trigger** | 🔇 Standalone | `taskOverdue.ts` queries for overdue tasks, checks `status NOT IN (completed, cancelled)` — DB uses `done` not `completed`. Would miss done tasks. |
| **Task Auto-Assigner Template** | 🔇 Standalone | Template defines agent but is not registered in any running agent scheduler |
| **Overdue Indicator** | ✅ Working | Red AlertCircle icon and red date text for overdue, non-completed tasks |
| **Priority Badges** | ⚠️ Partial | Shows high/medium/low but screenshot shows "CRITICAL" priority — not supported in schema (`enum: ['low', 'medium', 'high']`) |
| **Pagination** | ❌ Missing | Backend supports `limit`/`offset` and returns `hasMore`, frontend hardcodes `limit: 100` with no pagination UI |
| **Error Handling (list)** | ✅ Working | ErrorState component with retry button |
| **Error Handling (create)** | ⚠️ Partial | `console.error` only, no user-facing toast/error on create failure |
| **Error Handling (complete/reopen)** | ⚠️ Partial | `console.error` only, no user-facing feedback |
| **Empty State** | ✅ Working | Shows icon + "No tasks found" with CTA to create |
| **Loading State** | ✅ Working | Skeleton loader for task list |

---

## 4. Issues Found

### 🔴 Critical

**C1. AI Recommendations endpoint does not exist**
- `Tasks.jsx:125` calls `POST /api/agents/recommendations`
- No such route exists in the backend
- Every task creation with title >= 5 chars triggers a failed fetch (404)
- The loading spinner shows briefly then fails silently
- **Impact:** AI recommendation feature is completely non-functional

**C2. Column name mismatch: `assignee_id` vs `assigned_to`**
- DB schema and backend routes use `assigned_to`
- `assignTask.ts:114` writes to `assignee_id`
- `assignTask.ts:218` queries `assignee_id`
- **Impact:** Auto-assign agent would silently fail or write to wrong column

**C3. Status enum mismatch in overdue trigger**
- `taskOverdue.ts:44` excludes `['completed', 'cancelled']`
- DB uses `done` (not `completed`) and has no `cancelled` status
- Valid statuses: `open`, `in_progress`, `review`, `done`, `blocked`
- **Impact:** Overdue trigger would never exclude completed tasks

**C4. `taskEta.ts` reads from non-existent table**
- `taskEta.ts:34` queries `entomate_project_tasks`
- Schema only defines a `tasks` table
- The `entomate_project_tasks` table appears to be from the Project Board module (different migration), not guaranteed to exist
- **Impact:** ETA predictions would fail with table-not-found error

### 🟡 Medium

**M1. No task edit UI**
- Backend supports full CRUD (`PUT /api/tasks/:id`)
- Frontend has no way to edit a task's title, description, status, priority, assignee, or due date after creation
- Users must delete and recreate tasks to make changes

**M2. No task assignment UI**
- Backend supports `PUT /api/tasks/:id/assign`
- Frontend create form doesn't include an assignee field
- No way to assign or reassign tasks from the UI

**M3. Missing status filters**
- `Tasks.jsx:354` only shows `all`, `open`, `in_progress`, `done`
- Missing: `review`, `blocked` (both valid statuses in the schema)
- Tasks in these statuses are invisible unless user selects "All"

**M4. Wizard step logic is broken**
- Step 0: Create → shown when form opens
- Step 1: Set Priority → set after create, but `loadTasks()` immediately runs and sets step to 2 (since tasks now exist)
- Step 1 is never visible to the user
- The wizard provides no actionable guidance

**M5. Create form is too minimal**
- Only captures: title, priority, dueDate
- Missing fields that backend supports: description, tags, assignedTo, projectId, startDate, parentTaskId
- QuickTaskModal also sends `source` and `related_id` — backend silently ignores these

**M6. No error feedback on mutations**
- `handleCreate`, `handleComplete`, `handleReopen` catch errors but only `console.error`
- No toast, snackbar, or inline error shown to user
- User has no idea if an action failed

**M7. Kanban board not accessible from Tasks page**
- `KanbanBoard.jsx` is a complete drag-drop kanban with all 5 status columns
- Only accessible from Project Dashboard
- Tasks page has no toggle to switch between list and kanban views

**M8. No pagination controls**
- Backend returns `hasMore` flag and supports `offset`
- Frontend requests 100 tasks with no UI to load more
- Will break or perform poorly for users with > 100 tasks

**M9. Server-side search not used**
- Backend supports `search` query param with `ilike` matching on title AND description
- Frontend does client-side filtering on `task.title` only
- Means description is never searched, and search doesn't work if task isn't in the first 100 loaded

**M10. `critical` priority visible in UI (screenshot) but not in schema**
- The screenshot shows a "CRITICAL" priority badge
- Schema only allows `low`, `medium`, `high`
- Either the DB has tasks with non-validated priority values, or the screenshot is from a different state

### 🟢 Nice-to-Have

**N1. No task detail view**
- Backend `GET /api/tasks/:id` returns task with subtasks
- No frontend route or modal to view full task details

**N2. No subtask UI**
- Backend supports `parent_task_id` for subtasks
- No way to create or view subtask hierarchy in UI

**N3. No bulk operations UI**
- Backend supports `POST /tasks/bulk` and `PUT /tasks/bulk/status`
- No multi-select or bulk action toolbar in frontend

**N4. No task sorting**
- Tasks are displayed in `created_at DESC` order from the backend
- No UI to sort by priority, due date, status, etc.

**N5. No due date validation**
- Form accepts any date including past dates
- No warning when creating a task already overdue

**N6. Agent layer is completely disconnected**
- `assignTask.ts`, `taskOverdue.ts`, `taskAutoAssigner.ts` are well-built
- None are wired to any scheduler, cron job, or API route
- They exist as standalone code with no execution path

**N7. ETA predictions not surfaced in UI**
- `taskEta.ts` has a complete prediction model with tests
- No API endpoint exposes predictions
- No UI shows estimated completion dates

**N8. No keyboard shortcuts**
- No keyboard navigation for task actions (complete, delete, create)

**N9. Tags and custom fields unused**
- Schema supports `tags` (JSONB) and `custom_fields` (JSONB)
- Neither is exposed in create form or task list display

**N10. No task count badge in sidebar**
- Navigation shows "Tasks" item but no count of open/overdue tasks

---

## 5. Code Quality Notes

### Dead Code / Unused Imports
- `Tasks.jsx:4` — `Filter`, `Target` imported from lucide but never used
- `Tasks.jsx:2` — `Link` imported from react-router-dom, used once for project link but could be cleaner
- `Tasks.jsx:28-31` — `recommendations`, `loadingRecommendations`, `showExplanation`, `explanationData` state exists but the AI recommendation feature is broken, making this state dead weight

### Questionable Patterns
- `Tasks.jsx:267` — Error span uses `color: 'var(--c)'` which appears to be an undefined/truncated CSS variable
- `Tasks.jsx:410` — Inline `onMouseEnter/Leave` handlers for hover effect instead of CSS `:hover`
- `Tasks.jsx:411` — Sets `--hover-bg` CSS variable but never uses it (uses direct `style.background` instead)
- Backend `routes/tasks.js:53-55` — If supabase is null, returns fake success with local data (dev fallback) but this masks real issues in production

### Type Safety
- Agent layer is TypeScript with proper types
- Frontend is all JSX (no TypeScript) — no compile-time type checking
- `assignTask.ts:146` — `getTaskDetails` returns `Promise<any | null>` — loses type safety

### Security
- Backend routes are protected by `authenticate` middleware — good
- SQL injection is prevented by Supabase client parameterization — good
- `routes/tasks.js:119` — `search` param is used directly in `.or()` filter with `ilike` — Supabase handles escaping but worth noting
- No RLS policies visible for the tasks table — relies entirely on backend auth
- Delete cascades subtasks without checking ownership — could delete other users' subtasks

---

## 6. Revisal Plan

### Phase 1: Fix Broken / Critical Issues

1. **Fix or remove AI Recommendations integration**
   - Option A: Create `POST /api/agents/recommendations` endpoint that calls the existing agent logic
   - Option B: Remove the broken recommendation UI from `Tasks.jsx` to eliminate 404 noise
   - Recommendation: Option B first (remove dead code), Option A later when agent layer is wired

2. **Fix column name mismatch in `assignTask.ts`**
   - Change `assignee_id` → `assigned_to` on lines 114 and 218
   - Also update the `assigned_at` field (not in schema) — remove or add to schema

3. **Fix status enum in `taskOverdue.ts`**
   - Change `['completed', 'cancelled']` → `['done']` (or `['done', 'blocked']`)
   - Align with actual DB status values

4. **Fix table name in `taskEta.ts`**
   - Change `entomate_project_tasks` → `tasks` (lines 34, 73, 82)
   - Or verify the `entomate_project_tasks` table exists and is intended

5. **Add error feedback on create/complete/reopen**
   - Import and use toast system (already used in `QuickTaskModal`)
   - Show error toast on catch blocks

### Phase 2: Wire Up Missing Core Features

6. **Add task edit capability**
   - Create `EditTaskModal` or inline edit
   - Allow editing: title, description, status, priority, assignee, due date, tags
   - Call `tasksApi.update()`

7. **Add task assignment UI**
   - Add assignee selector to create form and edit modal
   - Show assigned user in task list row
   - Load team members from users API

8. **Add missing status filters**
   - Add `review` and `blocked` to the filter button array
   - Consider adding a count badge per status

9. **Add list/kanban view toggle**
   - Reuse `KanbanBoard.jsx` (already exists and works)
   - Add toggle buttons (list view / board view) above the task list

10. **Implement server-side search**
    - Pass `searchQuery` as `search` param to `tasksApi.list()`
    - Remove client-side filter (or keep as secondary filter)

11. **Add pagination**
    - Add "Load More" button or infinite scroll
    - Track offset in state, use `hasMore` from response

### Phase 3: Refactor & Improve Architecture

12. **Wire agent layer to backend**
    - Create API endpoints for agent actions (assign, overdue check)
    - Set up a scheduler (cron or Supabase pg_cron) for `taskOverdue` trigger
    - Register `taskAutoAssigner` template in agent registry

13. **Expose ETA predictions**
    - Create `GET /api/tasks/:id/eta` endpoint
    - Show predicted completion in task detail view
    - Fix table reference first (Phase 1 item)

14. **Clean up wizard logic**
    - Either make the 3-step wizard meaningful (track actual user progress) or remove it
    - Current implementation is misleading

15. **Fix unused imports and dead CSS variables**
    - Remove `Filter`, `Target` imports
    - Fix `var(--c)` → proper variable name
    - Remove inline hover JS, use CSS

### Phase 4: New Features & Polish

16. **Task detail view/modal**
    - Show full task info, subtasks, activity log
    - Link to project if assigned

17. **Subtask support in UI**
    - Create subtasks from task detail
    - Show subtask progress in parent task row

18. **Bulk operations toolbar**
    - Multi-select checkboxes
    - Bulk status change, bulk delete, bulk assign

19. **Task sorting**
    - Sort by priority, due date, status, created date
    - Persist sort preference

20. **Tags UI**
    - Tag input in create/edit forms
    - Tag filter chips
    - Color-coded tag badges in task list

---

## 7. Agent Prompt for Revisal Implementation

```
You are performing a staged revisal of the Entomate Tasks module. The audit identified
4 critical bugs, 10 medium issues, and 10 nice-to-have improvements across 15 files.

## Current State Summary

The Tasks module has:
- A working list view with create, complete, delete, filter, search
- A fully functional backend API with 10 endpoints
- An agent layer (TypeScript) for auto-assignment, overdue detection, ETA prediction — ALL DISCONNECTED
- A Kanban board component that exists but isn't linked from the Tasks page
- AI recommendation integration that calls a non-existent endpoint

## File Locations

Frontend:
- Main page: frontend/src/pages/Tasks.jsx (507 lines)
- Quick create: frontend/src/components/intelligence/QuickTaskModal.jsx (103 lines)
- Kanban: frontend/src/components/KanbanBoard.jsx (~180 lines)
- AI recs: frontend/src/components/intelligence/AgentRecommendationPanel.jsx
- API client: frontend/src/services/api.js (tasksApi at lines 301-331)

Backend:
- Routes: backend/routes/tasks.js (473 lines, 10 endpoints)
- Schemas: backend/schemas/tasks.js (90 lines, Zod validation)

Agent Layer:
- Auto-assign: src/agents/actions/assignTask.ts (339 lines)
- Overdue trigger: src/agents/triggers/taskOverdue.ts (157 lines)
- Template: src/agents/templates/taskAutoAssigner.ts (67 lines)

Analytics:
- ETA prediction: src/analytics/taskEta.ts (250 lines)
- Types: src/analytics/types.ts (90 lines)
- Tests: tests/analytics/taskEta.test.ts (259 lines)

Database:
- Schema: docs/migrations/schema.sql — tasks table uses `assigned_to` (not `assignee_id`)
- Status values: open, in_progress, review, done, blocked
- Priority values: low, medium, high

## Phase 1 Tasks (Critical Fixes)

1. In Tasks.jsx: Remove the broken AI recommendations integration (lines 114-176,
   294-320, 491-504) and the state declarations (lines 27-31). Remove the imports
   for AgentRecommendationPanel and ExplanationModal (lines 8-9). This eliminates
   the 404 calls to /api/agents/recommendations.

2. In src/agents/actions/assignTask.ts:
   - Line 114: Change `assignee_id` → `assigned_to`
   - Line 115: Remove `assigned_at` (not in schema) or add column to schema
   - Line 218: Change `assignee_id` → `assigned_to`

3. In src/agents/triggers/taskOverdue.ts:
   - Line 44: Change `['completed', 'cancelled']` → `['done']`
   - Line 144: Change `("completed","cancelled")` → `("done")`

4. In src/analytics/taskEta.ts:
   - Lines 34, 73, 82: Change `entomate_project_tasks` → `tasks`
   - Line 74: Change `assigned_to` field name to match (already correct in schema)

5. In Tasks.jsx mutation handlers (handleCreate, handleComplete, handleReopen):
   - Import toast: look at QuickTaskModal.jsx for pattern (useToast hook)
   - Add toast.error() in catch blocks
   - Add toast.success() on successful create

## Phase 2 Tasks (Wire Missing Features)

6. Add missing status filters to Tasks.jsx line 354:
   Change the filter array from ['all', 'open', 'in_progress', 'done']
   to ['all', 'open', 'in_progress', 'review', 'done', 'blocked']

7. Create an EditTaskModal component (or add inline editing):
   - Fields: title, description, status, priority, assignee, due_date, tags
   - Call tasksApi.update(id, data)
   - Open from task row click

8. Add assignee field to the create form:
   - Fetch team members
   - Show a <select> or searchable dropdown
   - Pass assignedTo in the create payload

9. Add list/kanban toggle to Tasks.jsx:
   - State: viewMode ('list' | 'kanban')
   - Render KanbanBoard when kanban mode
   - KanbanBoard already fetches its own tasks

10. Switch to server-side search:
    - Pass search param to tasksApi.list()
    - Debounce the search input
    - Remove client-side .filter() or keep as supplementary

11. Add pagination:
    - Track page/offset state
    - Show "Load More" when hasMore is true
    - Append new tasks to existing list

## Phase 3-4: See audit document for full details on agent wiring, ETA exposure,
subtasks, bulk ops, sorting, and tags.

## Design System

Use existing VC design system components:
- VCButton (variant: primary/secondary/ghost/danger, size: sm/md)
- VCBadge (color: crimson/amber/mint/neutral)
- VCInput, VCSelect
- useToast() hook for notifications
- useConfirm() hook for destructive actions
- CSS variables: --text-primary, --text-secondary, --text-tertiary,
  --bg-elevated, --accent-primary, --font-display, --font-mono

## Constraints

- Do not change the database schema without explicit migration files
- Keep all changes backwards-compatible with existing data
- Maintain the existing VC design system patterns
- All new components should support dark mode (the app is dark-first)
```

---

*End of audit.*
