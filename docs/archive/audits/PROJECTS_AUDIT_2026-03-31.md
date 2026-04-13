# Projects Section Audit — Entomate

**Date:** 2026-03-31
**Auditor:** Claude Opus 4.6
**Scope:** All project-related components, services, routes, types, database schemas, and agent automation

---

## 1. File Inventory

| # | File | Lines | Role |
|---|------|-------|------|
| 1 | `backend/routes/projects.js` | 408 | REST API — project CRUD + from-deal + stats |
| 2 | `backend/routes/tasks.js` | 469 | REST API — task CRUD + complete/reopen/assign + bulk |
| 3 | `backend/routes/dashboard.js` | 530 | REST API — dashboard views, insights, workload, overdue |
| 4 | `backend/schemas/projects.js` | 61 | Zod validation for project routes |
| 5 | `frontend/src/pages/Projects.jsx` | 295 | Project portfolio list page (JSX) |
| 6 | `frontend/src/pages/ProjectDetail.jsx` | 360 | Single project detail + task CRUD (JSX) |
| 7 | `frontend/src/pages/ProjectDashboard.jsx` | 573 | Analytics dashboard with Recharts + Kanban (JSX) |
| 8 | `frontend/src/components/KanbanBoard.jsx` | 320 | Drag-and-drop Kanban task board (JSX) |
| 9 | `frontend/src/services/api.js` | ~60 | `projectsApi` + `tasksApi` + `dashboardApi` wrappers |
| 10 | `src/components/ProjectsView.tsx` | 656 | Modern TS component — list/detail/create + ETA (unused?) |
| 11 | `src/services/projectService.ts` | 359 | TS service — Supabase direct + Knowledge Graph |
| 12 | `src/agents/actions/createOnboardingProject.ts` | 257 | Agent action — onboarding project from template |
| 13 | `src/agents/templates/projectKickoffAgent.ts` | 102 | Agent template — deal-close automation |
| 14 | `src/lib/supabase.ts` | ~30 | `EntoamateProject` + `EntoamateProjectTask` types |
| 15 | `docs/migrations/schema.sql` | ~90 | `projects` + `tasks` table DDL |
| 16 | `docs/migrations/dashboard-views.sql` | ~90 | `project_statistics`, `team_workload`, `overdue_items`, `action_item_trends` views |

**Total: ~4,560 lines across 16 files**

---

