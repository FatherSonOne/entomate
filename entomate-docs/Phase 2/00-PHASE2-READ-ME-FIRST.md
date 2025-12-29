# Entomate — Phase 2 (8 Weeks) — READ ME FIRST
**Start date:** Dec 16, 2025  
**Release date target:** Feb 10, 2026  
**Release type:** Single 8-week release (one launch)  
**Primary themes:** Custom AI Agents + Advanced Search/Knowledge Graph + Predictive Analytics  
**Backend reference:** Node.js (backend-first), with a clear path to add UI after the backend works.

---

## What you are building (simple explanation)
Phase 2 turns Entomate from “meeting notes + tasks” into a system that can:
- Run **AI Agents** that automatically monitor deals, assign tasks, and coordinate delivery.
- Provide **Advanced Search** (Ask Assistant) across meetings, tasks, CRM deals, and Pulse messages.
- Provide **Predictions** like “deal close probability” and “task ETA” using your historical data.

If Phase 1 is the “record and summarize meetings” foundation, Phase 2 is the “autopilot” layer that makes work happen with less manual effort.

---

## Non-developer translation (what is an Agent?)
An **Agent** is like a “robot employee” that:
1. Watches for a **trigger** (example: a meeting ends, a deal changes stage, a task is overdue).
2. Runs a **decision step** (example: read transcript + CRM context and decide what matters).
3. Executes **actions** (example: create tasks, post to Pulse, update CRM, alert a manager).

In code, an agent is usually:
- A record in a database (name, enabled/disabled, triggers, actions)
- A runner that executes steps reliably
- A log of every run (audit trail)

---

## Phase 2 Definition of Done (must ship)
Phase 2 is complete when these are true:

### Agents
- The Agents framework exists (create/edit/enable/disable/test-run).
- At least **3 agents** are deployed and stable:
  - Deal Risk Monitor
  - Meeting Outcome Processor (enhanced)
  - Customer Success Coordinator (or Task Auto-Assigner if that’s higher value)

### Search + Knowledge Graph
- Ask Assistant can search across:
  - Meetings (transcripts + summaries)
  - Projects + tasks
  - CRM deals/contacts (Logos Vision)
  - Pulse messages (as context)
- Answers show **sources/citations** (what meeting/task/deal the answer came from).
- Knowledge Graph MVP exists (at minimum: accurate linked records view).

### Predictive Analytics
- Predictive endpoints exist and return useful values:
  - Deal close probability (MVP)
  - Task ETA (MVP)
- Baseline models are acceptable in Phase 2 (rule-based first, ML second), as long as:
  - outputs are consistent
  - tracked
  - and improve over time

---

## Success metrics (acceptance targets)
Use these as “ship gates”:
- **Search latency:** < 500ms for top-level retrieval (excluding AI generation time).
- **Automation/agent success rate:** > 98% successful executions (no silent failures).
- **Model usefulness:** target 80%+ “directionally correct” (calibrated over time).
- **Adoption:** internal users actually use it (at least weekly).

---

## Folder structure to create (VS Code)
Create these docs in your repo:

`docs/phase2/`
- 00-PHASE2-READ-ME-FIRST.md (this file)
- 01-PHASE2-TIMELINE-8-WEEKS.md
- 02-AGENTS-FRAMEWORK-SPEC.md
- 03-AGENT-BUILDER-UI-SPECS.md
- 04-ADVANCED-SEARCH-RAG-SPECS.md
- 05-KNOWLEDGE-GRAPH-MVP.md
- 06-PREDICTIVE-ANALYTICS-MVP.md
- 07-TESTING-QA-PHASE2.md
- 08-RELEASE-CHECKLIST-PHASE2.md

---

## How to use these docs (correct order)
1. Read **00** (this file)
2. Read **01** (timeline) to know what week you are in
3. Read **02** (agents spec) before writing code
4. Read **04** (search) before building any “Ask Assistant” UI polish
5. Read **06** (analytics) only after you confirm what data exists

---

## Backend-first Node.js reference (recommended baseline)
This Phase 2 documentation assumes a Node.js backend pattern like:

### Core services
- **API server:** Express (REST endpoints)
- **Database:** Postgres
- **Queue/Jobs:** BullMQ + Redis (recommended) OR a simple DB-backed job runner for MVP
- **Embeddings/Search:** pgvector in Postgres (recommended MVP)
- **AI provider:** Gemini API (same as Phase 1)

### Why backend-first?
Because UI can look “done” while nothing works reliably.
Agents, search, and predictions must be dependable and testable first.

---

## Minimal Node.js modules you will create (Phase 2)
These module names are referenced throughout the Phase 2 docs:

### Agents
- `src/agents/agentRegistry.js`
- `src/agents/agentRunner.js`
- `src/agents/triggers/*`
- `src/agents/actions/*`
- `src/agents/templates/*`

### Search (RAG)
- `src/search/embedder.js`
- `src/search/retriever.js`
- `src/search/ragAnswer.js`
- `src/search/citations.js`

### Analytics (Predictions)
- `src/analytics/dealProbability.js`
- `src/analytics/taskEta.js`
- `src/analytics/modelRegistry.js`

### Shared
- `src/db/index.js`
- `src/lib/logger.js`
- `src/lib/retry.js`
- `src/lib/rateLimit.js`

---

## Phase 2 “work rules” (protect the schedule)
To make Feb 10 real:
- Do not start with “perfect UI.” Start with “reliable backend.”
- Every agent must have:
  - idempotency (safe if run twice)
  - retry rules
  - audit logs
  - and a kill switch (disable toggle)
- Search must return sources before it returns “beautiful answers.”
- Predictions must ship as MVP “useful guesses,” not perfect ML.

---

## 60-minute kickoff checklist (start right now)
Do these in this exact order:

1) **Create the docs files** listed above in `docs/phase2/`.
2) Create a Git branch:
   - `phase2/main` (or `feature/phase2-foundation`)
3) Confirm these environment variables exist in `.env` (placeholders ok tonight):
   - `GEMINI_API_KEY=`
   - `POSTGRES_URL=`
   - `REDIS_URL=` (if using BullMQ)
   - `LOGOS_VISION_API_KEY=`
   - `LOGOS_VISION_BASE_URL=`
   - `PULSE_API_KEY=`
   - `PULSE_BASE_URL=`
4) Add a Phase 2 “work board” (GitHub Projects or issues) with:
   - Week 1–8 columns
   - Bugs + Blockers column
5) In Gemini Studio, start mockups for:
   - Agent Builder UI
   - Search UI (filters + citations)
   - Knowledge Graph view (linked records)

---

## What to ask for (dependencies)
Phase 2 depends on having access to:
- Logos Vision API endpoints for deals/contacts/tasks + webhooks (if available)
- Pulse API endpoints for messages/channels + history search (if available)

If those are not ready, build Phase 2 with mock adapters, but do not delay the framework.

---

## Next file to request
Reply: **“Show file 01”** to get the 8-week Phase 2 timeline markdown.
