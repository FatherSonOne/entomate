# Bot Ops Runbook

Operational procedures for the Entomate meeting-bot fleet. Bots are run
by [Recall.ai](https://recall.ai) — they handle bot identity, anti-bot
detection, audio capture, and platform quirks across Meet/Zoom/Teams.
Entomate stores per-meeting state in `bot_sessions` and reacts to Recall
webhook events.

> **Why Recall and not in-house?** We initially built our own headless-
> Chromium bot (Fly Machines + Puppeteer + stealth plugin) under
> P1.1/P1.2. Google CAPTCHA-blocked the datacenter IP login on first try.
> See `docs/plans/ENTOMATE_GAP_CLOSING_PLAN.md` §8 for the build-vs-buy
> tradeoff and the M-PR pricing checkpoint where we revisit this.

Source:
- Orchestrator: [`backend/services/botOrchestrator.js`](../../backend/services/botOrchestrator.js)
- Admin routes: [`backend/routes/bots.js`](../../backend/routes/bots.js)
- Schema: [`supabase/migrations/20260423000001_bot_sessions.sql`](../../supabase/migrations/20260423000001_bot_sessions.sql) + [`20260425000001_bot_sessions_recall.sql`](../../supabase/migrations/20260425000001_bot_sessions_recall.sql)

## Architecture in one paragraph

`botOrchestrator.launchBotSession()` POSTs to Recall.ai's `/bot/`
endpoint with the meeting URL and a webhook URL pointing at our
`/api/admin/bots/recall-webhook` route. Recall spins up its own bot
infrastructure, joins the meeting, captures + transcribes, and posts
status events to our webhook. We update `bot_sessions` from those
events and surface admin endpoints (launch / stop / list / state) for
operators.

## Required env / secrets (backend)

| Var | Notes |
|---|---|
| `RECALL_API_KEY` | From Recall.ai dashboard. Required. |
| `RECALL_API_BASE` | Default `https://us-west-2.recall.ai/api/v1` |
| `RECALL_WEBHOOK_SIGNING_SECRET` | Svix `whsec_…` value generated when you create the workspace webhook in the Recall dashboard. Used to verify HMAC-SHA256 signatures on inbound webhook requests. Required — the route 500s without it. |
| `RESEND_API_KEY` | From [resend.com](https://resend.com) dashboard. Powers the pre-meeting opt-out email (P1.7 Slice 2). If unset, attendee rows land with `email_status='skipped'` and the bot launch still succeeds — emails simply don't go out. |
| `RESEND_FROM` | Sender address with display name, e.g. `Meet Mate <notifications@qntmecos.com>`. Defaults to a Resend sandbox sender that won't reach real recipients in prod. |
| `OPT_OUT_BASE_URL` | Base URL for opt-out links in the email. Default `https://entomate.onrender.com`. The SPA fallback in `server.js` routes `/opt-out/:token` to the React app. |

> **`BOT_CALLBACK_BASE_URL` is no longer used.** Recall doesn't expose a
> `webhook_url` field on the bot create endpoint; webhooks are configured
> at the Recall workspace level (see "Webhook setup" below). Safe to
> remove from `render.yaml` next time you touch it.

## First-time setup

1. **Recall.ai account.** Sign up at https://recall.ai → dashboard → copy
   your API key.
2. **Deepgram credential (transcription).** Sign up at
   https://console.deepgram.com → API Keys → create a Member-scoped key.
   In the Recall.ai dashboard → Transcription Providers → add the key as
   the **default** Deepgram credential (leave Host and Project Id blank
   for the US endpoint + meeting bots). Bots launch with
   `deepgram_streaming` + `model: nova-3` + `diarize: true`; Recall reads
   the key from the dashboard at call time. No backend env var.
3. **Resend account (opt-out email).** Sign up at https://resend.com →
   Domains → add `qntmecos.com` (or the chosen sender domain). Add the
   SPF/DKIM/DMARC DNS records Resend provides — propagation can take
   up to 24h. Then API Keys → create one and set `RESEND_API_KEY` +
   `RESEND_FROM` in Render env. **Until DNS verifies, leave
   `RESEND_API_KEY` unset** — attendee rows will land with
   `email_status='skipped'` and the launch path keeps working.
4. **DB migrations.**
   ```bash
   supabase db push
   ```
   Applies all bot-related migrations:
   - `20260423000001_bot_sessions.sql` (initial)
   - `20260425000001_bot_sessions_recall.sql` (Recall pivot)
   - `20260426000001_bot_consent_columns.sql` (P1.7 Slice 1)
   - `20260427000001_bot_session_attendees.sql` (P1.7 Slice 2)
5. **Webhook setup** — see next section. This is a one-time dashboard
   configuration plus a single env var.

## Webhook setup (workspace-level, signed)

Recall doesn't accept a per-bot `webhook_url` at launch time; the bot
create endpoint silently drops it. Webhooks are set up once per Recall
workspace and fire for every bot in that workspace.

1. **In the Recall dashboard:** Webhooks → Add endpoint. Set the URL to:
   ```
   https://entomate.onrender.com/api/admin/bots/recall-webhook
   ```
   Recall fires a discrete event per status transition (no unified
   `bot.status_change` event, and no `bot.recording.done` /
   `bot.transcript.done` — verified against the dashboard catalog
   2026-04-26). Subscribe to:
   - `bot.joining_call`
   - `bot.in_waiting_room`
   - `bot.in_call_not_recording`
   - `bot.in_call_recording`
   - `bot.call_ended`
   - `bot.done`
   - `bot.fatal`

   `recording_url` and `transcript_url` are captured by an authoritative
   `GET /bot/<id>` call inside `handleRecallWebhook` when `bot.done`
   fires — no separate event needed.

   If a "subscribe to all" option exists, prefer that — the handler
   silently ignores events it doesn't act on, so a wider subscription
   costs nothing and survives Recall adding new event types.
2. Recall reveals a Svix signing secret of the form `whsec_<base64>`.
   Copy it.
3. **In Render:** set `RECALL_WEBHOOK_SIGNING_SECRET` to that exact
   `whsec_…` string. Save → triggers redeploy.
4. **No `?session=` or `?token=` query params on the URL.** Authentication
   is HMAC-SHA256 via Svix headers (`svix-id`, `svix-timestamp`,
   `svix-signature`); the session is resolved from
   `payload.data.bot.metadata.session_id` (or by `recall_bot_id` lookup as
   a fallback) inside `botOrchestrator.handleRecallWebhook`.
5. Verify by relaunching a bot and watching Render logs for inbound
   `POST /api/admin/bots/recall-webhook` 200s. The corresponding
   `bot_sessions.status` should march through `joining` → `in_call` →
   `completed` as Recall fires events.

## Boot-time guarantees

On startup the backend runs `verifyBotSchema()`
([`backend/config/verifyBotSchema.js`](../../backend/config/verifyBotSchema.js))
which projects every column the orchestrator + webhook handler write
against `bot_sessions`. In production, a missing column exits the process
with code 1 so a deploy with unapplied migrations fails loud rather than
silently swallowing the error in the orchestrator's post-launch UPDATE
(see `botOrchestrator.js`).

`validateEnv()` warns at boot if `RECALL_API_KEY` or
`RECALL_WEBHOOK_SIGNING_SECRET` are missing. The webhook route 500s
deterministically when the signing secret is unset, so a missed config is
visible the first time Recall delivers — no silent acceptance.

## Admin endpoints

All require a Supabase access token in `Authorization: Bearer …` AND that
the requester be `owner` or `admin` of the workspace (org) the bot belongs
to. Membership is read from `org_members`; `auth.users.user_metadata.role`
is ignored.

```bash
# Launch — workspaceId in body, role checked against that org.
# consentAcknowledged: true is REQUIRED (P1.7 organizer-side consent gate).
# The launching user's auth.users.id + the timestamp are recorded on the
# bot_sessions row as consent_acknowledged_by / consent_acknowledged_at for
# audit. Omitting the field returns 400 consent_required.
#
# participantEmails (optional, P1.7 Slice 2) is the list of external
# attendees who should receive a pre-meeting opt-out email. The organizer's
# own email is filtered out automatically; duplicates are collapsed; bad
# shapes dropped. Per-attendee status is in the response under `attendees`
# and persisted on bot_session_attendees.
curl -X POST https://entomate.onrender.com/api/admin/bots/launch \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId":         "<org-uuid>",
    "meetingId":           "<meeting-uuid>",
    "meetingUrl":          "https://meet.google.com/abc-defg-hij",
    "platform":            "meet",
    "consentAcknowledged": true,
    "participantEmails":   ["alice@example.com", "bob@example.com"]
  }'

# List active — workspaceId required as query param; results scoped to that org
curl "https://entomate.onrender.com/api/admin/bots?workspaceId=<org-uuid>" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Stop (force-leave the meeting) — org_id resolved from bot_sessions.id
curl -X DELETE https://entomate.onrender.com/api/admin/bots/<session-id> \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "stuck in joining state"}'

# Full Recall bot state — same authz path as DELETE
curl https://entomate.onrender.com/api/admin/bots/<session-id>/state \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### Getting an `$ACCESS_TOKEN` for testing

Sign in via the frontend, then in DevTools console:

```js
JSON.parse(localStorage.getItem(
  Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
)).access_token
```

Or via CLI against Supabase REST:

```bash
curl -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"<you>","password":"<pw>"}' | jq -r .access_token
```

## Stop semantics — state-aware

`DELETE /api/admin/bots/:sessionId` no longer assumes `/leave_call` is the
right Recall endpoint. The orchestrator first reads the bot's current Recall
state and branches:

| Recall status | Recall call we make |
|---|---|
| `ready`, `joining_call`, `in_waiting_room` | `DELETE /bot/<id>` (cancel — `/leave_call` returns 400 `cannot_command_unstarted_bot` here) |
| `in_call_not_recording`, `in_call_recording` | `POST /bot/<id>/leave_call` |
| `recording_done`, `call_ended`, `done`, `fatal`, `timeout` | none — already terminal, just mark the row |
| Recall returns 404 for the bot | none — already gone, just mark the row |
| Anything unrecognized | falls back to `/leave_call` with a warn log |

The mapping lives in `botOrchestrator.js` (`PRE_CALL_STATUSES` /
`IN_CALL_STATUSES` / `TERMINAL_STATUSES` constants).

## Manual cleanup (when admin API is unavailable)

Stop a bot directly via Recall — note the right endpoint depends on its
current status. Get state first:

```bash
curl "https://us-west-2.recall.ai/api/v1/bot/<recall_bot_id>" \
  -H "Authorization: Token $RECALL_API_KEY" | jq '.status_changes[-1]'
```

Then either cancel (pre-call):

```bash
curl -X DELETE "https://us-west-2.recall.ai/api/v1/bot/<recall_bot_id>" \
  -H "Authorization: Token $RECALL_API_KEY"
```

Or leave the call (in-call):

```bash
curl -X POST "https://us-west-2.recall.ai/api/v1/bot/<recall_bot_id>/leave_call" \
  -H "Authorization: Token $RECALL_API_KEY"
```

Then mark the row:

```sql
update public.bot_sessions
set status = 'stopped',
    failure_reason = 'manual_recall_kill',
    ended_at = now()
where id = '<session-id>';
```

## Webhook event mapping

Recall status code → our `bot_sessions.status`:

| Recall code | Our status |
|---|---|
| `ready` | `pending` |
| `joining_call`, `in_waiting_room` | `joining` |
| `in_call_not_recording`, `in_call_recording` | `in_call` |
| `recording_done`, `call_ended`, `done` | `completed` |
| `fatal` | `failed` |
| `timeout` | `timeout` |

`recording_url` and `transcript_url` populate on `bot.done` /
`bot.recording.done` events.

## Retention enforcement (P1.7 Slice 3)

A daily in-process scheduler (`backend/services/retentionScheduler.js`)
fires `runRetentionSweep` from `retentionService.js` at **03:00 UTC**.
For each workspace, the sweep:

1. Reads `workspace_settings.data_controls_json.retention_days` (default 90,
   allowed values {30, 90, 365}).
2. Finds `bot_sessions` older than that threshold whose
   `recording_url` or `transcript_url` is still populated and that
   haven't been swept (`retention_deleted_at IS NULL`).
3. Calls Recall's `DELETE /bot/<id>` to nuke hosted media. 404 is
   treated as success (already gone).
4. NULLs the URL columns on the row, stamps `retention_deleted_at`.
5. The row itself is preserved for audit.

The sweep is capped at 200 rows per workspace per day to protect against
a misconfigured retention cliff melting the Recall API; remaining rows
roll over to the next day.

### Setting per-workspace retention

UI: workspace owner/admin → Settings → Data & Retention → pick 30/90/365.

CLI:

```bash
curl -X PUT https://entomate.onrender.com/api/settings/workspace \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "<org-uuid>",
    "data_controls_json": { "retention_days": 30 }
  }'
