# Project Board Section - Full Audit

**Date:** 2026-03-31
**Section:** Project Board (Projects, Tasks, Kanban, Dashboard)
**Auditor:** Claude Opus 4.6

---

## 1. File Inventory

| File | Lines | Role |
|------|-------|------|
| `frontend/src/pages/Projects.jsx` | 350 | Project portfolio listing, search, filter, create |
| `frontend/src/pages/ProjectDetail.jsx` | 403 | Single project view with task list, stats, meetings |
| `frontend/src/pages/ProjectDashboard.jsx` | 554 | Dashboard with overview, kanban, team workload tabs |
| `frontend/src/components/KanbanBoard.jsx` | 325 | Drag-and-drop kanban board (5 columns) |
| `frontend/src/utils/badges.jsx` | 33 | Status/priority badge helpers |
| `frontend/src/services/api.js` (lines 269-331) | ~63 | `projectsApi` + `tasksApi` client methods |
| `frontend/src/styles/vc-components.css` (lines 891-897) | 7 | `.kcard` styles only |
| `backend/routes/projects.js` | 525 | Project CRUD + from-deal + stats + dashboard endpoints |
| `backend/routes/tasks.js` | 473 | Task CRUD + complete/reopen/assign/bulk endpoints |
| `backend/routes/dashboard.js` | 685 | Dashboard endpoints (meetings-based + project-based) |
| `backend/schemas/projects.js` | 62 | Zod validation schemas for projects |
| `backend/schemas/tasks.js` | 90 | Zod validation schemas for tasks |

**Total:** ~3,570 lines across 12 files

---

## 2. Architecture Diagram

```
FRONTEND                                     BACKEND                         DATABASE
========                                     =======                         ========

  /projects                                  POST /api/projects
  +--[Projects.jsx]----------------------->  GET  /api/projects         ---> projects table
  |   - List, search, filter, create         PUT  /api/projects/:id
  |   - Delete with confirm dialog           DEL  /api/projects/:id
  |                                          POST /api/projects/from-deal
  |
  /projects/:id                              GET  /api/projects/:id     ---> projects + tasks
  +--[ProjectDetail.jsx]------------------>  (joins tasks + meetings)        + meetings tables
  |   - Task list, add task, complete
  |   - Stats cards, related meetings
  |   - Link to Dashboard
  |
  /projects/:id/dashboard                    GET  /api/projects/:id/dashboard
  /project-dashboard                         GET  /api/dashboard/project-insights
  +--[ProjectDashboard.jsx]--------------->                              ---> projects + tasks
  |   |                                                                      (aggregated)
  |   +-- Tab: Overview
  |   |   - Stats cards (total, rate, progress, overdue)
  |   |   - Pie chart (Recharts) - task status
  |   |   - Bar chart (Recharts) - priority distribution
  |   |   - AI Insights (global only)
  |   |
  |   +-- Tab: Kanban Board
  |   |   +--[KanbanBoard.jsx]----------->  GET  /api/tasks             ---> tasks table
  |   |       - 5 columns: To Do, In Progress, Review, Done, Blocked
  |   |       - HTML5 drag-and-drop
  |   |       - Optimistic updates         PUT  /api/tasks/:id
  |   |
  |   +-- Tab: Team Workload
  |       - Stacked bar chart (Recharts)
  |       - Member cards with completion rates
  |
  API CLIENT                                 SHARED
  ==========                                 ======
  [api.js]                                   [schemas/projects.js]  Zod validation
    projectsApi.*                            [schemas/tasks.js]     Zod validation
    tasksApi.*
    dashboardApi.getProjectInsights()

  UTILS
  =====
  [badges.jsx] - getStatusBadge(), getPriorityBadge(), getTaskStatusBadge()
```

### State Management
- **Local `useState` only** -- no Zustand, Redux, or Context for project/task state
- Each page independently fetches and manages its own data
- No shared cache or global store

