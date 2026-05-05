# Ecosystem hardening + observability audit

Two-part investigation, no code changes expected unless explicitly approved.
Deliver a written report with prioritized recommendations.

## Part A — hardening audit

Goal: catalog every place the cross-app ecosystem could fail silently or
under attack, ranked by blast radius. Output is a punch list, not patches.

### Background you'll need

The ecosystem bridge connects three apps via direct HTTP:
- **Entomate** (`f:\entomate`) — Node/Express backend, Postgres on Supabase
  project `epftmicjaxrthmpyoguy`
- **Pulse** (`f:\pulse1`) — React + Supabase edge functions; Supabase
  project `ucaeuszgoihoyrvhewxk` (org Quantum Ecosystems)
- **Logos Vision** (`f:\logos-vision-crm`) — third app, **out of scope to
  modify** in this audit (it's primary on the user's other workstation)

Bridge implementation:
- Entomate side: `f:\entomate\backend\services\ecosystemBridge.js` —
  `sendEvent`, `isConnected`, `getStatus`, `getEventStats`
- Pulse side: `f:\pulse1\supabase\functions\ecosystem-inbound\index.ts` —
  `routeEvent` switch, plus per-event-type handlers
- Config table: `ecosystem_config` (in BOTH project DBs) — `app_name`,
  `enabled`, `api_url`, `service_token`, `inbound_token`,
  `features.gateway_key`, `features.*`
- Audit table: `ecosystem_events` (in both DBs) — `direction`, `source`,
  `target_app`, `event_type`, `status`, `error_message`, `payload`

Recent context the user may bring up:
- Tonight's session got all three Entomate→Pulse event types
  (`agent.action_completed`, `automation.triggered`,
  `meeting.action_items_extracted`) end-to-end working. See commits
  `5ca6155`, `496582e`, `991d013` on Entomate `main` and `239921b` on
  Pulse `feat/meetings-coral-cockpit`.

### What to investigate

Each item below is a hypothesis worth confirming. Don't fix — just
catalog. Mark each as "confirmed", "false alarm", or "needs deeper look".

