# Entomate AI — APP-PRODUCT (build scope)

> **Status:** SCOPE ONLY — compiled 2026-11-22. Nothing is built yet.
> **Goal:** Port the full Logos AI agent (logic + every visual layer) from Logos Vision into Entomate as **Entomate AI**, then let the two agents talk to each other.
> **Category:** Feature (with a Service + Integration tail).
> **Parent roadmap:** [entomate-APP-PRODUCT.md](entomate-APP-PRODUCT.md) (~61/100). This file owns the AI agent only.
> **Source of the port:** `C:\Dev\logos-vision-crm` — `src/components/LogosAssistant/`, `supabase/functions/gemini-proxy/`, `supabase/functions/_shared/{toolDefinitions,toolExecutor,writeTools}.ts`. Counts below were measured from **code**, not from the LV spec docs (those have drifted — see §7).

---

## 1. What exists today

### Entomate (the destination)

| Piece | Where | Size | State |
|---|---|---|---|
| Chat panel "Entomate AI" | `frontend/src/components/EntoAssistant/` | 6 files, ~1,170 lines | Right-side drawer (420px), section-aware context, `mod+/`, localStorage history (50 msgs), proactive badge |
| Client service | `frontend/src/services/entoAssistantService.js` | 347 | SSE client, falls back to `searchApi.askStream` |
| Route | `backend/routes/assistant.js` | 423 | `POST /api/assistant/query` (SSE), 10 section loaders |
| Provider facade | `backend/config/ai.js` → `gemini.js` / `openai.js` | ~800 | `gemini-2.5-flash` / `gpt-4o-mini`; **no tool calling**; streaming is **simulated** (full answer, then 20 ms per word) |
| Agents | `backend/services/agents/*`, `agentOrchestrator.js`, `aiAgentService.js` | ~3,400 | Three overlapping systems (parent roadmap S8). Four agents call `ai.chat()`, which `config/ai.js` does not define |
| Ecosystem bridge | `backend/services/ecosystemBridge.js`, `supabase/functions/ecosystem-inbound/` | 543 + 913 | Shared-secret token POSTs. No HMAC, no idempotency (parent roadmap S5) |
| Tables that help | baseline `00000000000000_baseline.sql` | — | `get_my_org_ids()` (L162), `action_items` (L652), `conversations` (L1124, **no `org_id`**), `ecosystem_entity_map` (L1255), `org_ai_usage_monthly` (L1621) |

### Logos Vision (the source)

| Layer | Size | Ports how |
|---|---|---|
| UI — `LogosAssistant/` | 28 files, ~10,700 lines (`LogosAssistant.css` alone 3,703) | Visuals port as-is; data wiring adapts |
| Client logic | `useAssistantChat` 846, `useAssistantContext` 404, `useProposals` 352, `logosThreadService` 210 | Adapt (transport + context) |
| Domain services | `logosAssistantService.ts` 3,615, `agentActionService.ts` 4,475 | **Rewrite for Entomate's domain** — the spine is generic, the verbs are CRM |
| Server loop | `gemini-proxy/index.ts` 916 | Re-host in Express (see D1) |
| Tool roster | 13 read tools, 40 write declarations (26 `write`, 13 `sensitive`, 1 `safe`) | Replace with an Entomate roster (§4) |
| DB | `agent_action_log` (+ plans, undone status), `logos_ai_threads`, `ai_usage_logs` | New Entomate migrations, same shape |
| Not in LV | attachments, embeddings for Logos AI, any agent-to-agent protocol | — |

---

## 2. Security floor — must close BEFORE any port work

**CLOSED 2026-11-22 (EAI-01).** The finding below was written against a local checkout 125 commits behind `origin/main`.

**Pre-flight re-derivation (EAI-01 sweep):**

| Inherited claim | Verdict on `origin/main` `01d5342` |
|---|---|
| `/query` uses `optionalAuth`, anon accepted | **Already closed upstream** — `authenticate` (`0fb489d`, `b8a62a0`) |
| Loaders read via the service client with no org filter | **Mechanism swapped** — still the service client, but every loader had `.in('org_id', orgIds)` (`cf300d3`, `db604cb`) |
| No `aiLimiter` | **Confirmed** — only the global `apiLimiter` (100/min) |
| Loaders do not use a user-JWT client (D2) | **Confirmed** |
| Goals loader exists | **Gone** — Goals removed in `5264fec`; workflows/automations merged in `8161670` |
| `conversations` rows written with no user | **Already closed upstream** — `user_id` written + owned-conversation check (`db604cb`) |

**What EAI-01 shipped:** `aiLimiter` on `/query`; `createUserClient(token)` in `config/supabase.js`; tasks, meetings, workflows and the conversation writes go through the caller's JWT client, so RLS (`org_id IN get_my_org_ids()`, `user_id = auth.uid()`) is the perimeter and the `org_id` filter is a second fence.

**Not moved (EAI-01b):** live RLS on `projects` (owner or `team_ids`) and `agents` (`created_by`) is narrower than the org filter the app uses. Moving them to the user client would hide org rows the caller did not create. They stay on the service client with the org filter until their RLS is org-scoped. `calendar_events` does not exist in the live DB.

