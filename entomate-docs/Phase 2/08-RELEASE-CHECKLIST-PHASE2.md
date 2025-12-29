text
# Entomate — Phase 2 — Release Checklist (Production Launch)
**Release target:** Feb 10, 2026  
**Release type:** Single combined release (Agents + Search/RAG + Knowledge Graph MVP + Predictive Analytics MVP)  
**Goal:** A safe production launch that avoids spam, duplicates, downtime, and hallucinated answers.

---

## What “Release Checklist” means (plain English)
This is the step-by-step list to follow right before launch so nothing important is forgotten.

A Phase 2 release is not “we merged code.”
A Phase 2 release is “the system is stable, monitored, and safe in production.”

---

## Phase 2 final ship gates (must be true)
- [ ] Agents success rate > 98% in staging runs (no silent failures).
- [ ] Search retrieval latency < 500ms in staging (excluding Gemini generation).
- [ ] Ask Assistant returns citations for factual answers and returns “Not found” otherwise.
- [ ] At least 3 agents are live and stable:
  - [ ] Deal Risk Monitor
  - [ ] Meeting Outcome Processor (enhanced)
  - [ ] Customer Success Coordinator OR Task Auto-Assigner (choose one as the 3rd if time is tight)
- [ ] Predictive endpoints live:
  - [ ] Deal close probability
  - [ ] Task ETA
- [ ] Every critical failure is visible:
  - [ ] agent_runs table logs failures
  - [ ] search errors are logged
  - [ ] analytics endpoint errors are logged

---

## Pre-release (72–24 hours before launch)
### Code + branch readiness
- [ ] Phase 2 branch merged to `main` (or release branch created).
- [ ] No open “P0” or “P1” bugs.
- [ ] All migrations reviewed and tested.
- [ ] Version/tag created (example: `v2.0.0-rc1`).

### Documentation readiness
- [ ] `docs/phase2/` up to date.
- [ ] Known limitations listed (example: Lead Qualification Agent only if lead data exists).
- [ ] Support runbook created (what to do if Pulse/CRM is down).

### Environment readiness
- [ ] Production environment variables set:
  - [ ] GEMINI_API_KEY
  - [ ] POSTGRES_URL
  - [ ] REDIS_URL (if using queue)
  - [ ] LOGOS_VISION_BASE_URL + LOGOS_VISION_API_KEY
  - [ ] PULSE_BASE_URL + PULSE_API_KEY
- [ ] Secrets rotated (if any were shared).
- [ ] Rate limiting values validated.

---

## Staging signoff (must be completed)
### Agents
- [ ] Idempotency test for each live agent (run twice, no duplicates).
- [ ] Guardrails test (force spam scenario, confirm stop).
- [ ] Retry test (simulate 429/503 and verify backoff).
- [ ] Audit logs readable in UI for success and failure.

### Search/RAG
- [ ] 25-question test set completed and recorded.
- [ ] Citations verified for at least 10 “found” answers.
- [ ] “Not found” verified for at least 5 questions.
- [ ] Retrieval latency measured and recorded.

### Predictive Analytics
- [ ] 20 deals tested: probability + explanation make sense.
- [ ] 20 tasks tested: ETA + explanation make sense.
- [ ] Predictions stored with `model_version`.

---

## Production deployment steps (the actual launch)
### 1) Freeze
- [ ] Announce code freeze window (example: 2 hours).
- [ ] Stop merging non-release PRs.

### 2) Backup
- [ ] Take production database backup/snapshot.
- [ ] Confirm backup is restorable (at least confirm the snapshot exists).

### 3) Deploy
- [ ] Deploy backend (Node.js API).
- [ ] Deploy frontend (web app).
- [ ] Run database migrations in production (only once).
- [ ] Restart services cleanly.

### 4) Smoke tests (must pass immediately)
Run these checks right after deploy:
- [ ] `GET /api/health` returns ok
- [ ] `GET /api/agents` returns list
- [ ] `POST /api/agents/:id/test-run` works in dry-run
- [ ] `POST /api/search/ask` returns “Not found” (with empty data) or returns citations (with data)
- [ ] `GET /api/analytics/deals/:id/probability` returns JSON
- [ ] Confirm agent_runs table is receiving logs

### 5) Enable agents gradually (important)
Do NOT enable every agent at once.
Enable in this order:
1. [ ] Meeting Outcome Processor (most controlled and visible)
2. [ ] Deal Risk Monitor (make sure guardrails prevent spam)
3. [ ] Customer Success Coordinator OR Task Auto-Assigner
4. [ ] Remaining agents (only if stable)

---

## Monitoring checklist (first 24 hours)
### Logs and dashboards
- [ ] Monitor error rate (500s).
- [ ] Monitor agent_runs failures (count and top causes).
- [ ] Monitor CRM API failures (401/403/429/5xx).
- [ ] Monitor Pulse API failures (429/5xx).
- [ ] Monitor search latency.
- [ ] Monitor queue depth (if using BullMQ/Redis).

### Spam prevention checks
- [ ] Confirm Pulse messages volume is normal.
- [ ] Confirm CRM task creation rate is normal.
- [ ] Confirm no duplicate tasks are being created.

---

## Rollback plan (must exist before launch)
### When to rollback (clear triggers)
Rollback if any of these occur:
- [ ] Agents cause spam (Pulse or CRM)
- [ ] Major duplicate CRM tasks detected
- [ ] Search answers are hallucinating (no citations enforcement failing)
- [ ] System instability (crashes, high 500s)

### Rollback options (choose 1 primary + 1 backup)
Primary (recommended):
- [ ] Roll back app code to previous release tag

Backup:
- [ ] Restore database snapshot (only if migrations caused issues)

### “Kill switch” emergency procedure
If spam is happening:
1) Disable agents immediately:
- [ ] Flip global `AGENTS_ENABLED=false` (if implemented) OR
- [ ] Disable each agent via admin endpoint/UI
2) Stop the queue worker (if using BullMQ):
- [ ] Scale worker to 0
3) Verify Pulse/CRM traffic stops
4) Investigate logs and agent_runs

---

## Post-release (Day 1–7)
### Validation
- [ ] Confirm 3 agents running successfully daily
- [ ] Confirm “Ask Assistant” usage and user satisfaction
- [ ] Confirm predictions are being stored and viewed

### Improvements (do not block launch)
- [ ] Tune retrieval scoring and chunking
- [ ] Improve prompts for RAG answers
- [ ] Refine baseline prediction rules

---

## Roles and approvals
Before launch, get signoff from:
- [ ] Product owner (you)
- [ ] Backend lead
- [ ] Frontend lead
- [ ] QA owner
- [ ] Ops/DevOps owner (if applicable)

---

## Next file to request (optional)
If you want the remaining missing doc (File 05 Knowledge Graph MVP), reply:
**“Show file 05”**