```

Invalid values return 400 `invalid_settings`.

### Manual retention sweep (out-of-band)

```js
// In a node REPL on the backend:
require('./services/retentionService').runRetentionSweep().then(console.log)
```

There is no admin HTTP endpoint to trigger the sweep — gated behind the
in-process scheduler so a stuck cron is the only failure mode.

## Jurisdiction policy (P1.7 Slice 4)

Per-workspace consent posture lives at
`workspace_settings.data_controls_json.consent_jurisdiction`. Allowed
values:

| Value | Meaning |
|---|---|
| `permissive` | Default. One-party-consent assumed. Organizer's launch affirmation suffices. |
| `two_party` | For meetings where any participant may be in a US two-party-consent state (CA, FL, IL, MD, MA, MT, NV, NH, PA, WA). Surfaces a stronger consent prompt at launch. |
| `gdpr` | For meetings that may include EU/UK participants. Same prompt as `two_party`; future releases will gate launches without a confirmed attendee list. |

**Slice 4 does not enforce these values beyond UI** — they're a flag a
future enforcement layer can read. The organizer's legal obligations are
unchanged.

UI: workspace owner/admin → Settings → Data & Privacy.

CLI:

```bash
curl -X PUT https://entomate.onrender.com/api/settings/workspace \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "<org-uuid>",
    "data_controls_json": { "consent_jurisdiction": "two_party" }
  }'
