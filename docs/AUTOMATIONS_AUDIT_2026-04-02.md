# AUTOMATIONS SECTION AUDIT

**Date:** 2026-04-02
**Auditor:** Claude Opus 4.6
**Section:** Automations (including Agents Framework)
**Project:** Entomate

---

## 1. File Inventory

### Frontend — New Architecture (TSX, index.tsx shell)

| File | Lines | Role |
|------|-------|------|
| `src/components/AutomationsView.tsx` | 512 | Main Automations tab component (CRUD, presets) |
| `src/services/automationService.ts` | 411 | Supabase CRUD + trigger evaluation + action execution |
| `src/hooks/useAgents.ts` | 192 | React hook for agents CRUD, test, toggle |
| `src/lib/supabase.ts` (lines 136-149) | 14 | `EntoamateAutomation` interface |

### Frontend — Legacy Architecture (JSX, React Router)

| File | Lines | Role |
|------|-------|------|
| `frontend/src/pages/Automations.jsx` | 725 | Full-featured automations page (templates, history, builder, test, scheduler) |
| `frontend/src/components/AutomationBuilder.jsx` | 748 | Multi-step automation builder (trigger -> actions -> review) |
| `frontend/src/services/api.js` (automationsApi) | 37 | API client for `/api/automations/*` endpoints |

### Backend — Express API

| File | Lines | Role |
|------|-------|------|
| `backend/routes/automations.js` | 870 | Full REST API (CRUD, toggle, execute, test, trigger, schedule, logs) |
| `backend/services/automationEngine.js` | 951 | Action handlers with retry logic, condition evaluation, templates |
| `backend/services/automationScheduler.js` | 283 | Cron-based scheduler using node-cron |
| `backend/schemas/automations.js` | 82 | Zod validation schemas |
| `backend/server.js` (line 237) | 1 | Route registration: `/api/automations` |

### Agents Framework (TypeScript)

| File | Lines | Role |
|------|-------|------|
| `src/agents/types.ts` | 164 | Agent, TriggerEvent, AgentRun types, guardrails |
| `src/agents/agentRegistry.ts` | 223 | Trigger evaluators + action handler registry |
| `src/agents/agentRunner.ts` | 384 | Idempotent runner with retry, guardrails, step recording |
| `src/agents/agentService.ts` | 442 | Agent CRUD, health monitoring, emergency kill switch |
| `src/agents/agentTriggerService.ts` | 446 | Event-based trigger firing (meeting, deal, task, overdue checks) |
| `src/agents/index.ts` | 32 | Module re-exports |
| `src/agents/actions/index.ts` | 54 | 5 action handlers registered |
| `src/agents/actions/extractActionItems.ts` | ~60 | Gemini-powered action extraction |
| `src/agents/actions/syncToCrm.ts` | ~50 | CRM sync action |
| `src/agents/actions/postToPulse.ts` | ~50 | Pulse chat posting |
| `src/agents/actions/createOnboardingProject.ts` | ~70 | Project creation from template |
| `src/agents/actions/assignTask.ts` | ~50 | AI-assisted task assignment |
| `src/agents/actions/prepareContext.ts` | ~60 | Intelligence context assembly |
| `src/agents/triggers/index.ts` | 32 | 4 trigger handlers |
| `src/agents/triggers/*.ts` | ~200 | 4 trigger evaluators |
| `src/agents/templates/index.ts` | 277 | 18 agent templates |
| `src/agents/templates/*.ts` (18 files) | ~1800 | Individual template definitions |

### Database

| File | Role |
|------|------|
| `supabase/migrations/20251219_002_week7_automations_tables.sql` | Tables: automations, automation_logs, ai_agents, agent_execution_logs, team_members, automation_templates |

### Backend Agents (JS — Legacy)

| File | Lines | Role |
|------|-------|------|
| `backend/services/agentOrchestrator.js` | ~200 | Orchestrates JS agents |
| `backend/services/agents/baseAgent.js` | ~80 | Base agent class |
| `backend/services/agents/assignmentAgent.js` | ~120 | Assignment agent |
| `backend/services/agents/deadlineAgent.js` | ~100 | Deadline agent |
| `backend/services/agents/followupAgent.js` | ~120 | Follow-up agent |
| `backend/services/agents/priorityAgent.js` | ~100 | Priority agent |
| `backend/services/agentTemplates.js` | ~150 | Agent template definitions |