### Database Tables (inferred -- no migration found)
- `projects` (id, name, description, crm_deal_id, deal_value, status, start_date, end_date, owner_id, team_ids, tags, settings, created_at, updated_at)
- `tasks` (id, project_id, title, description, assigned_to, status, priority, due_date, start_date, parent_task_id, tags, custom_fields, completed_at, created_at, updated_at)
- `project_statistics` (database view -- used by dashboard.js, not by projects.js)
- `meetings` (linked via project_id)
- `action_items` (linked via meeting_id)

---

## 3. Feature Status Catalog

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | Project list with search & filter | ✅ Working | Search by name, filter by status (planning/active/completed/archived) |
| 2 | Create project (form with validation) | ✅ Working | Name required, optional dates/tags/description |
| 3 | Delete project (with confirm) | ✅ Working | Cascades to tasks, unlinks meetings |
| 4 | Project detail view | ✅ Working | Shows tasks, stats, related meetings |
| 5 | Add task to project | ✅ Working | Title, description, priority, assignee (free text), due date |
| 6 | Complete task (checkbox) | ✅ Working | Optimistic update with rollback on error |
| 7 | Delete task (with confirm) | ✅ Working | Optimistic update with rollback |
| 8 | Kanban board (drag-and-drop) | ⚠️ Partial | Drag works, but CSS layout classes (`kanban`, `kanban-col`, `kanban-header`, `kanban-count`) are **never defined** -- layout is broken |
| 9 | Project dashboard - Overview tab | ✅ Working | Stats cards, pie chart, bar chart via Recharts |
| 10 | Project dashboard - Team Workload tab | ✅ Working | Stacked bar chart + member cards |
| 11 | AI Insights (global dashboard) | ✅ Working | Auto-generated insights from `/dashboard/project-insights` |
| 12 | Create project from CRM deal | ✅ Working | Backend endpoint creates project + 5 default tasks |
| 13 | Project stats endpoint | ✅ Working | Task/meeting/action-item breakdowns |
| 14 | Bulk task create | ✅ Working | Backend wired, API client wired -- not called from any UI |
| 15 | Bulk task status update | ✅ Working | Backend wired, API client wired -- not called from any UI |
| 16 | Task assign endpoint | ✅ Working | Backend wired, API client wired -- not called from any UI |
| 17 | Task reopen endpoint | ✅ Working | Backend wired, API client wired -- not called from any UI |
| 18 | Update project (status/fields) | 🔇 Stub | Backend endpoint exists, no UI to trigger it |
| 19 | Subtasks | 🔇 Stub | Schema supports `parentTaskId`, backend returns subtasks -- no UI |
| 20 | Task tags / custom fields | 🔇 Stub | Schema + DB support exists -- no UI |
| 21 | Wizard workflow (GuideCard) | ⚠️ Partial | Steps display but logic is simplistic (jumps to step 2 if projects exist) |
| 22 | Assignee picker | ❌ Broken | Free-text input, no user lookup -- `assigned_to` stores raw text, not user ID |
| 23 | Task inline editing | ❌ Missing | No way to edit a task after creation (title, desc, priority, dates) |
| 24 | Project editing | ❌ Missing | No UI to change project name, status, dates, or description after creation |
| 25 | Task status change from list view | ❌ Missing | ProjectDetail only has "complete" checkbox -- no way to set in_progress, review, blocked |
| 26 | Database migration for projects/tasks tables | ❌ Missing | No SQL migration file found in `supabase/migrations/` |

---

## 4. Issues Found

### 🔴 Critical (5)

**C1. Kanban CSS classes are undefined**
- `KanbanBoard.jsx` uses classes `kanban`, `kanban-col`, `kanban-header`, `kanban-count` (lines 138, 142, 158, 170, 181, 201)
- These are not defined in `vc-components.css` or any other CSS file
- Only `.kcard`, `.kcard-title`, `.kcard-meta`, `.kcard-footer` exist (lines 894-897)
- **Impact:** Kanban board has no column layout -- columns stack vertically, headers have no styling, count badges are unstyled. The board is non-functional as a kanban.

**C2. No database migration for `projects` and `tasks` tables**
- Backend routes reference `projects` and `tasks` tables
- No migration file exists in `supabase/migrations/` to create them
- **Impact:** Fresh deployments will fail. Tables must be manually created or migration is missing from repo.