```

Invalid values return 400 `invalid_settings`. The setting is preserved
across other-key updates because the route does not clobber the JSONB
blob — the UI does a read-modify-write to keep adjacent keys safe.

The legal reference for these values is
[`docs/policies/CONSENT_JURISDICTIONS.md`](../policies/CONSENT_JURISDICTIONS.md).
The counsel review packet is
[`docs/policies/COUNSEL_REVIEW_PACKET.md`](../policies/COUNSEL_REVIEW_PACKET.md).

## GDPR right-to-delete (P1.7 Slice 3)

Notify-only fulfillment. Three endpoints under `/api/consent/data-deletion`:

| Method + path | Auth | Purpose |
|---|---|---|
| `POST /` | Public | Submit a deletion request |
| `GET /admin` | Platform admin | List pending requests |
| `POST /admin/:id/fulfill` | Platform admin | Fan deletion across attendees + sessions |
| `POST /admin/:id/deny` | Platform admin | Record denial reason (Art. 17(3) basis) |

### Bootstrap a platform admin

There is no UI for managing `platform_admins`. Insert your first row by SQL:

```sql
insert into public.platform_admins (user_id, notes)
values ('<your-auth-user-id>', 'bootstrap')
on conflict (user_id) do nothing;
```

Resolve your `auth.users.id` from the Supabase dashboard → Authentication
→ Users.

### Fulfilling a request

```bash
# List pending requests (yours, by virtue of being a platform admin)
curl https://entomate.onrender.com/api/consent/data-deletion/admin \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Fulfill — fans the delete out
curl -X POST https://entomate.onrender.com/api/consent/data-deletion/admin/<request-id>/fulfill \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Or deny with a documented Art. 17(3) reason
curl -X POST https://entomate.onrender.com/api/consent/data-deletion/admin/<request-id>/deny \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"legal hold under matter X-2026-04"}'
```

The fulfillment summary (counts of attendees deleted, sessions redacted,
Recall media deleted) is stored on the `data_deletion_requests` row in
`fulfillment_summary` and returned in the response.

## Pre-meeting opt-out email (P1.7 Slice 2)

Each launched session can carry a list of `participantEmails`. For each
clean address, the orchestrator:

1. Generates a 32-byte raw token, stores `sha256(token)` on a
   `bot_session_attendees` row.
2. Sends the opt-out email via Resend (sender = `RESEND_FROM`).
3. Records `email_status` on the row: `sent` / `failed` / `skipped`
   (latter when `RESEND_API_KEY` is unset).

The opt-out URL points at `${OPT_OUT_BASE_URL}/opt-out/<rawToken>`.
Recipients land on a public React page that calls
`GET /api/consent/opt-out/:token` for context and
`POST /api/consent/opt-out/:token` to record the opt-out. Clicking the
link is idempotent — re-clicks return `alreadyOptedOut: true` and do
not re-fire the organizer notification.

When an opt-out is recorded, the orchestrator best-effort sends a
notification email back to the organizer (resolved via
`bot_sessions.consent_acknowledged_by` → `auth.users`). The flow is
notify-only — the bot is **not** automatically stopped; the organizer
decides whether to continue.

### Querying opt-outs for a workspace

Org members can read their workspace's attendee rows under RLS:

```sql
select session_id, email, email_status, opted_out_at, opt_out_reason
from public.bot_session_attendees
where org_id = '<org-uuid>'
  and opted_out_at is not null
