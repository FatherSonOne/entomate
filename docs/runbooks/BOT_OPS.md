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
3. **DB migration.**
   ```bash
   supabase db push
   ```
   Applies both the original `20260423000001_bot_sessions.sql` and the
   Recall extension `20260425000001_bot_sessions_recall.sql`.
4. **Webhook setup** — see next section. This is a one-time dashboard
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
# Launch — workspaceId in body, role checked against that org
curl -X POST https://entomate.onrender.com/api/admin/bots/launch \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "<org-uuid>",
    "meetingId":   "<meeting-uuid>",
    "meetingUrl":  "https://meet.google.com/abc-defg-hij",
    "platform":    "meet"
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
