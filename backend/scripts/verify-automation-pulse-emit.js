#!/usr/bin/env node
/**
 * Smoke test — Entomate /api/automations/trigger emits automation.triggered
 * to Pulse via the ecosystem bridge.
 *
 * Sibling of verify-agent-pulse-emit.js. Differences:
 *   - Endpoint:  POST /api/automations/trigger  (vs /api/agents/trigger)
 *   - Auth:      x-api-key + INTERNAL_API_KEY   (vs Bearer JWT)
 *   - Body:      { triggerType, triggerData }   (camelCase, vs snake_case)
 *   - Response:  { triggered, results }         (vs data.executed)
 *   - Pulse:     event_type=automation.triggered
 *
 * Required env
 *   ENTOMATE_API_URL              e.g. http://localhost:3000
 *   ENTOMATE_INTERNAL_API_KEY     Matches process.env.INTERNAL_API_KEY in backend
 *   PULSE_SUPABASE_URL            https://ucaeuszgoihoyrvhewxk.supabase.co
 *   PULSE_SUPABASE_SERVICE_KEY    Pulse's service-role key (read-only is enough)
 *
 * Optional env
 *   POLL_TIMEOUT_MS               Default 15000 (15s)
 *   TRIGGER_TYPE                  Default 'manual_test'. Must match the
 *                                 trigger_type of at least one enabled
 *                                 automation in this environment.
 */

/* eslint-disable no-console */

const REQUIRED_ENV = [
  'ENTOMATE_API_URL',
  'ENTOMATE_INTERNAL_API_KEY',
  'PULSE_SUPABASE_URL',
  'PULSE_SUPABASE_SERVICE_KEY',
];

for (const name of REQUIRED_ENV) {
  if (!process.env[name]) {
    console.error(`[verify-automation-pulse-emit] missing env var: ${name}`);
    process.exit(2);
  }
}

const ENTOMATE_API_URL    = process.env.ENTOMATE_API_URL.replace(/\/+$/, '');
const INTERNAL_API_KEY    = process.env.ENTOMATE_INTERNAL_API_KEY;
const PULSE_URL           = process.env.PULSE_SUPABASE_URL.replace(/\/+$/, '');
const PULSE_SERVICE_KEY   = process.env.PULSE_SUPABASE_SERVICE_KEY;
const POLL_TIMEOUT_MS     = parseInt(process.env.POLL_TIMEOUT_MS, 10) || 15000;
const TRIGGER_TYPE        = process.env.TRIGGER_TYPE || 'manual_test';
const POLL_INTERVAL_MS    = 1000;

async function postEntomateTrigger() {
  const url = `${ENTOMATE_API_URL}/api/automations/trigger`;
  const start = Date.now();
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': INTERNAL_API_KEY,
    },
    body: JSON.stringify({
      triggerType: TRIGGER_TYPE,
      triggerData: { _smoke_test: true, _started_at: new Date().toISOString() },
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
    + `&event_type=eq.automation.triggered`
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
  // 5s buffer for clock skew between this machine and Pulse's Postgres clock.
  const sinceIso = new Date(Date.now() - 5000).toISOString();
  console.log(`[verify-automation-pulse-emit] Triggering ${TRIGGER_TYPE} on ${ENTOMATE_API_URL}`);
  console.log(`[verify-automation-pulse-emit] Will poll Pulse for events created >= ${sinceIso}`);

  let triggerResult;
  try {
    triggerResult = await postEntomateTrigger();
  } catch (err) {
    console.error(`[verify-automation-pulse-emit] FAIL — trigger HTTP error: ${err.message}`);
    process.exit(1);
  }

  if (!triggerResult.ok) {
    console.error(`[verify-automation-pulse-emit] FAIL — trigger returned HTTP ${triggerResult.status}`);
    console.error(`  body: ${JSON.stringify(triggerResult.body)}`);
    process.exit(1);
  }

  const triggered = triggerResult.body?.triggered || 0;
  console.log(`[verify-automation-pulse-emit] Trigger OK in ${triggerResult.elapsedMs}ms — triggered=${triggered}`);

  if (triggered === 0) {
    console.error(
      `[verify-automation-pulse-emit] FAIL — 0 automations matched triggerType='${TRIGGER_TYPE}'.\n`
      + `  The emit hook only fires when an automation actually runs, so no Pulse\n`
      + `  event is expected. Set TRIGGER_TYPE to a trigger_type that has at least\n`
      + `  one enabled automation in this environment, then re-run.`
    );
    process.exit(1);
  }

  console.log(`[verify-automation-pulse-emit] Polling Pulse ecosystem_events (timeout=${POLL_TIMEOUT_MS}ms)...`);
  const pollStart = Date.now();
  const pollResult = await pollPulseForEvent(sinceIso);
  const pollElapsed = Date.now() - pollStart;

  if (pollResult.found) {
    console.log(`[verify-automation-pulse-emit] PASS — event arrived in Pulse in ${pollElapsed}ms`);
    console.log(`  matched ${pollResult.rows.length} row(s):`);
    for (const row of pollResult.rows) {
      console.log(`    ${row.created_at}  ${row.event_type}  status=${row.status}`);
    }
    process.exit(0);
  }

  console.error(`[verify-automation-pulse-emit] FAIL — no Pulse event after ${pollElapsed}ms`);
  if (pollResult.lastErr) console.error(`  last poll error: ${pollResult.lastErr}`);
  console.error(`  Things to check:`);
  console.error(`    - ECOSYSTEM_PULSE_WORKSPACE_ID is set in Entomate env (else emit no-ops)`);
  console.error(`    - ecosystem_config row for 'pulse' is enabled with a valid api_url + service_token`);
  console.error(`    - features.gateway_key is set on the Pulse ecosystem_config row`);
  console.error(`    - Pulse ecosystem-inbound function is deployed and accepting`);
  process.exit(1);
}

main().catch(err => {
  console.error(`[verify-automation-pulse-emit] unexpected error: ${err.stack || err.message}`);
  process.exit(1);
});