**C3. Assignee is free text, not a user reference**
- `ProjectDetail.jsx:280` -- assignee is a plain text input
- `tasks` table stores `assigned_to` as a string, not a UUID foreign key
- **Impact:** No user validation, no profile lookup, impossible to build reliable workload tracking. Team Workload tab shows raw text strings instead of real user data.

**C4. No task editing after creation**
- Once a task is created, there is no UI to edit title, description, priority, due date, or assignee
- The PUT endpoint exists (`PUT /api/tasks/:id`) and is fully wired in the API client
- **Impact:** Users must delete and recreate tasks to change any field.

**C5. No project editing after creation**
- No UI to change project status from "planning" to "active" or update name/dates/description
- The PUT endpoint exists (`PUT /api/projects/:id`) and is fully wired
- **Impact:** Project status is permanently "planning" unless changed via direct API call. Status filter becomes useless.

### 🟡 Medium (8)

**M1. Task list only supports "complete" action**
- `ProjectDetail.jsx:320-331` -- checkbox only toggles between current status and "done"
- No way to set a task to "in_progress", "review", or "blocked" from the list view
- Kanban is the only way to change status, but kanban CSS is broken (C1)

**M2. `dashboardApi` vs `projectsApi` confusion in ProjectDashboard**
- Global mode calls `dashboardApi.getProjectInsights()` (line 73)
- Project mode calls `projectsApi.getDashboard(id)` (line 48)
- Two completely different data shapes and response structures
- The dashboard code handles this, but the dual-source architecture is fragile

**M3. Dashboard `project_statistics` view used by `dashboard.js` but no migration**
- `dashboard.js:27` queries `project_statistics` view
- `dashboard.js:284` queries `team_workload` view
- `dashboard.js:356` queries `overdue_items` view
- `dashboard.js:418` queries `action_item_trends` view
- None of these views have migration files. Code has fallback logic for some but not all.

**M4. `dashboardApi` import in KanbanBoard is unused**
- `KanbanBoard.jsx:7` -- `dashboardApi` is imported but never used. Only `tasksApi` is called.

**M5. Kanban `isOverdue` compares dates without timezone safety**
- `KanbanBoard.jsx:131-134` -- `new Date(dueDate) < new Date()` can give wrong results across timezones
- Same pattern in `ProjectDashboard.jsx` and backend routes

**M6. Wizard step logic is simplistic and misleading**
- `Projects.jsx:36-37` -- if any projects exist, wizard jumps to step 2 ("Track")
- Skips step 1 ("Organize") entirely. Wizard provides no actionable guidance.

**M7. No pagination on Projects list**
- `Projects.jsx:33` hardcodes `limit: 50`
- No "load more" or pagination UI
- Will break with many projects

**M8. ProjectDetail stats optimistic update is error-prone**
- `ProjectDetail.jsx:62-83` -- manually adjusts stats counts during optimistic complete
- Complex conditional logic (`openTasks - (status === 'open' ? 1 : 0)`) is fragile
- If task was in `review` or `blocked` status, stats won't adjust correctly

### 🟢 Nice-to-Have (7)

**N1. Bulk operations have no UI**
- `tasksApi.bulkCreate()` and `tasksApi.bulkUpdateStatus()` are wired but never called from components
- Would be useful for kanban multi-select or import flows

**N2. Task reopen has no UI**
- `tasksApi.reopen()` is wired but never called
- Completed tasks can't be re-opened from the UI

**N3. Subtasks have no UI**
- Schema supports `parentTaskId`, backend returns subtasks -- no rendering

**N4. Tags and custom fields have no UI**
- Both are in the schema and DB -- tags can be set on project create but never displayed or edited on tasks

**N5. No real-time updates**
- No Supabase realtime subscriptions for tasks or projects
- Changes by other users won't appear until manual refresh

**N6. No loading/error states on ProjectDashboard charts**
- Charts show "No data" placeholder but no retry button or error messaging

**N7. Kanban has no "add task" inline action**
- Must go to ProjectDetail to add tasks, then switch to dashboard kanban tab to drag them

---

## 5. Dead Code & Quality Issues

