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
| `RECALL_API_BASE` | Default `https://us-east-1.recall.ai/api/v1` |
| `RECALL_WEBHOOK_TOKEN` | Random 24-byte hex. Generate with: `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`. Used to authenticate Recall webhook calls back to us. |
| `BOT_CALLBACK_BASE_URL` | Public URL of this backend, e.g. `https://entomate.onrender.com`. Recall posts webhooks to `<base>/api/admin/bots/recall-webhook`. |

## First-time setup

1. **Recall.ai account.** Sign up at https://recall.ai → dashboard → copy
   your API key.
2. **Render env.** Set `RECALL_API_KEY`, `RECALL_WEBHOOK_TOKEN`, and
   `BOT_CALLBACK_BASE_URL` in the Render service Environment tab.
3. **Deepgram credential (transcription).** Sign up at
   https://console.deepgram.com → API Keys → create a Member-scoped key.
   In the Recall.ai dashboard → Transcription Providers → add the key as
   the **default** Deepgram credential (leave Host and Project Id blank
   for the US endpoint + meeting bots). Bots launch with
   `deepgram_streaming` + `model: nova-3` + `diarize: true`; Recall reads
   the key from the dashboard at call time. No backend env var.
4. **DB migration.**
   ```bash
   supabase db push
   ```
   Applies both the original `20260423000001_bot_sessions.sql` and the
   Recall extension `20260425000001_bot_sessions_recall.sql`.
5. **Webhook URL** is computed at launch time as
   `{BOT_CALLBACK_BASE_URL}/api/admin/bots/recall-webhook?session=<id>&token=<RECALL_WEBHOOK_TOKEN>`.
   Recall stores it per-bot at creation; nothing to register up-front.

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

## Manual cleanup (when admin API is unavailable)

Stop a bot directly via Recall:

```bash
curl -X POST "https://us-east-1.recall.ai/api/v1/bot/<recall_bot_id>/leave_call/" \
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
| Webhook returns 401 in Render logs | Token mismatch | Confirm `RECALL_WEBHOOK_TOKEN` in Render matches what was set when bot was launched (Recall stores it at creation; rotate by relaunching) |
| Session stuck in `joining`, no webhooks | Recall bot couldn't enter meeting | Check Recall dashboard for the bot's status; usually a meeting permission issue |
| `recording_url` never populated | Meeting never started or bot was kicked | `getRecallBotState` shows the full status history |
