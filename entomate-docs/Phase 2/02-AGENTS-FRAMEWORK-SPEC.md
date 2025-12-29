Here is File 02. Copy everything into: docs/phase2/02-AGENTS-FRAMEWORK-SPEC.md​

text
# Entomate — Phase 2 — Agents Framework Spec (Backend-First Node.js)
**Start:** Dec 16, 2025  
**Release Target:** Feb 10, 2026  
**Primary Goal:** Build a safe, testable, reliable “Agent runtime” that can run 3–5 business agents without spamming Pulse or duplicating CRM records.

---

## What this spec is for (plain-English)
This document explains exactly how to build the “Agent Engine” that powers:
- Deal Risk Monitor
- Meeting Outcome Processor (enhanced)
- Task Auto-Assigner
- Customer Success Coordinator
- Lead Qualification Agent (if lead data exists)

This engine must be:
- reliable (no silent failures)
- repeatable (safe if it runs twice)
- observable (audit logs)
- controllable (kill switch / disable)

---

## Core concepts
### Agent
An **Agent** is a configuration + runtime behavior:
- A trigger decides **when** it runs
- Steps/actions decide **what** it does
- Guardrails decide **what it is allowed** to do
- An audit log records **what happened**

### Trigger
A trigger is a condition like:
- `meeting.completed`
- `deal.stage_changed`
- `task.overdue`
- `action_item.missed_deadline`

### Action
An action is a side-effect like:
- create a CRM task
- post a Pulse message
- update a deal note
- create an onboarding project template

---

## Architecture (recommended)
### Components
1) **Agent Registry**
- a list of available triggers and actions
- lets you validate agent configs

2) **Agent Runner**
- loads enabled agents
- evaluates triggers
- executes steps/actions
- writes audit logs
- retries safely

3) **Agent Audit Log**
- stores every run (success or failure)
- includes inputs/outputs/errors
- supports manual re-run

4) **Rate limiting & circuit breakers**
- prevents spam and cascading failures if Pulse/CRM is down

---

## Data model (Postgres tables)
Create tables like these (names can vary but keep fields):

### `agents`
Stores agent definitions (the “blueprint”).

Recommended fields:
- `id` (uuid)
- `name` (text)
- `description` (text)
- `enabled` (boolean)
- `trigger_type` (text)  — example: `meeting.completed`
- `trigger_config` (jsonb) — example: `{ "minDurationSec": 60 }`
- `actions` (jsonb) — ordered list of actions/steps
- `guardrails` (jsonb) — limits (max messages, max tasks)
- `created_at`, `updated_at`

Example `actions` JSON:
[
{ "type": "extract_action_items", "config": { "model": "gemini" } },
{ "type": "sync_to_crm", "config": { "dedupeKey": "meetingId+taskTitle" } },
{ "type": "post_to_pulse", "config": { "channel": "sales" } }
]

text

### `agent_runs`
Stores run history (audit logs).

Recommended fields:
- `id` (uuid)
- `agent_id` (uuid)
- `status` (text) — `success | failed | skipped | running`
- `trigger_event_id` (text) — unique id for idempotency (example: meetingId, webhookId)
- `started_at`, `finished_at`
- `input` (jsonb)
- `output` (jsonb)
- `error` (text)
- `attempt` (int)

### `agent_run_steps` (optional but recommended)
If you want detailed debugging.

Fields:
- `id` uuid
- `agent_run_id` uuid
- `step_index` int
- `step_type` text
- `status` text
- `started_at`, `finished_at`
- `input` jsonb
- `output` jsonb
- `error` text

---

## Idempotency (must-have)
**Problem:** Webhooks and background jobs can run twice.
**Solution:** every agent run must have a `trigger_event_id` and check if it already ran successfully.

Rule:
- If `agent_runs` already contains `agent_id + trigger_event_id` with status `success`, then SKIP.

---

## Retry policy (must-have)
Retries should happen for:
- network errors
- rate limit responses
- temporary downtime (Pulse, Logos Vision)

Retries should NOT happen for:
- “bad config” errors
- “validation failed” errors
- “permission denied” errors (until fixed)

Recommendation:
- max attempts: 3
- exponential backoff: 1s → 5s → 20s
- after max attempts: mark run `failed` + alert in admin UI

---

## Guardrails (must-have)
Each agent must have guardrails stored in `agents.guardrails`, such as:
- `maxPulseMessagesPerRun` (default 3)
- `maxCrmTasksPerRun` (default 10)
- `maxTotalActionsPerRun` (default 25)
- `dryRunDefault` (true in early dev)

If guardrails are exceeded:
- stop execution
- mark run failed
- include a clear error message in audit log

---

## Execution flow (step-by-step)
1) Agent Runner loads enabled agents
2) For each agent:
   - evaluate trigger (does it apply now?)
   - if no: skip
3) Create agent_run row with status `running`
4) Execute steps in order
5) Write each step result (optional table)
6) On success: mark run `success`
7) On error:
   - retry if eligible
   - otherwise mark run `failed`
8) Always store enough detail to debug

---

## Node.js reference implementation (skeleton)
### `src/agents/agentRegistry.js`
Responsibilities:
- define allowed triggers
- define allowed actions
- validate agent config

Example skeleton:
// src/agents/agentRegistry.js
const TRIGGERS = {
"meeting.completed": require("./triggers/meetingCompleted"),
"task.overdue": require("./triggers/taskOverdue"),
"deal.stage_changed": require("./triggers/dealStageChanged"),
};