### Workflow System (Related — JSX)

| File | Lines | Role |
|------|-------|------|
| `frontend/src/pages/Workflows.jsx` | ~300 | Workflows page |
| `frontend/src/pages/WorkflowBuilder.jsx` | ~500 | Visual workflow builder |
| `frontend/src/components/workflow/*.jsx` (15+ files) | ~2000 | Canvas, toolbar, node config, etc. |
| `backend/services/workflow/*.js` (5 files) | ~800 | Executor, scheduler, templates, node registry |

**TOTAL: ~60+ files, ~11,000+ lines**

---

## 2. Architecture Diagram

```
                          ┌─────────────────────────────────────────────┐
                          │              FRONTEND LAYER                  │
                          ├─────────────────┬───────────────────────────┤
                          │  index.tsx Shell │  React Router (legacy)    │
                          │                 │                           │
                          │ AutomationsView │  Automations.jsx          │
                          │ (TSX - simple)  │  + AutomationBuilder.jsx  │
                          │                 │  (JSX - full-featured)    │
                          ├─────────────────┼───────────────────────────┤
                          │ automationSvc   │  automationsApi           │
                          │ (direct Supa-   │  (HTTP → Express API)     │
                          │  base client)   │                           │
                          └────────┬────────┴──────────┬────────────────┘
                                   │                    │
                    ┌──────────────┘                    └──────────────┐
                    │                                                   │
                    ▼                                                   ▼
    ┌──────────────────────────┐               ┌────────────────────────────────┐
    │  TABLE: entomate_        │               │  EXPRESS BACKEND               │
    │  automations             │               │                                │
    │  (NO MIGRATION!)         │               │  routes/automations.js         │
    │  - TSX service writes    │               │  ├─ automationEngine.js        │
    │    to this table         │               │  │  (15 action handlers)       │
    │  - Different schema      │               │  ├─ automationScheduler.js     │
    │    from 'automations'    │               │  │  (cron-based)               │
    │                          │               │  └─ agentOrchestrator.js       │
    └──────────────────────────┘               │     (JS agents)               │
                                                │                                │
                                                │  TABLE: automations            │
                                                │  TABLE: automation_logs        │
                                                └────────────────────────────────┘

    ┌──────────────────────────────────────────────────────────────────┐
    │  AGENTS FRAMEWORK (TypeScript — src/agents/)                     │
    │                                                                  │
    │  agentTriggerService ──► agentRunner ──► agentRegistry           │
    │  (fire events)          (idempotent    (TRIGGERS + ACTIONS)      │
    │                          execution)                              │
    │                                                                  │
    │  agentService (CRUD)     18 templates     useAgents hook         │
    │                                                                  │
    │  TABLE: agents (NOT in migration!)                               │
    │  TABLE: agent_runs (NOT in migration!)                           │
    │  TABLE: agent_run_steps (NOT in migration!)                      │
    └──────────────────────────────────────────────────────────────────┘
```

### Key Architectural Observations

There are **THREE parallel automation systems** that don't interoperate:

1. **TSX AutomationsView** — Simple CRUD via direct Supabase → `entomate_automations` table (no migration, different schema)
2. **JSX Automations page** — Full-featured UI → Express API → `automations` table (has migration)
3. **Agents Framework** — TypeScript agent system → `agents` table (no migration for agents/agent_runs/agent_run_steps)

---

## 3. Feature Status

### AutomationsView (TSX — index.tsx shell)

