# Handoff — 2026-04-25

**Context:** End of a long debugging session that started with P1.1 bot fleet
foundation work and ended with a strategic pivot to Recall.ai. Pick this up to
ship the next P1.x slice.

---

## TL;DR — what changed today

1. **Pivoted from in-house Fly.io meeting bot → Recall.ai SaaS.**
   Google CAPTCHA-blocked our datacenter-IP headless Chromium login on first
   attempt. Iteration on selectors / login flow doesn't move us past Google's
   IP-reputation defense. Recall handles bot identity, anti-bot, audio capture,
   and platform quirks across Meet/Zoom/Teams.

2. **Backend is live + Recall is functionally proven.**
   - Render service `entomate` deployed at https://entomate.onrender.com
   - Direct curl against Recall API succeeded (created bot, got valid response)
   - Orchestrator code patched to match Recall's actual endpoint shape

3. **Total commits this session:** ~17, ending at `ea7dc30` on `main`.

---

## State of the system right now

| Layer | Status | Notes |
|---|---|---|
| Render backend | ✅ Live | https://entomate.onrender.com — deploy auto-runs on push to main |
| Recall.ai account | ✅ Active | "Quantum Ecosystems" workspace in us-west-2 (Oregon), $5 trial credit |
| Supabase | ✅ Active | us-west-2, migrations applied through `20260425000001_bot_sessions_recall.sql` |
| Bot fleet code | ✅ In place | `backend/services/botOrchestrator.js` calls Recall API |
| `/api/admin/bots/launch` | ✅ Code-ready | End-to-end test blocked by Clerk-Supabase auth mismatch (see Gotchas) |
| Recall webhook receiver | ✅ Code-ready | Listens at `/api/admin/bots/recall-webhook?session=&token=` |
| Frontend bot launcher UI | ❌ Not built | Admin endpoints exist but no UI invokes them |
| Old Fly bot infra | ✅ Decommissioned in code | App `entomate-bot-fleet` still exists in Fly account but is harmless; destroy whenever |

## Critical secrets — location reference

All real values in 1Password unless noted. **Never paste in chat.**

| Secret | Where it lives | Purpose |
|---|---|---|
| `RECALL_API_KEY` | Render env (set) + 1Password | Recall API auth |
| `RECALL_WEBHOOK_TOKEN` | Render env (set) | Validates Recall webhooks back to us |
| Recall Verification Secret (`whsec_6R41...`) | 1Password | For HMAC webhook signature verification (future upgrade — see Backlog) |
| Meet Mate Google creds (email/password/TOTP) | 1Password | No longer used — Recall has its own bot identities. Account can be deleted if not wanted elsewhere. |
| Supabase service key | Render env | Backend writes to bot_sessions via service role |
| Fly API token | Render env (orphaned) | Was for in-house bot; safe to remove |

## Recent commit history (most recent first)

```
ea7dc30  fix(bots): drop trailing slash on Recall endpoints + add recording_config
cdaf0a8  fix(bots): default Recall API base to us-west-2 (oregon)
d2fa72c  feat(bots): pivot from in-house Fly bot to Recall.ai
2caa878  fix(bots): deep page-state diagnostic logging  (pre-pivot)
b1fa904  fix(bots): click "Next" button by exact text   (pre-pivot)
740ac17  fix(bots): drop Chromium verbose logs + log page state at each step
e6daf94  fix(bots): debug Chromium launch hang
6d712be  fix(bots): bump bot Machine memory 2GB → 4GB
f4e1a9e  fix(bots): bump CPU 1→2 (Fly shared-cpu-1x caps at 2GB)
3956152  fix(bots): legacy headless + chromium pre-flight check
bc1870a  fix(bots): install Chromium with full deps + add dumpio
ff04ec9  chore(deploy): align render.yaml + Meet Mate identity schema
65b14f0  feat(bots): P1.1 bot fleet foundation
```

Anything tagged `(pre-pivot)` is now obsoleted by the Recall pivot but kept in
history for reference.

## Open GitHub issues — current state

| # | Title | Status |
|---|---|---|
| 1 | P1.1 Bot Infrastructure | Shipped in original Fly form; partially obsoleted by Recall pivot. Don't reopen. |
| 2 | P1.2 Google Meet Bot | Functionally shipped via Recall. Update issue body to note "implemented via Recall.ai (pivot)" and close. |
| 3 | P1.3 Bot Reliability Harness | **Re-scope** — Recall handles most of this. New scope: react to Recall webhook failures, surface to user via Pulse. ~0.5 wk. |
| 4 | P1.4 Speaker Diarization (Deepgram) | Now a 1-line config change in orchestrator (`recording_config.transcript.provider`). ~0.5 day. |
| 5 | P1.5 Bot Fleet Monitoring | Largely deferred to Recall's dashboard. Our part is just exposing Recall's bot status to admins via UI. |
| 6 | P1.6 PWA + Web Push | Independent of bot work. Still relevant. |
| 7 | P1.7 Consent UX + compliance | Independent. Still relevant. |
| 8 | P1.8 Regression test suite | Reduced scope — test the orchestrator → Recall → webhook loop end-to-end with a synthetic Meet. |
| 9 | P1.9 Cost monitoring | Still relevant; Recall's pricing is per-meeting-hour, easier to track than Fly Machines were. |
| 10 | P1.10 NPO verification (IRS EO) | Independent. Still relevant. |
| 11 | P1.11 Onboarding runbook + Looms | Independent. Still relevant. |

