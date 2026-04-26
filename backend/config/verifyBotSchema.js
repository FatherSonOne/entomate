/**
 * Boot-time schema check for the Recall-managed bot path.
 *
 * Reads zero rows from `bot_sessions` while projecting every column the
 * orchestrator + webhook handler need to write. PostgREST surfaces a missing
 * column as an error on the request, which lets us fail the deploy loud
 * instead of silently swallowing the failure inside botOrchestrator's
 * post-launch UPDATE (see botOrchestrator.js post-launch comment).
 *
 * In production a missing column is fatal — process exits with code 1 so
 * Render's deploy fails visibly. In dev we log loud and return false so
 * fresh checkouts can boot before migrations are applied locally.
 */

'use strict';

const { supabaseAdmin } = require('./supabase');
const log = require('../utils/log');

const REQUIRED_BOT_SESSION_COLUMNS = [
  'id',
  'org_id',
  'meeting_id',
  'platform',
  'status',
  'recall_bot_id',
  'recording_url',
  'transcript_url',
  'failure_reason',
  'started_at',
  'ended_at'
];

async function verifyBotSchema({ exitOnFailure } = {}) {
  if (!supabaseAdmin) {
    log.warn('[BOT_SCHEMA] supabaseAdmin not configured — skipping schema check');
    return false;
  }

  const projection = REQUIRED_BOT_SESSION_COLUMNS.join(', ');
  const { error } = await supabaseAdmin
    .from('bot_sessions')
    .select(projection)
    .limit(0);

  if (!error) {
    log.info('[BOT_SCHEMA] bot_sessions schema OK', {
      columns: REQUIRED_BOT_SESSION_COLUMNS.length
    });
    return true;
  }

  const isProd = process.env.NODE_ENV === 'production';
  const shouldExit = exitOnFailure !== undefined ? exitOnFailure : isProd;

  log.error('[BOT_SCHEMA] bot_sessions schema check failed — likely missing migration', {
    error: error.message,
    code: error.code,
    hint: 'Apply supabase/migrations/20260425000001_bot_sessions_recall.sql to this database.',
    fatal: shouldExit
  });

  if (shouldExit) {
    process.exit(1);
  }
  return false;
}

module.exports = { verifyBotSchema, REQUIRED_BOT_SESSION_COLUMNS };