| Feature | Status | Notes |
|---------|--------|-------|
| List automations | ⚠️ Partial | Queries `entomate_automations` — table has no migration |
| Create automation | ⚠️ Partial | Direct Supabase insert to non-existent table |
| Edit automation | ⚠️ Partial | Same table issue |
| Delete automation | ⚠️ Partial | Same table issue |
| Toggle active/inactive | ⚠️ Partial | Same table issue |
| Preset automations (4) | ⚠️ Partial | Creates presets to non-existent table |
| Trigger evaluation | ✅ Working | Pure logic — evaluates correctly |
| Action execution (sync_to_crm) | ✅ Working | Calls real service |
| Action execution (post_to_pulse) | ✅ Working | Calls real service |
| Action execution (notify_team) | ✅ Working | Calls real service |
| Action execution (create_project_tasks) | ✅ Working | Calls real service |
| Action execution (webhook) | ✅ Working | fetch() to configured URL |
| Action execution (send_email) | ❌ Broken | Returns "not implemented" |
| Run automations for meeting | ✅ Working | `runAutomationsForMeeting()` — well-built pipeline |
| Dark mode support | ❌ Missing | Hardcoded white backgrounds, no theme support |

### Automations.jsx (Legacy JSX — React Router)

| Feature | Status | Notes |
|---------|--------|-------|
| List automations | ✅ Working | Via Express API → `automations` table |
| Create from templates | ✅ Working | Category-filtered template picker |
| Custom builder (3-step wizard) | ✅ Working | Trigger → Actions → Review |
| Toggle automation | ✅ Working | Via API |
| Delete automation | ✅ Working | With confirm dialog |
| Manual execute | ✅ Working | Via API with toast feedback |
| Dry-run test | ✅ Working | Via `/test` endpoint |
| Execution history | ✅ Working | Loads logs for top 5 automations |
| Scheduler status | ✅ Working | Shows cron schedule + next run |
| Category filter (AI/Integration/CRM) | ✅ Working | Dynamic filtering |
| Wizard progress guide | ✅ Working | 3-step visual guide |
| Error state | ✅ Working | ErrorState component with retry |

### AutomationBuilder.jsx

| Feature | Status | Notes |
|---------|--------|-------|
| Trigger selection (6 types) | ✅ Working | Visual picker with descriptions |
| Scheduled trigger config | ✅ Working | Cron presets + manual + timezone |
| Action picker (11 types) | ✅ Working | Categorized modal |
| Action config forms | ✅ Working | Per-type config UIs |
| Multi-action ordering | ✅ Working | Sequential list with remove |
| Review & save | ✅ Working | Summary view |
| Dry-run test | ✅ Working | Inline test results |

### Backend API (routes/automations.js)

| Feature | Status | Notes |
|---------|--------|-------|
| POST /api/automations (create) | ✅ Working | With Zod validation |
| GET /api/automations (list) | ✅ Working | Pagination, filters |
| GET /api/automations/templates | ✅ Working | Loads workflow templates too |
| GET /api/automations/:id | ✅ Working | Single fetch |
| PUT /api/automations/:id | ✅ Working | Field whitelist filtering |
| DELETE /api/automations/:id | ✅ Working | Cleans up logs first |
| POST /:id/toggle | ✅ Working | Smart toggle if no body |
| POST /:id/execute | ⚠️ Partial | Actions return stub messages ("queued") |
| POST /trigger (service-to-service) | ⚠️ Partial | Actions are stubs |
| GET /:id/logs | ✅ Working | Paginated history |
| POST /:id/test | ✅ Working | Dry-run with previews |
| POST /:id/schedule | ✅ Working | Re-schedule cron jobs |
| GET /scheduler/status | ✅ Working | List scheduled jobs |

### AutomationEngine (backend service)

| Feature | Status | Notes |
|---------|--------|-------|
| handleCreateTask | ✅ Working | Real Supabase insert |
| handleCreateCRMTask | ⚠️ Partial | Depends on crmService.createTask |
| handleSyncToCRM | ✅ Working | Batch sync with status tracking |
| handlePostToChat | ⚠️ Partial | Depends on chatService availability |
| handleSendNotification | 🔇 Stub | Delegates to handlePostToChat |
| handleCreateProject | ✅ Working | Real Supabase insert |
| handleUpdateStatus | ✅ Working | Generic status updater |
| handleExtractActionItems | ✅ Working | Uses Gemini AI |
| handleGenerateSummary | ✅ Working | Uses Gemini AI |
| handleSendEmail | ⚠️ Partial | SendGrid integration; falls back to logging |
| handleSendSlack | ⚠️ Partial | Falls back to logging if no webhook |
| handleRunAgent | ✅ Working | Delegates to agentOrchestrator |
| handleAutoAssign | ✅ Working | AI-based via agentOrchestrator |
| handleAutoPrioritize | ✅ Working | AI-based via agentOrchestrator |
| handleSuggestDeadline | ✅ Working | AI-based via agentOrchestrator |
| handleDetectFollowups | ✅ Working | AI-based with auto-create option |
| Retry logic | ✅ Working | Configurable retries with backoff |
| Condition evaluation | ✅ Working | Nested field comparison operators |
| Template interpolation | ✅ Working | `{{variable.path}}` syntax |

