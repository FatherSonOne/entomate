text
# Entomate — Phase 2 — Testing & QA Plan
**Purpose:** Make Phase 2 stable enough to ship as a single release (Feb 10, 2026) by testing Agents + Search (RAG) + Predictive Analytics end-to-end.  
**Philosophy:** Reliability beats polish. If UI looks good but agents spam Pulse or duplicate CRM tasks, Phase 2 fails.

---

## What QA means (plain English)
QA (Quality Assurance) is the process of proving:
- the features work
- the system is safe (doesn’t spam, doesn’t duplicate)
- failures are visible (audit logs)
- performance is acceptable

Phase 2 QA focuses on 3 risky areas:
1) Agents (automation can cause damage)
2) Search/RAG (hallucinations destroy trust)
3) Predictions (must be explainable and stable)

---

## Phase 2 “ship gates” (must pass)
- **Agents success rate:** > 98% successful runs (no silent failures).
- **Search retrieval latency:** < 500ms for retrieval (not including Gemini generation).
- **No spam rule:** Guardrails prevent excessive Pulse/CRM actions.
- **No duplicates rule:** Idempotency prevents duplicate CRM tasks/messages.
- **Observability:** Every agent run is logged with status + error detail.

---

## Test environments (recommended)
Create two environments:
1) **Local dev**
- fastest iteration
- mocked CRM/Pulse allowed

2) **Shared staging**
- uses real Postgres + (ideally) Redis
- uses sandbox Logos Vision + sandbox Pulse credentials
- used for final signoff tests

---

## Testing types (what to run and when)
### 1) Unit tests (fast)
Run on every PR.
Targets:
- input validation helpers
- guardrails logic
- citation parsing/validation
- scoring logic for predictions

### 2) Integration tests (critical)
Run on every PR that touches:
- agents runner
- CRM/Pulse adapters
- search retriever
- analytics endpoints

### 3) End-to-end tests (release signoff)
Run during Week 8 (and weekly starting Week 4).
Targets:
- agent triggers → actions
- RAG question → citations
- deal/task analytics → stored predictions

### 4) Chaos/failure tests (must do)
Prove the system behaves safely when:
- CRM is down
- Pulse is down
- Gemini rate limits
- network errors occur

---

## Agents QA (detailed)
### Core Agent Test Cases (required)
For each Phase 2 agent template:
- Deal Risk Monitor
- Meeting Outcome Processor
- Task Auto-Assigner
- Customer Success Coordinator
- Lead Qualification Agent (if enabled)

Test these:

#### A) Idempotency tests
Goal: running twice should not create duplicates.
Steps:
1. Trigger the agent using a fixed `triggerEventId`.
2. Run the agent once → expect success.
3. Run again with SAME `triggerEventId` → expect `skipped` or no side effects.
Expected:
- no duplicate CRM tasks
- no duplicate Pulse posts
- `agent_runs` contains first success + second skip (or a “skipped” record)

#### B) Guardrails tests
Goal: guardrails stop spam.
Steps:
1. Create a test scenario that would create 50 actions.
2. Set guardrails to maxTotalActionsPerRun=10.
Expected:
- run fails safely
- error message says which guardrail was exceeded
- no partial spam (prefer “stop early” behavior)

#### C) Retry tests
Goal: retry only for transient failures.
Steps:
1. Force Pulse adapter to return 429 / 503.
2. Confirm exponential backoff occurs.
3. Confirm max attempts is respected.
Expected:
- `agent_runs.attempt` increments
- final status = failed after max attempts
- error stored with readable message

#### D) Audit log completeness
Goal: every run is visible.
Expected fields in run:
- agentId
- triggerEventId
- startedAt/finishedAt
- status
- input and output JSON
- error string if failed

---

## Search/RAG QA (detailed)
### Core Search Test Set (required)
Maintain a file (in your repo) called:
- `docs/phase2/search-test-questions.md`

It must include:
- 25 questions total
- at least:
  - 10 questions requiring meeting + CRM context
  - 10 questions requiring meeting + Pulse context
  - 5 questions that should return “Not found”

For each question, record:
- expected result type (found vs not found)
- expected key citation source (meeting/task/deal/message)

### Anti-hallucination tests (must pass)
- If zero citations → response must be rejected and replaced with “Not found”
- If citation IDs referenced don’t exist → reject and return “Not found”
- If sources are irrelevant (manual review) → refine retrieval

### Latency tests
Measure:
- embedding time
- retrieval time
- total time

Acceptance:
- retrieval < 500ms (excluding Gemini generation)

### Citation correctness tests
For 10 random answers:
- open each cited source
- verify the cited text supports the statement

---

## Predictive Analytics QA (detailed)
### Deal Probability tests
For 20 deals (or test deals):
- record:
  - stage
  - overdue task count
  - last activity age
- verify:
  - probability moves in the expected direction
  - explanation mentions the right drivers
  - stored in `predictions` with `model_version`

### Task ETA tests
For 20 tasks:
- ensure predicted completion dates are:
  - not in the past (unless already completed and you are backfilling)
  - consistent with rules
- explanation must mention baseline/cycle-time logic

### Regression tests
After changing baseline rules:
- run the same dataset
- compare before/after to ensure no wild swings

---

## Failure-mode test matrix (must run in staging)
| Component | Failure to simulate | Expected behavior |
|----------|----------------------|------------------|
| Pulse API | 503 down | agent retries, then fails; no spam; run logged |
| CRM API | 401/403 auth | agent fails quickly; run logged; no retries unless misconfig fixed |
| CRM API | 429 rate limit | agent retries with backoff; run logged |
| Gemini | rate limit | queue or retry; system remains responsive; visible errors |
| Postgres | slow query | search degrades gracefully; logs show slow query |

---

## Load / performance testing (simple commands)
In staging (or local):
- Basic health endpoint load test:
  - `ab -n 1000 -c 10 http://<host>:3000/api/health`
  - or `wrk -t4 -c100 -d30s http://<host>:3000/api/health`

For search endpoint, do:
- 50–100 concurrent requests with a fixed question payload
- verify:
  - no crashes
  - no runaway memory usage
  - retrieval time stays within target

---

## Release candidate checklist (Week 8 signoff)
### Agents
- [ ] Each agent template test-run passes
- [ ] Each agent idempotency test passes
- [ ] Guardrails stop spam in worst-case scenarios
- [ ] Audit logs are visible for success/failure

### Search
- [ ] 25 questions executed and scored
- [ ] “Not found” behavior confirmed
- [ ] Citations verified for 10 answers
- [ ] retrieval latency meets target

### Analytics
- [ ] deal probability endpoint stable
- [ ] task ETA endpoint stable
- [ ] explanations always present
- [ ] predictions saved with model_version

### Operational
- [ ] error logs monitored
- [ ] env vars correct in staging and prod
- [ ] rollback plan exists (see file 08)

---

## What to do tonight (first QA steps)
If starting immediately:
1) Create the test question file:
   - `docs/phase2/search-test-questions.md`
2) Write the first 10 questions now (you’ll add the rest later).
3) Add “smoke tests” to confirm:
   - `/api/agents` works
   - `/api/search/ask` works (even with mocked data)
   - `/api/analytics/deals/:id/probability` returns JSON

---

## Next file to request
Reply: **“Show file 08”** for the Phase 2 release checklist (deployment, rollback, and final approval gates).