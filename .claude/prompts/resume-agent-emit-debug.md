# Resume — debug why agent.action_completed events aren't reaching Pulse

You're picking up a smoke-test debugging session. The user (Aegis{FM}) was
verifying that Entomate's `/api/agents/trigger` route fires
`agent.action_completed` events to Pulse via the ecosystem bridge.
Everything on the Entomate side appears to succeed, but Pulse never
receives the event. Stopped at end-of-day for sleep — pick up here.

## State recap

**Code shipped this session (all already committed):**

| SHA | Repo | Change |
|---|---|---|
| `b615b0b` | Entomate | Added `notifyPulseAgentCompleted()` helper in `backend/routes/agents.js` and hooked it into both `POST /api/agents/:id/execute` and `POST /api/agents/trigger`. Also added `notifyPulseAutomationTriggered()` in `backend/services/automationEngine.js`. Both helpers are fire-and-forget, gated on `process.env.ECOSYSTEM_PULSE_WORKSPACE_ID`. |
| `6385e8b` | Entomate | New smoke test script: `backend/scripts/verify-agent-pulse-emit.js`. Calls /api/agents/trigger and polls Pulse `ecosystem_events` for the resulting inbound row. |

**The relevant Pulse-side handler already exists** at
`f:\pulse1\supabase\functions\ecosystem-inbound\index.ts` — case
`'agent.action_completed'` routes to `handleAgentAction()` which posts to
the entomate-alerts bot channel. Was already in place pre-session.

## Last test run output

```
PS F:\entomate\backend> $env:TRIGGER_TYPE = "task.overdue"
PS F:\entomate\backend> node scripts/verify-agent-pulse-emit.js
[verify-agent-pulse-emit] Triggering task.overdue on http://localhost:3000
[verify-agent-pulse-emit] Will poll Pulse for events created >= 2026-05-04T05:15:19.783Z
[verify-agent-pulse-emit] Trigger OK in 1304ms — executed=1
[verify-agent-pulse-emit] Polling Pulse ecosystem_events (timeout=15000ms)...
[verify-agent-pulse-emit] FAIL — no Pulse event after 15427ms
```

What this tells us:
- Trigger reached Entomate ✓
- Auth worked (a previous run failed with 401 from a stale JWT; current session has a fresh one) ✓
- An agent matched `task.overdue` and executed ✓
- The notify hook *should* have fired post-execution
- Pulse never received the event ✗

## Env state at end of session