### Automation Scheduler

| Feature | Status | Notes |
|---------|--------|-------|
| Initialize on load | ✅ Working | Loads scheduled automations from DB |
| Schedule cron jobs | ✅ Working | node-cron with timezone |
| Cancel jobs | ✅ Working | On disable/delete |
| Execute scheduled | ⚠️ Partial | `executeAction()` is a stub — returns placeholder |
| Next run time | 🔇 Stub | Always returns `now + 60s` instead of real calculation |
| Graceful shutdown | ✅ Working | Stops all jobs |

### Agents Framework (TypeScript)

| Feature | Status | Notes |
|---------|--------|-------|
| Agent CRUD | ✅ Working | Full service layer |
| Agent Runner | ✅ Working | Idempotent, retry, guardrails, step recording |
| Trigger evaluation | ✅ Working | 5 trigger types with configurable conditions |
| Action execution | ✅ Working | 6 action types with real implementations |
| 18 agent templates | ✅ Working | Well-structured with metadata |
| useAgents hook | ✅ Working | Complete React integration |
| Emergency kill switch | ✅ Working | Disables all agents at once |
| Health monitoring | ✅ Working | 24h success rate, failure tracking |
| Spam detection | ✅ Working | Configurable rate limiting |
| Dry-run mode | ✅ Working | Default on for safety |
| Meeting intelligence integration | ✅ Working | Context assembly for upcoming meetings |
| onMeetingProcessed hook | ✅ Working | Fires agents after meeting processing |
| onDealStageChanged hook | ✅ Working | Fires agents on deal stage changes |

### Database Schema

| Feature | Status | Notes |
|---------|--------|-------|
| `automations` table | ✅ Exists | Migration present |
| `automation_logs` table | ✅ Exists | Migration present |
| `ai_agents` table | ✅ Exists | Migration present (but agents framework queries `agents` table) |
| `agent_execution_logs` table | ✅ Exists | Migration present (but agents framework queries `agent_runs` + `agent_run_steps`) |
| `team_members` table | ✅ Exists | Migration present |
| `automation_templates` table | ✅ Exists | Seeded with 6 templates |
| `entomate_automations` table | ❌ Missing | TSX service references it but no migration |
| `agents` table | ❌ Missing | TS agents framework queries this, but only `ai_agents` exists |
| `agent_runs` table | ❌ Missing | No migration |
| `agent_run_steps` table | ❌ Missing | No migration |
| RLS policies | ❌ Missing | All tables have GRANTs but no RLS policies |

---

## 4. Issues

### RED — Critical

1. **Three incompatible automation systems** — TSX AutomationsView, JSX Automations page, and Agents Framework all exist independently. They use different tables (`entomate_automations`, `automations`, `agents`), different APIs (direct Supabase vs Express), and different type systems.

2. **Missing `entomate_automations` table migration** — The TSX `AutomationsView` component queries `entomate_automations` via `automationService.ts`, but no migration creates this table. Every CRUD operation will fail with a Supabase error.

3. **Missing `agents`, `agent_runs`, `agent_run_steps` table migrations** — The TS agents framework queries these tables, but only `ai_agents` and `agent_execution_logs` exist in migrations. The table names don't match.

4. **Backend action executor in routes is all stubs** — The `executeAction()` function in `routes/automations.js` (line 664-692) returns hardcoded `{ message: "X queued" }` strings for ALL action types. The *real* executor is in `automationEngine.js` but **it's never called from the routes**. Manual execution and trigger execution via the API produce fake results.

5. **Scheduler `executeAction()` is a stub** — `automationScheduler.js` line 190-194: its `executeAction` returns a placeholder instead of delegating to `automationEngine`. All scheduled automations silently do nothing.