1. **Auth surface for service-to-service routes.** Tonight `apiKeyAuth`
   was discovered to silently `next()` when `INTERNAL_API_KEY` is unset
   ([backend/middleware/auth.js:241-247](F:/entomate/backend/middleware/auth.js#L241)).
   Find every route that uses `apiKeyAuth` and verify:
   - Is the env var enforced at backend startup (validateEnv)?
   - Are there other "soft auth" patterns elsewhere with the same
     fail-open behavior?
   - Does Pulse's `ecosystem-inbound` enforce both `X-Ecosystem-Token`
     and the gateway anon key, or only one?

2. **Stuck `pending` outbound events.** The bridge writes `status='pending'`
   *before* the HTTP call (`ecosystemBridge.js:127-140`), updates after.
   A backend crash mid-call leaves the row pending forever. Commit
   `153796a` added a dead-letter retry tick — read
   `f:\entomate\backend\services\ecosystemScheduler.js` and confirm
   whether it covers `pending` (not just `failed`) rows. Query the live
   DB for any rows stuck in `pending` for > 10 min.

3. **Inbound failure alerting.** When Pulse's `ecosystem-inbound`
   processes an event and fails (e.g., schema mismatch, missing
   workspace), it writes `status='failed'` to Pulse's `ecosystem_events`
   with the error. Nothing surfaces this to operators. Look for any
   notification/alert/log pipe that fires on inbound failures, in either
   app. If none exists, recommend the lightest-touch fix.

4. **Schema drift between local migrations and prod.** Tonight's bot
   message migration `20260326000003_bot_message_support.sql` shipped
   a comment saying "encrypted_content and nonce are NULL — bot messages
   are plaintext" but the migration never relaxed the NOT NULL — bug
   was undetected for ~5 weeks. Diff Pulse's `f:\pulse1\supabase\migrations`
   directory against `mcp__claude_ai_Supabase__list_migrations` for
   project `ucaeuszgoihoyrvhewxk`. Flag any migration files in the repo
   that aren't applied to prod, or any prod migrations not in the repo.

5. **Orphan `message_channels` rows.** Tonight's investigation found
   8 of 9 rows reference workspaces that don't exist in either
   `workspaces` or `ephemeral_workspaces` (e.g.,
   `feedaa8d-1f48-4ad1-b757-11c7b79b7510`,
   `550e8400-e29b-41d4-a716-446655440000`). Confirm whether these are
   from seed data or real divergence. Recommend whether to add a
   workspace FK or leave it.

6. **Service-token rotation story.** Both Pulse's `ecosystem_config.service_token`
   and Entomate's matching `inbound_token` (or vice versa) must be
   rotated together — there's no orchestration today. Document the
   current procedure and propose what a safer rotation flow would look
   like (out of scope to implement).

7. **Event idempotency.** If Pulse's inbound handler throws *after* a
   side effect (e.g., bot message posted) but before returning success,
   Entomate retries — duplicate side effects? Read `routeEvent` carefully
   and pick a handler that has external side effects to walk through.

8. **Architectural duplication.** Tonight we found
   `routes/automations.js POST /trigger` has its own inline execution
   loop bypassing `automationEngine.execute()`, which is why the emit
   hook never fired. Same anti-pattern likely elsewhere. Grep for routes
   that re-implement service logic instead of delegating; flag the
   biggest offender.

### Deliverable

A single markdown file: `f:\entomate\.claude\reports\ecosystem-hardening-<yyyy-mm-dd>.md`

Sections:
- One-line summary
- Findings table (item / status / blast radius / suggested next step)
- 3 highest-priority recommendations with rationale
- Anything you found that wasn't on this list but should be

## Part B — observability surface for cross-app data flow

Goal: design what UI indicators should exist in Pulse and Entomate so
operators can see at a glance whether ecosystem traffic is healthy.
Current state: zero UI indicators in either app.

### What exists today

- `GET /api/ecosystem/status` (Entomate, unauthenticated) returns
  `{ initialized, pulse: bool, logosVision: bool, connectedApps: [...], stats: {...} }`
- Both Pulse and Entomate have `ecosystem_events` tables with full
  audit trail (timestamp, direction, source/target, event_type, status,
  error_message, payload)
- `getEventStats()` on the bridge gives counts by status/direction over
  a configurable window

### What to design (don't implement, just propose)

1. **Connection-status pill** in each app's settings or admin panel.
   Shows "Connected to: Entomate ✓ Logos Vision ✓" with last-heartbeat
   timestamp. Pulse and Entomate both need one.

2. **Recent-activity feed** for ecosystem events — last 50 inbound and
   outbound, with status, event type, timestamp, peer app. Failures
   highlighted.

3. **Per-event-type health indicator.** "Last successful
   `meeting.action_items_extracted` from Entomate: 12 min ago" or
   "No `donation.received` from Logos Vision in 7 days — expected?"

4. **For Logos Vision specifically:** the user wants visibility on
   what's flowing both directions with LV. Pulse already handles
   `donation.received` (case in ecosystem-inbound). Audit:
   - What LV→Pulse events does Pulse handle? (case statements in
     `routeEvent`)
   - What LV→Entomate events does Entomate handle? (Entomate's inbound
     surface, find equivalent of `routeEvent`)
   - What does Pulse send to LV? Entomate to LV? Grep for
     `sendEvent('logos_vision'` and similar
   - What's wired both ways vs. one-way only?
   - Make a 3x3 matrix: rows = source app, cols = target app, cells =
     event types

### Deliverable

Add a section to the same markdown report:
- Mockup or text wireframe of each UI element
- For Pulse: where in the UI it should live (route, component proximity,
  what existing settings panel)
- For Entomate: same
- The 3x3 LV connectivity matrix
- A "phase 1" cut: smallest meaningful version of each indicator that
  could ship in <1 day of work

## Out of scope

- Modifying any LV code (`f:\logos-vision-crm` — primary on other workstation)
- Implementing any of the recommended changes — this audit is read-only
  except for writing the report
- Touching the Pulse `feat/meetings-coral-cockpit` branch's unrelated
  cockpit/briefing work
- Rotating any secrets — propose, don't execute

## Available tools you'll likely use

- `mcp__claude_ai_Supabase__execute_sql` against project IDs
  `ucaeuszgoihoyrvhewxk` (Pulse) and `epftmicjaxrthmpyoguy` (Entomate)
- `mcp__claude_ai_Supabase__list_migrations` for the schema-drift check
- Standard Read/Grep/Glob across both repos
- Don't call `apply_migration` or `execute_sql` for anything destructive
  without explicit user approval

## Estimated time

Part A: 30-45 min of investigation across both repos + DBs
Part B: 20-30 min — code reading + design thinking
Total report: 800-1500 words, plus the LV matrix