The user has these set in their PowerShell test session (will need to re-set if shell was closed — `$env:` vars don't persist):

```
ENTOMATE_API_URL=http://localhost:3000
ENTOMATE_TEST_JWT=<JWT extracted from browser localStorage; expires hourly>
PULSE_SUPABASE_URL=https://ucaeuszgoihoyrvhewxk.supabase.co
PULSE_SUPABASE_SERVICE_KEY=<pulse service role key>
TRIGGER_TYPE=task.overdue
```

**Unknown:** whether `ECOSYSTEM_PULSE_WORKSPACE_ID` is set in the
Entomate backend's environment (the *running backend's* env, not the
test shell's). This is the most likely culprit — see step 1 below.

## Resume here — 3-step diagnostic in priority order

**STEP 1 — verify the backend has `ECOSYSTEM_PULSE_WORKSPACE_ID` set.**

The notify hook at `backend/routes/agents.js:notifyPulseAgentCompleted`
silently returns when this env var is missing. Ask the user to run, in
the shell where `npm run dev` is running:

```powershell
echo $env:ECOSYSTEM_PULSE_WORKSPACE_ID
```

If empty → that's it. Set it and restart backend. The Pulse workspace
UUID can be found by the user in their Pulse account settings, or by
querying `pulse_workspaces` (or `workspaces`) in the Pulse Supabase
project.

If it IS set, proceed to step 2.

**STEP 2 — check Entomate's outbound log to see if the bridge attempted delivery.**

Run against the Entomate Supabase project (`epftmicjaxrthmpyoguy`):

```sql
SELECT created_at, event_type, target_app, status, error_message
FROM ecosystem_events
WHERE direction = 'outbound'
  AND event_type = 'agent.action_completed'
ORDER BY created_at DESC
LIMIT 5;
```

Three outcomes route to different fixes:

- **No rows** → bridge wasn't connected. Check `ecosystem_config` row
  for `app_name='pulse'`: must have `enabled=true`, `api_url` set,
  `service_token` non-null and not starting with 'PLACEHOLDER'. The
  bridge `isConnected('pulse')` check is what gates the call.

- **Row with status='failed'** → `error_message` will tell you exactly.
  Most likely culprits: 401 (token mismatch — Pulse's `inbound_token`
  doesn't match Entomate's `service_token`), DNS error (placeholder URL
  in `api_url`), or 401 from missing `features.gateway_key` on Entomate's
  `ecosystem_config` row for `pulse` (Supabase edge function gateway
  rejects without it). Fix the underlying state and re-test.

- **Row with status='delivered'** → Pulse received it. Proceed to step 3.

**STEP 3 — if delivered, find why the smoke script's poll missed it.**

Run against the Pulse Supabase project (`ucaeuszgoihoyrvhewxk`):

```sql
SELECT created_at, source, event_type, status, error_message
FROM ecosystem_events
WHERE direction = 'inbound'
  AND created_at > now() - interval '10 minutes'
ORDER BY created_at DESC LIMIT 10;
```

- If a row exists with `event_type='agent.action_completed'` and
  `source='entomate'` → the smoke script's poll should have found it.
  Check the timestamp vs. the `Will poll Pulse for events created >= ...`
  line in the script output for clock-skew issues. May need to widen the
  test poll's `since` window.
- If row exists but `source` is something other than `'entomate'` (e.g.
  `'entomate-backend'`, `'entomate.local'`) — the script's filter at
  `backend/scripts/verify-agent-pulse-emit.js` line ~73 is too strict.
  Patch the filter to match.
- If no row at all but Entomate logged `delivered` — Pulse's inbound
  function accepted the request but the row insert is failing silently.
  Check the Pulse edge function logs in the Supabase dashboard.

## After it works

Once the smoke test passes (exit 0 with "PASS — event arrived in Pulse
in Xms"):

1. Make sure `ECOSYSTEM_PULSE_WORKSPACE_ID` lives somewhere persistent
   (Entomate `.env`, Render/Railway/Vercel env config, etc) — not just
   in a one-shot shell.
2. Consider running the same verification against `automation.triggered`
   (sibling change in `b615b0b`). The user offered to write a parallel
   smoke script for that and accepted; this is the next item to ship.
3. The wider session list to potentially pick up:
   - `meeting.action_items_extracted` Entomate→Pulse sender (Pulse handler
     exists, no Entomate emitter — last open §5.2 gap)
   - LV column-unification work currently in `stash@{0}` over on
     `f:\logos-vision-crm` — separate workstation transfer; see
     `F:\logos-vision-crm\.claude\prompts\apply-ecosystem-bridge-63.md`

## What NOT to do

- Don't touch Logos Vision (LV is primary on the user's other workstation;
  out of bounds here).
- Don't add more emit hooks until this one is proven working end-to-end.
- Don't propose a "rewrite the bridge" type fix — the bridge works, it's
  almost certainly a config/env issue.
- Avoid emojis in code/output unless the user asks.

## Useful pointers

- Notify hook source: `f:\entomate\backend\routes\agents.js` —
  `notifyPulseAgentCompleted()` near top of file
- Bridge source: `f:\entomate\backend\services\ecosystemBridge.js` —
  `sendEvent()` and `isConnected()`
- Pulse handler: `f:\pulse1\supabase\functions\ecosystem-inbound\index.ts`
  — `handleAgentAction()` (case `'agent.action_completed'`)
- Smoke script: `f:\entomate\backend\scripts\verify-agent-pulse-emit.js`

Don't ask the user to re-run anything before showing them STEP 1's
one-liner. Get them to "what's the value of that env var" first; let
their answer drive the rest.