| Issue | Location | Details |
|-------|----------|--------|
| Unused import | `KanbanBoard.jsx:7` | `dashboardApi` imported but never used |
| Unused import | `ProjectDashboard.jsx:6` | `Calendar` imported but never used |
| Undefined CSS classes | `KanbanBoard.jsx` | `kanban`, `kanban-col`, `kanban-header`, `kanban-count` -- no CSS definitions |
| Inconsistent field naming | Backend routes vs frontend | Backend uses `snake_case` (`project_id`), frontend create forms use `camelCase` (`projectId`) -- conversion happens silently |
| Duplicate team workload logic | `projects.js:472-494` and `dashboard.js:554-576` | Same Map-based team aggregation duplicated in two routes |
| No TypeScript | All files | Entire Project Board section is plain JSX -- no type safety |
| `.passthrough()` on all Zod schemas | `projects.js`, `tasks.js` | Allows arbitrary extra fields through validation -- weakens schema safety |
| No auth on dashboard routes | `dashboard.js` | Missing `authenticate` middleware -- all dashboard endpoints are publicly accessible |
| Inline styles throughout | All components | Heavy use of `style={{}}` instead of CSS classes, hurts performance (new object refs each render) |

---

## 6. Revisal Plan

### Phase 1: Fix Critical / Broken (Priority: Immediate)

1. **Add Kanban CSS layout** -- Define `.kanban` (grid/flex row), `.kanban-col` (column), `.kanban-header`, `.kanban-count` in `vc-components.css`
2. **Create database migration** -- Write SQL migration for `projects` and `tasks` tables with proper types, indexes, and RLS policies
3. **Add task edit modal** -- Click a task to open edit modal with all fields (title, description, priority, status, assignee, due date)
4. **Add project edit capability** -- Edit button on ProjectDetail header to update name, description, status, dates
5. **Fix assignee to use real user references** -- Replace free-text input with user picker querying actual team members, store user UUID

### Phase 2: Wire Up Stubs & Partial Features

6. **Add status change dropdown in task list** -- Allow changing task status from ProjectDetail without needing kanban
7. **Wire up task reopen** -- Add "Reopen" button on completed tasks
8. **Add pagination to Projects list** -- Load more / infinite scroll
9. **Add auth middleware to dashboard routes** -- `router.use(authenticate)` in `dashboard.js`
10. **Fix ProjectDetail stats optimistic update** -- Use a simpler pattern: refetch stats after mutation, or compute from task list

### Phase 3: Refactor & Architecture

11. **Extract shared team workload aggregation** -- Deduplicate logic between `projects.js:472-494` and `dashboard.js:554-576` into a shared utility
12. **Remove unused imports** -- `dashboardApi` from KanbanBoard, `Calendar` from ProjectDashboard
13. **Remove `.passthrough()` from Zod schemas** -- Tighten validation to reject unknown fields
14. **Move inline styles to CSS classes** -- Reduce render-time object allocations
15. **Unify dashboard data source** -- Consolidate `dashboardApi.getProjectInsights()` and `projectsApi.getDashboard()` into a single cohesive pattern

### Phase 4: New Features & Polish

16. **Add subtask UI** -- Collapsible subtask list under parent tasks, create subtask button
17. **Add tags UI for tasks** -- Tag chips on task cards, tag filter in task list
18. **Add bulk operations UI** -- Multi-select in kanban, bulk status change, bulk assign
19. **Add inline "add task" to kanban columns** -- Quick-add input at bottom of each column
20. **Add Supabase realtime subscriptions** -- Live updates when tasks/projects change
21. **Add kanban card quick-edit** -- Click to expand card with inline editing

---

## 7. Claude Agent Prompt (for Revisal Execution)

