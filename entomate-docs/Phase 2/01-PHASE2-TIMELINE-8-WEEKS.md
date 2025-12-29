# Entomate — Phase 2 Timeline (8 Weeks)
**Start:** Dec 16, 2025  
**Release Target:** Feb 10, 2026  
**Release Style:** Single release (ship everything together)  
**Build Style:** Backend-first Node.js reference → UI second  
**Goal:** Deliver Agents Framework + Advanced Search/Knowledge Graph MVP + Predictive Analytics MVP

---

## How to use this timeline (simple)
- Each week has:
  - Outcomes (what must exist by Friday)
  - Backend deliverables (Node.js reference)
  - Frontend deliverables (only after backend works)
  - QA checks (how you know it’s working)
- If you fall behind:
  - Protect the “Definition of Done” from file 00
  - Reduce UI polish first, not backend reliability

---

## Phase 2 Weekly Overview (fast view)

| Week | Dates | Focus | Must-Ship Outcome by Friday |
|------|-------|-------|-----------------------------|
| 1 | Dec 16–22 | Foundation + Specs | Specs locked, data model drafts, Gemini Studio mockups started |
| 2 | Dec 23–29 | Agents Framework Core | Agent runner works + audit logs + enable/disable + test-run (backend) |
| 3 | Dec 30–Jan 5 | 2 Agents Live | Deal Risk + Meeting Outcome Processor running end-to-end |
| 4 | Jan 6–12 | Advanced Search (RAG) | Ask Assistant searches meetings+tasks+CRM+Pulse with citations |
| 5 | Jan 13–19 | Knowledge Graph MVP | Linked records + minimal visualization working |
| 6 | Jan 20–26 | Predictive Analytics MVP | Deal probability + task ETA endpoints live (MVP) |
| 7 | Jan 27–Feb 2 | Remaining Agents + Polish | 2 more agents live + guardrails + tuning |
| 8 | Feb 3–10 | Stabilize + Release | Performance, reliability, docs, production launch |

---

## Week 1 (Dec 16–22): Foundation + Designs
### Outcome by Friday
- Phase 2 scope locked and written down (no new features added).
- Phase 2 docs created in `docs/phase2/`.
- Gemini Studio mockups started for Agent Builder, Search, and Knowledge Graph.
- Node.js backend skeleton ready for Phase 2 modules.

### Backend (Node.js) — Tasks
- Create a Phase 2 branch:
  - `feature/phase2-foundation`
- Add base folder structure (even if empty files):
  - `src/agents/`
  - `src/search/`
  - `src/analytics/`
- Add environment variables (placeholders ok):
  - `GEMINI_API_KEY`
  - `POSTGRES_URL`
  - `REDIS_URL` (optional if using BullMQ)
  - `LOGOS_VISION_BASE_URL`, `LOGOS_VISION_API_KEY`
  - `PULSE_BASE_URL`, `PULSE_API_KEY`
- Confirm Postgres migrations approach (recommended: SQL migrations or Prisma/Knex — pick one and stick to it).

### Frontend — Tasks
- No major frontend builds this week.
- Only: confirm UI routes/pages you will need:
  - `/agents`
  - `/search`
  - `/graph`
  - `/analytics`

### QA / Validation
- Repo builds and runs locally.
- Lint/test commands run (even if tests are minimal).

---

## Week 2 (Dec 23–29): Agents Framework (core)
### Outcome by Friday
- Agent Framework works end-to-end:
  - Create agent definition (DB or JSON config)
  - Enable/disable agent
  - Test-run agent
  - Audit log saved for every run
- “Kill switch” exists: a single toggle disables an agent immediately.

### Backend (Node.js) — Tasks
Implement:
- Agent registry (list of available triggers/actions)
- Agent runner (executes trigger → actions)
- Audit logs table/model (agent_runs)

Minimum runtime guarantees:
- Idempotency (safe if run twice)
- Retry rules (configurable)
- Logging (structured logs)

### Frontend — Tasks
- Minimal Agent Builder UI:
  - List agents
  - Enable/disable
  - “Test run” button
  - View audit logs

### QA / Validation
- A “hello world agent” runs and logs correctly.
- Agent failure is visible (no silent failures).

---

## Week 3 (Dec 30–Jan 5): Two agents go live
### Outcome by Friday
- 2 real agents run end-to-end:
  1) Deal Risk Monitor
  2) Meeting Outcome Processor (enhanced)

### Backend (Node.js) — Tasks
- Implement Deal Risk Monitor:
  - Trigger: overdue high-priority tasks OR missed action item deadlines
  - Actions: alert in Pulse + update CRM note (or task comment)
- Implement Meeting Outcome Processor:
  - Trigger: meeting completed + transcript ready
  - Actions: extract decisions + action items + link to CRM deal + post summary to Pulse
  - Must include dedupe logic so it doesn’t create duplicates if run twice

