# AI Agents Section — Full Audit

**Date:** 2026-04-02
**Auditor:** Claude Opus 4.6
**Section:** AI Agents (Agent Framework, Orchestration, Explainability, Learning)

---

## 1. File Inventory

### Frontend (UI)
| File | Lines | Purpose |
|------|-------|---------|
| `frontend/src/pages/Agents.jsx` | 790 | Main Agents page — template gallery, agent list, diagnostics, performance analytics |
| `frontend/src/components/intelligence/AgentRecommendationPanel.jsx` | 252 | Inline recommendation panel for task creation (assignment, priority, deadline) |
| `frontend/src/components/explainability/ExplanationCard.jsx` | 195 | Collapsible explanation card showing AI reasoning |
| `frontend/src/components/explainability/ExplanationModal.jsx` | 192 | Full-screen explanation detail modal |
| `frontend/src/components/explainability/AlternativesList.jsx` | ~80 | Shows alternative recommendations |
| `frontend/src/components/explainability/ConfidenceBadge.jsx` | ~40 | Color-coded confidence score badge |
| `frontend/src/components/explainability/FactorBreakdown.jsx` | ~100 | Visual factor weight breakdown |
| `frontend/src/components/explainability/FactorDetail.jsx` | ~60 | Individual factor detail view |
| `frontend/src/components/explainability/FactorList.jsx` | ~80 | List of decision factors |
| `frontend/src/components/explainability/ExplanationFeedback.jsx` | ~60 | Feedback capture for explanations |
| `frontend/src/components/explainability/ProgressBar.jsx` | ~30 | Reusable progress bar |
| `frontend/src/components/explainability/Tooltip.jsx` | ~40 | Tooltip component |
| `frontend/src/components/learning/LearningDashboard.jsx` | ~150 | Dashboard for viewing learned patterns |
| `frontend/src/components/learning/PatternCard.jsx` | ~80 | Individual pattern card |
| `frontend/src/components/learning/PatternApprovalModal.jsx` | ~120 | Approve/reject learned patterns |
| `frontend/src/components/learning/FeedbackPrompt.jsx` | ~80 | Post-action feedback prompt |
| `frontend/src/components/learning/EffectivenessReport.jsx` | ~100 | Pattern effectiveness reporting |

### Backend (API & Services)
| File | Lines | Purpose |
|------|-------|---------|
| `backend/routes/agents.js` | 527 | REST routes — CRUD, trigger, execute, logs, feedback, orchestration |
| `backend/routes/agentTasks.js` | 290 | Task intelligence routes — overdue, ETA, auto-assign |
| `backend/schemas/agents.js` | 104 | Zod validation schemas for agent routes |
| `backend/services/aiAgentService.js` | 686 | Core service — AIAgent class, trigger engine, CRUD, execution logging |
| `backend/services/agents.js` | 170 | Simple agent registry (assignment, priority, deadline, followup) with Gemini |
| `backend/services/agentOrchestrator.js` | 278 | Multi-agent orchestration (sequential, parallel, meeting processing) |
| `backend/services/agentTemplates.js` | 1545 | 19 predefined agent templates across 7 categories |
| `backend/services/agents/baseAgent.js` | 69 | Base class for typed agents |
| `backend/services/agents/assignmentAgent.js` | 247 | Assignment agent with AI + workload analysis + learning |
| `backend/services/agents/priorityAgent.js` | 264 | Priority agent with keyword extraction + AI + learning |
| `backend/services/agents/deadlineAgent.js` | 332 | Deadline agent with complexity estimation + AI + learning |
| `backend/services/agents/followupAgent.js` | 496 | Follow-up detection with pattern matching + AI + learning |
| `backend/services/explainability/ExplainabilityService.js` | 1013 | Generates structured explanations for AI decisions |
| `backend/services/explainability/ExplanationAnalytics.js` | 319 | Tracks explanation views, expansions, overrides |
| `backend/services/explainability/NaturalLanguageGenerator.js` | 296 | Converts structured factors into human-readable text |
| `backend/services/learning/LearningEngine.js` | 375 | Applies learned patterns to recommendations |
| `backend/services/learning/PatternDetectionService.js` | 529 | Detects behavioral patterns from user feedback |
| `backend/services/learning/FeedbackService.js` | 252 | Records user feedback on agent decisions |
| `backend/services/learning/OutcomeTracker.js` | 424 | Tracks real outcomes to validate agent predictions |

