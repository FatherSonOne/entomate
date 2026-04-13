# WORKFLOWS SECTION AUDIT

**Date:** 2026-04-01
**Auditor:** Claude Opus 4.6
**Section:** Workflows (Visual Automation Builder)
**Total Files:** 34
**Total Lines:** ~18,070

---

## 1. File Inventory

### Frontend — Pages
| File | Lines | Purpose |
|------|-------|---------|
| `frontend/src/pages/Workflows.jsx` | 415 | Workflow list page with search, filter, CRUD, templates |
| `frontend/src/pages/WorkflowBuilder.jsx` | 219 | Single workflow editor page — wraps WorkflowCanvas |

### Frontend — Components (`frontend/src/components/workflow/`)
| File | Lines | Purpose |
|------|-------|---------|
| `WorkflowCanvas.jsx` | 525 | Main React Flow canvas — drag/drop, undo/redo, node management |
| `WorkflowToolbar.jsx` | 259 | Top toolbar — save, execute, test, zoom, grid, menu |
| `WorkflowDebugPanel.jsx` | 303 | Bottom debug panel — execution trace, output, pins, versions |
| `NodePalette.jsx` | 270 | Left sidebar — draggable node types by category |
| `NodeConfigPanel.jsx` | 587 | Right sidebar — node property editor with typed field renderers |
| `NodeOutputInspector.jsx` | 371 | Output viewer — tree/JSON/table views with search & copy |
| `ExecutionTraceViewer.jsx` | 390 | Step-by-step execution visualization |
| `DataPinningPanel.jsx` | 456 | Pin test data to nodes for development |
| `VersionHistoryPanel.jsx` | 448 | Version history with diff viewer and restore |
| `ExpressionEditor.jsx` | 655 | Smart text editor with `{{}}` syntax highlighting & autocomplete |
| `ExpressionAutocomplete.jsx` | 497 | Autocomplete dropdown for expressions |
| `SecretsManager.jsx` | 909 | Secrets CRUD with audit log — full standalone feature |
| `MeetingSummaryWidget.jsx` | 432 | Meeting intelligence widget for workflow integration |
| `nodes/index.jsx` | 300 | Custom React Flow node components with category colors |
| `index.js` | 28 | Barrel exports |

### Frontend — Utilities
| File | Lines | Purpose |
|------|-------|---------|
| `utils/expressionParser.js` | 749 | Expression tokenizer, validator, resolver |
| `utils/expressionFunctions.js` | 958 | Built-in expression function library |

### Frontend — API
| File | Lines | Purpose |
|------|-------|---------|
| `services/api.js` (workflows section) | ~65 | `workflowsApi` — 15 API methods |

### Backend — Routes & Schemas
| File | Lines | Purpose |
|------|-------|---------|
| `backend/routes/workflows.js` | 866 | Full REST API — CRUD, execute, test, toggle, versions, executions, nodes, pins |
| `backend/schemas/workflows.js` | 75 | Zod validation schemas |

### Backend — Services (`backend/services/workflow/`)
| File | Lines | Purpose |
|------|-------|---------|
| `WorkflowExecutor.js` | 476 | Graph-based execution engine — branching, parallel, error handling |
| `WorkflowScheduler.js` | 425 | Cron-based scheduling with node-cron |
| `WorkflowTemplates.js` | 1,748 | Pre-built workflow templates |
| `NodeRegistry.js` | 1,030 | Node type registry with handlers and definitions |

### Backend — Node Handlers (`backend/services/workflow/nodes/`)
| File | Lines | Purpose |
|------|-------|---------|
| `BaseNode.js` | 270 | Abstract base — interpolation, nested value access |
| `TriggerNodes.js` | 199 | Webhook, Schedule, Meeting, Action Item, Error triggers |
| `ActionNodes.js` | 637 | HTTP Request, Slack, Email, Task, CRM Sync, Code |
| `LogicNodes.js` | 493 | IF, Switch, Merge, Loop, Filter, Aggregate, Wait, Stop |
| `AINodes.js` | 384 | AI Agent, AI Prompt, AI Extract, AI Classify, Summarize |
| `DataNodes.js` | 518 | Transform, Split, Set, DateTime, JSON, Crypto |
| `RAGNodes.js` | 614 | RAG-specific AI nodes |
| `CRMNodes.js` | 1,019 | CRM sync/lookup/update nodes |

