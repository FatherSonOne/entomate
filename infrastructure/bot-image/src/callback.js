/**
 * Bot → orchestrator status callback. POSTs JSON to the URL injected at
 * Machine launch, with the bearer token also injected at launch. Failures
 * are logged but never thrown — the orchestrator's reconciliation loop is
 * what catches truly stuck sessions (P1.3).
 */

'use strict';

const { slog } = require('./log');

async function reportStatus(config, status, extra = {}) {
  if (!config.callbackUrl || !config.callbackToken) return;
  try {
    const res = await fetch(config.callbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.callbackToken}`
      },
      body: JSON.stringify({
        session_id: config.sessionId,
        status,
        ts: new Date().toISOString(),
        ...extra
      })
    });
    if (!res.ok) {
      slog('warn', 'callback_non_2xx', { status, http: res.status });
    }
  } catch (err) {
    slog('warn', 'callback_failed', { status, error: err.message });
  }
}

module.exports = { reportStatus };