### TypeScript Agent Framework (`src/agents/`)
| File | Lines | Purpose |
|------|-------|---------|
| `src/agents/types.ts` | 163 | Type definitions — TriggerType, ActionType, Agent, AgentRun, Guardrails |
| `src/agents/agentRegistry.ts` | 222 | Trigger and action handler registries with validation |
| `src/agents/agentRunner.ts` | 383 | Execution engine — idempotency, retries, guardrails, step recording |
| `src/agents/agentTriggerService.ts` | 445 | Event-based trigger firing (meeting, deal, task events) |
| `src/agents/index.ts` | 31 | Module re-exports |
| `src/agents/actions/index.ts` | 56 | Action handler registry |
| `src/agents/actions/extractActionItems.ts` | ~80 | Extract action items from meeting transcripts |
| `src/agents/actions/syncToCrm.ts` | ~80 | Sync data to Logos Vision CRM |
| `src/agents/actions/postToPulse.ts` | ~80 | Post messages to Pulse |
| `src/agents/actions/createOnboardingProject.ts` | ~80 | Create onboarding projects |
| `src/agents/actions/assignTask.ts` | ~80 | Auto-assign tasks |
| `src/agents/actions/prepareContext.ts` | ~80 | Assemble cross-app context for intelligence profiles |

### Database Migrations
| File | Purpose |
|------|---------|
| `supabase/migrations/20260402000001_fix_agent_table_names.sql` | Creates `agents`, `agent_runs`, `agent_run_steps` tables (for TS framework) |
| `supabase/migrations/20260402000003_seed_agent_templates.sql` | Seeds 19 templates into `automation_templates` |
| `docs/migrations/001_agent_explanations.sql` | Creates `agent_explanations` table |

**Total:** ~10,945 lines across ~40 files

---

## 2. Architecture Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                           │
│                                                                     │
│  ┌──────────────┐   ┌────────────────────┐   ┌──────────────────┐  │
│  │ Agents.jsx   │   │ AgentRecommendation│   │ Explainability   │  │
│  │ (Main Page)  │   │ Panel.jsx          │   │ Components (11)  │  │
│  │              │   │                    │   │                  │  │
│  │ • Template   │   │ • Assignment rec   │   │ • ExplanationCard│  │
│  │   Gallery    │   │ • Priority rec     │   │ • ExplanationModal│ │
│  │ • Agent List │   │ • Deadline rec     │   │ • FactorBreakdown│  │
│  │ • Diagnostics│   │ • Accept/Override  │   │ • Alternatives   │  │
│  │ • Customize  │   │ • Why? buttons     │   │ • Feedback       │  │
│  │ • Analytics  │   │                    │   │                  │  │
│  └──────┬───────┘   └────────┬───────────┘   └────────┬─────────┘  │
│         │                    │                         │            │
│  ┌──────┴────────────────────┴─────────────────────────┴──────────┐ │
│  │                    api.js (agentsApi)                          │ │
│  │  .list() .getTemplates() .create() .toggle() .execute()       │ │
│  │  .getLogs() .getStats() .orchestrate() .processMeeting()      │ │
│  │  .getExplanation() .feedback() .trackAnalytics()              │ │
│  └───────────────────────────┬────────────────────────────────────┘ │
└──────────────────────────────┼──────────────────────────────────────┘
                               │ HTTP
