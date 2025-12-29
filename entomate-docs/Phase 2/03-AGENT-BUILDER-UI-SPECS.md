text
# Entomate — Phase 2 — Agent Builder UI Specs
**Purpose:** Define the UI screens and behaviors needed to manage Agents safely (create/edit/test/enable/disable) while keeping the build backend-first.  
**Important:** The UI is “thin.” The backend enforces safety (idempotency, guardrails, retries, audit logs). The UI only configures and observes.

---

## What the Agent Builder is (non-dev explanation)
The Agent Builder is the “control panel” for your AI agents:
- You can create an agent (pick trigger + actions).
- You can test-run it safely.
- You can turn it on/off (enable/disable).
- You can see what it did (audit log).

Think: “Zapier-like builder” but for Entomate agents.

---

## Minimum screens (Phase 2 MVP)
You must have these screens by the Phase 2 release:

1) **Agents List**
2) **Agent Detail / Edit**
3) **Agent Test Run**
4) **Agent Run History (Audit Log)**
5) **Templates Gallery** (can be a modal)

Optional (nice-to-have):
- “Dry-run mode” toggle (preview what would happen without performing actions)
- “Permissions / roles” (admin-only)

---

## Screen 1: Agents List
### Purpose
Let users see all agents and quickly understand:
- name
- enabled/disabled state
- last run result (success/failed)
- last run time
- quick actions (enable/disable, view logs, test)

### UI elements
- Header: “Agents”
- Button: “Create Agent”
- List/Table columns:
  - Agent name
  - Trigger type
  - Enabled toggle
  - Last run status
  - Last run time
  - Actions: View / Test Run

### Backend endpoints it needs
- `GET /api/agents`
- `POST /api/agents/:id/enable`
- `POST /api/agents/:id/disable`
- `GET /api/agent-runs?agentId=...&limit=...`

### Must-have behaviors
- If agent is “enabled,” show a clear “LIVE” badge.
- If last run failed, show red “FAILED” badge and link to run details.
- If backend is down, show a clear error message (no silent failure).

---

## Screen 2: Agent Detail / Edit
### Purpose
Edit an agent safely:
- name, description
- trigger + trigger config
- ordered actions list
- guardrails
- dry-run mode (optional)

### Sections (layout)
1) Header bar
   - Agent name
   - Enabled toggle
   - “Save”
   - “Test Run”
2) Trigger section
3) Actions section (ordered list)
4) Guardrails section
5) Danger zone (delete agent)

---

### Trigger section
**Fields:**
- Trigger type (dropdown)
- Trigger config (form fields OR JSON editor)

**Dropdown options (Phase 2):**
- meeting.completed
- task.overdue
- deal.stage_changed

**Examples of trigger config**
- meeting.completed:
  - minDurationSec (default 60)
  - mustHaveTranscript (true/false)
- task.overdue:
  - overdueByDays (default 1)
  - priorityFilter (high/medium/low)
- deal.stage_changed:
  - fromStage (string)
  - toStage (string)

---

### Actions section (ordered list)
Actions are executed from top to bottom.

**UI behavior**
- “Add Action” button
- Each action row shows:
  - action type dropdown
  - config fields / JSON editor
  - drag handle (reorder)
  - remove

**Phase 2 action dropdown options (MVP)**
- extract_action_items (Gemini)
- sync_to_crm (Logos Vision)
- post_to_pulse (Pulse)
- create_onboarding_project (Entomate Projects)
- assign_task (Entomate Tasks)

---

### Guardrails section (required)
**Fields**
- maxPulseMessagesPerRun (default 3)
- maxCrmTasksPerRun (default 10)
- maxTotalActionsPerRun (default 25)

**Rules**
- Guardrails must always be visible.
- UI should show warnings if someone sets very high numbers.

---

### Danger Zone
- Delete agent (requires confirmation)
- Show warning: “This cannot be undone.”

---

### Backend endpoints it needs
- `GET /api/agents/:id`
- `PUT /api/agents/:id`
- `DELETE /api/agents/:id`

---

## Screen 3: Agent Test Run (required)
### Purpose
Safely test an agent against a real example:
- A specific meetingId, dealId, or taskId
- Show what actions would happen
- Optionally execute actions (in dev only)

### UI elements
- Input: select “Test context type”
  - meetingId
  - dealId
  - taskId
- Input: ID value
- Toggle: dry-run (default ON)
- Button: “Run Test”
- Output panel:
  - runId
  - status
  - step-by-step outputs
  - counters (Pulse messages, CRM tasks, total actions)
  - any errors

### Backend endpoint it needs
- `POST /api/agents/:id/test-run`
Payload example:
{
"dryRun": true,
"context": { "meetingId": "..." }
}

text

### Must-have behaviors
- Test-run must show exactly what would happen.
- If dry-run is true, backend must NOT call Pulse/CRM (only simulate).
- Test results must be stored in agent_runs (audit log).

---

## Screen 4: Agent Run History (Audit Log)
### Purpose
Let users debug and trust the system.

### UI elements
- Filters:
  - status (success/failed/skipped)
  - date range
  - agent
- List:
  - run time
  - triggerEventId
  - status
  - counters
- Run detail view (click a run):
  - input JSON
  - output JSON
  - errors
  - step breakdown (if agent_run_steps exists)

### Backend endpoints it needs
- `GET /api/agent-runs?agentId=...`
- `GET /api/agent-runs/:runId`
- `GET /api/agent-runs/:runId/steps` (optional)

---

## Screen 5: Templates Gallery (recommended)
### Purpose
A fast starting point for non-technical users.

### Templates to include (Phase 2)
- Deal Risk Monitor
- Meeting Outcome Processor
- Task Auto-Assigner
- Customer Success Coordinator
- Lead Qualification Agent (if lead data exists)

### UI behavior
- “Create from template”
- Template preview shows:
  - trigger
  - actions
  - guardrails defaults

### Backend endpoint it needs
- `POST /api/agents/from-template`
Payload:
{ "templateId": "deal-risk-monitor" }

text

---

## Gemini Studio prompts (copy/paste)
Use these prompts to generate the UI wireframes quickly.

### Prompt A — Agents List + Detail
Paste into Gemini Studio:
You are a UX designer. Design an "Agents" admin panel for a SaaS product called Entomate.
Style: minimalist, modern, clean (enterprise).
Screens needed:

Agents List: table with agent name, trigger type, enabled toggle, last run status, last run time, and action buttons (View, Test Run).

Agent Detail/Edit: sections for trigger (dropdown + config), ordered actions list (add/reorder/remove), guardrails (maxPulseMessagesPerRun, maxCrmTasksPerRun, maxTotalActionsPerRun), and a danger zone to delete.
Include labels for each component and note empty/loading/error states.

text

### Prompt B — Test Run + Audit Log
You are a UX designer. Design two screens for Entomate:

"Agent Test Run" screen: user selects context type (meetingId/dealId/taskId), enters an ID, toggles dry-run ON/OFF (default ON), clicks Run Test, then sees step-by-step output, counters, and errors.

"Agent Run History" screen: filterable list of agent runs showing status, triggerEventId, counters, and clickable detail view with input/output JSON and step breakdown.
Style: minimalist enterprise UI.

text

---

## Implementation notes (for developers)
- Keep UI simple: CRUD + toggles + logs.
- Do NOT implement “agent logic” in the frontend.
- Always show:
  - the enabled state
  - the last run result
  - and how to find logs

---

## Next file to request
Reply: **“Show file 04”** for the Advanced Search + RAG specification (the Ask Assistant expansion across meetings/tasks/CRM/Pulse with citations).