### Frontend — Tasks
- Add an “Agent results” view:
  - latest run status (success/fail)
  - what it changed (tasks created, messages posted)

### QA / Validation
- Run each agent 10 times (with test data).
- Verify:
  - no duplicate CRM tasks
  - no repeated Pulse spam
  - audit logs are complete

---

## Week 4 (Jan 6–12): Advanced Search (RAG)
### Outcome by Friday
- Ask Assistant can answer using:
  - meetings + tasks + CRM deals/contacts + Pulse (as context)
- Answers include citations (sources listed).

### Backend (Node.js) — Tasks
- Implement embeddings strategy:
  - MVP: pgvector in Postgres for embeddings + vector search
- Implement retrieval:
  - Top K meetings
  - Top K tasks
  - Top K deal notes (if available)
  - Pulse context (recent messages tied to the deal/project)
- Implement RAG prompt assembly with citations.

### Frontend — Tasks
- Search UI:
  - query box
  - filters (deal/customer/date/owner/sentiment)
  - answer panel
  - citations panel

### QA / Validation
- 25 test questions (write them down).
- Score each answer 1–5 and improve prompts/retrieval until acceptable.

---

## Week 5 (Jan 13–19): Knowledge Graph MVP
### Outcome by Friday
- Linked records are accurate:
  - meeting ↔ deal ↔ project ↔ tasks ↔ people
- Basic visualization OR at minimum a “relationship panel” exists that is usable.

### Backend (Node.js) — Tasks
- Create a “relationships” model/table:
  - source_type/source_id → target_type/target_id (+ relationship_type)
- Add linking logic:
  - Meeting mentions deal -> create relationship
  - Action item created -> link meeting → task
  - Deal creates project -> link deal → project

### Frontend — Tasks
- Graph view MVP:
  - can click a meeting and see linked deal/tasks/projects
  - simple node list is acceptable if visualization is too slow

### QA / Validation
- Randomly sample 20 meetings and verify relationships are correct.

---

## Week 6 (Jan 20–26): Predictive Analytics MVP
### Outcome by Friday
- Two prediction endpoints live and wired into UI:
  - deal close probability
  - task ETA

### Backend (Node.js) — Tasks
- Start with baseline models:
  - rule-based scoring (first)
  - then add ML later (Phase 2 still counts as shipped if baseline is useful)
- Store predictions with timestamps so you can track changes over time.
- Add an “explanation” field (why the model thinks this).

### Frontend — Tasks
- Deal analytics card:
  - probability % + explanation
- Task analytics:
  - predicted completion date + confidence band (simple)

### QA / Validation
- Compare predictions to known outcomes (even small dataset).
- Confirm predictions are not random and have consistent logic.

---

## Week 7 (Jan 27–Feb 2): Remaining agents + polish
### Outcome by Friday
- 2 more agents go live:
  - Task Auto-Assigner
  - Customer Success Coordinator
- Lead Qualification Agent is “nice if ready” (only if lead data exists).

### Backend (Node.js) — Tasks
- Task Auto-Assigner:
  - input: task type + workload + skills tags
  - output: assign user + notify in Pulse
- Customer Success Coordinator:
  - trigger: deal stage -> implementation
  - actions: create onboarding project template + tasks + Pulse kickoff message

### Frontend — Tasks
- Add “agent templates” dropdown in Agent Builder UI
- Add “dry-run mode” toggle so users can preview actions without executing

### QA / Validation
- Confirm the new agents do not break existing automations.
- Confirm rate limits and retries are working.

---

## Week 8 (Feb 3–Feb 10): Stabilize + ship
### Outcome by release day
- Production ready:
  - monitoring/logging
  - retries and dead-letter handling (no lost jobs)
  - documentation updated
  - a final end-to-end test suite passes

### Backend (Node.js) — Tasks
- Add operational hardening:
  - rate limiting for agent actions
  - circuit breaker behavior (if Pulse or CRM is down)
  - manual re-run for failed agent runs
- Add indexes for performance (search especially).
- Confirm audit logs retention policy.

### Frontend — Tasks
- UI polish (only after backend stable):
  - loading states
  - error states
  - clear “sources” UX for search
  - agent run history page

### QA / Validation
- Release checklist from file 08 must be 100% complete.
- Run:
  - load tests (search)
  - failure tests (simulate CRM down)
  - spam prevention tests (Pulse)

---

## Team cadence (recommended)
- Daily standup: 15 minutes
- Weekly sign-off: Friday
- Rule: if something is blocked > 24 hours, escalate immediately

---

## Next file to request
Reply: **“Show file 02”** for the Agents Framework specification (this is the most important build doc).