┌──────────────────────────────┼──────────────────────────────────────┐
│                       BACKEND (Express)                             │
│                               │                                     │
│  ┌────────────────────────────┴─────────────────────────────────┐   │
│  │          routes/agents.js     routes/agentTasks.js           │   │
│  │   /api/agents/*               /api/agent-tasks/*             │   │
│  └──────┬──────────────────────────────────┬────────────────────┘   │
│         │                                  │                        │
│  ┌──────┴──────────┐  ┌───────────────┐  ┌┴────────────────────┐   │
│  │ aiAgentService  │  │ agentOrchest- │  │ agentTasks routes  │   │
│  │ (AIAgent class) │  │ rator.js      │  │ (overdue, ETA,     │   │
│  │                 │  │               │  │  auto-assign)      │   │
│  │ • trigger()     │  │ • runAgent()  │  │                    │   │
│  │ • execute()     │  │ • orchestrate │  │ Direct Supabase    │   │
│  │ • CRUD ops      │  │ • parallel()  │  │ queries            │   │
│  │ • gatherContext │  │ • meeting()   │  └────────────────────┘   │
│  │ • makeDecisions │  │ • apply()     │                            │
│  │ • memory/learn  │  └──────┬────────┘                            │
│  └──────┬──────────┘         │                                     │
│         │            ┌───────┴────────┐                            │
│         │            │  agents.js     │                            │
│         │            │  (Registry)    │                            │
│         │            │  4 agents:     │                            │
│         │            │  assignment,   │                            │
│         │            │  priority,     │                            │
│         │            │  deadline,     │                            │
│         │            │  followup      │                            │
│         │            └───────┬────────┘                            │
│         │                    │                                     │
│  ┌──────┴────────┐  ┌───────┴────────┐  ┌──────────────────────┐  │
│  │ agents/       │  │ Explainability │  │ Learning Engine     │  │
│  │ baseAgent.js  │  │ Service        │  │                     │  │
│  │ assignment*.js│  │                │  │ • LearningEngine    │  │
│  │ priority*.js  │  │ • Generate     │  │ • PatternDetection  │  │
│  │ deadline*.js  │  │ • Store        │  │ • FeedbackService   │  │
│  │ followup*.js  │  │ • Analytics    │  │ • OutcomeTracker    │  │
│  └───────────────┘  │ • NLG          │  └──────────────────────┘  │
│                     └────────────────┘                             │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│              TypeScript Agent Framework (src/agents/)               │
│               SEPARATE SYSTEM — NOT WIRED TO BACKEND                │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ types.ts     │  │ agentRegistry│  │ agentRunner.ts           │  │
│  │              │  │ .ts          │  │ • Idempotency            │  │
│  │ TriggerType  │  │              │  │ • Retries (exp backoff)  │  │
│  │ ActionType   │  │ 5 Triggers   │  │ • Guardrails             │  │
│  │ Agent        │  │ 6 Actions    │  │ • Step recording         │  │
│  │ AgentRun     │  │ Validation   │  │ • Dry-run support        │  │
│  │ Guardrails   │  │              │  │                          │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────┐  ┌────────────────────────────────────┐  │
│  │ agentTriggerService  │  │ actions/                           │  │
│  │ .ts                  │  │ extractActionItems, syncToCrm,     │  │
│  │                      │  │ postToPulse, createOnboardingProject│ │
│  │ Event-based triggers │  │ assignTask, prepareContext          │  │
│  └──────────────────────┘  └────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                        DATABASE (Supabase)                          │
│                                                                     │
│  Legacy tables (backend):           New tables (TS framework):      │
│  ┌─────────────────────┐            ┌──────────────────────┐       │
│  │ ai_agents            │            │ agents               │       │
│  │ agent_executions     │            │ agent_runs           │       │
│  │ agent_explanations   │            │ agent_run_steps      │       │
│  │ automation_templates │            └──────────────────────┘       │
│  │ learning_patterns    │                                           │
│  └─────────────────────┘                                           │
└─────────────────────────────────────────────────────────────────────┘

External APIs:
  • Gemini (via config/gemini.js) — AI decision-making, text generation
  • Gemini (via config/ai.js)    — Used by typed agents for chat prompts
  • Supabase                     — Database, storage, auth
  • Pulse (cross-app)            — Post messages via ecosystem bridge
  • Logos CRM (cross-app)        — Sync deals, contacts
```

---

## 3. Feature Status Catalog

### 3.1 Agent Management (CRUD & UI)
| Feature | Status | Notes |
|---------|--------|-------|
| List agents | ✅ Working | Fetches from `ai_agents` table via API |
| Create agent (blank) | ⚠️ Partial | "Create Agent" button opens `showCreateModal` but **no modal component exists** — renders nothing |
| Create from template (Quick Deploy) | ✅ Working | Template → `createFromTemplate()` → inserts into `ai_agents` |
| Create from template (Customize) | ⚠️ Partial | Customization modal works for name/description but **cannot add new triggers/actions** — only remove existing ones |
| Toggle agent (enable/disable) | ✅ Working | API + DB toggle working |
| Delete agent | ❌ Broken | Trash icon exists in UI but **has no onClick handler** — does nothing |
| View agent details/diagnostics | ✅ Working | Side panel shows config, live logs |
| Agent filter/search | 🔇 Stub | Filter input rendered but **not wired** — no filtering logic |
| Performance analytics panel | ⚠️ Partial | Shows execution count + success rate from DB, but **"Avg Duration" is hardcoded to "2.4s"** |

### 3.2 Agent Templates
| Feature | Status | Notes |
|---------|--------|-------|
| Template gallery with categories | ✅ Working | 19 templates, 7 categories, category tabs |
| Quick Start section | ✅ Working | Shows first 3 templates |
| Deploy from template | ✅ Working | Inserts into `ai_agents` |
| Template category filtering | ✅ Working | Category tabs work |
| Template customization wizard | ⚠️ Partial | Can edit name/description, remove triggers/actions, but **no way to add** new ones |
| Seed templates to automation_templates | ✅ Working | Migration `20260402000003` seeds templates |

### 3.3 Agent Execution
| Feature | Status | Notes |
|---------|--------|-------|
| Manual agent execution | ✅ Working | POST `/agents/:id/execute` → triggers AIAgent pipeline |
| Event-based triggering | ✅ Working | `aiAgentService.trigger()` matches agents by trigger type |
| Context gathering | ✅ Working | Gathers deals, meetings, tasks based on trigger type |
| AI decision-making (Gemini) | ✅ Working | Builds prompts, parses JSON decisions |
| Rule-based fallback | ✅ Working | Falls back to condition evaluation when AI fails |
| Action execution | ⚠️ Partial | Calls `automationEngine.executeAction()` — depends on that engine existing |
| Execution logging | ✅ Working | Logs to `agent_executions` table |
| Memory/learning updates | ✅ Working | Updates `memory` JSONB on agent record |
| Stats tracking | ✅ Working | Increments `execution_count`, updates `success_rate` |

### 3.4 Agent Orchestration
| Feature | Status | Notes |
|---------|--------|-------|
| Single agent run | ✅ Working | `agentOrchestrator.runAgent()` |
| Sequential orchestration | ✅ Working | Context enrichment between agents |
| Parallel orchestration | ✅ Working | `Promise.all()` execution |
| Meeting processing | ✅ Working | Runs priority + deadline agents per action item |
| Apply suggestions | ✅ Working | Updates `action_items` in DB |
| Orchestration logs | ✅ Working | In-memory log (last 100) |

### 3.5 Agent Task Intelligence
| Feature | Status | Notes |
|---------|--------|-------|
| Overdue task detection | ✅ Working | Queries tasks with past due dates |
| ETA prediction | ✅ Working | Historical stats + workload adjustments |
| Auto-assignment | ✅ Working | Balanced workload strategy |

### 3.6 Explainability Layer
| Feature | Status | Notes |
|---------|--------|-------|
| Explanation generation | ✅ Working | Factor calculation, alternatives, confidence scoring |
| Explanation storage | ✅ Working | Stores in `agent_explanations` table |
| ExplanationCard component | ✅ Working | Adaptive UI, collapsible details |
| ExplanationModal component | ✅ Working | Full-screen detail view |
| Analytics tracking | ✅ Working | Tracks views, expansions, overrides |
| Accept/Change recommendations | ✅ Working | Wired through ExplanationCard |

### 3.7 Learning System
| Feature | Status | Notes |
|---------|--------|-------|
| Pattern detection | ✅ Working | Detects behavioral patterns from feedback |
| Learning application | ✅ Working | Applies patterns to future recommendations |
| Feedback capture | ✅ Working | Records ratings and notes |
| Outcome tracking | ✅ Working | Validates predictions against reality |
| LearningDashboard | ⚠️ Partial | Component exists, needs route/integration verification |
| Pattern approval flow | ⚠️ Partial | Modal exists but unclear if wired into navigation |

### 3.8 TypeScript Agent Framework (src/agents/)
| Feature | Status | Notes |
|---------|--------|-------|
| Type definitions | ✅ Working | Comprehensive types for triggers, actions, runs |
| Trigger registry | ✅ Working | 5 trigger types with condition evaluation |
| Action registry | ✅ Working | 6 action types with handlers |
| Agent runner | ✅ Working | Idempotency, retries, guardrails |
| Trigger service | ✅ Working | Event-based trigger firing |
| Agent validation | ✅ Working | Validates agent config against registry |
| **Integration with backend** | ❌ Not Wired | TS framework queries `agents` table; backend queries `ai_agents`. **Two separate systems.** |

---

## 4. Issues Found

### 🔴 Critical

**C1: Two Parallel Agent Systems Not Integrated**
- The backend (Express/JS) uses `ai_agents` + `agent_executions` tables
- The TypeScript framework (`src/agents/`) uses `agents` + `agent_runs` + `agent_run_steps` tables
- These are **completely separate systems** that don't talk to each other
- The UI (`Agents.jsx`) only talks to the backend system
- The TS framework has superior guardrails, idempotency, and step recording but **is never invoked from the frontend or backend routes**
- **Impact:** Half the agent infrastructure is dead code

**C2: Delete Agent Button Not Wired**
- [Agents.jsx:329](frontend/src/pages/Agents.jsx#L329): `<VCButton variant="ghost" size="sm"><Trash2 /></VCButton>` — no `onClick`
- Users can create agents but cannot delete them through the UI
- **Impact:** Agent cleanup impossible via UI

**C3: "Create Agent" Modal Missing**
- [Agents.jsx:209](frontend/src/pages/Agents.jsx#L209): `setShowCreateModal(true)` is called but there is **no modal rendered** for `showCreateModal`
- The state variable exists, the button exists, but the modal component/JSX does not
- **Impact:** Custom (non-template) agent creation is completely broken

### 🟡 Medium

**M1: Agent Filter Input Not Wired**
- [Agents.jsx:261](frontend/src/pages/Agents.jsx#L261): Filter input renders but has no `onChange` or filtering logic
- **Impact:** Cannot filter agents when list grows

**M2: Performance Analytics "Avg Duration" Hardcoded**
- [Agents.jsx:684](frontend/src/pages/Agents.jsx#L684): `<div>2.4s</div>` — hardcoded value, not computed from execution logs
- **Impact:** Misleading analytics display

**M3: Customization Modal Cannot Add Triggers/Actions**
- The customization modal can only remove triggers/actions, not add new ones
- No UI for selecting from available trigger types or action types
- **Impact:** Customization is limited to renaming and removing

**M4: Duplicate Agent Registry Systems**
- `backend/services/agents.js` defines 4 agents inline with Gemini prompts
- `backend/services/agents/*.js` defines 4 typed agents with BaseAgent class + AI config + Learning
- Both are importable but serve different orchestration paths
- **Impact:** Confusing codebase, potential inconsistency in behavior

**M5: Agent Templates Seeded to Wrong Table**
- `agentTemplates.js` returns hardcoded templates (used by API `/agents/templates`)
- Migration `20260402000003` seeds into `automation_templates` (used by automations page)
- The agent page doesn't read from `automation_templates`
- **Impact:** Template data duplication and potential drift

**M6: ExplanationCard `api.agents.getExplanation()` Method Path**
- [ExplanationCard.jsx:28](frontend/src/components/explainability/ExplanationCard.jsx#L28) calls `api.post('/agents/analytics/track')` directly
- [Agents.jsx:104](frontend/src/pages/Agents.jsx#L104) calls `api.agents.getExplanation()` — mixing direct `api.get/post()` and namespaced `api.agents.*`
- **Impact:** Inconsistent API call patterns; potential breakage if API shape changes

**M7: Orchestrator Logs Are In-Memory Only**
- `agentOrchestrator.executionLogs` is a class-level array — lost on server restart
- Capped at 100 entries
- **Impact:** No persistent orchestration audit trail

**M8: `automationEngine.executeAction()` Dependency Not Verified**
- `aiAgentService.js` line 312 calls `automationEngine.executeAction(action, data)` for action execution
- If automationEngine doesn't handle the action types that agents produce, actions silently fail
- **Impact:** Agent actions may not actually execute

**M9: RLS Policies Too Permissive**
- Both `agents` and `ai_agents` tables have `USING (true) WITH CHECK (true)` policies
- Any authenticated user can read/modify any user's agents
- **Impact:** Security — users can tamper with other users' agents

### 🟢 Nice-to-Have

**N1: No Agent Builder Wizard for Custom Agents**
- The design doc mentions an "Agent Builder UI" (`entomate-docs/Phase 2/03-AGENT-BUILDER-UI-SPECS.md`) but it's not implemented
- Only template-based creation works

**N2: No Drag-and-Drop Action Ordering in Customization**
- Actions in the customize modal show step numbers but can't be reordered

**N3: No Real-Time Agent Status Updates**
- Agent execution status doesn't update in real-time (no WebSocket/subscription)
- User must refresh or re-select agent to see new logs

**N4: Missing Batch Operations**
- No bulk enable/disable/delete for agents

**N5: Learning Dashboard Not Accessible from Agents Page**
- Learning components exist but there's no navigation path from the Agents page

**N6: No Agent Execution History Chart**
- Performance analytics panel shows numbers but no visual timeline/chart

**N7: Missing Loading State for Explanation Fetch**
- Individual execution log entries show loading spinners but the overall panel doesn't indicate bulk-loading state

**N8: TypeScript Framework Missing `agentService.ts` Export**
- `src/agents/index.ts` exports from `./agentService` but this file doesn't appear in the file tree — potential missing file

---

## 5. Dead Code & Redundancy

| Item | Location | Issue |
|------|----------|-------|
| `showCreateModal` state | `Agents.jsx:30` | State exists but no corresponding modal JSX |
| `backend/services/agents.js` inline agents | 170 lines | Duplicates functionality of `backend/services/agents/*.js` typed agents |
| Entire `src/agents/` TS framework | ~1,380 lines | Not wired to any Express route or frontend call |
| `require.cache` clearing | `routes/agents.js:42` | Debug hack clearing require cache for templates — should be removed |
| `_debug` field in templates response | `routes/agents.js:53-56` | Debug metadata leaking to client |

---

## 6. Revisal Plan

### Phase 1: Fix Critical Issues (Broken Functionality)

**1.1 Wire Delete Agent Button**
- Add `onClick` handler to delete button in `Agents.jsx:329`
- Add confirmation dialog before deletion
- Call `api.delete(`/agents/${selectedAgent.id}`)` then refresh

**1.2 Build Create Agent Modal**
- Create a modal for `showCreateModal` state with:
  - Name, description, agent_type fields
  - Trigger type selector (from available triggers)
  - Action step builder (from available actions)
  - Config fields per trigger/action type
- Wire to `api.post('/agents', agentData)`

**1.3 Decide on Agent System Unification**
- **Option A (Recommended):** Migrate backend routes to use the TS agent framework
  - Update Express routes to call `runSingleAgent()` / `processTriggeredAgents()`
  - Benefits: idempotency, guardrails, step recording, dry-run
  - Work: Medium — rewrite `aiAgentService` methods to delegate to TS runner
- **Option B:** Port TS framework features into existing backend
  - Add guardrails, idempotency, step recording to `aiAgentService.js`
  - Benefits: Less disruptive
  - Work: Medium — but duplicates effort

### Phase 2: Wire Stubs & Fix Medium Issues

**2.1 Wire Agent Filter**
- Add `filterText` state + `onChange` to filter input
- Filter `agents` array by name/description match

**2.2 Fix Hardcoded Avg Duration**
- Compute from `executionLogs` data: `logs.reduce((sum, l) => sum + (l.duration_ms || 0), 0) / logs.length`

**2.3 Enhance Customization Modal**
- Add "Add Trigger" button with dropdown of available trigger types
- Add "Add Action" button with dropdown of available action types
- Add drag-and-drop reordering for actions

**2.4 Consolidate Agent Registries**
- Remove `backend/services/agents.js` inline agents
- Have orchestrator use the typed agents (`backend/services/agents/*.js`)
- Or unify under the TS framework (per Phase 1.3 decision)

**2.5 Fix Template Seeding Alignment**
- Either remove `automation_templates` seeding or make agent page read from it
- Single source of truth for templates

**2.6 Remove Debug Code**
- Remove `require.cache` clearing in `routes/agents.js:42`
- Remove `_debug` field from templates response

### Phase 3: Architecture & Security Improvements

**3.1 Tighten RLS Policies**
- Add `created_by = auth.uid()` checks to agent tables
- Ensure users can only see/modify their own agents
- Add team-level access for shared agents

**3.2 Persist Orchestration Logs**
- Move `agentOrchestrator.executionLogs` to database
- Create `orchestration_runs` table or reuse `agent_runs`

**3.3 Verify `automationEngine` Integration**
- Audit `automationEngine.executeAction()` to confirm it handles all agent action types
- Add fallback/error logging if action type is unrecognized

**3.4 Consistent API Call Pattern**
- Standardize on `api.agents.*` namespaced calls throughout frontend
- Remove direct `api.get/post` calls for agent endpoints

### Phase 4: New Features & Polish

**4.1 Agent Builder Wizard**
- Full step-by-step wizard for creating custom agents
- Visual trigger/action configuration
- Test execution with dry-run before deployment

**4.2 Real-Time Status Updates**
- Use Supabase Realtime subscriptions for agent execution updates
- Live log streaming in diagnostics panel

**4.3 Execution History Chart**
- Add timeline chart to Performance Analytics panel
- Show success/failure over time

**4.4 Navigation to Learning Dashboard**
- Add "Learning Insights" tab or link from Agents page
- Show pattern effectiveness per agent

**4.5 Batch Agent Operations**
- Multi-select agents for bulk enable/disable/delete

---

## 7. Claude Agent Prompt — Revisal Implementation

```
You are implementing the AI Agents revisal plan for the Entomate project.

PROJECT: Entomate (f:/entomate)
TECH STACK: React (frontend/src/), Express.js (backend/), TypeScript (src/agents/), Supabase, Gemini AI

## Context

The AI Agents section has two parallel agent systems that need unification:
1. Backend (Express/JS): Uses `ai_agents` + `agent_executions` tables, `aiAgentService.js`
2. TypeScript Framework: Uses `agents` + `agent_runs` + `agent_run_steps` tables, has guardrails/idempotency/retries

The frontend (Agents.jsx) only talks to system #1.

## Critical Files

### Frontend
- `frontend/src/pages/Agents.jsx` (790 lines) — Main page, needs: delete wiring, create modal, filter, avg duration fix
- `frontend/src/components/intelligence/AgentRecommendationPanel.jsx` (252 lines) — Working, no changes needed
- `frontend/src/components/explainability/` (11 components) — Working, no changes needed

### Backend Routes
- `backend/routes/agents.js` (527 lines) — REST API, needs: debug code removal
- `backend/routes/agentTasks.js` (290 lines) — Working, no changes needed

### Backend Services
- `backend/services/aiAgentService.js` (686 lines) — Core service, AIAgent class + AIAgentService class
- `backend/services/agents.js` (170 lines) — Simple registry (4 agents with Gemini), REDUNDANT with typed agents
- `backend/services/agentOrchestrator.js` (278 lines) — Orchestration, logs are in-memory only
- `backend/services/agentTemplates.js` (1545 lines) — 19 templates, hardcoded
- `backend/services/agents/assignmentAgent.js` (247 lines) — Typed agent with learning
- `backend/services/agents/priorityAgent.js` (264 lines)
- `backend/services/agents/deadlineAgent.js` (332 lines)
- `backend/services/agents/followupAgent.js` (496 lines)

### TypeScript Framework (NOT wired to backend)
- `src/agents/types.ts` (163 lines) — Types
- `src/agents/agentRegistry.ts` (222 lines) — 5 triggers, 6 actions
- `src/agents/agentRunner.ts` (383 lines) — Runner with guardrails
- `src/agents/agentTriggerService.ts` (445 lines) — Event trigger firing

### Database
Tables: `ai_agents`, `agent_executions`, `agent_explanations` (legacy)
Tables: `agents`, `agent_runs`, `agent_run_steps` (TS framework)
Table: `automation_templates` (seeded templates)
Table: `learning_patterns` (learning system)

## Implementation Order

### Phase 1: Fix Broken (Critical)

1. **Wire Delete Button** (Agents.jsx:329)
   - Add onClick: confirm dialog → api.delete(`/agents/${selectedAgent.id}`) → refetch
   - Clear selectedAgent after delete

2. **Create Agent Modal** (Agents.jsx)
   - Add modal JSX for `showCreateModal` state
   - Fields: name, description, trigger type (dropdown), actions (multi-select)
   - Available triggers: meeting.completed, task.overdue, deal.stage_changed, action_item.missed_deadline
   - Available actions: extract_action_items, sync_to_crm, post_to_pulse, create_onboarding_project, assign_task
   - Submit → api.post('/agents', data) → refetch

3. **Decide unification strategy**: For now, keep backend system as primary,
   but port guardrails concept from TS framework into `aiAgentService.js`

### Phase 2: Wire Stubs

4. **Wire Filter Input** (Agents.jsx:261)
   - Add filterText state, onChange handler
   - Filter agents.filter(a => a.name.toLowerCase().includes(filterText) || a.description?.toLowerCase().includes(filterText))

5. **Fix Avg Duration** (Agents.jsx:684)
   - Replace "2.4s" with computed value from executionLogs
   - Fallback to "—" if no logs

6. **Enhance Customize Modal**
   - Add "Add Trigger" dropdown (available trigger types)
   - Add "Add Action" dropdown (available action types)

7. **Remove debug code**
   - routes/agents.js:42 — remove require.cache clearing
   - routes/agents.js:53-56 — remove _debug field

### Phase 3: Architecture

8. **Consolidate agent registries**
   - Remove inline agents from `backend/services/agents.js`
   - Update agentOrchestrator to use typed agents from `backend/services/agents/*.js`

9. **Tighten RLS**
   - Add created_by filtering to ai_agents and agents table policies

10. **Persist orchestration logs**
    - Log to agent_executions or create new table

## Style Guide
- Use VC design system (VCButton, VCBadge, VCIconBox, VCInput)
- CSS variables: --text-primary, --text-secondary, --text-tertiary, --bg-elevated, --accent-primary
- Font mono: var(--font-mono)
- Follow existing modal patterns in Agents.jsx (backdrop + centered card)
```

---

## 8. Summary

The AI Agents section is **architecturally ambitious** with a comprehensive feature set spanning agent CRUD, template-based deployment, AI-powered decision-making, orchestration, explainability, and learning. Most of the backend infrastructure works well.

**The biggest issues are:**
1. Two parallel agent systems that aren't integrated (~1,400 lines of dead TS code)
2. Missing Create Agent modal (button does nothing)
3. Delete button not wired
4. Overly permissive RLS policies
5. Hardcoded analytics values

**Estimated effort:** Phase 1 (critical fixes) — 2-3 hours. Phase 2 (wiring) — 3-4 hours. Phase 3 (architecture) — 4-6 hours. Phase 4 (features) — 8-12 hours.
