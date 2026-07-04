# Entomate — APP-PRODUCT.md

> The living source of truth for Entomate, compiled by `/app-dev` (Phase 0–4) on 2026-07-04.
> This is a whole-app foundation spec. Each roadmap **Section** below becomes its own hardening session.
> Update this file at the end of every session. Never regress a proven win.

---

## 0. What Entomate Is

**AI-powered meeting-intelligence platform, nonprofit-native, ecosystem-connected.** It captures
meetings (via Recall.ai bots), transcribes with speaker diarization (Deepgram Nova-3), and — through
its signature **Meeting Intelligence Profiles (MIP)** layer — processes each meeting *through the lens
of its purpose* (board, grant, donor, standup, sales…), then routes structured outcomes (decisions,
action items, briefings) back into the sibling apps.

**Ecosystem thesis (the north star):** Logos Vision knows the *people*, Pulse knows the
*conversations*, Entomate knows the *meetings* — three purpose-built apps sharing one intelligence
layer beat any all-in-one. MIP is the first feature that makes all three "think together."

- **Target category:** Whole-app (spans Feature + Service + Infrastructure + Data + Integration).
- **Stack:** `backend/` Node/Express (Render) · `frontend/` React 18 JSX + Vite + Tailwind (Vercel) ·
  Supabase (Postgres + pgvector + Edge Functions) · Recall.ai · Deepgram · Gemini/OpenAI · Slack · Google Calendar · Svix.
- **Repo:** github.com/FatherSonOne/entomate · branch `main` · last commit 2026-06-12.
- **Market:** Q2 2027 (per ecosystem roadmap). Positioning: NPO-native; tiers Steward/Mission/Foundation (provisional).

---

## 1. Canonical vs Divergent (read this before touching anything)