order by opted_out_at desc;
```

### Manually re-firing an opt-out email (e.g. bounce recovery)

Not yet automated. Look up the session in `bot_session_attendees`,
note the `email`, and re-launch the bot or send a one-off email
through Resend's dashboard. Bounce-handling is on the slice 2.5
backlog.

## Troubleshooting

| Symptom | Likely cause | Action |
|---|---|---|
| `RECALL_API_KEY is not set` at launch | Backend secret missing | Set in Render env, redeploy |
| `Recall API 401` | Wrong/expired key | Rotate in Recall dashboard, update Render env |
| `Recall API 400` "invalid meeting_url" | Malformed URL | Confirm URL works in a regular browser |
| Webhook returns 401 | Svix HMAC verification failed | Confirm `RECALL_WEBHOOK_SIGNING_SECRET` exactly matches the `whsec_…` value shown for this endpoint in the Recall dashboard. Rotating the secret in the dashboard requires updating Render env. |
| Webhook returns 500 "signing secret not configured" | `RECALL_WEBHOOK_SIGNING_SECRET` unset | Set it in Render env, redeploy |
| Webhook returns 500 "Raw body not captured" | `express.json` lost its `verify` callback | Confirm the `verify: (req, _res, buf) => { req.rawBody = buf; }` option is still on `express.json()` in `server.js` |
| All bots stuck in `launching`, no webhooks ever | No workspace webhook configured in Recall dashboard | Add the endpoint per "Webhook setup" above |
| Session stuck in `joining`, webhooks landing for other bots | Recall bot couldn't enter meeting | Check Recall dashboard for the bot's status; usually a meeting permission issue |
| `recording_url` never populated | Meeting never started or bot was kicked | `getRecallBotState` shows the full status history |
| All attendee emails land with `email_status='skipped'` | `RESEND_API_KEY` unset on Render | Set it (or accept skipped state if Resend isn't ready yet — bot launches still work) |
| Resend returns 403 / "domain not verified" | DNS records (SPF/DKIM/DMARC) haven't propagated or are missing | Check Resend dashboard → Domains for the verification status; re-add the records at your DNS provider |
| Opt-out link returns 404 | Token mistyped, expired by cascade-delete (parent `bot_sessions` row gone), or already cancelled | Check `bot_session_attendees.opt_out_token_hash` for the sha256 of the token in the URL |
| Organizer notification email not received on opt-out | `consent_acknowledged_by` was null at launch (legacy row) or organizer's `auth.users.email` is empty | Check the `bot_sessions` row for `consent_acknowledged_by`; legacy rows pre-Slice-1 won't notify |
| Retention sweep never fires | `RetentionScheduler not initialized` in boot logs | Check that `retentionScheduler.initialize()` runs in `server.js`; restart the service |
| Retention sweep skips rows | `retention_delete_error` populated | Inspect the column for the per-row error. Often a Recall 4xx — fix the Recall key or accept the row as orphaned |
| GDPR fulfill returns 403 | Caller isn't in `platform_admins` | Insert your `user_id` via SQL (see runbook) |
| GDPR fulfill `summary.errors` non-empty | Partial deletion — some attendees/sessions failed | Re-run fulfill (idempotent — already-deleted rows are skipped) or inspect the specific errors |
