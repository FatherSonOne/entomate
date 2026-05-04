#!/usr/bin/env node
/**
 * Smoke test — Entomate /api/agents/trigger emits agent.action_completed
 * to Pulse via the ecosystem bridge.
 *
 * What it does
 *   1. POSTs to Entomate's /api/agents/trigger with a dummy trigger_type.
 *   2. Polls Pulse's ecosystem_events table for an inbound row of type
 *      'agent.action_completed' from source='entomate' created after the
 *      pre-trigger timestamp.
 *   3. Reports pass/fail with timing.
 *
 * Required env
 *   ENTOMATE_API_URL              e.g. http://localhost:3001  (no trailing slash)
 *   ENTOMATE_TEST_JWT             A user-scoped JWT for the Entomate API.
 *                                 Run `npm run --prefix backend test:get-jwt`
 *                                 or grab one from your browser's auth header.
 *   PULSE_SUPABASE_URL            https://ucaeuszgoihoyrvhewxk.supabase.co
 *   PULSE_SUPABASE_SERVICE_KEY    Pulse's service-role key (read-only is enough)
 *
 * Optional env
 *   POLL_TIMEOUT_MS               Default 15000 (15s). Cross-app delivery is
 *                                 normally < 2s, so this is generous.
 *   TRIGGER_TYPE                  Default 'manual_test'. Use a trigger_type
 *                                 you know matches at least one enabled agent
 *                                 in your env, otherwise result.executed=0
 *                                 and the emit will skip.
 *
 * Exit codes
 *   0 = pass — event landed on Pulse within the timeout
 *   1 = fail — request error, no event, or executed=0 (no agent matched)
 *   2 = config error — missing env vars
 */

/* eslint-disable no-console */

const REQUIRED_ENV = [
  'ENTOMATE_API_URL',
  'ENTOMATE_TEST_JWT',
  'PULSE_SUPABASE_URL',
  'PULSE_SUPABASE_SERVICE_KEY',
];

for (const name of REQUIRED_ENV) {
  if (!process.env[name]) {
    console.error(`[verify-agent-pulse-emit] missing env var: ${name}`);
    process.exit(2);
  }
}

const ENTOMATE_API_URL    = process.env.ENTOMATE_API_URL.replace(/\/+$/, '');
const ENTOMATE_TEST_JWT   = process.env.ENTOMATE_TEST_JWT;
const PULSE_URL           = process.env.PULSE_SUPABASE_URL.replace(/\/+$/, '');
const PULSE_SERVICE_KEY   = process.env.PULSE_SUPABASE_SERVICE_KEY;
const POLL_TIMEOUT_MS     = parseInt(process.env.POLL_TIMEOUT_MS, 10) || 15000;
const TRIGGER_TYPE        = process.env.TRIGGER_TYPE || 'manual_test';
const POLL_INTERVAL_MS    = 1000;

async function postEntomateTrigger() {
  const url = `${ENTOMATE_API_URL}/api/agents/trigger`;
  const start = Date.now();
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ENTOMATE_TEST_JWT}`,
    },
    body: JSON.stringify({
      trigger_type: TRIGGER_TYPE,
      data: { _smoke_test: true, _started_at: new Date().toISOString() },
    }),
  });
  const elapsedMs = Date.now() - start;
  const body = await resp.json().catch(() => ({}));
  return { status: resp.status, ok: resp.ok, body, elapsedMs };
}

async function pollPulseForEvent(sinceIso) {
  const queryUrl = `${PULSE_URL}/rest/v1/ecosystem_events`
    + `?select=id,event_type,source,created_at,status`
    + `&direction=eq.inbound`
    + `&source=eq.entomate`
    + `&event_type=eq.agent.action_completed`
    + `&created_at=gte.${encodeURIComponent(sinceIso)}`
    + `&order=created_at.desc`
    + `&limit=5`;

  const headers = {
    'apikey': PULSE_SERVICE_KEY,
    'Authorization': `Bearer ${PULSE_SERVICE_KEY}`,
  };

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let lastErr = null;

  while (Date.now() < deadline) {
    try {
      const resp = await fetch(queryUrl, { headers });
      if (!resp.ok) {
        lastErr = `Pulse query HTTP ${resp.status}: ${await resp.text().catch(() => '')}`;
      } else {
        const rows = await resp.json();
        if (Array.isArray(rows) && rows.length > 0) {
          return { found: true, rows };
        }
      }
    } catch (err) {
      lastErr = err.message;
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }

  return { found: false, lastErr };
}

async function main() {
  const sinceIso = new Date().toISOString();
  console.log(`[verify-agent-pulse-emit] Triggering ${TRIGGER_TYPE} on ${ENTOMATE_API_URL}`);
  console.log(`[verify-agent-pulse-emit] Will poll Pulse for events created >= ${sinceIso}`);

  let triggerResult;
  try {
    triggerResult = await postEntomateTrigger();
  } catch (err) {
    console.error(`[verify-agent-pulse-emit] FAIL — trigger HTTP error: ${err.message}`);
    process.exit(1);
  }

  if (!triggerResult.ok) {
    console.error(`[verify-agent-pulse-emit] FAIL — trigger returned HTTP ${triggerResult.status}`);
    console.error(`  body: ${JSON.stringify(triggerResult.body)}`);
    process.exit(1);
  }

  const executed = triggerResult.body?.data?.executed || 0;
  console.log(`[verify-agent-pulse-emit] Trigger OK in ${triggerResult.elapsedMs}ms — executed=${executed}`);

  if (executed === 0) {
    console.error(
      `[verify-agent-pulse-emit] FAIL — 0 agents matched trigger_type='${TRIGGER_TYPE}'.\n`
      + `  The emit hook only fires when result.executed > 0, so no Pulse event\n`
      + `  is expected. Set TRIGGER_TYPE to a trigger_type that has at least one\n`
      + `  enabled agent in this environment, then re-run.`
    );
    process.exit(1);
  }

  console.log(`[verify-agent-pulse-emit] Polling Pulse ecosystem_events (timeout=${POLL_TIMEOUT_MS}ms)...`);
  const pollStart = Date.now();
  const pollResult = await pollPulseForEvent(sinceIso);
  const pollElapsed = Date.now() - pollStart;

  if (pollResult.found) {
    console.log(`[verify-agent-pulse-emit] PASS — event arrived in Pulse in ${pollElapsed}ms`);
    console.log(`  matched ${pollResult.rows.length} row(s):`);
    for (const row of pollResult.rows) {
      console.log(`    ${row.created_at}  ${row.event_type}  status=${row.status}`);
    }
    process.exit(0);
  }

  console.error(`[verify-agent-pulse-emit] FAIL — no Pulse event after ${pollElapsed}ms`);
  if (pollResult.lastErr) console.error(`  last poll error: ${pollResult.lastErr}`);
  console.error(`  Things to check:`);
  console.error(`    - ECOSYSTEM_PULSE_WORKSPACE_ID is set in Entomate env (else emit no-ops)`);
  console.error(`    - ecosystem_config row for 'pulse' is enabled with a valid api_url + service_token`);
  console.error(`    - features.gateway_key is set on the Pulse ecosystem_config row`);
  console.error(`    - Pulse ecosystem-inbound function is deployed and accepting`);
  process.exit(1);
}

main().catch(err => {
  console.error(`[verify-agent-pulse-emit] unexpected error: ${err.stack || err.message}`);
  process.exit(1);
});