6. **No RLS policies on any automation tables** — `automations`, `automation_logs`, `ai_agents`, etc. all grant full CRUD to `anon` and `authenticated` with no row-level restrictions. Any authenticated user can read/modify/delete any other user's automations.

### YELLOW — Medium

7. **prepareContext action not exported from actions/index.ts** — The `agentRegistry.ts` imports and registers `prepareContext`, but `actions/index.ts` doesn't export it. The `actionHandlers` map is missing this entry, meaning `executeAction()` from the index will fail for this type.

8. **AutomationsView has no dark mode support** — Hardcoded `bg-white`, `text-gray-xxx`, `border-gray-xxx` classes throughout. The rest of Entomate uses CSS custom properties for theming.

9. **No error feedback on AutomationsView operations** — `handleCreate`, `handleUpdate`, `handleDelete`, `handleToggle` all silently swallow errors (logged to console only). User sees nothing if Supabase calls fail.

10. **Route `executeAction` vs Engine `executeAction` name collision** — Both `routes/automations.js` and `automationEngine.js` define an `executeAction` function with entirely different behavior. The route uses its own stub version and never delegates to the engine.

11. **Backend trigger/action types are inconsistent** — Routes define trigger types as `TRIGGER_TYPES.MEETING_ENDED = 'meeting_ended'`, but TSX service uses `'meeting_completed'`, and the Agents framework uses `'meeting.completed'`. Three incompatible naming schemes.

12. **Scheduler `getNextRunTime()` returns placeholder** — Line 200-208 in `automationScheduler.js`: always returns `now + 60s` regardless of the actual cron expression. The scheduler status UI shows incorrect next-run times.

13. **`send_email` action always fails in TSX service** — `automationService.ts` line 282: `send_email` case returns `{ success: false, message: 'Email sending not implemented' }`.

14. **Duplicate template definitions** — Automation templates are defined in 4 places: TSX service `PRESET_AUTOMATIONS`, backend route `/templates`, `automationEngine.getTemplates()`, and `automation_templates` DB table. They're different sets with no dedup.

15. **`useAgents` hook loaded but not surfaced in AutomationsView** — The hook is complete and functional but the TSX AutomationsView doesn't use it. The agent management UI only exists in the legacy JSX page.

### GREEN — Nice-to-Have

16. **No automation editing in legacy JSX page** — Users can create and delete but cannot edit existing automations in the Automations.jsx page.

17. **No real-time updates** — Neither frontend subscribes to Supabase realtime for automation status changes or execution logs.

18. **Execution logs limited to top 5 automations** — `Automations.jsx` line 109: `automations.slice(0, 5)` arbitrarily limits log loading.

19. **No pagination on automation lists** — Both frontends load all automations without pagination.

20. **Webhook action in TSX has no URL validation or timeout** — Raw `fetch()` with no timeout, no URL scheme validation, no SSRF protection.

21. **Accessibility gaps** — AutomationsView toggle switch has no aria-label, presets modal has no focus trap, no keyboard navigation for action list.

22. **Backend `optionalAuth` on write endpoints** — `POST /`, `PUT /:id`, `DELETE /:id`, `POST /:id/toggle` use `optionalAuth` middleware, meaning unauthenticated users can create/modify/delete automations. Noted as dev convenience but dangerous.

23. **No rate limiting on execute/trigger endpoints** — Manual execution and trigger endpoints have no throttling.

24. **18 agent templates but no UI to browse/create them** — The TSX shell doesn't render agent templates. The legacy JSX page shows backend templates but not the TS agent templates.

---

## 5. Dead Code & Duplication

| Item | Location | Notes |
|------|----------|-------|
| `backend/services/agents.js` | Backend | Legacy agent service, superseded by `agentOrchestrator.js` |
| `backend/services/agentTemplates.js` | Backend | Duplicated by `automationEngine.getTemplates()` and DB templates |
| `PRESET_AUTOMATIONS` array | TSX service | Duplicates backend templates (different format) |
| `automationEngine.getTemplates()` | Backend | Duplicates route templates and DB seeds |
| `frontend/src/pages/Workflows.jsx` + builder | Frontend | Separate workflow system that overlaps with automations |
| `scheduled` trigger type in TSX service | TSX | Returns `false` always — never fires from TSX path |
| `ActionType.send_email` in TSX service | TSX | Defined but always fails |

