/**
 * Retention Scheduler — fires runRetentionSweep() once a day at 03:00 UTC.
 *
 * In-process timer. Render's free tier may put the service to sleep on
 * idle; if that happens, the next request wakes it and the scheduler
 * re-arms based on the new wall-clock time. So a "missed" 03:00 firing
 * just rolls into the next day's slot. Acceptable for retention work
 * which has multi-day tolerance anyway.
 *
 * If a more reliable trigger is ever needed (e.g. for SLA work), point
 * an external cron service at GET /health and add an admin endpoint that
 * runs the sweep on demand.
 */

'use strict';

const log = require('../utils/log');
const { runRetentionSweep } = require('./retentionService');

const RUN_HOUR_UTC = 3; // 03:00 UTC daily
const RUN_MINUTE_UTC = 0;

let scheduledTimeout = null;

function msUntilNextRun() {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(RUN_HOUR_UTC, RUN_MINUTE_UTC, 0, 0);
  if (next.getTime() <= now.getTime()) {
    // Already past today's slot — schedule tomorrow.
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next.getTime() - now.getTime();
}

async function fireAndReschedule() {
  try {
    await runRetentionSweep();
  } catch (err) {
    log.error('[Retention] Scheduler fire failed', { error: err.message });
  } finally {
    schedule();
  }
}

function schedule() {
  if (scheduledTimeout) clearTimeout(scheduledTimeout);
  const delay = msUntilNextRun();
  scheduledTimeout = setTimeout(fireAndReschedule, delay);
  // Hours + minutes only — log noise control.
  const hrs = Math.floor(delay / 3600000);
  const mins = Math.floor((delay % 3600000) / 60000);
  log.info('[Retention] Next sweep scheduled', { in: `${hrs}h${mins}m`, at: new Date(Date.now() + delay).toISOString() });
}

function initialize() {
  if (scheduledTimeout) {
    log.warn('[Retention] Scheduler already initialized; ignoring duplicate init');
    return;
  }
  schedule();
}

function stop() {
  if (scheduledTimeout) {
    clearTimeout(scheduledTimeout);
    scheduledTimeout = null;
  }
}

module.exports = { initialize, stop, _internal: { msUntilNextRun, fireAndReschedule, schedule } };