| Concern | ✅ Canonical (build here) | ❌ Divergent / legacy (reconcile, don't extend) |
|---|---|---|
| Frontend | `frontend/` — React 18, JSX, react-router, Supabase auth, deployed by Vercel/Docker | root `index.tsx` + root `src/*.tsx` = dead Google-AI-Studio scaffold (React 19, **browser-side Gemini key** = latent secret leak) |
| Backend | `backend/` — `entomate-backend`, `server.js`, deployed by Render | root `server.js.bak`, `test-hub.js`, `nul`, and `server/` (3rd minimal Express: health/settings only) |
| Migrations | `supabase/migrations/` (CLI-linked, dated chain) | `backend/migrations/` + `database/` (empty), `server/db/`, `docs/migrations/` (scratch graveyard — **but holds the base schema, see §4**) |
| Cross-app transport | `ecosystemBridge` (direct HTTP → per-app `ecosystem-inbound` edge fn) | legacy `hubClient`/`hubEventPublisher` shared-DB "hub" (still dual-writing) |
| Tooling | root `package.json` owns husky/lint-staged/vitest for the whole repo | …but its React 19 + `@google/genai` deps make `npm run dev` at root boot the **dead** app — a newcomer trap |

---

## 2. Capability Map (what exists, by domain)

**Meetings / Bots** — *solid.* Recall bot launch/kill/state + Svix-HMAC webhook receiver; transcript
processing; per-meeting ask/recap/reprocess; publish-to-CRM. `botOrchestrator.js` (776 LOC, post-pivot, well-documented).
**Automation / Workflows** — *solid, over-built.* Legacy trigger `automations` **and** node-based v2
`workflows` (React-Flow builder, NodeRegistry 1048, Templates 1788) coexist. `AutomationEngine` (1003, ~19 action handlers).
**Agents** — *partial cohesion.* THREE overlapping subsystems: `aiAgentService` (template-driven, Gemini-direct)
vs `agents/` typed agents + `agentOrchestrator` (guardrailed, idempotent). `routes/agents.js` imports all.
**Intelligence / RAG** — *capable, split.* Briefings, meeting-prep, deal-risk, relationships, nudges;
semantic + keyword + RAG search (SSE). **Two embedding stacks** (`embeddingService` for /search vs `vectorStore` for workflow RAG; 1536 vs 768 dim mismatch).
**MIP (Meeting Intelligence Profiles)** — *Phases 1–3 built, Phase 4 open.* Profile tables, 7–8 built-in
profiles, context assembler, suggestion engine, `MeetingIntelligencePanel`. Value-path enrichment on **outbound recaps not yet wired** (still generic `formatRecapFallback`).
**Ecosystem** — *mid-migration.* Direct-HTTP bridge live (outbound events wired for Pulse + LV); inbound
edge fn caches context for MIP. Legacy hub still dual-writing. Retry/backoff/DLQ present; **no inbound idempotency**.
**Consent / GDPR** — *solid.* P1.7 slices 1–4 shipped (organizer consent gate, bot announcement, pre-meeting
opt-out email, public opt-out, retention sweep, right-to-delete, data controls, jurisdiction policy). `retentionScheduler` daily 03:00 UTC.
**Platform** — *solid.* projects/tasks/goals(OKRs)/dashboard/reports(PDF/CSV)/settings/secrets-vault/health.
Soft spots: `secretsVault` returns a **mock secret when DB not configured**; `monitoring/ErrorMonitoring` cost+analytics sinks are TODO.
**Integrations** — Recall, Deepgram (BYO key inside Recall config), Gemini+OpenAI (behind `config/ai.js`),
Slack (notifier + event listener), Google Calendar OAuth, Supabase (anon + service-role).

---

## 3. Hardening Scores (evidence-based, 2026-07-04)

| Layer | Score | Verdict |
|---|---|---|
| Backend architecture | 72/100 | Solid foundation; mid-refactor debt (2 transports, 2 RAG stacks, 3 agent systems) |
| Frontend (canonical) | 64/100 | Feature-complete surface; **zero typechecking on shipped UI**, theme-migration drift, dead twin |
| **Data layer / multi-tenancy** | **48/100** | **Functional but fragile** — non-reproducible base schema, no row-level org isolation |
| Ecosystem bridge | 55/100 | Right architecture, real retry/DLQ; no idempotency, weak auth, dual-impl drift |
| Capture pipeline (Recall) | 68/100 | Works E2E through P1.3; webhook-landing + migration-drift + thin tests are the open edges |
| Consent / GDPR | 80/100 | Genuinely well-built; verify live end-to-end |
| MIP intelligence | 70/100 | Built through Phase 3; value-path enrichment + learning loop (Ph4) remain |
| Observability / cost-ops | 45/100 | Monitoring TODOs, alerts fire with no UI, no cost dashboard |
| **Overall** | **~61/100** | **Functional but fragile foundation under a capable product.** Secure the foundation before adding surface. |

---

## 4. Foundational Fractures (cross-cutting — these anchor the roadmap)

1. **Multi-tenancy is not enforced at the row level.** No `org_id` on core tables (meetings, tasks,
   agents, automations, embeddings, relationships). RLS is per-*user* (`auth.uid()`). "A team shares data"
   is unsupported at the DB layer; org isolation depends on app logic + service-role bypass. *(Security-grade.)*
2. **The base schema lives outside the migration chain.** Core tables are created only by hand-run
   `docs/migrations/schema.sql` / `FULL-SCHEMA-SETUP.sql`; the dated chain only `ALTER`s them. `supabase db reset`
   would fail — **no reproducible from-zero build.** Plus duplicate/"fixed"/"safe" migration pairs are replay landmines.
3. **At-least-once ecosystem delivery with no inbound idempotency.** A retried `meeting.export` creates a
   duplicate `meetings` row + duplicate reprocess. Two bridge implementations (`data` vs `payload` shape) can drift;
   frontend-emitted failures never set `next_retry_at`, so they're silently lost.
4. **Weak app-to-app auth.** Static plaintext bearer tokens, no HMAC/nonce/timestamp, `CORS: *` on inbound;
   `meeting.export` fetches an attacker-suppliable `audioUrl` (SSRF surface).
5. **Three "two-of-a-kind" refactors half-done:** transport (bridge vs hub), RAG (embeddingService vs vectorStore),
   agents (aiAgentService vs orchestrator). Each is a source of drift and confusion until converged.

**Also open (from the plans' own words):** Recall webhook-landing reliability, migration-drift guard,
`stopBotSession` state-awareness, thin regression coverage, and a **stale COGS/pricing model** (built on
in-house $0.71/hr; Recall is ~$0.50–5/hr — margins unrevised).

---

## 5. What Works — PROTECT (do not regress)

- The Recall→Deepgram capture pipeline through P1.3 (E2E-validated Apr 2026).
- Consent/GDPR stack (P1.7) — thoughtfully built, jurisdiction-aware.
- `agentOrchestrator` guardrails (max actions/messages/CRM-tasks, idempotency, DB-persisted logs).
- `ExplainabilityService` (tested, 393-line suite) — the one critical path with real coverage.
- Ecosystem retry/backoff/DLQ scheduler + `sweepStuckPending` crash recovery.
- Defensive bridge guards (placeholder-URL/token refusal, auth fail-closed) from the recent hardening pass.

---

## 6. The Roadmap — Section-by-Section (each = one session)

Sequenced **foundation → surface**. Tier 0 is load-bearing for everything above it.
**Tracked on GitHub:** epic **#23**; sections **S1–S11 = issues #12–#22**; milestones **H0–H4**; label `roadmap: hardening`.

### Tier 0 — Foundation (do first)
- **S1 · Data Foundation & Multi-Tenancy** — fold base schema into the migration chain (reproducible `db reset`);
  add `org_id` + org-scoped RLS to core tables; retire duplicate/"fixed" migration landmines; reconcile the two
  org models. *Conduct: `schema`, `sentinel`.* **Load-bearing; recommended first.**
- **S2 · Repo Canonicalization** — delete the dead TSX scaffold (`index.tsx`, root `src/*.tsx`), `server/`, root
  cruft (`server.js.bak`, `nul`, `test-hub.js`); fix root `package.json` so it can't boot the dead app; resolve
  `context/` vs `contexts/` + finish the theme migration. *Conduct: `atlas`, `hex`.* Cheap, clears confusion.

### Tier 1 — Capture (the existential path: "bot before dashboard")
- **S3 · Capture Reliability** — webhook-landing reliability (Render cold-spin, `BOT_CALLBACK_BASE_URL`, token
  match), deploy-time migration-drift guard (loud fail), `stopBotSession` state-aware endpoints, regression suite
  for orchestrator→Recall→webhook. *Conduct: `specter`, `radar`.*
- **S4 · Consent Verify & Close** — P1.7 is shipped in code; drive it live end-to-end, confirm two-party/GDPR flows,
  close any residual gaps. *Conduct: `voyager`, `clause`.*

### Tier 2 — Connective Tissue
- **S5 · Ecosystem Bridge Hardening** — inbound idempotency (unique `event_id` guard), unify the two bridge impls
  (`data`/`payload`), fix frontend retry path, add HMAC/signing + SSRF guard on `meeting.export`, plan legacy-hub
  cutover, build `ecosystem_alerts` admin UI. *Conduct: `gateway`, `sentinel`, `weave`.*

### Tier 3 — Intelligence Completion
- **S6 · MIP Value Path** — wire profile-enriched recaps on outbound (kill generic fallback), verify context
  assembler post-pivot, build MIP Phase 4 (suggested→accepted→completed learning loop + custom-profile editor). *Conduct: `weave`, `radar`.*
- **S7 · RAG/Search Consolidation** — unify `embeddingService` + `vectorStore` onto one index + one dimension. *Conduct: `atlas`, `schema`.*
- **S8 · Agent System Consolidation** — converge the 3 agent subsystems onto `agentOrchestrator` as canonical. *Conduct: `atlas`, `ripple`.*

### Tier 4 — Surface & Ops
- **S9 · Frontend Type Safety & Polish** — decide TS-adoption for shipped UI; per-page hardening (route to
  `/section-launch-readiness` per area). *Conduct: `artisan`, `impeccable`.*
- **S10 · Observability & Cost-Ops** — wire monitoring TODOs, cost dashboard (bot/Deepgram/LLM minutes per workspace),
  ecosystem-alerts consumption. *Conduct: `beacon`.*
- **S11 · Pricing/COGS Re-model** — recompute tiers against real Recall pricing (strategy, not code). *Conduct: `ledger`, `compete`.*

**Recommended entry point:** **S1 (Data Foundation & Multi-Tenancy)** — it's load-bearing and the org-isolation
gap is the highest-severity risk for a multi-tenant SaaS heading to market.

---

## 7. Session Log

| Date | Section | Outcome |
|---|---|---|
| 2026-07-04 | Phase 0–4 orientation | Compiled this spec from 5 parallel layer-maps (backend, frontend, ecosystem, data, vision). No code changed. |

**▶ NEXT SESSION: S1 · Data Foundation & Multi-Tenancy** (Frank's pick, 2026-07-04).
Opens with the load-bearing decision: **tenancy model** — is Entomate data *team-shared per org* (any org member
sees the org's meetings/tasks) or *user-owned with org as billing boundary*? That answer determines whether S1
adds `org_id` + org-scoped RLS everywhere (team model) or keeps `auth.uid()` isolation and only scopes billing/quota
(user model). Then: (1) capture the true live schema (introspect the remote DB, since base tables were hand-applied);
(2) author a baseline migration that folds the base schema into the chain so `db reset` reproduces prod; (3) add
`org_id` + backfill + org-scoped RLS to core tables per the chosen model; (4) retire duplicate/"fixed" migration
landmines. Conduct: `schema`, `sentinel`. Verify: `supabase db reset` on a branch + RLS probe per table.

<!-- Append one row per future session. -->
