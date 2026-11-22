/**
 * Runs left in "running" forever (surface audit 2026-11-22: 3 of 13 prod runs).
 * A run lives in one server process; when Render sleeps or restarts mid-run,
 * nothing ever writes its end. Before listing runs, mark any that have been
 * running longer than STALE_AFTER_MS as failed with a reason a person can read.
 */

'use strict';

const log = require('../../utils/log');

const STALE_AFTER_MS = 30 * 60 * 1000;
const TIMEOUT_MESSAGE = 'Timed out: no result after 30 minutes. The server may have restarted during the run; run it again.';

/** Pure: is this run stuck? */
function isStale(run, now = Date.now()) {
  if (!run || run.status !== 'running' || !run.started_at) return false;
  return now - Date.parse(run.started_at) > STALE_AFTER_MS;
}

/**
 * @param {object} db supabase client
 * @param {string[]} workflowIds only these workflows (the caller's org)
 * @returns {Promise<number>} how many runs were closed
 */
async function expireStaleRuns(db, workflowIds, now = new Date()) {
  if (!db || !Array.isArray(workflowIds) || workflowIds.length === 0) return 0;
  const cutoff = new Date(now.getTime() - STALE_AFTER_MS).toISOString();
  try {
    const { data, error } = await db
      .from('workflow_executions')
      .update({ status: 'failed', finished_at: now.toISOString(), error_message: TIMEOUT_MESSAGE })
      .eq('status', 'running')
      .lt('started_at', cutoff)
      .in('workflow_id', workflowIds)
      .select('id');
    if (error) throw error;
    if (data?.length) log.info('[Workflows] closed stale runs', { count: data.length });
    return data?.length || 0;
  } catch (err) {
    log.warn('[Workflows] could not close stale runs', { error: err.message || err });
    return 0;
  }
}

module.exports = { expireStaleRuns, isStale, STALE_AFTER_MS, TIMEOUT_MESSAGE };