## Gotchas — read before resuming

1. **Clerk ↔ Supabase auth mismatch (P0 to resolve before any UI work).**
   The frontend signs users in via Clerk (`CLERK_SECRET_KEY` set in env). The
   bot admin routes use `backend/middleware/auth.js` which calls
   `supabase.auth.getUser()`. A Clerk JWT won't validate against Supabase
   `auth.getUser()`. End-to-end testing of `/api/admin/bots/launch` from the
   browser is currently blocked.
   **Fix options:** (a) bridge Clerk → Supabase via a `supabase.auth.signInWithIdToken()`
   exchange, (b) add a Clerk-aware auth middleware variant, (c) for testing
   only, add an `ALLOW_SERVICE_KEY_AUTH` env-gated bypass.

2. **Recall API quirks (already patched, but know them):**
   - Endpoints reject trailing slashes (`/bot` works, `/bot/` returns
     misleading auth_failed).
   - Free tier has $5 credit; verify `Last Used` timestamps in dashboard to
     confirm the right key is being used.
   - Region is encoded in the API base URL: `https://us-west-2.recall.ai/api/v1`
   - Workspace label "US West (Oregon)" maps to `us-west-2` in API base.

3. **PowerShell + JSON quoting hell.**
   When testing curl-equivalent calls, always use `Invoke-RestMethod` with
   hashtables → `ConvertTo-Json`, never raw `-d` string args. Backtick line
   continuations frequently break on paste.

4. **`fly logs` doesn't see destroyed `--rm` Machines.** Old artefact from
   the in-house bot debugging — irrelevant now since Recall manages its own
   bot fleet, but if anyone reverts, this will bite again.

5. **Bot Test Room:** `https://meet.google.com/agj-onej-fao` — persistent
   meeting in the user's Calendar. Good for repeated bot testing without
   spamming real meetings.

## Suggested next priorities (in rough order)

1. **Clerk ↔ Supabase auth bridge** — unblocks all admin-endpoint testing and
   any frontend that needs to call backend APIs. Probably 0.5–1 day.
2. **Close issue #2** with a comment about the Recall pivot decision. Update
   `docs/plans/ENTOMATE_GAP_CLOSING_PLAN.md` §8 COGS section to reflect
   actual Recall pricing (~$0.50–5/hr vs original $0.71/hr target).
3. **P1.4 Deepgram swap** — change `meeting_captions` → `deepgram` in
   `botOrchestrator.js` `recording_config`. ~30 min.
4. **Frontend bot launcher UI** — minimal admin page that POSTs to
   `/api/admin/bots/launch` once auth is resolved. Lets the team trigger
   bots without curl gymnastics.
5. **P1.7 Consent UX** — independent of bot work, blocking real-meeting use.

## How to resume — checklist

```
1. Read this doc.
2. `git log --oneline -20` to see what's landed since.
3. `gh issue list --milestone "M1 — Meet Bot + Table Stakes"` to see backlog.
4. Check Render + Recall dashboards are green:
   - https://entomate.onrender.com/health
   - https://us-west-2.recall.ai/dashboard (account home)
5. Pick next priority from the list above.
6. If touching the bot fleet: read `docs/runbooks/BOT_OPS.md` first — it's
   the source of truth for how Recall integration works.
```

## Cleanup that can happen anytime (no rush)

```bash
# Destroy unused Fly app (no cost while stopped, but tidy)
fly apps destroy entomate-bot-fleet --yes

# Remove orphaned Render env vars (if you want a clean panel)
# In Render dashboard, delete: FLY_API_TOKEN, FLY_BOT_APP_NAME,
# FLY_BOT_IMAGE, FLY_BOT_REGION, MEET_MATE_* (all 8)

# Delete Meet Mate Google account if not needed elsewhere
# (account at meetmate@qntmecos.com — disable 2FA first, then delete)

# Revoke unused Recall API keys in dashboard (keep just one active)
```

---

**Session vibe:** Long, hard. Started thinking we'd ship P1.2a Pass 1 + 2 in one
go. Hit Google's anti-bot wall, made the right call to pivot. Better to bleed a
session learning the limits of in-house bots than to bleed a quarter on it.

Status of the architecture: cleaner than before. Fewer moving parts. Recall is
the right primitive for this layer.