### Database
| File | Lines | Purpose |
|------|-------|---------|
| `docs/migrations/001_workflow_v2_infrastructure.sql` | 545 | Tables: workflows, workflow_versions, workflow_executions, webhooks, workflow_schedules, node_pinned_data, secrets |

---

## 2. Architecture Diagram

```
                              ┌─────────────────────────────────────────────────────────┐
                              │                    FRONTEND                              │
                              │                                                         │
  /workflows                  │  ┌────────────────────┐        ┌───────────────────┐    │
  ──────────────────────────▶ │  │   Workflows.jsx    │        │  workflowsApi     │    │
                              │  │  (list/search/CRUD) │───────▶│  (15 methods)     │────│──▶ Backend
  /workflows/:id              │  └────────────────────┘        └───────────────────┘    │
  ──────────────────────────▶ │  ┌────────────────────┐                                 │
                              │  │ WorkflowBuilder.jsx │                                 │
                              │  └────────┬───────────┘                                 │
                              │           │                                              │
                              │  ┌────────▼───────────────────────────────────────┐      │
                              │  │              WorkflowCanvas.jsx                │      │
                              │  │  ┌─────────────────────────────────────────┐   │      │
                              │  │  │           @xyflow/react (React Flow)    │   │      │
                              │  │  │  ┌──────────┐ ┌────────┐ ┌──────────┐  │   │      │
                              │  │  │  │ ReactFlow │ │MiniMap │ │Controls  │  │   │      │
                              │  │  │  └──────────┘ └────────┘ └──────────┘  │   │      │
                              │  │  └─────────────────────────────────────────┘   │      │
                              │  │                                                │      │
                              │  │  ┌──────────┐  ┌────────────┐  ┌──────────┐   │      │
                              │  │  │NodePalette│  │WorkflowTB  │  │NodeConfig│   │      │
                              │  │  │ (left)    │  │ (top bar)  │  │Panel (R) │   │      │
                              │  │  └──────────┘  └────────────┘  └──────────┘   │      │
                              │  │                                                │      │
                              │  │  ┌────────────────────────────────────────┐    │      │
                              │  │  │      WorkflowDebugPanel (bottom)       │    │      │
                              │  │  │  ┌──────┐ ┌──────┐ ┌────┐ ┌────────┐  │    │      │
                              │  │  │  │Trace │ │Output│ │Pins│ │Versions│  │    │      │
                              │  │  │  └──────┘ └──────┘ └────┘ └────────┘  │    │      │
                              │  │  └────────────────────────────────────────┘    │      │
                              │  └────────────────────────────────────────────────┘      │
                              │                                                         │
                              │  Utilities: ExpressionEditor, ExpressionAutocomplete,    │
                              │             SecretsManager, MeetingSummaryWidget          │
                              └─────────────────────────────────────────────────────────┘

                              ┌─────────────────────────────────────────────────────────┐
                              │                     BACKEND                              │
                              │                                                         │
                              │  routes/workflows.js ──▶ CRUD, Execute, Test, Toggle,   │
                              │                         Versions, Executions, Pins       │
                              │           │                                              │
                              │  ┌────────▼─────────┐     ┌────────────────────┐        │
                              │  │ WorkflowExecutor  │────▶│   NodeRegistry     │        │
                              │  │ (graph execution) │     │ (type→handler map) │        │
                              │  └──────────────────┘     └────────┬───────────┘        │
                              │                                     │                    │
                              │  ┌──────────────────┐     ┌────────▼───────────┐        │
                              │  │WorkflowScheduler  │     │   Node Handlers    │        │
                              │  │  (node-cron)      │     │ Trigger│Logic│Act  │        │
                              │  └──────────────────┘     │ AI│Data│RAG│CRM    │        │
                              │                           └────────────────────┘        │
                              │  ┌──────────────────┐                                    │
                              │  │WorkflowTemplates  │                                    │
                              │  │ (7+ presets)      │                                    │
                              │  └──────────────────┘                                    │
                              └─────────────────────────────────────────────────────────┘

                              ┌─────────────────────────────────────────────────────────┐
                              │                    DATABASE (Supabase)                    │
                              │                                                         │
                              │  workflows              workflow_versions                │
                              │  workflow_executions     workflow_schedules               │
                              │  webhooks                node_pinned_data                 │
                              │  secrets                                                 │
                              └─────────────────────────────────────────────────────────┘
```

