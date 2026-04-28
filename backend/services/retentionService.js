/**
 * Retention Service — daily sweep of expired Recall-hosted bot media
 * (P1.7 Slice 3, issue #7 acceptance criterion #3).
 *
 * Flow:
 *   1. Read each workspace's retention_days from
 *      workspace_settings.data_controls_json.retention_days (default 90,
 *      allowed values {30, 90, 365}).
 *   2. Find bot_sessions older than retention_days that still have
 *      recording_url or transcript_url and have not been swept.
 *   3. For each row, call Recall's DELETE /bot/<id> to nuke the hosted
 *      media, then NULL the URL columns and stamp retention_deleted_at.
 *   4. The row itself stays for audit trail.
 *
 * Triggered daily by retentionScheduler.js. Can also be invoked manually
 * for an out-of-band sweep — exported for that purpose.
 */

'use strict';

const { supabaseAdmin } = require('../config/supabase');
const log = require('../utils/log');
const orchestrator = require('./botOrchestrator');

const ALLOWED_RETENTION_DAYS = [30, 90, 365];
const DEFAULT_RETENTION_DAYS = 90;
// Cap how many rows a single sweep will touch. A misconfigured retention
// cliff (e.g. someone drops to 30 days on a multi-month-old workspace)
// would otherwise melt the Recall API. Roll over remaining rows to the
// next day's sweep.
const MAX_ROWS_PER_SWEEP = 200;

const db = () => {
  if (!supabaseAdmin) throw new Error('SUPABASE_SERVICE_KEY is not set');
  return supabaseAdmin;
};

/**
 * Resolve the retention threshold for a workspace. Reads
 * workspace_settings.data_controls_json.retention_days; falls back to
 * the default for missing/invalid values.
 */
async function getRetentionDays(workspaceId) {
  if (!workspaceId) return DEFAULT_RETENTION_DAYS;
  try {
    const { data } = await db()
      .from('workspace_settings')
      .select('data_controls_json')
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    const raw = data?.data_controls_json?.retention_days;
    const n = Number(raw);
    if (Number.isFinite(n) && ALLOWED_RETENTION_DAYS.includes(n)) return n;
    return DEFAULT_RETENTION_DAYS;
  } catch (err) {
    log.warn('getRetentionDays lookup failed; using default', {
      workspaceId, error: err.message
    });
    return DEFAULT_RETENTION_DAYS;
  }
}

/**
 * Delete a bot's hosted media at Recall. Returns {ok, alreadyGone}.
 * Throws on unexpected errors so the caller can record retention_delete_error.
 *
 * Recall's DELETE /bot/<id> endpoint deletes both the bot record and its
 * recordings/transcripts. 404 means the bot is already gone — treat as
 * success and continue with the local update.
 */
async function deleteRecallMedia(recallBotId) {
  if (!recallBotId) return { ok: true, alreadyGone: true };
  try {
    await orchestrator._internal.recallFetch(`/bot/${recallBotId}`, {
      method: 'DELETE'
    });
    return { ok: true, alreadyGone: false };
  } catch (err) {
    if (/\b404\b/.test(err.message)) {
      return { ok: true, alreadyGone: true };
    }
    throw err;
  }
}

/**
 * Per-workspace retention pass. Returns the count of rows visited and
 * outcomes. Errors on individual rows are logged but don't abort the
 * sweep.
 */
async function sweepWorkspace(workspaceId, retentionDays) {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: rows, error } = await db()
    .from('bot_sessions')
    .select('id, recall_bot_id, created_at, recording_url, transcript_url')
    .eq('org_id', workspaceId)
    .is('retention_deleted_at', null)
    .lt('created_at', cutoff)
    .or('recording_url.not.is.null,transcript_url.not.is.null')
    .order('created_at', { ascending: true })
    .limit(MAX_ROWS_PER_SWEEP);

  if (error) {
    log.error('Retention sweep query failed', { workspaceId, error: error.message });
    return { workspaceId, retentionDays, visited: 0, deleted: 0, failed: 0, error: error.message };
  }

  let deleted = 0;
  let failed = 0;

  for (const row of rows || []) {
    try {
      const result = await deleteRecallMedia(row.recall_bot_id);
      const { error: updErr } = await db()
        .from('bot_sessions')
        .update({
          recording_url: null,
          transcript_url: null,
          retention_deleted_at: new Date().toISOString(),
          retention_delete_error: null
        })
        .eq('id', row.id);
      if (updErr) throw new Error(`bot_sessions update failed: ${updErr.message}`);
      deleted += 1;
      if (!result.alreadyGone) {
        log.info('[Retention] Deleted Recall media', {
          sessionId: row.id, recallBotId: row.recall_bot_id, ageDays: Math.round((Date.now() - new Date(row.created_at).getTime()) / 86400000)
        });
      }
    } catch (err) {
      failed += 1;
      log.warn('[Retention] Sweep row failed; will retry next sweep', {
        sessionId: row.id, recallBotId: row.recall_bot_id, error: err.message
      });
      await db()
        .from('bot_sessions')
        .update({
          retention_delete_error: String(err.message || err).slice(0, 500)
        })
        .eq('id', row.id);
    }
  }

  return { workspaceId, retentionDays, visited: rows?.length || 0, deleted, failed };
}

/**
 * Top-level sweep — iterates all workspaces with bot_sessions and
 * applies their retention setting. Safe to invoke manually.
 *
 * Returns a per-workspace breakdown. Logs a single summary line at the
 * end so the cron output stays grep-friendly.
 */
async function runRetentionSweep() {
  const startedAt = Date.now();
  log.info('[Retention] Starting sweep');

  // Distinct workspace ids that have any bot_sessions. We could iterate
  // tenant_organizations, but most orgs have no bots so we'd waste calls.
  const { data: workspaces, error: wsErr } = await db()
    .from('bot_sessions')
    .select('org_id', { count: 'exact', head: false })
    .is('retention_deleted_at', null);

  if (wsErr) {
    log.error('[Retention] Workspace enumeration failed', { error: wsErr.message });
    return { error: wsErr.message };
  }

  const distinct = Array.from(new Set((workspaces || []).map((r) => r.org_id))).filter(Boolean);
  const results = [];
  for (const workspaceId of distinct) {
    const days = await getRetentionDays(workspaceId);
    const result = await sweepWorkspace(workspaceId, days);
    results.push(result);
  }

  const totals = results.reduce(
    (acc, r) => ({
      visited: acc.visited + (r.visited || 0),
      deleted: acc.deleted + (r.deleted || 0),
      failed: acc.failed + (r.failed || 0)
    }),
    { visited: 0, deleted: 0, failed: 0 }
  );

  log.info('[Retention] Sweep complete', {
    workspaces: distinct.length,
    durationMs: Date.now() - startedAt,
    ...totals
  });

  return { startedAt: new Date(startedAt).toISOString(), workspaces: distinct.length, totals, perWorkspace: results };
}

module.exports = {
  runRetentionSweep,
  sweepWorkspace,
  getRetentionDays,
  deleteRecallMedia,
  ALLOWED_RETENTION_DAYS,
  DEFAULT_RETENTION_DAYS
};
