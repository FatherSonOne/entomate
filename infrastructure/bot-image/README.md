# Entomate Bot Image

Headless Chromium + PulseAudio container for per-session meeting bots. Built
from `Dockerfile` in this directory and pushed to Fly.io's registry; launched
per-meeting by `backend/services/botOrchestrator.js`.

## Scope (P1.1)

- Container surface (Node 20 + Chromium + PulseAudio)
- Entrypoint skeleton: reads session config from env, launches Chromium,
  reports status to the orchestrator callback, exits
- Graceful shutdown on SIGTERM/SIGINT
- Max-duration timer (default 3h) to prevent runaway sessions

## Out of scope here

- Meet / Zoom / Teams join logic — lands in **P1.2** inside `src/drivers/`
- Loopback audio capture + upload to Supabase storage — also P1.2
- Reconnect / heartbeat — **P1.3**
- Deepgram streaming — **P1.4**

## Local build

```bash
cd infrastructure/bot-image
docker build -t entomate-bot:local .
```

## Env vars (consumed at runtime)

### Per-session (set by orchestrator at Machine launch)
| Var | Required | Purpose |
|---|---|---|
| `BOT_SESSION_ID` | yes | UUID of the `bot_sessions` row |
| `BOT_WORKSPACE_ID` | yes | Org ID (multi-tenant scope) |
| `BOT_MEETING_ID` | yes | Entomate meeting ID |
| `BOT_MEETING_URL` | yes | Platform URL (Meet/Zoom/Teams link) |
| `BOT_PLATFORM` | no (default `meet`) | One of `meet` / `zoom` / `teams` |
| `BOT_MAX_DURATION_MS` | no | Hard timeout; default 3h |
| `BOT_CALLBACK_URL` | no | POST target for status updates |
| `BOT_CALLBACK_TOKEN` | no | Bearer token for the callback |

### Meet Mate identity (passed through from backend env, used by login driver)
| Var | Required for join? | Purpose |
|---|---|---|
| `MEET_MATE_EMAIL` | yes (P1.2 Pass 2+) | Bot Google account email |
| `MEET_MATE_PASSWORD` | yes | Bot Google account password |
| `MEET_MATE_TOTP_SECRET` | yes | Raw base32 TOTP seed for 2SV (consumed by `otplib`) |
| `MEET_MATE_DISPLAY_NAME` | no (default `Meet Mate`) | Participant name rendered in Meet UI |

> Pass 1 reads these into `config.identity` but does not yet log in.
> Pass 2 implements the full login + Meet join flow.

See [`docs/runbooks/BOT_OPS.md`](../../docs/runbooks/BOT_OPS.md) for ops
procedures.
