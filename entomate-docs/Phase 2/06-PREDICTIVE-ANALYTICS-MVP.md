Here is File 06. Copy everything into: docs/phase2/06-PREDICTIVE-ANALYTICS-MVP.md​

text
# Entomate — Phase 2 — Predictive Analytics MVP
**Goal:** Ship useful predictions fast (rule-based first), then improve over time (ML later).  
**Must ship in Phase 2:**  
1) Deal close probability (MVP)  
2) Task ETA (MVP)

---

## What “Predictive Analytics” means (plain English)
Predictive Analytics is when Entomate uses your past data to make a helpful guess about the future, like:
- “This deal has a 72% chance to close.”
- “This task is likely to finish 5 days late.”

In Phase 2, predictions can start as **simple scoring rules** (not fancy ML). That still counts as “predictive” as long as it is:
- consistent
- explainable
- tracked over time

---

## Non-negotiables (Phase 2 rules)
- Always show an **explanation** for every prediction.
- Store predictions so you can compare later (did it improve?).
- Never block core workflows if predictions fail (predictions are “add-on intelligence”).
- Start with **baselines** and improve iteratively.

---

## Data needed (minimum)
### For deal close probability
You need at least some of:
- deal stage history
- deal value
- last activity date (meeting, email, message, note)
- tasks linked to the deal (open/overdue/completed)
- meeting sentiment or meeting outcomes (optional but powerful)

### For task ETA
You need:
- task created date
- due date (if available)
- status transitions (todo → doing → done)
- assignee (optional)
- priority (optional)

If you don’t have enough data yet, still ship baseline logic:
- “Overdue tasks are likely late”
- “Tasks assigned to overloaded users are likely late”

---

## What to build first (backend-first order)
1) Prediction storage tables
2) Two prediction endpoints
3) Simple rule-based baseline scoring
4) UI cards to display predictions + explanations
5) Calibration: compare predictions to outcomes (weekly)

---

## Database schema (Postgres)
Create a table to store predictions:

### `predictions`
Fields:
- `id` uuid
- `prediction_type` text (`deal_close_probability` | `task_eta`)
- `entity_type` text (`deal` | `task`)
- `entity_id` text (CRM deal id or internal task uuid)
- `predicted_value` jsonb (store structured output)
- `explanation` text
- `model_version` text (ex: `baseline_v1`)
- `created_at` timestamp

**Why store JSON?** Because later you may add:
- confidence
- feature contributions
- alternative predictions

---

## Prediction 1: Deal Close Probability (baseline)
### Output format (MVP)
Return:
- probability (0–100)
- risk flags
- explanation (human-readable)

Example:
{
"dealId": "crm_123",
"probability": 72,
"riskFlags": ["overdue_tasks", "no_recent_meeting"],
"explanation": "Probability reduced because 3 tasks are overdue and there has been no meeting in 14 days.",
"modelVersion": "baseline_v1"
}

text

### Baseline scoring logic (example)
Start from a base and add/subtract points.

Example heuristic:
- Base score: 50
- Stage adjustments:
  - discovery: +0
  - proposal: +10
  - negotiation: +20
  - verbal_commit: +30
- Activity adjustments:
  - last meeting < 7 days: +10
  - last meeting 7–14 days: +0
  - last meeting > 14 days: -10
- Task adjustments:
  - each overdue “high” task: -10 (cap at -30)
  - each completed key deliverable: +5 (cap at +15)
- Sentiment adjustments (optional):
  - negative sentiment last meeting: -10
  - positive sentiment: +5

Clamp to 0–100.

### “Explainability” requirement
The explanation must list the top 2–4 reasons.
Example:
- “+20 because deal is in negotiation.”
- “-20 because 2 high priority tasks are overdue.”

---

## Prediction 2: Task ETA (baseline)
### Output format (MVP)
Return:
- predictedCompletionDate (ISO date)
- confidence (low/medium/high) or numeric 0–1
- explanation (human-readable)

Example:
{
"taskId": "7b5e...",
"predictedCompletionDate": "2026-01-04",
"confidence": "medium",
"explanation": "Similar medium priority tasks for this team typically complete in 9–12 days; task is currently not started and due in 3 days.",
"modelVersion": "baseline_v1"
}

text

### Baseline ETA logic (example)
Compute a “typical cycle time”:
- for all completed tasks in last 90 days
- grouped by:
  - priority (optional)
  - assignee (optional)
  - project type (optional)

MVP fallback if no history:
- priority high: typical 3 days
- medium: 7 days
- low: 14 days

Then adjust:
- if task already overdue: predicted date = today + (typicalRemainingDays)
- if assignee has > N open tasks: add extra days

---

## Backend API endpoints (minimum)
### Deals
- `GET /api/analytics/deals/:dealId/probability`