```
You are performing a revisal of the Entomate Project Board section. The codebase is at f:\entomate.

## Context
Entomate is a meeting/project management app with Express.js backend, React frontend, and Supabase database. The Project Board section manages projects and tasks with a kanban board, dashboard analytics, and team workload views. It uses a custom "VC Design System" with CSS custom properties.

## Current Architecture
- Frontend: React (JSX, no TypeScript), React Router, Recharts for charts
- Backend: Express.js with Zod validation, Supabase client
- Styling: VC Design System CSS custom properties + Tailwind utility classes
- State: Local useState only, no global store

## Critical Files to Modify
1. `frontend/src/styles/vc-components.css` (lines 891-897) -- Add kanban layout CSS
2. `frontend/src/components/KanbanBoard.jsx` (325 lines) -- Remove unused dashboardApi import
3. `frontend/src/pages/ProjectDetail.jsx` (403 lines) -- Add task edit modal, project edit, status dropdown
4. `frontend/src/pages/Projects.jsx` (350 lines) -- Add pagination
5. `frontend/src/pages/ProjectDashboard.jsx` (554 lines) -- Remove unused Calendar import
6. `backend/routes/dashboard.js` (685 lines) -- Add authenticate middleware
7. `backend/schemas/projects.js` + `backend/schemas/tasks.js` -- Remove .passthrough()

## Phase 1 Tasks (Critical Fixes)

### Task 1: Add Kanban CSS Layout
In `frontend/src/styles/vc-components.css` after the existing KANBAN CARD section (line 897), add:
- `.kanban` -- CSS grid or flexbox row layout, horizontal scroll on overflow, gap between columns
- `.kanban-col` -- flex column, min-width ~240px, max-height with overflow scroll
- `.kanban-header` -- padding, flex layout for title/count
- `.kanban-count` -- small pill badge with font-size 11px, padding 2px 8px, border-radius 10px
All must use VC Design System CSS custom properties (--bg-elevated, --text-primary, etc).

### Task 2: Create Database Migration
Create `supabase/migrations/20260331_002_create_projects_tasks_tables.sql` with:
- `projects` table: id UUID PK, name TEXT NOT NULL, description TEXT, crm_deal_id TEXT, deal_value NUMERIC, status TEXT DEFAULT 'planning' CHECK (status IN ('planning','active','completed','archived')), start_date DATE, end_date DATE, owner_id UUID REFERENCES auth.users, team_ids UUID[], tags TEXT[], settings JSONB DEFAULT '{}', created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
- `tasks` table: id UUID PK, project_id UUID REFERENCES projects ON DELETE CASCADE, title TEXT NOT NULL, description TEXT, assigned_to UUID REFERENCES auth.users, status TEXT DEFAULT 'open' CHECK (status IN ('open','in_progress','review','done','blocked')), priority TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high')), due_date DATE, start_date DATE, parent_task_id UUID REFERENCES tasks, tags TEXT[], custom_fields JSONB DEFAULT '{}', completed_at TIMESTAMPTZ, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
- RLS policies: Enable RLS, allow authenticated users to CRUD their own projects (owner_id = auth.uid()), allow task CRUD where project owner_id = auth.uid() or assigned_to = auth.uid()
- Indexes on: tasks(project_id), tasks(assigned_to), tasks(status), projects(owner_id), projects(status)

### Task 3: Add Task Edit Modal
In `ProjectDetail.jsx`:
- Add an `editingTask` state and a modal component
- When a task row is clicked (not the complete checkbox or delete button), open the modal
- Modal fields: title (text), description (textarea), priority (select), status (select with all 5 options), assignee (text for now), due date (date input)
- On save, call `tasksApi.update(taskId, updates)` then reload project
- Use VC Design System styling: `var(--bg-elevated)`, `var(--text-primary)`, etc.

### Task 4: Add Project Edit
In `ProjectDetail.jsx`:
- Add an edit button next to the project name in the header
- Toggle an inline edit form or modal with: name, description, status (select), start date, end date
- On save, call `projectsApi.update(id, updates)` then reload

### Task 5: Add Auth to Dashboard Routes
In `backend/routes/dashboard.js`, add after `const router = express.Router();`:
```js
const { authenticate } = require('../middleware/auth');
router.use(authenticate);
```

## Conventions to Follow
- Use the VCButton, VCBadge components from `../components/vc`
- Use VC CSS custom properties for all colors/fonts (never hardcode colors)
- Use `useConfirm()` hook for destructive actions
- Use optimistic updates with error rollback for mutations
- Keep all API calls through the `api.js` service layer
- Follow existing camelCase (frontend) / snake_case (backend) naming convention
```

---

*End of audit.*