## 2. Architecture Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (JSX — active)                       │
│                                                                      │
│  App.jsx routes:                                                     │
│    /projects          → Projects.jsx (list + create)                 │
│    /projects/:id      → ProjectDetail.jsx (detail + tasks)           │
│    /projects/:id/dashboard → ProjectDashboard.jsx (analytics)        │
│    /project-dashboard → ProjectDashboard.jsx (global analytics)      │
│                                                                      │
│  Projects.jsx ──→ projectsApi ──→ Backend                            │
│  ProjectDetail.jsx ──→ projectsApi + tasksApi ──→ Backend            │
│  ProjectDashboard.jsx ──→ dashboardApi + projectsApi ──→ Backend     │
│  KanbanBoard.jsx ──→ tasksApi ──→ Backend                            │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ HTTP (Axios)
┌──────────────────────────▼──────────────────────────────────────────┐
│                     BACKEND (Express.js)                             │
│                                                                      │
│  /api/projects/*     → routes/projects.js                            │
│  /api/tasks/*        → routes/tasks.js                               │
│  /api/dashboard/*    → routes/dashboard.js                           │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ Supabase JS Client
┌──────────────────────────▼──────────────────────────────────────────┐
│                     DATABASE (Supabase/Postgres)                     │
│                                                                      │
│  Tables:     projects, tasks, meetings, action_items                 │
│  Views:      project_statistics, team_workload, overdue_items,       │
│              action_item_trends                                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│          TYPESCRIPT LAYER (src/ — ORPHANED / PARALLEL)               │
│                                                                      │
│  ProjectsView.tsx ──→ projectService.ts ──→ Supabase DIRECT          │
│                                                                      │
│  Tables used:  entomate_projects, entomate_project_tasks             │
│  (DIFFERENT from backend tables: projects, tasks)                    │
│                                                                      │
│  Integrations: Knowledge Graph, Logos Vision, ETA Predictions        │
│  Agent layer:  createOnboardingProject.ts, projectKickoffAgent.ts    │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Discovery: TWO PARALLEL SYSTEMS

The most critical finding is that there are **two completely separate project systems** running side by side:

1. **Backend System** (JSX frontend + Express backend)
   - Tables: `projects`, `tasks`
   - Status values: `planning`, `active`, `completed`, `archived`
   - Task statuses: `open`, `in_progress`, `review`, `done`, `blocked`
   - Routes through Express REST API

2. **TypeScript System** (TSX component + TS service)
   - Tables: `entomate_projects`, `entomate_project_tasks`
   - Status values: `active`, `completed`, `on_hold`
   - Task statuses: `todo`, `in_progress`, `done`
   - Direct Supabase client calls (bypasses backend)

These systems do NOT share data, do NOT share tables, and have incompatible status enums.

---

## 3. Feature Status Catalog

### Frontend JSX System (Active — routed in App.jsx)

| Feature | Status | Notes |
|---------|--------|-------|
| Project list with grid cards | ✅ Working | Pagination via `limit: 50`, search by name |
| Project create (inline form) | ✅ Working | Name + description only; no dates/team/tags in form |
| Project delete | ✅ Working | With confirm dialog, cascades tasks + unlinks meetings |
| Project detail view | ✅ Working | Shows stats, tasks, related meetings |
| Task CRUD on project detail | ✅ Working | Add/complete/delete tasks; title + priority only |
| Project status badges | ✅ Working | planning/active/completed/archived with color coding |
| Project search/filter | ⚠️ Partial | Search by name only; no status filter on list page |
| Deal value display | ✅ Working | Shows $ amount on card if present |
| End date display | ✅ Working | Shows date on card if present |
| GuideCard wizard | ✅ Working | 3-step wizard: Create → Organize → Track |
| Project Dashboard (per-project) | ⚠️ Partial | Loads data but depends on `dashboardApi.getProject(id)` which queries `project_statistics` view — this view is based on *meetings*, not projects |
| Project Dashboard (global) | ⚠️ Partial | Same issue — insights come from `action_items`, not `tasks` table |
| Kanban Board | ✅ Working | Drag-and-drop with optimistic updates on `tasks` table |
| Team Workload tab | ⚠️ Partial | Data comes from `team_workload` view (action_items), not project tasks |
| AI Insights | ⚠️ Partial | Generated from action item counts, not project-level AI analysis |
| Recharts visualizations | ✅ Working | Pie chart, bar charts, area charts render correctly |
| Create from CRM deal | ✅ Working | Backend endpoint exists + creates default tasks |
| Project stats endpoint | ✅ Working | Calculates from tasks table correctly |
| Error states | ✅ Working | ErrorState component with retry |
| Loading skeletons | ✅ Working | Skeleton components while loading |

### TypeScript System (ProjectsView.tsx — potentially orphaned)

| Feature | Status | Notes |
|---------|--------|-------|
| Project list view | ⚠️ Partial | Works but uses `entomate_projects` table — may not exist in DB |
| Project create form | ⚠️ Partial | Has name/description/dates/status fields |
| Project detail view | ⚠️ Partial | Shows description, status, dates, progress, linked records |
| Task CRUD | ⚠️ Partial | Full form with title/description/assignee/priority/due date |
| Task ETA predictions | 🔇 Stub | Uses `useTaskEta` hook — depends on `taskEta.ts` analytics |
| Knowledge Graph integration | 🔇 Stub | `LinkedRecordsPanel` renders — depends on graph service |
| Logos Vision linking | 🔇 Stub | Service method exists but no UI to trigger it |
| Project status filter | ✅ Working | Dropdown: All/Active/Completed/On Hold |
| Task status change (inline) | ✅ Working | Dropdown on each task row |
| Task edit/delete | ✅ Working | Edit opens form, delete removes |
| Stats calculation | ✅ Working | Loads stats per project — N+1 query pattern |
| Meeting → Task conversion | 🔇 Stub | `createTasksFromMeetingActionItems()` exists but no UI trigger |

### Agent Automation

| Feature | Status | Notes |
|---------|--------|-------|
| Onboarding project creation | 🔇 Stub | Code complete, writes to `projects` table (not `entomate_projects`) |
| Project kickoff template | 🔇 Stub | Template defined but `enabled: false` by default |
| Template task copying | 🔇 Stub | Writes tasks with calculated due dates |
| Deal → Project linking | 🔇 Stub | Uses Knowledge Graph `upsertRelationship` |
| Post-to-Pulse notification | 🔇 Stub | Template message only; no actual Pulse integration |
| CRM sync | 🔇 Stub | Config only; no implementation |

---

## 4. Issues Found

### 🔴 Critical

**C1. Two incompatible project systems / split-brain data**
- `projects` + `tasks` tables used by backend Express routes
- `entomate_projects` + `entomate_project_tasks` used by TypeScript service
- Data entered in one system is invisible to the other
- No migration path between them
- Files: all backend routes vs `src/services/projectService.ts`

**C2. `entomate_projects` / `entomate_project_tasks` tables may not exist**
- No SQL migration creates these tables in `supabase/migrations/`
- `projectService.ts` queries them directly — will fail with `relation does not exist`
- Only documentation references these table names

**C3. Dashboard data mismatch**
- `ProjectDashboard.jsx` calls `dashboardApi.getProject(id)` which queries `project_statistics` view
- `project_statistics` view is built from `meetings` + `action_items`, NOT from `projects` + `tasks`
- Passing a project ID to this endpoint will return nothing (project IDs ≠ meeting IDs)
- The "Task Status Distribution" pie chart and "Priority" bar chart will show action item data, not task data

**C4. SQL injection risk in search parameters**
- `backend/routes/projects.js:88` — `query.or(\`name.ilike.%${search}%\`)` — `search` is user input interpolated directly into Supabase filter
- Same pattern in `backend/routes/tasks.js:115`
- Supabase's PostgREST does escape these, but the pattern is fragile

**C5. No authentication on project routes**
- `req.user?.id || 'anonymous'` — falls back to anonymous if no auth
- No RLS policies defined for `projects` or `tasks` tables
- Any unauthenticated request can create/read/update/delete any project

### 🟡 Medium

**M1. ProjectsView.tsx is likely orphaned**
- Lives in `src/components/` (TypeScript layer)
- App.jsx routes to `frontend/src/pages/Projects.jsx` instead
- Not imported anywhere in the active routing
- Uses hardcoded Tailwind colors (`bg-gray-50`, `text-gray-400`) instead of VC design system CSS variables

**M2. Status enum mismatch across layers**
- Backend schema: `planning`, `active`, `completed`, `archived`
- TypeScript types: `active`, `completed`, `on_hold`
- Frontend creates with status `planning` (backend), TS creates with `active`
- No `on_hold` in backend, no `planning`/`archived` in TypeScript

**M3. Task status enum mismatch**
- Backend `tasks` table: `open`, `in_progress`, `review`, `done`, `blocked`
- TypeScript `entomate_project_tasks`: `todo`, `in_progress`, `done`
- KanbanBoard only shows 3 columns: `open`, `in_progress`, `done` (ignores `review`, `blocked`)

**M4. N+1 query in ProjectsView.tsx**
- `loadProjects()` fetches all projects, then loops `for (const project of data)` calling `getProjectStats(project.id)` for each
- 20 projects = 21 queries
- Should use a single aggregation query

**M5. Missing error feedback on project create**
- `Projects.jsx:handleCreate` catches error but only `console.error`s it
- User sees nothing if creation fails — `setCreating(false)` runs but no error message shown

**M6. Missing "review" and "blocked" columns in Kanban**
- `KanbanBoard.jsx` COLUMNS array only has `open`, `in_progress`, `done`
- Backend schema supports `review` and `blocked` statuses
- Tasks in these statuses disappear from the board

**M7. Create form missing fields**
- `Projects.jsx` only collects name + description
- Backend accepts: name, description, crmDealId, dealValue, startDate, endDate, teamIds, tags
- No way to set start/end dates, tags, or team from the UI

**M8. `getStatusBadge()` duplicated**
- Same function defined in both `Projects.jsx:87` and `ProjectDetail.jsx:103`
- Slightly different implementations (Projects has `archived`, Detail doesn't)

**M9. KanbanBoard task link goes to `/tasks/:id` — no route exists**
- `KanbanBoard.jsx:240` links to `/tasks/${task.id}`
- `App.jsx` has no route for `/tasks/:id`
- Click navigates to a 404

**M10. Agent automation writes to wrong table**
- `createOnboardingProject.ts:64` inserts into `projects` table
- `copyTemplateTasks:204` inserts into `tasks` table
- But the TypeScript `projectService.ts` reads from `entomate_projects` / `entomate_project_tasks`
- Agent-created projects would only be visible in the JSX frontend, not the TS component

### 🟢 Nice-to-Have

**N1. No project archive/soft-delete**
- Delete is permanent (hard delete of project + cascade delete of tasks)
- Meetings get unlinked but meetings' `project_id` set to null
- Consider archive/soft-delete pattern

**N2. No drag-and-drop reordering within Kanban columns**
- Can move between columns but cannot reorder within a column
- No `position` or `sort_order` field on tasks

**N3. No due date on projects in list view**
- `end_date` shown on cards but no visual indicator for overdue projects
- Dashboard "Overdue" count only counts action items, not project deadlines

**N4. No project templates in UI**
- Agent layer has templates but no user-facing template picker
- "Create from template" would be valuable

**N5. No task description field in ProjectDetail form**
- `ProjectDetail.jsx:230` — add-task form only has title + priority
- Backend accepts description, assignedTo, dueDate, etc.

**N6. No batch/bulk task operations in UI**
- Backend has `POST /api/tasks/bulk` and `PUT /api/tasks/bulk/status`
- No UI to leverage these endpoints

**N7. Unused imports**
- `ProjectDashboard.jsx:12` — imports `Area, AreaChart, LineChart, Line` from recharts but never uses them

**N8. Missing loading state on task complete/delete**
- `ProjectDetail.jsx:handleCompleteTask` and `handleDeleteTask` have no loading indicators
- Full project reload (`loadProject()`) fires on every action — could use optimistic updates

---

## 5. Dead Code / Unused

| Item | Location | Status |
|------|----------|--------|
| `MoreVertical` import | `ProjectDetail.jsx:5` | Imported, never used |
| `Area`, `AreaChart`, `LineChart`, `Line` imports | `ProjectDashboard.jsx:12` | Imported, never used |
| `MoreHorizontal` import | `KanbanBoard.jsx:6` | Imported, never used |
| `Plus` import | `KanbanBoard.jsx:6` | Imported, never used |
| `ProjectsView.tsx` entire component | `src/components/ProjectsView.tsx` | Not routed to from App.jsx |
| `getLogosVisionProjects()` | `src/services/projectService.ts:346` | No caller |
| `linkToLogosProject()` | `src/services/projectService.ts:324` | No caller |
| `getAllTasks()` | `src/services/projectService.ts:164` | No caller from projects |
| `dashboardApi` in `ProjectDashboard.jsx` | Line 13 | `getProject(id)` queries meeting-based view, returns wrong data for project IDs |

---

## 6. Revisal Plan

### Phase 1: Fix Critical Issues (Breaking / Data Integrity)

1. **Consolidate to one project system**
   - Decision: Keep the Backend/JSX system (it's the one routed in App.jsx and has proper REST API)
   - Migrate any valuable functionality from TypeScript layer (ETA predictions, Knowledge Graph integration) into the JSX system
   - Either create `entomate_projects`/`entomate_project_tasks` migration OR remove `projectService.ts` + `ProjectsView.tsx`

2. **Fix dashboard data source**
   - Create project-specific dashboard endpoint that queries `projects` + `tasks` tables (not meetings-based views)
   - `GET /api/projects/:id/dashboard` — returns task stats, priority breakdown, timeline
   - Update `ProjectDashboard.jsx` to use this new endpoint when `id` is present

3. **Add authentication/authorization**
   - Ensure `req.user` is populated via auth middleware on all project/task routes
   - Add RLS policies on `projects` and `tasks` tables
   - Remove `|| 'anonymous'` fallback

4. **Fix search parameter handling**
   - Sanitize `search` parameter before interpolation into Supabase `.or()` filters
   - Or use parameterized filter approach

### Phase 2: Wire Up Partial / Stub Functionality

5. **Expand project create form**
   - Add start date, end date, tags, team member assignment to `Projects.jsx` create form
   - Add status selector (planning/active)
   - Add optional CRM deal linking

6. **Add missing Kanban columns**
   - Add `review` and `blocked` columns to `KanbanBoard.jsx`
   - Add column for unassigned tasks

7. **Fix task detail link**
   - Either create a `/tasks/:id` route or change Kanban task links to navigate to `/projects/:projectId` with task highlighted

8. **Add error feedback on create/update failures**
   - Show toast/alert when `handleCreate` fails in `Projects.jsx`
   - Same for task operations in `ProjectDetail.jsx`

9. **Expand task add form on ProjectDetail**
   - Add description, assigned_to, due_date fields
   - Match the backend's full task schema

10. **Fix global dashboard**
    - Create `GET /api/dashboard/project-insights` that aggregates from `projects` + `tasks` tables
    - Wire into `ProjectDashboard.jsx` when no `id` param

### Phase 3: Refactor & Improve Architecture

11. **Extract shared components**
    - `getStatusBadge()` → shared utility or component
    - `getPriorityBadge()` → shared utility or component

12. **Optimistic updates**
    - Task complete/delete on ProjectDetail should update state immediately
    - Don't reload entire project on each task action

13. **Remove dead code**
    - Remove unused imports (`MoreVertical`, `MoreHorizontal`, `Area`, `AreaChart`, etc.)
    - Remove or consolidate `ProjectsView.tsx` and `projectService.ts` if not migrating to TS layer

14. **Add project-level dashboard endpoint**
    - Proper `GET /api/projects/:id/dashboard` with:
      - Task burn-down data
      - Completion velocity
      - Team workload (from tasks, not action_items)

15. **Fix N+1 queries**
    - If keeping `ProjectsView.tsx`, replace per-project stats loop with batch query

### Phase 4: New Features & Polish

16. **Project templates UI**
    - Let users create projects from templates (leveraging agent template system)
    - Template picker modal in project create flow

17. **Soft delete / archive**
    - Add `archived_at` column, filter archived projects from default view
    - Archive button instead of permanent delete

18. **Task reordering in Kanban**
    - Add `position` column to tasks table
    - Enable within-column drag reorder

19. **Bulk task operations UI**
    - Multi-select tasks → bulk status change, bulk assign, bulk delete
    - Wire to existing backend bulk endpoints

20. **Meeting → Task conversion UI**
    - Button on meeting detail to create project tasks from action items
    - Wire to `createTasksFromMeetingActionItems()` in projectService

---

## 7. Agent Prompt for Revisal

```
You are performing a phased revisal of the Projects section of Entomate (f:\entomate).

## Context

Entomate has TWO parallel project systems that need consolidation:

1. **Active system (keep)**: JSX frontend + Express backend
   - Frontend: `frontend/src/pages/Projects.jsx`, `ProjectDetail.jsx`, `ProjectDashboard.jsx`
   - Components: `frontend/src/components/KanbanBoard.jsx`
   - API client: `frontend/src/services/api.js` (projectsApi, tasksApi, dashboardApi)
   - Backend: `backend/routes/projects.js`, `backend/routes/tasks.js`, `backend/routes/dashboard.js`
   - Schemas: `backend/schemas/projects.js`
   - DB tables: `projects`, `tasks` (schema in `docs/migrations/schema.sql`)
   - DB views: `project_statistics`, `team_workload` (in `docs/migrations/dashboard-views.sql`)
   - Design system: Uses VC design system with CSS variables (--bg-elevated, --text-primary, etc.)

2. **Orphaned system (to deprecate or migrate features from)**:
   - Component: `src/components/ProjectsView.tsx`
   - Service: `src/services/projectService.ts`
   - Types: `src/lib/supabase.ts` (EntoamateProject, EntoamateProjectTask)
   - DB tables: `entomate_projects`, `entomate_project_tasks` (no migration exists)
   - Has: Knowledge Graph integration, ETA predictions, Logos Vision linking

3. **Agent layer** (future integration):
   - `src/agents/actions/createOnboardingProject.ts`
   - `src/agents/templates/projectKickoffAgent.ts`

## Design System

The active frontend uses the VC (Venture Capital) design system:
- CSS variables: `--bg-elevated`, `--text-primary`, `--text-secondary`, `--text-tertiary`, `--accent-primary`
- Components: `VCButton`, `VCBadge`, `PageHeader`, `GuideCard`, `Skeleton`, `ErrorState`
- Font: `var(--font-display)` for headings, `var(--font-mono)` for data
- Borders: `rgba(248,240,242,.08)` pattern
- Styling via `style={{ ... }}` with CSS variables, NOT hardcoded Tailwind colors

## Phase 1 Tasks (Critical)

1. Fix `ProjectDashboard.jsx` — when `id` param is present, it must query project-level data from `projects` + `tasks` tables, NOT from `project_statistics` view (which is meeting-based). Create a new backend endpoint `GET /api/projects/:id/dashboard` that returns:
   - `taskStats`: { open, in_progress, review, done, blocked } counts from `tasks` where project_id = id
   - `priorityStats`: { high, medium, low } counts
   - `overdueCount`: tasks where due_date < now AND status != 'done'
   - `completionRate`: percentage
   - `timeline`: recent task activity
   Update `ProjectDashboard.jsx` to call this endpoint when `id` is present.

2. Fix the global dashboard (no `id`) — create `GET /api/dashboard/project-insights` that aggregates from `projects` + `tasks` tables. Replace the meeting-based insights endpoint usage.

3. Add error display on `Projects.jsx` create form — set error state and show message when `projectsApi.create()` fails.

4. Add auth guard — ensure project and task routes check `req.user` and return 401 if missing. Remove `|| 'anonymous'` fallback.

## Phase 2 Tasks (Wire Up)

5. Expand project create form in `Projects.jsx`:
   - Add start_date and end_date date pickers
   - Add tags input (comma-separated or pill-based)
   - Add team member selection
   - Keep it within the existing inline form pattern

6. Expand task form in `ProjectDetail.jsx`:
   - Add description textarea
   - Add assigned_to text input
   - Add due_date date picker
   - Update newTask state and handleAddTask accordingly

7. Add `review` and `blocked` columns to `KanbanBoard.jsx` COLUMNS array.

8. Fix Kanban task links — change `/tasks/${task.id}` to `/projects/${task.project_id}` or remove the link if no task detail page exists.

9. Add status filter to `Projects.jsx` list page — dropdown to filter by planning/active/completed/archived.

## Phase 3 Tasks (Refactor)

10. Extract `getStatusBadge()` and `getPriorityBadge()` into a shared utility file `frontend/src/utils/badges.jsx`.

11. Remove unused imports from all files:
    - `ProjectDetail.jsx`: MoreVertical
    - `ProjectDashboard.jsx`: Area, AreaChart, LineChart, Line
    - `KanbanBoard.jsx`: MoreHorizontal, Plus

12. Add optimistic updates to ProjectDetail task operations — don't reload entire project on each task complete/delete.

## Do NOT:
- Modify `src/components/ProjectsView.tsx` or `src/services/projectService.ts` (will be deprecated separately)
- Add new npm dependencies
- Change database table schemas (only add new endpoints/views)
- Use hardcoded colors — always use CSS variables from the VC design system
- Add emojis to code or UI
```

---

*End of audit.*
