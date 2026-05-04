#!/usr/bin/env node
/**
 * Smoke test — Entomate /api/meetings/transcript triggers the AI pipeline
 * which extracts action items, saves them, and emits
 * meeting.action_items_extracted to Pulse via the ecosystem bridge.
 *
 * Sibling of verify-agent-pulse-emit.js. The flow is heavier because it
 * exercises the real meeting pipeline:
 *   1. POST /api/meetings/transcript with a small, action-item-rich
 *      transcript. The route runs AI summary + extraction, saves the
 *      meeting + items, then schedules firePostProcessing.
 *   2. firePostProcessing fires `meeting.action_items_extracted` to Pulse
 *      (only when ECOSYSTEM_PULSE_WORKSPACE_ID is set and at least one
 *      item was extracted).
 *   3. Poll Pulse's ecosystem_events for the inbound row.
 *
 * Required env (same as verify-agent-pulse-emit.js)
 *   ENTOMATE_API_URL              e.g. http://localhost:3000
 *   ENTOMATE_TEST_JWT             A user-scoped JWT for the Entomate API
 *   PULSE_SUPABASE_URL            https://ucaeuszgoihoyrvhewxk.supabase.co
 *   PULSE_SUPABASE_SERVICE_KEY    Pulse's service-role key (read-only enough)
 *
 * Optional env
 *   POLL_TIMEOUT_MS               Default 45000 (45s). The AI pipeline can
 *                                 take 5-15s before firePostProcessing fires,
 *                                 so the default is wider than the agent smoke.
 *
 * NOTE: Each run leaves a test meeting row in Entomate's `meetings` table
 * (titled `[smoke] action-items <iso-date>`). The smoke script does not
 * clean up — delete the row manually if it bothers you.
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
    console.error(`[verify-action-items-pulse-emit] missing env var: ${name}`);
    process.exit(2);
  }
}

const ENTOMATE_API_URL    = process.env.ENTOMATE_API_URL.replace(/\/+$/, '');
const ENTOMATE_TEST_JWT   = process.env.ENTOMATE_TEST_JWT;
const PULSE_URL           = process.env.PULSE_SUPABASE_URL.replace(/\/+$/, '');
const PULSE_SERVICE_KEY   = process.env.PULSE_SUPABASE_SERVICE_KEY;
const POLL_TIMEOUT_MS     = parseInt(process.env.POLL_TIMEOUT_MS, 10) || 45000;
const POLL_INTERVAL_MS    = 1500;

// A short transcript engineered to yield 2-3 clear action items across
// AI providers (OpenAI, Gemini). Owners + due dates are explicit so the
// extractor doesn't have to infer.
const TEST_TRANSCRIPT = [
  'Alice: Quick sync on Q1 deliverables.',
  'Alice: Bob, can you update the customer tracker spreadsheet by Friday?',
  'Bob: Yes, I will have it done by end of week.',
  'Alice: Carol, please draft the client proposal for the Acme account by next Wednesday — high priority since their renewal is coming up.',
  'Carol: Got it, first draft ready by Tuesday.',
  'Alice: Great. I will send out the meeting notes to everyone after this call.',
].join('\n');

async function postEntomateTranscript(title) {
  const url = `${ENTOMATE_API_URL}/api/meetings/transcript`;
  const start = Date.now();
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ENTOMATE_TEST_JWT}`,
    },
    body: JSON.stringify({
      title,
      transcript: TEST_TRANSCRIPT,
      attendees: ['Alice', 'Bob', 'Carol'],
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
    + `&event_type=eq.meeting.action_items_extracted`
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
  const title = `[smoke] action-items ${new Date().toISOString()}`;
  console.log(`[verify-action-items-pulse-emit] POST /api/meetings/transcript on ${ENTOMATE_API_URL}`);
  console.log(`[verify-action-items-pulse-emit] Title: "${title}"`);
  console.log(`[verify-action-items-pulse-emit] Will poll Pulse for events created >= ${sinceIso}`);

  let postResult;
  try {
    postResult = await postEntomateTranscript(title);
  } catch (err) {
    console.error(`[verify-action-items-pulse-emit] FAIL — POST HTTP error: ${err.message}`);
    process.exit(1);
  }

  if (!postResult.ok) {
    console.error(`[verify-action-items-pulse-emit] FAIL — POST returned HTTP ${postResult.status}`);
    console.error(`  body: ${JSON.stringify(postResult.body).slice(0, 500)}`);
    process.exit(1);
  }

  const meeting = postResult.body?.meeting || postResult.body?.data?.meeting || postResult.body;
  const actionItems = postResult.body?.actionItems
    || postResult.body?.data?.actionItems
    || meeting?.actionItems
    || [];
  console.log(`[verify-action-items-pulse-emit] POST OK in ${postResult.elapsedMs}ms — meeting=${meeting?.id || '?'} actionItems=${actionItems.length}`);

  if (actionItems.length === 0) {
    console.error(
      `[verify-action-items-pulse-emit] FAIL — AI extracted 0 action items.\n`
      + `  The emit hook only fires when there's at least one item, so no Pulse\n`
      + `  event is expected. Check the meeting row in Entomate's DB to see what\n`
      + `  the AI actually returned, or tweak TEST_TRANSCRIPT in this script.`
    );
    process.exit(1);
  }

  console.log(`[verify-action-items-pulse-emit] Polling Pulse ecosystem_events (timeout=${POLL_TIMEOUT_MS}ms)...`);
  const pollStart = Date.now();
  const pollResult = await pollPulseForEvent(sinceIso);
  const pollElapsed = Date.now() - pollStart;

  if (pollResult.found) {
    console.log(`[verify-action-items-pulse-emit] PASS — event arrived in Pulse in ${pollElapsed}ms`);
    console.log(`  matched ${pollResult.rows.length} row(s):`);
    for (const row of pollResult.rows) {
      console.log(`    ${row.created_at}  ${row.event_type}  status=${row.status}`);
    }
    process.exit(0);
  }

  console.error(`[verify-action-items-pulse-emit] FAIL — no Pulse event after ${pollElapsed}ms`);
  if (pollResult.lastErr) console.error(`  last poll error: ${pollResult.lastErr}`);
  console.error(`  Things to check:`);
  console.error(`    - ECOSYSTEM_PULSE_WORKSPACE_ID is set in Entomate env (else emit no-ops)`);
  console.error(`    - Bridge config row for 'pulse' is enabled with a valid api_url + service_token`);
  console.error(`    - features.gateway_key is set on the Pulse ecosystem_config row`);
  console.error(`    - Pulse ecosystem-inbound function is deployed and accepting`);
  console.error(`    - The transcript actually yielded action items (POST log above shows count)`);
  process.exit(1);
}

main().catch(err => {
  console.error(`[verify-action-items-pulse-emit] unexpected error: ${err.stack || err.message}`);
  process.exit(1);
});
