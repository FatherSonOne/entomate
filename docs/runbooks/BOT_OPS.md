# Bot Ops Runbook

Operational procedures for the Entomate meeting-bot fleet. Covers the
skeleton shipped in **P1.1** — expand as P1.2 (Meet driver), P1.3
(reliability), and P1.5 (fleet monitoring) land.

Source:
- Bot image: [`infrastructure/bot-image/`](../../infrastructure/bot-image/)
- Orchestrator: [`backend/services/botOrchestrator.js`](../../backend/services/botOrchestrator.js)
- Admin routes: [`backend/routes/bots.js`](../../backend/routes/bots.js)
- Fly config: [`infrastructure/fly.bot.toml`](../../infrastructure/fly.bot.toml)

## Architecture in one paragraph

Each meeting spawns a dedicated Fly.io Machine running the bot image.
`botOrchestrator.launchBotSession()` calls the Fly Machines API with a
per-session env bundle (session ID, meeting URL, callback token). The Machine
boots, runs the platform driver, reports status back via a bearer-token
callback, then exits. Fly auto-destroys the Machine on exit, so there is no
reuse across sessions. Session state lives in `bot_sessions` (Supabase).

## Required env / secrets (backend)

### Fly fleet
| Var | Where | Purpose |
|---|---|---|
| `FLY_API_TOKEN` | Render backend secret | Fly Machines API auth |
| `FLY_BOT_APP_NAME` | default `entomate-bot-fleet` | Fly app that owns the bots |
| `FLY_BOT_IMAGE` | default `registry.fly.io/entomate-bot-fleet:latest` | Bot image reference |
| `FLY_BOT_REGION` | default `sjc` | Fly region (San Jose, near Supabase us-west-2) |
| `BOT_CALLBACK_BASE_URL` | e.g. `https://entomate.onrender.com` | Base URL the bot POSTs status to |

### Meet Mate identity (orchestrator passes these to each Machine at launch)
| Var | Notes |
|---|---|
| `MEET_MATE_EMAIL` | Bot Google account email |
| `MEET_MATE_PASSWORD` | Bot Google account password |
| `MEET_MATE_TOTP_SECRET` | Raw base32 TOTP seed; consumed by `otplib` to clear 2SV |
| `MEET_MATE_DISPLAY_NAME` | Default `Meet Mate`; per-launch override possible via `botName` |
| `MEET_MATE_RECOVERY_EMAIL` | Backend-only metadata (not passed to Machine) |
| `MEET_MATE_BACKUP_CODES_REF` | Backend-only metadata (pointer to password manager) |
| `MEET_MATE_ACCOUNT_TYPE` | Backend-only — `workspace` or `personal` |
| `MEET_MATE_WORKSPACE_DOMAIN` | Backend-only metadata |

## First-time setup

```bash
# 1. Create the Fly app (one-time)
fly apps create entomate-bot-fleet --org <org>

# 2. Build & push the image (from repo root)
fly deploy --config infrastructure/fly.bot.toml \
           --build-only --push --image-label latest \
           --app entomate-bot-fleet

# 3. Set backend secrets (Render dashboard or CLI)
render env set FLY_API_TOKEN=<token>
render env set BOT_CALLBACK_BASE_URL=https://api.entomate.com
```

## Running the migration

```bash
supabase db push   # applies supabase/migrations/20260423000001_bot_sessions.sql
```

## Admin endpoints (all require admin role)

```bash
# Launch
curl -X POST https://api.entomate.com/api/admin/bots/launch \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "<org-uuid>",
    "meetingId": "<meeting-uuid>",
    "meetingUrl": "https://meet.google.com/abc-defg-hij",
    "platform": "meet"
  }'

# List active
curl https://api.entomate.com/api/admin/bots \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Kill
curl -X DELETE https://api.entomate.com/api/admin/bots/<session-id> \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "stuck in joining state"}'

# Logs
curl https://api.entomate.com/api/admin/bots/<session-id>/logs?limit=500 \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

## Manual bot kill (when admin API is unavailable)

Use the Fly CLI as a fallback:

```bash
fly machines list --app entomate-bot-fleet
fly machine destroy <machine-id> --app entomate-bot-fleet --force
```

Then mark the row manually:

```sql
update public.bot_sessions
set status = 'stopped',
    failure_reason = 'manual_fly_kill',
    ended_at = now()
where id = '<session-id>';
```

## Log retrieval

```bash
fly logs --app entomate-bot-fleet --machine <machine-id> --since 30m
```

Or use the admin logs endpoint (pulls through the Machines API).

## Known limits (P1.1 skeleton)

- `runPlatformDriver` is a placeholder that navigates to the URL and exits
  after ~5s. Real Meet join logic lands in **P1.2**.
- No reconnect on network drop — **P1.3**.
- No per-bot alerting on join-failure spikes — **P1.5**.
- No cost rollup — **P1.9**.

## Troubleshooting

| Symptom | Likely cause | Action |
|---|---|---|
| `FLY_API_TOKEN is not set` at launch | Backend secret missing | Set in Render dashboard, redeploy |
| `Fly API 404 @ /apps/entomate-bot-fleet/machines` | App not created | Run `fly apps create entomate-bot-fleet` |
| Bot in `pending` > 30s, no `machine_id` | Fly API error on launch | Check row's `failure_reason`; verify `FLY_BOT_IMAGE` exists |
| Callback returns 401 `Invalid callback token` | Race between insert and bot boot, or wrong token | Confirm bot env matches the hash in DB; rotate by stopping and relaunching |
| Session stuck in `in_call`, `ended_at` null | Bot died without final callback | Kill via admin API; P1.3 reliability harness will address this |