### Tasks
- `GET /api/analytics/tasks/:taskId/eta`

### Optional (batch)
- `POST /api/analytics/deals/probability`
- `POST /api/analytics/tasks/eta`

---

## Node.js reference modules
Create these files:

### `src/analytics/modelRegistry.js`
- Keeps track of models by name/version.
- Lets you upgrade baseline_v1 → baseline_v2 safely.

### `src/analytics/dealProbability.js`
- Loads deal + related events/tasks/meetings
- Computes baseline probability
- Writes to `predictions`

### `src/analytics/taskEta.js`
- Loads task + history
- Computes predicted date
- Writes to `predictions`

---

## Simple Node.js skeletons (reference)
### `src/analytics/modelRegistry.js`
const MODELS = {
deal_close_probability: { version: "baseline_v1" },
task_eta: { version: "baseline_v1" }
};

function getModelVersion(type) {
return MODELS[type]?.version || "unknown";
}

module.exports = { getModelVersion };

text

### `src/analytics/dealProbability.js`
const db = require("../db");
const { getModelVersion } = require("./modelRegistry");

function clamp(n, min, max) {
return Math.max(min, Math.min(max, n));
}

async function computeDealProbability(dealId) {
// TODO: replace placeholders with real joins:
const deal = await db.getDeal(dealId); // stage, value, updatedAt
const stats = await db.getDealStats(dealId); // overdueTasks, lastMeetingDaysAgo, etc.

let score = 50;
const reasons = [];

if (deal.stage === "negotiation") { score += 20; reasons.push("+20 negotiation stage"); }
if (stats.lastMeetingDaysAgo > 14) { score -= 10; reasons.push("-10 no meeting in 14+ days"); }
if (stats.overdueHighTasks > 0) {
const penalty = Math.min(30, stats.overdueHighTasks * 10);
score -= penalty;
reasons.push(-${penalty} overdue high priority tasks);
}

score = clamp(score, 0, 100);

const result = {
dealId,
probability: score,
riskFlags: [
...(stats.overdueHighTasks > 0 ? ["overdue_tasks"] : []),
...(stats.lastMeetingDaysAgo > 14 ? ["no_recent_meeting"] : [])
],
explanation: reasons.slice(0, 4).join("; "),
modelVersion: getModelVersion("deal_close_probability")
};

// Store prediction
await db.insertPrediction({
prediction_type: "deal_close_probability",
entity_type: "deal",
entity_id: dealId,
predicted_value: result,
explanation: result.explanation,
model_version: result.modelVersion
});

return result;
}

module.exports = { computeDealProbability };

text

### `src/analytics/taskEta.js`
const db = require("../db");
const { getModelVersion } = require("./modelRegistry");

function addDays(date, days) {
const d = new Date(date);
d.setDate(d.getDate() + days);
return d.toISOString().slice(0, 10);
}

async function computeTaskEta(taskId) {
const task = await db.getTask(taskId); // priority, status, createdAt, dueDate, assigneeId
const hist = await db.getTaskHistoryStats(taskId); // typicalDaysForSimilar, assigneeOpenTasks, etc.

let typicalDays = hist.typicalDaysForSimilar;
if (!typicalDays) {
typicalDays = task.priority === "high" ? 3 : task.priority === "low" ? 14 : 7;
}

let extra = 0;
if ((hist.assigneeOpenTasks || 0) > 10) extra += 3;
if (task.status === "todo") extra += 1;

const predictedCompletionDate = addDays(new Date(), typicalDays + extra);

const result = {
taskId,
predictedCompletionDate,
confidence: typicalDays ? "medium" : "low",
explanation: Baseline ETA uses typical cycle time ${typicalDays} days plus adjustments (${extra} days).,
modelVersion: getModelVersion("task_eta")
};

await db.insertPrediction({
prediction_type: "task_eta",
entity_type: "task",
entity_id: taskId,
predicted_value: result,
explanation: result.explanation,
model_version: result.modelVersion
});

return result;
}

module.exports = { computeTaskEta };

text

---

## UI requirements (minimal)
### Deal page / Deal panel
Show:
- “Close Probability: 72%”
- Explanation line (hover to expand)

### Task details
Show:
- “Predicted completion: Jan 4”
- Confidence label + explanation

---

## QA / Acceptance checklist
- Predictions endpoints respond in < 300ms (excluding any external calls).
- If CRM is down, endpoint returns a graceful message and logs an error.
- 20 sample deals + 20 tasks tested and results “make sense” (directionally correct).
- Predictions stored in DB with model_version and explanation.

---

## Next file to request
Reply: **“Show file 05”** (Knowledge Graph MVP) or **“Show file 07”** (Testing + QA for Phase 2).