**Evidence:** jest `assistant-route.test.js` 11/11 green; on `01d5342` the 9 D2 cases fail and the 2 401 cases pass (upstream already had `authenticate`); live anon/forged → 401 on the real router; self-aborting probe as an org-A owner read 0 org-B rows in tasks, meetings, workflows (control: 14 org-A tasks, 8 meetings).

---

## 3. Decisions (taken as recommended — reversible)

| # | Decision | Why |
|---|---|---|
| D1 | **The agent loop lives in Express** (`backend/routes/entoAi.js`), not in a new Supabase edge function. | Entomate's AI already runs in the backend with its keys and provider config. One AI perimeter, not two. |
| D2 | **Every tool runs through a per-request, user-JWT Supabase client** (anon key + the caller's `Authorization` header). Never the service-role client. | RLS (`org_id IN get_my_org_ids()`) becomes the perimeter by construction, so the §2 bug class cannot come back. LV gets the same guarantee by running executors client-side under user RLS. |
| D3 | **Gemini function calling via the installed `@google/generative-ai`.** OpenAI stays as the plain-chat fallback only. | The LV loop, tool schemas and prompts are Gemini-shaped. Porting them to a second tool format doubles the work. Upgrading to `@google/genai` is out of scope. |
| D4 | **Port TSX → JSX mechanically** (`esbuild --loader=tsx --jsx=preserve` strips types), then hand-fix imports. | Entomate's frontend is plain JS. One language per app. Type stripping is cheap and does not change behaviour. |
| D5 | **Visual port keeps LV's tokens and maps them** through one bridge file (`EntoAI.tokens.css`): `--la-*` and `--cmf-*` → Held Light / Void Crimson tokens. | The 3,703-line CSS ports unchanged. Theme fixes go in one place. |
| D6 | **Writes are proposed, confirmed in the UI, then executed by the backend** under the user client (D2). Sensitive verbs need a typed confirm, as in LV. Write tools ship behind `ENTO_AI_WRITE_TOOLS=false`. | Same propose → confirm → execute → undo spine as LV. The flag lets the read agent ship first. |
| D7 | **Cross-app rule: an agent can only PROPOSE in the other app. The owning app's user confirms in the owning app.** | No agent gets write authority over another product's data. This is the safety line for §5. |

---

## 4. Entomate tool roster (first cut — refine in Phase 3/4)

**Read (≈10):** `search_meetings`, `get_meeting` (summary, attendees, transcript, sentiment), `list_action_items`, `list_tasks`, `get_task`, `list_projects`, `get_project`, `list_goals`, `get_calendar` (range), `search_everything` (wraps the existing search service).

**Write (≈10, flag-gated):** `create_task`, `update_task` (status, priority, due date), `assign_task`, `create_action_item`, `complete_action_item`, `create_project`, `update_goal_progress`, `schedule_meeting` (*sensitive*), `draft_followup_email` (draft only — no send), `log_meeting_note`. A `propose_plan` wrapper chains them, as in LV.

Out of the first cut: any verb that sends to real people (email/SMS send). Add later as *terminal* (non-undoable) sensitive tools.

---

## 5. Agent-to-agent (Entomate AI ⇄ Logos AI) — design sketch, built LAST

Today both apps have only **one-way event fan-out** (`ecosystem-inbound` on both sides, shared tokens). There is no agent protocol in either repo.

**Target shape:**

1. **Peer read tool, both directions.** Entomate AI gets `ask_logos_vision(question)`; Logos AI gets `ask_entomate(question)`. Each call is an HTTPS request to the peer's agent endpoint, which runs the peer's **read-only** tool set and returns text + record links.
2. **Identity.** The call carries the mapped peer org and user from `ecosystem_entity_map`. No mapping → the tool returns "not connected", never a guess.
3. **Transport hardening first.** HMAC signing + idempotency key + timestamp window on the bridge (parent roadmap **S5**). The agent channel does not ship on bare shared tokens.
4. **Peer proposals (later).** "Create a follow-up task in Entomate from this LV case" → Logos AI calls `propose_in_entomate`, Entomate stores it as a `proposed` row in its own `ento_ai_action_log`, and the Entomate user confirms it in Entomate's ProposalCard (D7).
5. **Loop guard.** A hop counter in the request header. A peer call made while serving a peer call is refused (max depth 1).

---

## 6. Roadmap

Each phase is one or more `/app-dev sweep` sessions. Lines are rough ported + new.

| Phase | Row | Deliverable | Size | Gate |
|---|---|---|---|---|
| **P0** | EAI-01 | ✅ **DONE 2026-11-22** — `aiLimiter`; org-RLS loaders + conversation writes through the user client (D2). See §2. | S | anon → 401 ✔; org A reads 0 org B rows ✔ |
| **P0** | EAI-01b | 🟡 **BUILT, apply pending** — migration `20261122000012_projects_agents_org_select.sql` adds `projects_org_select` / `agents_org_select`; assistant `projects` + `agents` loaders move to the user client. Ship order: apply the migration FIRST, then push the route. | S | Self-aborting probe: org-A owner 0 → 5 projects, 0 → 1 agent, org B 0; org-B owner sees its 4, org A 0; 0 policies left after abort ✔ |
| **P1** | EAI-02 | **Visual shell port** — panel, launcher, `LogosOrb` → Ento orb, `DotMatrix`, `ThreadRail`, `Composer`, `ContextCard`, skeleton, `usePanelResize`, full CSS + token bridge (D5). Wired to the existing `/api/assistant/query` so behaviour is unchanged. | L (~7,000 ported) | **Needs Frank's approval — replaces EntoAssistant (§8)**. Playwright: both themes, desktop + phone |
| **P2** | EAI-03 | Real streaming (Gemini `generateContentStream`) + `ento_ai_threads` table (user + org RLS, `tenant_organizations` FK) replacing localStorage history. | M (~600) | Thread survives reload and a second device; RLS probe |
| **P3** | EAI-04 | Function-calling loop in `routes/entoAi.js` + the ≈10 read tools (§4) + tool-call chips in the panel. | L (~1,500) | Each tool answers a real question on demo data; cross-org probe returns nothing |
| **P4** | EAI-05 | Write spine: `ento_ai_action_log` migration, propose/confirm/undo, `ProposalCard`, `useProposals`, ≈10 write verbs behind the flag (D6). | L (~2,500) | Self-aborting DB probe + Playwright confirm → undo on a test org |
| **P5** | EAI-06 | `PlanCard` + `propose_plan`; proactive nudges (server signals replace the 10-minute client poll); voice (`voiceSignal`, `useMicLevel`, Web Speech). | M–L (~1,800) | Plan of 3 steps runs and undoes; nudge appears from a seeded overdue task |
| **P6** | EAI-07 | Usage + cost attribution into `org_ai_usage_monthly`; per-org AI limit. | S–M (~300) | Counter moves by the measured token count |
| **P7** | EAI-08 | Bridge hardening (parent S5: HMAC + idempotency) — prerequisite for P8. | M | Replayed / unsigned request rejected |
| **P8** | EAI-09 | Agent-to-agent read channel (§5 steps 1–3, 5) — **touches both repos**. | M–L | Ask Entomate AI a question only LV can answer; answer cites an LV record |
| **P9** | EAI-10 | Peer proposals (§5 step 4). | M | LV-originated proposal confirmed and undone inside Entomate |

**Total:** roughly 14,000 ported/new lines across ~10–14 sessions. P1 is the biggest single piece because the visuals are most of Logos AI's mass.

**Recommended order:** P0 → P1 → P3 → P2 → P4 → P5 → P6 → P7 → P8 → P9. P3 before P2 because tools are the value; real streaming is polish on top of a working loop.

---

## 7. Spec drift found in LV docs (do not trust them for counts)

| LV doc claims | Code measures |
|---|---|
| 10 read tools | 13 |
| 33 write declarations | 40 |
| `LogosAssistant.tsx` 1,322 lines | 1,542 |
| `LogosAssistant.css` 3,065 lines | 3,703 |
| `LogosAIPeekTab.tsx` | does not exist |

---

## 8. Before/After — replacing EntoAssistant (approval required for P1)

**Exists now:** right drawer at 420px with backdrop + slide-in; sidebar launcher in `Layout.jsx` (`nl-footer`); `mod+/`; section-aware context loading; section quick actions and follow-up suggestions; localStorage history; proactive badge (overdue tasks, meetings within the hour, 10-minute poll); SSE with a fallback to `searchApi.askStream`; uncommitted logo-mark swap to `EntomateMark` (a peer's in-flight work — must be preserved, not overwritten).

**After P1:** the LV panel (resizable, thread rail, context card, orb launcher, dot-matrix status, skeleton) in its place, talking to the **same** endpoint, so every answer is unchanged.

**Kept:** `mod+/`, the sidebar launcher slot, section context, quick actions, the proactive badge, the SSE fallback, `EntomateMark`.

**Lost:** the current 582-line `EntoAssistant.css` look. Nothing functional.

**Risk:** z-index and backdrop against Entomate's layout (drawer is z 1050); Held Light contrast on LV's dark-first CSS (P7 tail already fought this); bundle size (~10k lines into the main chunk — lazy-load the panel).

---

## 9. Known side findings (not this file's rows)

- `ai.chat()` is called by `assignmentAgent`, `priorityAgent`, `deadlineAgent`, `followupAgent` (6 sites) but not defined in `config/ai.js` → parent roadmap **S8**. Not runtime-verified.
- `conversations.user_id` is nullable. The assistant now writes `user_id` (upstream `db604cb`) and inserts through the user client, so RLS rejects a missing user. Retire the column's nullability with P2.
- §4 lists `list_goals`; Goals was removed upstream in `5264fec`. Drop it at P3.

## 10. Score

Not scored — nothing to score until P0 lands. First score after P1.
