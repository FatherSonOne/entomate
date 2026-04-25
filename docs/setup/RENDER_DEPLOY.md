# Deploying the Entomate Backend to Render

Step-by-step for the first-time deploy. You should do this before P1.2a code
work because the bot needs a stable backend URL for status callbacks.

Source of truth for service config: [`render.yaml`](../../render.yaml).

## Prerequisites

- A Render account (free tier is fine to start) — [signup](https://render.com)
- The Entomate GitHub repo connected to your GitHub account (already true —
  `FatherSonOne/entomate`)
- All current secrets in your password manager — Supabase URL/keys, Gemini key,
  Notetaker Google creds (from the bot-account setup), Fly API token (later)

## Step 1 — Connect the Blueprint

1. Go to https://dashboard.render.com
2. New → **Blueprint**
3. Connect the `FatherSonOne/entomate` repo
4. Render reads `render.yaml` and shows the service `entomate` plus every
   `sync: false` env var as a slot waiting for input. (If you already have an
   `entomate` service in your Render workspace, the Blueprint will sync to it
   in place rather than creating a duplicate.)
5. Pick a workspace name; click **Apply** to create the service (it will fail
   the first deploy until secrets are populated — that's expected)

## Step 2 — Populate secrets

In the service's **Environment** tab, fill in each `sync: false` var:

### Frontend / CORS
| Var | Source | Notes |
|---|---|---|
| `FRONTEND_URL` | your deployed frontend URL | e.g. `https://entomate.com` |
| `CORS_ORIGINS` | comma-separated allowlist | matches frontend URL(s) |

### Supabase (already in your `backend/.env.local`)
| Var | Source |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_KEY` | Supabase service-role key (secret) |
| `HUB_SUPABASE_URL` | same as `SUPABASE_URL` |
| `HUB_SUPABASE_ANON_KEY` | same as `SUPABASE_ANON_KEY` |
| `HUB_SUPABASE_SERVICE_KEY` | same as `SUPABASE_SERVICE_KEY` |

### AI
| Var | Source |
|---|---|
| `GEMINI_API_KEY` | Google AI Studio (secret) |

### Meet Mate — bot Google account (from your password manager)
| Var | Notes |
|---|---|
| `MEET_MATE_EMAIL` | the dedicated bot email |
| `MEET_MATE_PASSWORD` | the dedicated bot password (secret) |
| `MEET_MATE_TOTP_SECRET` | the **raw** base32 TOTP seed (not the QR image) |
| `MEET_MATE_RECOVERY_EMAIL` | admin email for account-recovery alerts |
| `MEET_MATE_BACKUP_CODES_REF` | pointer string, e.g. `1Password: <vault> / Meet Mate / Backup Codes` — never the codes themselves |
| `MEET_MATE_WORKSPACE_DOMAIN` | only if account is on Google Workspace |

`MEET_MATE_DISPLAY_NAME` and `MEET_MATE_ACCOUNT_TYPE` come pre-set with
sensible defaults (`Meet Mate` and `workspace`) — adjust only if needed.

### Bot fleet (Fly.io) — leave blank for now if you haven't done Fly setup yet
| Var | When to set |
|---|---|
| `FLY_API_TOKEN` | After Fly.io account + bot-fleet app created |
| `BOT_CALLBACK_BASE_URL` | After this Render service is live — set it to `https://<service-name>.onrender.com` |

> The backend will start fine without `FLY_API_TOKEN`. Bot launch endpoints
> will fail with a clear error message. That's the expected state until P1.2a
> Pass 2 is ready for end-to-end testing.

## Step 3 — Trigger first deploy

Click **Manual Deploy → Clear build cache & deploy**. Watch the build logs.
First build pulls the entire backend Docker image; expect 5–10 min.

## Step 4 — Verify

```bash
curl https://<your-service>.onrender.com/health
```

Should return `200 OK` with a JSON health response.

## Step 5 — Set the callback base URL

Now that the URL is stable, go back to **Environment** and set:

```
BOT_CALLBACK_BASE_URL=https://<your-service>.onrender.com
```

Click **Save Changes** — Render redeploys automatically.

## Free-tier note

The free plan spins down after 15 min idle, with ~30s cold-start. Fine for
P1.2a iteration; **upgrade to Starter ($7/mo)** before any design partner
joins a real meeting — a 30s cold-start during a bot callback would mean the
orchestrator misses status updates while spinning back up.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Build fails on `npm ci` | Delete `package-lock.json` discrepancy locally, push fresh; or use `npm install` in the Dockerfile temporarily |
| `/health` returns 404 | Verify `healthCheckPath: /health` in `render.yaml` matches `app.use('/health', ...)` in `server.js:161` |
| Service starts but logs `SUPABASE_URL not set` | One or more of the Supabase env vars is unset — check the Environment tab |
| Service starts but `FLY_API_TOKEN is not set` errors on bot launch | Expected until Fly setup is complete |

## What this doesn't cover

- **Fly.io setup** for the bot fleet — covered separately in
  [`docs/runbooks/BOT_OPS.md`](../runbooks/BOT_OPS.md#first-time-setup)
- **Database migrations** — apply via `supabase db push` from the project
  root, not Render
- **Frontend deploy** — currently on Vercel via `vercel.json`, not Render
