# Ecosystem hardening + observability audit — 2026-05-04

**One-line summary:** The cross-app bridge works end-to-end on the happy path,
but it has three classes of silent failure (auth fail-open, stuck `pending`
events, zero alerting on inbound errors), one stale config row that's been
spamming retries for ~37 days, and zero operator-facing UI in either app.

---

## Part A — Hardening audit

### Findings table

| # | Item | Status | Blast radius | Suggested next step |
|---|---|---|---|---|
| 1a | `apiKeyAuth` fails open when `INTERNAL_API_KEY` is unset ([backend/middleware/auth.js:241-247](F:/entomate/backend/middleware/auth.js#L241)) | **Confirmed** | Medium — a missing env in prod silently disables auth on `POST /api/automations/trigger`, the only consumer. Anyone reachable can fire automations. | Add `INTERNAL_API_KEY` to `REQUIRED_IN_PRODUCTION` in [validateEnv.js:3-7](F:/entomate/backend/config/validateEnv.js#L3); make `apiKeyAuth` return 503 when unset rather than `next()`. |
| 1b | `validateEnv` does not enforce any ecosystem secret (`SUPABASE_SERVICE_KEY` only required in prod, no `INTERNAL_API_KEY`, `ECOSYSTEM_*`) | **Confirmed** | Medium — backend boots happily without the keys that gate cross-app calls; first symptom is a 401 storm. | Extend `REQUIRED_IN_PRODUCTION`; print a `[ENV]` line for each missing ecosystem var so it shows up in startup logs. |
| 1c | Pulse `ecosystem-inbound` enforces only `X-Ecosystem-Token` ([index.ts:49-55](F:/pulse1/supabase/functions/ecosystem-inbound/index.ts#L49)). Gateway anon-key check is left to Supabase's API gateway implicitly. | **Needs deeper look** | Low-medium — gateway is enforced because the edge function has `verify_jwt: true`, but if that ever flips to `false`, the second factor disappears. | Add an explicit anon-key check inside the function (compare `Authorization` against an env-side allowlist) so the function is safe regardless of gateway config. |
| 2 | Stuck outbound `pending` events. Bridge writes `pending` *before* the HTTP call ([ecosystemBridge.js:127-140](F:/entomate/backend/services/ecosystemBridge.js#L127)) and only updates after. The retry tick at [ecosystemScheduler.js:62-64](F:/entomate/backend/services/ecosystemScheduler.js#L62) filters `status='failed'` only — pending rows never recover. | **Confirmed.** Entomate DB has 19 outbound rows stuck `pending` since 2026-03-29 (all `health.ping` to `logos_vision`/`pulse`). | Low operationally (these are heartbeats) but the bug is real and would corrupt the pending count for any UI. | Sweep `pending && created_at < NOW() - 5 min` into the retry tick (or mark them `failed` so they get a `next_retry_at`). Also consider writing the row in a `try/finally` and short-circuit the insert when no event log id was created. |
| 3 | Inbound failure alerting is **zero** in both apps. Pulse writes `status='failed'` + `error_message` to `ecosystem_events` but no notification, log forwarder, or Sentry capture fires. | **Confirmed.** Pulse DB has 4 inbound failures (today: 2 × `workspaceId required`, 1 × `chat_messages_workspace_id_fkey` violation, 1 × `encrypted_content NOT NULL` from the bot-message bug fixed in `239921b`). All silently logged. | High — the auth pipeline works, the table fills up with errors, nobody sees them until something obvious breaks downstream. | **Cheapest fix:** add a Postgres trigger on `ecosystem_events` that calls `pg_notify` (or inserts into `pulse_notifications` for the workspace owner) when a row hits `status='failed'`. **Slightly heavier:** ship every failed row to Sentry via the existing edge-function `console.error` pipe (logs already go to Logflare). |
| 4 | Schema drift between local migrations and Pulse prod. | **Confirmed (mild).** Prod has every timestamped migration the repo has. Drift comes from the *other* direction — the repo carries non-timestamped SQL that prod has never seen: `verify_tables.sql`, `simple_cleanup_cron.sql`, `add_email_tracking_to_alerts.sql`, `create_user_settings_secure.sql`, `create_user_sessions_table.sql`, plus the entire `_archive/` and `_old_migrations/` trees. The supabase CLI ignores these because they don't match the timestamp regex, but a human running them by hand would re-apply behaviour that's already in prod. | Low if nobody runs them, high if anyone runs them by hand. | Move the five loose SQL files into `_archive/` (or delete) and add a CI check: `find supabase/migrations -maxdepth 1 -type f -not -regex '.*/[0-9]\{14\}_.*\.sql' \| grep -v '^supabase/migrations/_'` should produce zero output. |
| 5 | Orphan `message_channels` rows. | **Confirmed.** 8 of 11 rows reference dead workspaces — 4 under `feedaa8d-…` (entomate-* bot channels created 2026-03-30 against a workspace ID that never existed; classic test/staging accident) and 4 under `550e8400-…` (the canonical zero-UUID seed: `general`, `random`, `Engineering Team`, `marketing`, created 2025-12-20 by an old dev seed script). The 3 valid rows all hang off `c54f5267-…`. | Low. They're invisible to the app today because `message_channels.workspace_id` has no FK to `workspaces`. | Two-step: (a) delete the 4 seed rows + 4 orphan bot channels in a migration; (b) add `workspace_id REFERENCES workspaces(id) ON DELETE CASCADE`. The bot-channel resolver ([index.ts:953-1015](F:/pulse1/supabase/functions/ecosystem-inbound/index.ts#L953)) needs to handle the FK error path or pre-validate the workspace. |
| 6 | Service-token rotation has no orchestration. Pulse's `ecosystem_config.service_token` (the secret Pulse uses to talk to Entomate) and Entomate's `ecosystem_config.inbound_token` (the secret Entomate accepts from Pulse) must be the same string and must rotate together. Today this is a four-step manual SQL update. | **Confirmed (no story exists).** | High if a token leaks — there is no break-glass; you'd be doing simultaneous SQL updates while live traffic flows. | See "Token rotation flow" below. Out of scope to implement. |
| 7 | Event idempotency is **partial**. `routeEvent` switches on `eventType` and dispatches handlers that vary widely on idempotency. | **Confirmed (split).** `handleContactEvent` uses upsert (idempotent ✓). `handleMeetingProcessed`, `handleActionItemsExtracted`, `handleBotPost`, `handleDonationReceived` all call `insertBotMessage` with no event_id dedupe — a retry produces a duplicate bot message + duplicate notifications. Bridge's `next_retry_at` is 5 min, retries up to 5×, so under transient handler failures you can post 5 copies of the same recap. | Medium — visible to end users as duplicate cards in `entomate-meetings`. | Add a unique partial index on `chat_messages (workspace_id, bot_app, ((bot_metadata->>'meetingId')))` for `is_bot_message=true` rows, OR have `ecosystem-inbound` short-circuit when `ecosystem_events.event_id` is already `status='processed'` (lookup + skip before calling the handler). The latter is cheaper and works for every event type. |
| 8 | Architectural duplication: routes that re-implement service logic. | **Confirmed.** [routes/automations.js:554-651](F:/entomate/backend/routes/automations.js#L554) is the worst offender — it does its own automation-loop instead of calling `automationEngine.execute()`, and the comment at line 617-618 admits it ("this route bypasses automationEngine.execute(), so we duplicate the hook that lives there"). [routes/agents.js:21-42](F:/entomate/backend/routes/agents.js#L21) also reimplements its Pulse-emit hook locally instead of going through `automationEngine.notifyPulseAutomationTriggered` or a shared helper. | Medium — every cross-app emit added to `automationEngine` has to be remembered and copy-pasted into `routes/automations.js` or it silently drops. | Refactor `POST /api/automations/trigger` to delegate to `automationEngine.execute()`. Move Pulse-emit helpers (`notifyPulseAgentCompleted`, etc.) into a single `services/ecosystemEmitters.js` so the call sites are one-liners. |

### Bonus findings (not on the original list)

- **`ecosystem_config` placeholder URL is live.** Entomate's row for `logos_vision` still points at `https://your-logos-vision-project.supabase.co/functions/v1` (last_heartbeat: 2026-03-29). Combined with `isConnected()` only checking the *token* against the `PLACEHOLDER` prefix ([ecosystemBridge.js:70-72](F:/entomate/backend/services/ecosystemBridge.js#L70)), the bridge believes LV is connected and has been firing heartbeats into DNS-lookup failures for 37 days straight. **Fix:** also sanity-check `api_url` against a placeholder list, and fail `isConnected()` if `last_heartbeat` is older than N hours.
- **`ecosystem_config` has 4 rows per app, not 1.** The query `SELECT app_name, jsonb_object_keys(features)` returns 10 rows total because `features` is a JSON object whose keys we exploded — but it does mean every config update needs to merge the `features` map carefully (not replace it). The `POST /api/ecosystem/config` route does a full replace ([routes/ecosystem.js:56-66](F:/entomate/backend/routes/ecosystem.js#L56)) — passing `features: {}` will wipe the gateway_key. Document this or switch to JSON merge.
- **Entomate has no inbound HTTP route, but it does have an inbound edge function.** `f:\entomate\backend\routes\ecosystem.js` only exposes outbound endpoints. Inbound traffic from Pulse + LV terminates at the Supabase edge function `epftmicjaxrthmpyoguy.../ecosystem-inbound` (verified via `list_edge_functions`, version 7, ACTIVE). The function source is in the Supabase project, not the Entomate repo — so the Entomate repo doesn't carry its own routing/handler logic. That's a **documentation gap**: anyone reading just the Entomate backend would think Pulse→Entomate is impossible.
- **`sendServiceEvent` in Pulse omits the `apikey` header.** Compare [ecosystem-inbound/index.ts:719-727](F:/pulse1/supabase/functions/ecosystem-inbound/index.ts#L719) (only sets `Authorization`) with [ecosystemBridge.js:154-163](F:/entomate/backend/services/ecosystemBridge.js#L154) (sets both `Authorization` AND `apikey`). Probable cause of the 265 `HTTP 401` heartbeats from Pulse → Entomate in the outbound log.

### Top 3 priority recommendations

**1. Wire alerting on inbound failures (Item 3).** This is the highest-leverage fix because every other item in the list got *quietly* worse for 5 weeks specifically because nobody could see failures. A Postgres `AFTER INSERT … WHEN NEW.status='failed'` trigger that writes into `pulse_notifications` (or pings a Slack webhook via `pg_net`) takes ~30 lines of SQL and would have surfaced both the `encrypted_content NOT NULL` bug (5 weeks lost) and the 19 stuck-pending rows (37 days lost) within minutes of them happening. Build this before fixing anything else, so subsequent fixes have a feedback loop.

**2. Close the auth fail-open + add a "ecosystem health" check at startup (Items 1a, 1b, bonus #1).** A single startup function that (a) refuses to boot in prod when `INTERNAL_API_KEY`/ecosystem secrets are missing and (b) marks each `ecosystem_config` row `enabled=false` if its `api_url` matches a known placeholder pattern would have prevented the 37-day heartbeat-into-the-void. Keep it idempotent so it's safe to run on every deploy.

**3. Idempotency at the inbound layer (Item 7).** The cheapest, most general fix: before calling `routeEvent`, query `ecosystem_events` for a row with the same `event_id` and `direction='inbound'` and `status='processed'`. If found, return 200 immediately. This single check makes every existing handler idempotent without per-handler refactors, and it scales to future event types for free. Pair with the existing `event_id` UUID generation already in the bridge.

### Token rotation flow (Item 6 — proposal only)

Current procedure (manual, error-prone):
1. Generate new UUID.
2. SQL update on Pulse `ecosystem_config.service_token` for `app_name='entomate'`.
3. SQL update on Entomate `ecosystem_config.inbound_token` for `app_name='pulse'`.
4. Call `POST /api/ecosystem/config` to trigger `bridge.reload()`.
5. Repeat 1-4 for the LV pair.

Safer flow:
- Each config row gets `service_token_pending` (nullable) alongside `service_token`.
- Inbound function accepts EITHER `service_token` or `service_token_pending` during a 60-min grace window.
- Rotation script: write new token to `_pending` on both sides, wait for first successful heartbeat with the new token, promote `_pending → active`, clear `_pending`.
- Call `bridge.reload()` once at promotion time.
- All four DB writes go through a single `rotate_token(app_name)` RPC so the cutover is atomic and auditable in `audit_log`.

---

## Part B — Observability surface

### What exists today (confirmed)

- `GET /api/ecosystem/status` returns `{ initialized, pulse, logosVision, connectedApps[], stats }` — **unauthenticated**.
- `GET /api/ecosystem/events` returns recent events with optional `direction`/`status` filters — **also unauthenticated**.
- No UI consumes either endpoint in either app.

### Phase 1 (≤1 day per app)

#### 1. Connection-status pill

**Pulse:** lives in `Settings → Integrations` (existing route). Sub-section "Ecosystem Bridge" with one row per `ecosystem_config` entry:

```
┌─────────────────────────────────────────────────────────────┐
│ Ecosystem Bridge                                            │
├─────────────────────────────────────────────────────────────┤
│ ● Entomate          last heartbeat: 2 min ago    [Test] [⋯] │
│ ● Logos Vision      last heartbeat: 14 min ago   [Test] [⋯] │
│ ○ Connecting…                                               │
└─────────────────────────────────────────────────────────────┘
```
Green dot if `last_heartbeat < 15 min`, amber if `15-60 min`, red if `>60 min` or `enabled=false`. Fetches via a new authenticated edge function `ecosystem-status` (Pulse currently has no admin API surface for this). Uses the existing `--pulse-*` design tokens.

**Entomate:** lives in `Settings → Integrations → Pulse / Logos Vision` (the page that already exists for token entry). Same pill above the form. Calls existing `GET /api/ecosystem/status`.

#### 2. Recent-activity feed

Single table, last 50 rows from `ecosystem_events` (both apps' UI hits its own DB):

```
┌───────────────────────────────────────────────────────────────────────┐
│ Recent ecosystem traffic                          [↑ Outbound] [↓ In] │
├───────────────────────────────────────────────────────────────────────┤
│ ↓ contact.created      from Logos Vision   ✓ processed   2 min ago    │
│ ↑ meeting.processed    to Pulse            ✓ delivered   8 min ago    │
│ ↑ action_item.created  to Logos Vision     ✗ failed      12 min ago   │
│   └─ HTTP 500: workspaceId required                       [Retry]     │
│ ↓ donation.received    from Logos Vision   ✓ processed   1 hr ago     │
└───────────────────────────────────────────────────────────────────────┘
```

Failures expand inline to show `error_message`. Outbound failed rows get a "Retry" button hitting the existing `/api/ecosystem/retry/:eventId` (Entomate) — Pulse needs the same edge function. Filter chips: All / Inbound / Outbound / Failures only.

**Pulse:** lives at `/admin/ecosystem` (route doesn't exist yet — co-locate with whatever admin route the workspace-deletion UI uses, e.g. near `Workspace Settings`). Component proximity: next to the connection-status pill.

**Entomate:** lives at `/settings/integrations` directly under the connection-status pill. Component proximity: same page, same column.

#### 3. Per-event-type health indicator

A grid below the activity feed:

```
┌───────────────────────────────────────────────────────────────────┐
│ Event-type health (last 24h)                                      │
├───────────────────────────────────────────────────────────────────┤
│ meeting.processed                Last ✓ 12 min ago    24/24       │
│ action_item.created              Last ✓ 12 min ago    23/24  ⚠   │
│ contact.created                  Last ✓  2 min ago   442/442      │
│ donation.received                No traffic in 7 days  —          │
│ heartbeat → entomate             Last ✗ 2 min ago    0/265   ✗   │
└───────────────────────────────────────────────────────────────────┘
```

Computed in SQL with a single window query against `ecosystem_events`. The "no traffic in 7 days" line is the most useful signal for one-way integrations (today, donation.received only flows LV→Pulse — silence might be fine, or might mean LV's outbound emit broke).

**Phase-1 cut:** ship just the connection-status pill + last-50 feed. The per-event-type health grid can wait — the data already exists in the feed. ~6h of work in Pulse (new `ecosystem-status` edge function + a Settings card) and ~3h in Entomate (already has both endpoints, just needs the React card).

### Logos Vision connectivity matrix (3×3)

What flows in each direction today, based on `routeEvent` switch statements + `sendEvent('app',…)` grep + actual traffic in both DBs.

|             | **→ Pulse**                                                                                                              | **→ Entomate**                                              | **→ Logos Vision**                                                                                                                |
|---|---|---|---|
| **From Pulse**       | n/a                                                                                                                       | `heartbeat` (failing 401, 265× — `apikey` header missing)    | *(none — no `sendEvent('logos_vision',…)` in Pulse code)*                                                                          |
| **From Entomate**    | `agent.action_completed`, `automation.triggered`, `meeting.action_items_extracted`, `meeting.processed`, `meeting.briefing`, `message.bot_post`, `notification.send`, `meeting.recordings_list`, `meeting.export_request`, `task.created/updated/completed`, `heartbeat` ✓ working | n/a                                                          | `meeting.processed`, `action_item.created`, `task.completed`, `meeting.briefing`, `contact.discovered`, `heartbeat` (DNS failing, placeholder URL) |
| **From Logos Vision**| `contact.created` (442×), `contact.updated` (34×), `donation.received`, `heartbeat`, `meeting.started` (6×) ✓ working      | *(no LV→Entomate traffic in `ecosystem_events`)*             | n/a                                                                                                                               |

**LV-specific observations:**
- LV→Pulse is the busiest leg by volume (442 contacts) and is healthy.
- Entomate→LV has been broken for 37 days because of the placeholder URL — every `meeting.processed` and `action_item.created` Entomate has tried to push to LV since 2026-03-29 either failed (DNS) or stuck at `pending` (the bug from Item 2).
- LV→Entomate is **wired in name only** — Entomate's edge function accepts incoming events, but LV's own bridge doesn't appear to send anything to Entomate (no `meeting.started`, no `contact.*` events showing up). Worth confirming on the LV side at the next sync.
- The `meeting.started` from LV (6×) lands in Pulse but Pulse has no handler for it (default branch in `routeEvent` just logs). Either add a handler or remove from LV.

### Out of scope this audit (deferred)

- Modifying any LV code (`f:\logos-vision-crm`) — primary on the other workstation.
- Implementing any of the recommended changes — this audit is read-only except for writing this report.
- Touching the Pulse `feat/meetings-coral-cockpit` branch's unrelated cockpit/briefing work.
- Rotating any secrets — proposed flow only.