---

## 6. Revisal Plan

### Phase 1: Fix Critical — Make It Work (Priority: HIGH)

1. **Unify on a single automation system**
   - Decision: Keep the Express backend + JSX frontend as the primary system (more complete)
   - Rewrite `AutomationsView.tsx` to call the Express API (like `automationsApi`) instead of direct Supabase to `entomate_automations`
   - OR create the `entomate_automations` migration and keep both systems (not recommended)

2. **Wire route executor to automationEngine**
   - In `routes/automations.js`, replace the stub `executeAction()` function with a call to `automationEngine.execute()` or `automationEngine.executeAction()`
   - This fixes manual execution, trigger execution, and test endpoints

3. **Wire scheduler to automationEngine**
   - In `automationScheduler.js`, replace the stub `executeAction()` with a call to `automationEngine.executeAction()`
   - This fixes all scheduled automations

4. **Fix database table name mismatches for Agents Framework**
   - Create migration for `agents`, `agent_runs`, `agent_run_steps` tables
   - OR update the agents framework to query `ai_agents` and `agent_execution_logs` (matching existing migration)

5. **Add RLS policies to automation tables**
   - `automations`: users can only CRUD their own (by `user_id` or `created_by`)
   - `automation_logs`: read-only, scoped to user's automations
   - Similar for agent tables

### Phase 2: Wire Up Partial Functionality (Priority: MEDIUM)

6. **Fix `prepareContext` action export** — Add to `src/agents/actions/index.ts`

7. **Normalize trigger/action type naming** — Pick one convention (`snake_case` recommended) and map between systems

8. **Add dark mode to AutomationsView** — Use CSS custom properties or themeClasses pattern

9. **Add user-facing error feedback** — Toast/alert on failed CRUD operations in AutomationsView

10. **Fix `getNextRunTime()` in scheduler** — Use `cron-parser` package to compute actual next occurrence

11. **Implement email action** — Wire to SendGrid or remove from UI options

12. **Switch write endpoints from `optionalAuth` to `authenticate`**

### Phase 3: Consolidate & Refactor (Priority: LOW)

13. **Consolidate template definitions** — Single source of truth (DB table `automation_templates`) populated by migration, served by API

14. **Merge Agents Framework into automation system** — Expose TS agents as a special category of automations, share the same CRUD UI

15. **Remove dead code** — `backend/services/agents.js`, `agentTemplates.js`, duplicate template arrays, `entomate_automations` references

16. **Add editing to JSX page** — Pre-populate builder with existing automation data

17. **Add real-time subscriptions** — Supabase realtime for execution status updates

### Phase 4: Polish & New Features

18. **Add rate limiting** — Throttle execute/trigger endpoints

19. **Add webhook URL validation + timeout** — SSRF protection, 10s timeout

20. **Add accessibility** — Focus traps, aria-labels, keyboard navigation

21. **Add pagination** — Server-side pagination for automation lists

22. **Agent template browser UI** — Surface the 18 TS agent templates in the UI

23. **Automation versioning** — Track changes to automation configurations

24. **Conditional action chains** — If action A fails, skip action B (already partially supported via `stopOnFailure`)

---

## 7. Claude Agent Prompt — Revisal Implementation