const ACTIONS = {
"post_to_pulse": require("./actions/postToPulse"),
"sync_to_crm": require("./actions/syncToCrm"),
"extract_action_items": require("./actions/extractActionItems"),
"create_onboarding_project": require("./actions/createOnboardingProject"),
};

function validateAgent(agent) {
if (!TRIGGERS[agent.trigger_type]) throw new Error("Unknown trigger_type");
if (!Array.isArray(agent.actions)) throw new Error("actions must be an array");
for (const step of agent.actions) {
if (!ACTIONS[step.type]) throw new Error(Unknown action type: ${step.type});
}
return true;
}

module.exports = { TRIGGERS, ACTIONS, validateAgent };

text

### `src/agents/agentRunner.js`
Responsibilities:
- run agents safely
- enforce idempotency
- enforce retries and guardrails
- write audit logs

Example skeleton:
// src/agents/agentRunner.js
const { TRIGGERS, ACTIONS, validateAgent } = require("./agentRegistry");
const db = require("../db");
const { withRetry } = require("../lib/retry");

async function hasSuccessfulRun(agentId, triggerEventId) {
const r = await db.query(
SELECT 1 FROM agent_runs WHERE agent_id=$1 AND trigger_event_id=$2 AND status='success' LIMIT 1,
[agentId, triggerEventId]
);
return r.rowCount > 0;
}

async function createRun(agentId, triggerEventId, input) {
const r = await db.query(
INSERT INTO agent_runs (id, agent_id, status, trigger_event_id, started_at, input, attempt) VALUES (gen_random_uuid(), $1, 'running', $2, NOW(), $3, 1) RETURNING *,
[agentId, triggerEventId, input]
);
return r.rows;
}

async function finishRun(runId, status, output, error) {
await db.query(
UPDATE agent_runs SET status=$1, output=$2, error=$3, finished_at=NOW() WHERE id=$4,
[status, output || null, error || null, runId]
);
}

function checkGuardrails(guardrails, counters) {
const g = guardrails || {};
if ((g.maxPulseMessagesPerRun ?? 3) < counters.pulseMessages)
throw new Error("Guardrail exceeded: maxPulseMessagesPerRun");
if ((g.maxCrmTasksPerRun ?? 10) < counters.crmTasks)
throw new Error("Guardrail exceeded: maxCrmTasksPerRun");
if ((g.maxTotalActionsPerRun ?? 25) < counters.totalActions)
throw new Error("Guardrail exceeded: maxTotalActionsPerRun");
}

async function runSingleAgent(agent, triggerPayload) {
validateAgent(agent);

const triggerEventId = triggerPayload.triggerEventId;
if (!triggerEventId) throw new Error("triggerEventId is required for idempotency");

if (await hasSuccessfulRun(agent.id, triggerEventId)) {
return { skipped: true, reason: "Already ran successfully for this triggerEventId" };
}

const run = await createRun(agent.id, triggerEventId, triggerPayload);

const counters = { pulseMessages: 0, crmTasks: 0, totalActions: 0 };
try {
for (let i = 0; i < agent.actions.length; i++) {
const step = agent.actions[i];
counters.totalActions += 1;

text
  checkGuardrails(agent.guardrails, counters);

  // Each action should return { result, countersDelta }
  const actionFn = ACTIONS[step.type];

  const stepResult = await withRetry(() =>
    actionFn({ agent, step, triggerPayload })
  );

  if (stepResult?.countersDelta) {
    counters.pulseMessages += stepResult.countersDelta.pulseMessages || 0;
    counters.crmTasks += stepResult.countersDelta.crmTasks || 0;
  }
}

await finishRun(run.id, "success", { counters }, null);
return { success: true, runId: run.id };
} catch (err) {
await finishRun(run.id, "failed", { counters }, err.message);
throw err;
}
}

module.exports = { runSingleAgent };

text

---

## Trigger contract (standard input)
Every trigger should output:
- `triggerEventId` (string) — unique identifier for idempotency
- `type` (string) — trigger type
- `payload` (json) — meetingId, dealId, taskId, etc.
- `occurredAt` (iso string)

Example:
{
"triggerEventId": "meeting:2b1a...-completed",
"type": "meeting.completed",
"occurredAt": "2025-12-16T05:00:00Z",
"payload": { "meetingId": "2b1a..." }
}

text

---

## Agent templates (Phase 2 must-have)
Create templates so users can start fast:
1) Deal Risk Monitor
2) Meeting Outcome Processor
3) Task Auto-Assigner
4) Customer Success Coordinator
5) Lead Qualification Agent (if available)

Templates are just pre-filled `agents` records.

---

## Minimal admin endpoints (for UI)
Recommended REST endpoints:
- `GET /api/agents`
- `POST /api/agents`
- `GET /api/agents/:id`
- `PUT /api/agents/:id`
- `POST /api/agents/:id/test-run`
- `POST /api/agents/:id/enable`
- `POST /api/agents/:id/disable`
- `GET /api/agent-runs?agentId=...`

---

## Must-not-fail rules
- Never spam Pulse:
  - add rate limits
  - enforce guardrails
- Never duplicate CRM tasks:
  - use dedupe keys + idempotency
- Never hide failures:
  - every failure must appear in `agent_runs` and UI

---

## Next file to request
Reply: **“Show file 03”** for the Agent Builder UI specs (what the UI must do and what screens to design in Gemini Studio).