---

## 3. Feature Status Catalog

### Workflow List Page (`Workflows.jsx`)
| Feature | Status | Notes |
|---------|--------|-------|
| List workflows | 🔴 Broken | API response shape mismatch — frontend expects `response.workflows`, backend sends `{ data: [...] }` |
| Search/filter | ✅ Working | Client-side filter on name/description + active/inactive toggle |
| Create workflow | 🔴 Broken | Same API mismatch — `response.workflow.id` won't exist |
| Delete workflow | ⚠️ Partial | Delete API call correct, but depends on broken list load |
| Toggle active | ⚠️ Partial | API call correct, optimistic update, but depends on broken list |
| Execute workflow | ⚠️ Partial | API call correct, reloads list (which is broken) |
| Duplicate workflow | 🔴 Broken | `original.workflow.name` — API mismatch |
| Quick Start templates | 🔇 Stub | Creates empty `nodes: []`, `connections: []` — no actual template nodes injected |
| Workflow history nav | 🔇 Stub | Navigates to `/workflows/:id/history` — route doesn't exist |

### Workflow Builder (`WorkflowBuilder.jsx`)
| Feature | Status | Notes |
|---------|--------|-------|
| Load workflow | 🔴 Broken | `response.workflow` — API sends `{ data: {...} }` |
| Save workflow | 🔴 Broken | Same shape issue — `response.workflow` |
| Execute workflow | ⚠️ Partial | API call correct, logs result to console |
| Test workflow | ⚠️ Partial | API call correct, logs result to console |
| Toggle active | ✅ Working | Simple toggle call |
| Duplicate | ⚠️ Partial | Works if create API response accessed correctly (it's not) |
| Delete | ✅ Working | Calls API, navigates back |

### WorkflowCanvas (React Flow)
| Feature | Status | Notes |
|---------|--------|-------|
| Node drag & drop from palette | ✅ Working | Proper React Flow DnD setup |
| Node connections | ✅ Working | `addEdge` with smoothstep type |
| Node selection & config | ✅ Working | Click selects, opens config panel |
| Undo/redo | ⚠️ Partial | History tracking exists but has stale closure bugs — `markDirty` captures stale `nodes`/`edges` |
| Snap to grid | ✅ Working | 15px grid |
| MiniMap | ✅ Working | With category-based colors |
| Export/Import JSON | ✅ Working | Blob download/file upload |
| Save to backend | 🔴 Broken | Depends on broken API response shape |
| Empty state | ✅ Working | Shows helpful prompt |
| Keyboard shortcuts | ⚠️ Partial | Delete/Backspace for nodes, no Ctrl+S for save |

### Node Palette
| Feature | Status | Notes |
|---------|--------|-------|
| 5 categories, 32 node types | ✅ Working | Triggers (6), Logic (9), Actions (9), AI (6), Data (6) |
| Drag to canvas | ✅ Working | Proper DnD data transfer |
| Click to add | ✅ Working | Adds at random offset from center |
| Search filter | ✅ Working | Filters by label and description |
| Category expand/collapse | ✅ Working | All expanded by default |

### Node Config Panel
| Feature | Status | Notes |
|---------|--------|-------|
| Label/description editing | ✅ Working | Updates node data |
| Typed field renderers | ✅ Working | text, textarea, number, select, boolean, json, keyvalue, conditions |
| Config schemas for all types | ⚠️ Partial | 18 of 32 node types have schemas; 14 types fall back to empty |
| Advanced options | ✅ Working | Notes, Continue on Failure, Disable Node |
| Test node button | 🔇 Stub | `console.log('Testing node:', nodeId)` |
| Pin/unpin data | ✅ Working | Toggle state, visual feedback |

### Debug Panel
| Feature | Status | Notes |
|---------|--------|-------|
| Execution trace viewer | ⚠️ Partial | Component built but depends on execution data from broken API |
| Node output inspector | ✅ Working | Tree/JSON/table views, search, copy, download |
| Data pinning panel | ✅ Working | Full CRUD with JSON editor, import/export |
| Version history panel | ⚠️ Partial | API calls exist but `getVersions` response shape uncertain |
| Minimize/expand | ✅ Working | Animated transitions |
| Tab switching | ✅ Working | 4 tabs: Execution, Output, Pinned Data, Versions |
| ChevronDown/ChevronUp | ⚠️ Partial | Uses inline SVG functions instead of lucide imports |

### Expression System
| Feature | Status | Notes |
|---------|--------|-------|
| `{{}}` syntax detection | ✅ Working | Parser in `expressionParser.js` |
| Autocomplete dropdown | ✅ Working | Categories: Nodes, Secrets, Env, Trigger, Workflow, Functions |
| Syntax highlighting | ✅ Working | Token-based colorization |
| Inline validation | ✅ Working | Red underline for invalid refs |
| Function library | ✅ Working | 958 lines of built-in functions |
| **Integration into NodeConfigPanel** | ❌ Not wired | ExpressionEditor exists but NodeConfigPanel uses plain `<input>`/`<textarea>` |

### Secrets Manager
| Feature | Status | Notes |
|---------|--------|-------|
| Secrets CRUD | ✅ Working | Full UI with search, filter, categories |
| Audit log | ✅ Working | Per-secret audit trail |
| Environment scoping | ✅ Working | dev/staging/prod badges |
| **Backend secrets route** | ❌ Missing | `SecretsManager.jsx` creates its own API client; no `/api/secrets` route found |

### Backend — Execution Engine
| Feature | Status | Notes |
|---------|--------|-------|
| Graph traversal | ✅ Working | Topological execution from trigger nodes |
| Branching (IF/Switch) | ✅ Working | Output branch routing |
| Parallel execution | ✅ Working | `Promise.all` for non-merge nodes |
| Pinned data support | ✅ Working | Skips execution, uses pinned data in test mode |
| Error handling / error workflows | ✅ Working | `errorWorkflowId` in settings, trigger error handler |
| Execution persistence | ✅ Working | Saves to `workflow_executions` table |
| Cancel execution | ✅ Working | In-memory tracking via `activeExecutions` Map |

### Backend — Scheduler
| Feature | Status | Notes |
|---------|--------|-------|
| Cron scheduling | ✅ Working | node-cron with timezone support |
| Auto-initialize on server start | ✅ Working | Called in `server.js` startup |
| Graceful shutdown | ✅ Working | `stopAll()` in shutdown handler |
| Dynamic add/remove/toggle | ✅ Working | Full lifecycle management |
| Stats tracking | ✅ Working | run_count, consecutive_failures, next_run_at |
| Cron presets & descriptions | ✅ Working | 12 common presets with human-readable labels |

### Backend — Node Handlers
| Feature | Status | Notes |
|---------|--------|-------|
| Trigger nodes (5 types) | ✅ Working | Webhook, Schedule, Meeting, Action Item, Error |
| Logic nodes (8 types) | ✅ Working | IF, Switch, Merge, Loop, Filter, Aggregate, Wait, Stop |
| Action nodes (7+ types) | ✅ Working | HTTP, Slack, Email, Task, CRM, Code, Respond Webhook |
| AI nodes (5+ types) | ✅ Working | Agent, Prompt, Extract, Classify, Summarize |
| Data nodes (6 types) | ✅ Working | Transform, Split, Set, DateTime, JSON, Crypto |
| RAG nodes | ✅ Working | RAG-specific processing |
| CRM nodes | ✅ Working | CRM sync, lookup, update — 1,019 lines |
| Variable interpolation | ✅ Working | `{{field.path}}` in BaseNode |

### Database Schema
| Feature | Status | Notes |
|---------|--------|-------|
| `workflows` table | ✅ Working | Full schema with JSONB nodes/connections |
| `workflow_versions` table | ✅ Working | Snapshot-based versioning |
| `workflow_executions` table | ✅ Working | Full execution tracking with node-level detail |
| `workflow_schedules` table | ✅ Working | Cron + timezone + stats |
| `webhooks` table | ✅ Working | Webhook registration for trigger nodes |
| `node_pinned_data` table | ✅ Working | Per-node pinned test data |
| `secrets` table | ✅ Working | Encrypted secrets with scoping |
| RLS policies | ⚠️ Unknown | Migration defines tables but RLS policies not verified |
| Version auto-creation trigger | ❌ Missing | No DB trigger to auto-create versions on workflow update |

---

## 4. Issues Found

### 🔴 Critical (5)

**C1. Frontend-Backend API Response Shape Mismatch**
- **Location:** `Workflows.jsx:36`, `WorkflowBuilder.jsx:35,54`
- **Problem:** Backend returns `{ success: true, data: [...] }` but frontend accesses `response.workflows`, `response.workflow`, etc. The Axios interceptor returns `response.data` (the JSON body), so `response.data` on the frontend is the array/object — but code accesses `.workflows` / `.workflow` which don't exist.
- **Impact:** Workflow list shows empty, create/edit/load all fail silently.
- **Fix:** Either change frontend to use `response.data` or change backend response shape.

**C2. ExpressionEditor Not Integrated into Node Config**
- **Location:** `NodeConfigPanel.jsx` — all text/textarea fields use plain HTML inputs
- **Problem:** The 655-line ExpressionEditor and 497-line ExpressionAutocomplete exist but are never used in the actual node configuration UI. Users can't use `{{}}` expressions when configuring nodes.
- **Impact:** The entire expression system (1,152+ lines) is dead code in practice.

**C3. Quick Start Templates Are Empty Shells**
- **Location:** `Workflows.jsx:367-411`
- **Problem:** Template click handlers call `handleCreateFromTemplate('Meeting Processing', [], [])` — passing empty `nodes` and `connections` arrays. `WorkflowTemplates.js` has 1,748 lines of pre-built templates but is never called from the frontend.
- **Impact:** Templates create blank workflows, defeating the purpose.

**C4. Secrets Manager Has No Backend**
- **Location:** `SecretsManager.jsx:10-63`
- **Problem:** Creates its own inline API client pointing to `/api/secrets` but no `routes/secrets.js` exists in the backend. All CRUD operations will 404.
- **Impact:** Entire Secrets Manager UI is non-functional.

**C5. Node Testing is a Console.log Stub**
- **Location:** `WorkflowCanvas.jsx:267`
- **Problem:** `handleTestNode` just does `console.log('Testing node:', nodeId)`. Backend has a full `testNode()` method in WorkflowExecutor.
- **Impact:** Cannot test individual nodes.

### 🟡 Medium (8)

**M1. Undo/Redo Has Stale Closure Bugs**
- **Location:** `WorkflowCanvas.jsx:80-91`
- **Problem:** `markDirty` and `saveToHistory` capture stale `nodes`/`edges` due to React state closure. `markDirty` calls `onChange({ nodes, edges })` with the values at render time, not after the mutation.
- **Fix:** Use `setNodes`/`setEdges` functional updates and `useRef` for history.

**M2. No Keyboard Shortcuts for Common Actions**
- **Location:** `WorkflowCanvas.jsx`
- **Problem:** No Ctrl+S (save), Ctrl+Z/Y (undo/redo), or Ctrl+D (duplicate) keyboard shortcuts.
- **Fix:** Add `useEffect` with keydown listeners.

**M3. Version History Not Auto-Created**
- **Location:** `backend/routes/workflows.js:187-257` (PUT route)
- **Problem:** The update endpoint increments version but never creates a `workflow_versions` record. The version number on the workflow row increases but there's no snapshot saved.
- **Fix:** Add version snapshot creation in the PUT handler before applying updates.

**M4. Workflow Validation Mismatch Frontend/Backend**
- **Location:** Backend `validateWorkflow()` at `workflows.js:757` checks for `node.type === 'trigger'`, but frontend nodes use flat types like `webhook`, `schedule` — not `type: 'trigger'`. The validation will always fail saying "no trigger node".
- **Fix:** The backend validator needs to match the actual node type taxonomy (or the frontend needs to set `type: 'trigger'` and `subtype: 'webhook'`).

**M5. `onOpenSettings` and `onOpenHistory` Never Passed**
- **Location:** `WorkflowToolbar.jsx:208-220`
- **Problem:** Toolbar renders "Workflow Settings" and "Version History" menu items that call `onOpenSettings?.()` and `onOpenHistory?.()`, but `WorkflowCanvas` never passes these props.
- **Fix:** Wire up settings modal and history panel toggle.

**M6. 14 Node Types Missing Config Schemas**
- **Location:** `NodeConfigPanel.jsx:246-382`
- **Problem:** Only 18 of 32 node types have config schemas. Missing: `meeting_processed`, `action_item_created`, `error`, `manual`, `merge`, `split_batches`, `aggregate`, `stop_error`, `execute_workflow`, `sync_crm`, `respond_webhook`, `set_variable`, `ai_classify`, `detect_followups`.
- **Fix:** Add `nodeSchemas` entries for all remaining types.

**M7. Debug Panel ChevronDown/ChevronUp Are Inline SVG**
- **Location:** `WorkflowDebugPanel.jsx:289-303`
- **Problem:** Instead of importing from lucide-react, custom SVG function components are defined inline. Inconsistent with the rest of the codebase.
- **Fix:** Import `ChevronDown`, `ChevronUp` from lucide-react (already in the import list at line 11 — just not used).

**M8. Frontend Sends Wrong Field Names in Connections**
- **Location:** `WorkflowCanvas.jsx:96-103`
- **Problem:** React Flow edges use `source`/`target` fields but the backend expects `sourceNodeId`/`targetNodeId`. The `onConnect` handler creates edges with React Flow's default shape, then sends them as `connections` to the backend where the validator expects `sourceNodeId`/`targetNodeId`.
- **Fix:** Transform edges to backend format before save, or update backend to accept React Flow format.

### 🟢 Nice-to-Have (6)

**N1. No Workflow Name Editing in Builder**
- The toolbar shows the workflow name but it's not editable. Users must go back to list, which doesn't have an edit name action either.

**N2. No Real-Time Execution Feedback**
- Execution runs synchronously on the backend. No WebSocket/SSE updates for long-running workflows. The UI shows a spinner and waits.

**N3. Missing Loading States on Template Click**
- Template cards in `Workflows.jsx` have no loading indicator after click.

**N4. No Workflow Import from Templates**
- `WorkflowTemplates.js` on the backend has 7+ complete templates with proper nodes/connections, but there's no API endpoint to list or instantiate them.

**N5. No Bulk Operations on Workflow List**
- Can't select and delete/activate/deactivate multiple workflows at once.

**N6. Zod Schemas Use `z.any()` for Nodes/Connections**
- `schemas/workflows.js:5-8` — nodes and connections are `z.array(z.any())` with no structure validation at the schema level. All validation happens in the route handler's `validateWorkflow()`.

---

## 5. Dead Code / Unused Imports

| Location | Issue |
|----------|-------|
| `Workflows.jsx:12` | `Mic` icon imported but only used in template card — acceptable |
| `WorkflowDebugPanel.jsx:11` | `ChevronLeft`, `ChevronRight` imported but custom SVGs used instead |
| `WorkflowDebugPanel.jsx:14-17` | `ExecutionTraceViewer`, `NodeOutputInspector`, `DataPinningPanel`, `VersionHistoryPanel` are used but their full functionality depends on execution data that won't flow through the broken API |
| `ExpressionEditor.jsx` | Entire 655-line component is **never rendered** anywhere in the workflow UI |
| `ExpressionAutocomplete.jsx` | Entire 497-line component is **never rendered** |
| `expressionParser.js` | Entire 749-line utility is **never called** from rendered components |
| `expressionFunctions.js` | Entire 958-line utility is **never called** from rendered components |
| `MeetingSummaryWidget.jsx` | Not imported by any workflow component — standalone |

**Total dead code:** ~2,859 lines (ExpressionEditor + ExpressionAutocomplete + expressionParser + expressionFunctions)

---

## 6. Revisal Plan

### Phase 1: Fix Critical Issues (API + Core Functionality)

**1a. Fix API Response Shape Mismatch**
- **Option A (Recommended):** Update frontend to use `response.data` everywhere
  - `Workflows.jsx:36` → `setWorkflows(response.data || [])`
  - `Workflows.jsx:53` → `navigate(\`/workflows/${response.data.id}\`)`
  - `Workflows.jsx:77-80` → `original.data.name`, `.description`, `.nodes`, `.connections`
  - `WorkflowBuilder.jsx:35` → `setWorkflow(response.data)`
  - `WorkflowBuilder.jsx:54` → `setWorkflow(response.data)` / `return response.data`
  - `WorkflowBuilder.jsx:115` → `navigate(\`/workflows/${response.data.id}\`)`
- **Option B:** Change backend to return `{ workflow: ... }` / `{ workflows: [...] }` shape
- Files: `Workflows.jsx`, `WorkflowBuilder.jsx`

**1b. Fix Node Type Validation Mismatch**
- Frontend nodes set `type` as the specific type (e.g., `webhook`, `schedule`) but the backend `validateWorkflow()` checks for `type === 'trigger'`.
- Either: (a) Update frontend to use `{ type: 'trigger', subtype: 'webhook' }` format, or (b) Update backend validator to check category via a lookup (matching what `getCategory()` does on the frontend).
- Files: `WorkflowCanvas.jsx`, `NodePalette.jsx`, `nodes/index.jsx`, `backend/routes/workflows.js`

**1c. Fix Connection Field Name Mismatch**
- React Flow edges use `source`/`target` but backend expects `sourceNodeId`/`targetNodeId`.
- Add a transform function in `handleSave` to map edge fields.
- Files: `WorkflowCanvas.jsx`

### Phase 2: Wire Up Stub/Partial Functionality

**2a. Wire Quick Start Templates to Backend Templates**
- Create `GET /api/workflows/templates` endpoint that returns `WorkflowTemplates` data
- Frontend `handleCreateFromTemplate` should call API to get template nodes/connections
- Files: `backend/routes/workflows.js`, `Workflows.jsx`

**2b. Wire Node Testing**
- Replace `console.log` stub with actual API call to `workflowsApi.test(workflowId, { nodeId, inputData })`
- Display result in the Debug Panel's Output tab
- Files: `WorkflowCanvas.jsx`, potentially `backend/routes/workflows.js`

**2c. Wire ExpressionEditor into NodeConfigPanel**
- Replace plain `<input>` and `<textarea>` in `FieldRenderers.text` and `FieldRenderers.textarea` with `ExpressionEditor` / `ExpressionField`
- Pass available nodes, secrets, and env vars as context
- Files: `NodeConfigPanel.jsx`

**2d. Add Version Snapshot Creation**
- In the PUT `/api/workflows/:id` handler, create a `workflow_versions` record before applying updates
- Increment version number
- Files: `backend/routes/workflows.js`

**2e. Wire Toolbar Settings & History Buttons**
- Pass `onOpenSettings` and `onOpenHistory` from `WorkflowCanvas` to `WorkflowToolbar`
- `onOpenSettings`: open a settings modal (workflow name, description, error workflow, retry config)
- `onOpenHistory`: toggle the Version History tab in the debug panel
- Files: `WorkflowCanvas.jsx`

**2f. Add Missing Node Config Schemas**
- Add `nodeSchemas` entries for the 14 missing node types
- Files: `NodeConfigPanel.jsx`

### Phase 3: Create Secrets Backend + Polish

**3a. Create Secrets API Route**
- Create `backend/routes/secrets.js` with CRUD operations matching `SecretsManager.jsx`'s API expectations
- Implement encryption at rest for secret values
- Wire into `server.js`
- Files: New `backend/routes/secrets.js`, `backend/schemas/secrets.js`, `server.js`

**3b. Fix Stale Closure Bugs in Undo/Redo**
- Use `useRef` to track nodes/edges for history, or use functional state updates
- Files: `WorkflowCanvas.jsx`

**3c. Add Keyboard Shortcuts**
- Ctrl+S → save, Ctrl+Z → undo, Ctrl+Y → redo
- Files: `WorkflowCanvas.jsx`

**3d. Make Workflow Name Editable in Builder**
- Add inline editable title in `WorkflowToolbar`
- Files: `WorkflowToolbar.jsx`, `WorkflowCanvas.jsx`

**3e. Clean Up Debug Panel Inline SVGs**
- Replace custom ChevronDown/ChevronUp with lucide-react imports
- Files: `WorkflowDebugPanel.jsx`

### Phase 4: New Features & Enhancements

**4a. Real-Time Execution Updates**
- Add WebSocket/SSE channel for execution progress
- Update `ExecutionTraceViewer` to show live node-by-node updates

**4b. Workflow History Route**
- Add `/workflows/:id/history` route with full execution history UI
- Or redirect to builder with history tab open

**4c. Bulk Operations on Workflow List**
- Select multiple workflows for bulk delete/activate/deactivate

**4d. Template Gallery**
- Full template browser with preview and one-click instantiation

---

## 7. Agent Prompt for Revisal

```
You are performing a Workflows section revisal on the Entomate project at f:/entomate.

## Current State Summary

The Workflows section is a visual automation builder (N8N-style) with React Flow canvas
frontend and a Node.js/Express/Supabase backend. It has 34 files totaling ~18,070 lines.

**The backend is mostly solid** — WorkflowExecutor, WorkflowScheduler, NodeRegistry, and
8 node handler files are well-implemented with graph traversal, parallel execution,
branching, scheduling, and 30+ node types.

**The frontend has the visual infrastructure** — React Flow canvas, drag-and-drop palette,
node config panel, debug panel with 4 tabs, expression system, secrets manager.

**But nothing works end-to-end** due to 3 critical wiring issues:

## Critical Fixes Required (Do These First)

### Fix 1: API Response Shape Mismatch
Backend returns `{ success: true, data: ... }` but frontend accesses `response.workflows`,
`response.workflow`, etc.

Files to fix:
- `frontend/src/pages/Workflows.jsx` — lines 36, 53, 77-80, 121
- `frontend/src/pages/WorkflowBuilder.jsx` — lines 35, 54, 55, 115

Change all `response.workflows` → `response.data`, `response.workflow` → `response.data`,
`original.workflow.X` → `original.data.X`.

### Fix 2: Node Type / Category Mismatch
Frontend nodes have `type: 'webhook'` (flat). Backend `validateWorkflow()` at
`backend/routes/workflows.js:762` checks `node.type === 'trigger'`.

Option A: Update frontend to use `{ type: 'trigger', subtype: 'webhook' }` format.
This requires changes in:
- `frontend/src/components/workflow/nodes/index.jsx` — `getCategory()` and BaseNode
- `frontend/src/components/workflow/NodePalette.jsx` — dragStart data
- `frontend/src/components/workflow/WorkflowCanvas.jsx` — onDrop handler

Option B: Update backend validator to check against a type→category lookup.

### Fix 3: Connection Field Names
React Flow edges use `source`/`target`. Backend expects `sourceNodeId`/`targetNodeId`.

In `WorkflowCanvas.jsx` `handleSave`, transform edges:
```js
connections: edges.map(e => ({
  id: e.id,
  sourceNodeId: e.source,
  sourceOutput: e.sourceHandle || 'main',
  targetNodeId: e.target,
  targetInput: e.targetHandle || 'main'
}))
```

## Phase 2: Wire Stubs

After critical fixes, wire these:

1. **Templates**: Create `GET /api/workflows/templates` returning WorkflowTemplates data.
   Update `Workflows.jsx` `handleCreateFromTemplate` to fetch and use real template data.

2. **Node Testing**: Replace `console.log` in `WorkflowCanvas.jsx:267` with actual API call.

3. **ExpressionEditor**: Replace plain inputs in `NodeConfigPanel.jsx` FieldRenderers
   with `ExpressionEditor` component.

4. **Version Snapshots**: In PUT `/api/workflows/:id`, insert into `workflow_versions`
   before applying update.

5. **14 missing node config schemas**: Add entries to `nodeSchemas` in `NodeConfigPanel.jsx`.

6. **Secrets backend**: Create `backend/routes/secrets.js` matching SecretsManager API expectations.

## Key Files

Frontend:
- `frontend/src/pages/Workflows.jsx` (415 lines)
- `frontend/src/pages/WorkflowBuilder.jsx` (219 lines)
- `frontend/src/components/workflow/WorkflowCanvas.jsx` (525 lines)
- `frontend/src/components/workflow/NodeConfigPanel.jsx` (587 lines)
- `frontend/src/components/workflow/WorkflowDebugPanel.jsx` (303 lines)

Backend:
- `backend/routes/workflows.js` (866 lines)
- `backend/services/workflow/WorkflowExecutor.js` (476 lines)
- `backend/services/workflow/NodeRegistry.js` (1,030 lines)

Database: `docs/migrations/001_workflow_v2_infrastructure.sql` (545 lines)
```

---

**End of Audit**
