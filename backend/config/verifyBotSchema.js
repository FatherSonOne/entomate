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
  'ended_at',
  // P1.7 Slice 1 — organizer-side consent gate. Migration:
  // supabase/migrations/20260426000001_bot_consent_columns.sql
  'consent_acknowledged_at',
  'consent_acknowledged_by'
];

// P1.7 Slice 2 — pre-meeting opt-out email. Migration:
// supabase/migrations/20260427000001_bot_session_attendees.sql
const REQUIRED_BOT_SESSION_ATTENDEES_COLUMNS = [
  'id',
  'session_id',
  'org_id',
  'email',
  'opt_out_token_hash',
  'email_status',
  'opted_out_at',
  'created_at'
];

async function probeTable(table, columns) {
  const { error } = await supabaseAdmin
    .from(table)
    .select(columns.join(', '))
    .limit(0);
  return error || null;
}

async function verifyBotSchema({ exitOnFailure } = {}) {
  if (!supabaseAdmin) {
    log.warn('[BOT_SCHEMA] supabaseAdmin not configured — skipping schema check');
    return false;
  }

  const checks = [
    { table: 'bot_sessions', columns: REQUIRED_BOT_SESSION_COLUMNS },
    { table: 'bot_session_attendees', columns: REQUIRED_BOT_SESSION_ATTENDEES_COLUMNS }
  ];

  const failures = [];
  for (const { table, columns } of checks) {
    const err = await probeTable(table, columns);
    if (err) failures.push({ table, error: err });
  }

  if (failures.length === 0) {
    log.info('[BOT_SCHEMA] bot tables schema OK', {
      tables: checks.length,
      bot_sessions_columns: REQUIRED_BOT_SESSION_COLUMNS.length,
      bot_session_attendees_columns: REQUIRED_BOT_SESSION_ATTENDEES_COLUMNS.length
    });
    return true;
  }

  const isProd = process.env.NODE_ENV === 'production';
  const shouldExit = exitOnFailure !== undefined ? exitOnFailure : isProd;

  for (const f of failures) {
    log.error(`[BOT_SCHEMA] ${f.table} schema check failed — likely missing migration`, {
      error: f.error.message,
      code: f.error.code,
      hint: 'Apply pending bot migrations (20260425000001_bot_sessions_recall.sql, 20260426000001_bot_consent_columns.sql, 20260427000001_bot_session_attendees.sql) to this database.',
      fatal: shouldExit
    });
  }

  if (shouldExit) {
    process.exit(1);
  }
  return false;
}

module.exports = {
  verifyBotSchema,
  REQUIRED_BOT_SESSION_COLUMNS,
  REQUIRED_BOT_SESSION_ATTENDEES_COLUMNS
};