```
You are implementing the Phase 1 and Phase 2 revisal of the Entomate Automations section based on audit findings from 2026-04-02.

## Project Context
- Entomate is at f:\entomate
- React + TypeScript frontend (dual architecture: index.tsx shell + React Router JSX pages)
- Express.js backend at backend/
- Supabase for database
- Three parallel automation systems need to be unified

## Current State Summary
There are three disconnected automation systems:
1. TSX AutomationsView (src/components/AutomationsView.tsx) → queries non-existent `entomate_automations` table
2. JSX Automations page (frontend/src/pages/Automations.jsx) → Express API → `automations` table (working)
3. TypeScript Agents Framework (src/agents/) → queries non-existent `agents` table (should use `ai_agents`)

The backend route executor and scheduler both use stub executeAction() that return fake "queued" messages instead of delegating to the real automationEngine.js.

## Tasks (in order)

### Task 1: Wire route executor to automation engine
File: backend/routes/automations.js
- Replace the stub `executeAction()` function (lines 664-692) to delegate to `require('../services/automationEngine')`
- The engine's `executeAction(action, triggerData)` method takes an action object and trigger data
- Ensure the route's manual execute endpoint (POST /:id/execute) and trigger endpoint (POST /trigger) both use the real engine

### Task 2: Wire scheduler to automation engine
File: backend/services/automationScheduler.js
- Replace the stub `executeAction()` method (lines 190-194) to delegate to automationEngine
- Import automationEngine at the top
- Call `automationEngine.executeAction(action, triggerData)` for each action

### Task 3: Fix scheduler getNextRunTime()
File: backend/services/automationScheduler.js
- Install cron-parser: npm install cron-parser
- Replace the placeholder getNextRunTime() (lines 200-208) with real calculation using cron-parser

### Task 4: Rewrite AutomationsView to use Express API
File: src/components/AutomationsView.tsx
- Instead of importing from automationService.ts (direct Supabase to entomate_automations)
- Create a thin API client that calls /api/automations/* endpoints (matching what automationsApi does in frontend/src/services/api.js)
- Keep the same UI structure but wire to real backend
- Add dark mode support using CSS custom properties

### Task 5: Fix agent table name mismatches
File: Create new migration supabase/migrations/20260402_fix_agent_table_names.sql
- The agents framework (src/agents/) queries: `agents`, `agent_runs`, `agent_run_steps`
- The existing migration creates: `ai_agents`, `agent_execution_logs`
- Create views or rename tables to match what the code expects
- Add the missing `agent_runs` and `agent_run_steps` tables

### Task 6: Fix prepareContext action export
File: src/agents/actions/index.ts
- Add `import * as prepareContext from './prepareContext'`
- Add `'prepare_context': prepareContext` to the actionHandlers map

### Task 7: Add RLS policies
File: Create migration supabase/migrations/20260402_automation_rls.sql
- Enable RLS on automations, automation_logs, ai_agents, agent_execution_logs, team_members
- Automations: users see own (by user_id or created_by), admins see all
- Logs: read-only, scoped to user's automations via FK
- Revoke overly-broad anon grants

### Task 8: Add error feedback to AutomationsView
- Wrap CRUD operations in try/catch with user-facing error toast
- Show loading states on buttons during async operations

### Task 9: Switch write endpoints from optionalAuth to authenticate
File: backend/routes/automations.js
- Change POST /, PUT /:id, DELETE /:id, POST /:id/toggle from optionalAuth to authenticate
- Keep GET endpoints as-is

## Key Files to Read First
- backend/routes/automations.js (870 lines — the route layer with stub executor)
- backend/services/automationEngine.js (951 lines — the real executor)
- backend/services/automationScheduler.js (283 lines — cron scheduler with stub)
- src/components/AutomationsView.tsx (512 lines — TSX component hitting wrong table)
- src/agents/agentService.ts (442 lines — queries `agents` table)
- supabase/migrations/20251219_002_week7_automations_tables.sql (schema)

## Do NOT
- Do not delete the legacy JSX Automations page or AutomationBuilder — they work
- Do not merge the Agents Framework into the automation system yet (Phase 3)
- Do not touch workflow files (separate section)
- Do not remove the automationService.ts file — it has useful trigger evaluation and action execution logic that can be reused
```

---

## 8. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Users create automations via TSX that silently fail | HIGH | Phase 1 Task 4 — rewire to real API |
| Scheduled automations do nothing | HIGH | Phase 1 Task 2 — wire to engine |
| Manual execution returns fake results | HIGH | Phase 1 Task 1 — wire to engine |
| Agent runs write to non-existent tables | HIGH | Phase 1 Task 5 — fix migrations |
| Any user can delete any automation | MEDIUM | Phase 1 Task 7 — add RLS |
| Auth bypass on write endpoints | MEDIUM | Phase 2 Task 9 — require auth |

---

*Audit complete. The Automations section has a solid foundation with well-designed engines (automationEngine.js, agentRunner.ts) that are simply not wired to the UI and routes correctly. The primary work is plumbing, not rebuilding.*
