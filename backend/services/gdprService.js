/**
 * GDPR Service — right-to-delete (Art. 17) request lifecycle.
 *
 * Notify-only fulfillment: a public POST submits a request, a platform
 * admin gets an email, the admin actions the request via authenticated
 * endpoints in routes/dataDeletion.js. Submitting the request alone
 * does NOT delete anything — fulfillment is a separate, gated step.
 *
 * Why notify-only: an open auto-delete on email-match would let anyone
 * who knows a victim's address bulk-delete their data from any
 * workspace. Manual fulfillment lets the admin sanity-check the request
 * (does this person actually appear in our data? was their consent ever
 * given? is there a reason to deny under GDPR Art. 17(3) — e.g. legal
 * obligation to retain?).
 */

'use strict';

const { supabaseAdmin } = require('../config/supabase');
const log = require('../utils/log');
const consentEmail = require('./consentEmailService');
const orchestrator = require('./botOrchestrator');

const db = () => {
  if (!supabaseAdmin) throw new Error('SUPABASE_SERVICE_KEY is not set');
  return supabaseAdmin;
};

function normalizeEmail(e) {
  if (typeof e !== 'string') return null;
  const trimmed = e.trim().toLowerCase();
  if (!trimmed.includes('@') || !trimmed.includes('.')) return null;
  if (trimmed.length < 5 || trimmed.length > 254) return null;
  return trimmed;
}

/**
 * Public submission. Records the request and notifies platform admins.
 */
async function submitDeletionRequest({ email, reason, ip, userAgent }) {
  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail) return { ok: false, error: 'invalid_email' };

  const { data: row, error } = await db()
    .from('data_deletion_requests')
    .insert({
      email: cleanEmail,
      reason: typeof reason === 'string' ? reason.slice(0, 2000) : null,
      source_ip: ip || null,
      user_agent: userAgent ? String(userAgent).slice(0, 500) : null
    })
    .select()
    .single();

  if (error) {
    log.error('Deletion request insert failed', { error: error.message });
    return { ok: false, error: 'insert_failed' };
  }

  // Notify platform admins. Best-effort — submission still succeeds even
  // if the notification fails. Admins can also poll the pending list.
  try {
    await notifyPlatformAdmins(row);
  } catch (err) {
    log.warn('Platform admin notification failed', { error: err.message });
  }

  return { ok: true, requestId: row.id };
}

async function notifyPlatformAdmins(request) {
  const { data: admins } = await db()
    .from('platform_admins')
    .select('user_id');
  if (!admins?.length) {
    log.warn('No platform admins to notify of deletion request', { requestId: request.id });
    return;
  }

  for (const { user_id } of admins) {
    try {
      const { data: userInfo } = await db().auth.admin.getUserById(user_id);
      const adminEmail = userInfo?.user?.email;
      if (!adminEmail) continue;
      await consentEmail.sendDeletionRequestNotification({
        to: adminEmail,
        requestId: request.id,
        requesterEmail: request.email,
        reason: request.reason
      });
    } catch (err) {
      log.warn('Skipped admin notification', { user_id, error: err.message });
    }
  }
}

/**
 * Admin-side: list pending requests.
 */
async function listPendingRequests() {
  const { data, error } = await db()
    .from('data_deletion_requests')
    .select('id, email, reason, requested_at, source_ip, user_agent, fulfillment_status')
    .eq('fulfillment_status', 'pending')
    .order('requested_at', { ascending: true });
  if (error) throw new Error(`pending list failed: ${error.message}`);
  return data || [];
}

/**
 * Admin-side: fulfill a request. Fans the delete out across:
 *   - bot_session_attendees rows matching the email (cascade-friendly:
 *     delete the row entirely; the parent bot_sessions row stays with
 *     the audit attendees count reduced).
 *   - bot_sessions where the email's attendee was the only attendee
 *     and the session has consent_acknowledged_by matching the email's
 *     auth user (rare; we redact recall media instead of deleting the
 *     whole row to preserve the org's launch audit).
 *
 * Returns the fulfillment summary (counts + any errors).
 */
async function fulfillDeletionRequest(requestId, fulfilledByUserId) {
  const { data: req, error: lookupErr } = await db()
    .from('data_deletion_requests')
    .select('id, email, fulfillment_status')
    .eq('id', requestId)
    .maybeSingle();
  if (lookupErr || !req) return { ok: false, error: 'not_found' };
  if (req.fulfillment_status !== 'pending') {
    return { ok: false, error: `already_${req.fulfillment_status}` };
  }

  const summary = {
    attendees_deleted: 0,
    sessions_redacted: 0,
    recall_media_deleted: 0,
    errors: []
  };

  // 1. Find all attendee rows for this email across all workspaces.
  const { data: attendees, error: attErr } = await db()
    .from('bot_session_attendees')
    .select('id, session_id, email')
    .eq('email', req.email);
  if (attErr) {
    summary.errors.push(`attendee lookup: ${attErr.message}`);
  }

  for (const att of attendees || []) {
    const { error: delErr } = await db()
      .from('bot_session_attendees')
      .delete()
      .eq('id', att.id);
    if (delErr) {
      summary.errors.push(`delete attendee ${att.id}: ${delErr.message}`);
    } else {
      summary.attendees_deleted += 1;
    }
  }

  // 2. Find sessions where this person is the organizer (consent_acknowledged_by
  //    maps to a user with this email). Redact Recall media on those rows.
  // Supabase admin doesn't have a direct email lookup, so we paginate-list
  // and filter. For pre-launch volume this is fine; refactor when user
  // count crosses ~1000.
  let organizerUserId = null;
  try {
    const { data: usersPage } = await db().auth.admin.listUsers({ page: 1, perPage: 200 });
    const matchUser = (usersPage?.users || []).find((u) =>
      (u.email || '').toLowerCase() === req.email
    );
    organizerUserId = matchUser?.id || null;
  } catch (err) {
    summary.errors.push(`auth user lookup: ${err.message}`);
  }

  if (organizerUserId) {
    const { data: sessions, error: sessErr } = await db()
      .from('bot_sessions')
      .select('id, recall_bot_id, recording_url, transcript_url, retention_deleted_at')
      .eq('consent_acknowledged_by', organizerUserId);
    if (sessErr) {
      summary.errors.push(`session lookup: ${sessErr.message}`);
    }

    const { deleteRecallMedia } = require('./retentionService');
    for (const s of sessions || []) {
      if (s.retention_deleted_at) continue; // already swept by retention
      if (!s.recording_url && !s.transcript_url) continue;
      try {
        const result = await deleteRecallMedia(s.recall_bot_id);
        await db()
          .from('bot_sessions')
          .update({
            recording_url: null,
            transcript_url: null,
            retention_deleted_at: new Date().toISOString(),
            retention_delete_error: null
          })
          .eq('id', s.id);
        summary.sessions_redacted += 1;
        if (!result.alreadyGone) summary.recall_media_deleted += 1;
      } catch (err) {
        summary.errors.push(`session ${s.id} redact: ${err.message}`);
      }
    }
  }

  // 3. Mark the request fulfilled.
  await db()
    .from('data_deletion_requests')
    .update({
      fulfillment_status: 'fulfilled',
      fulfilled_at: new Date().toISOString(),
      fulfilled_by: fulfilledByUserId,
      fulfillment_summary: summary
    })
    .eq('id', requestId);

  log.info('[GDPR] Request fulfilled', { requestId, summary });
  return { ok: true, summary };
}

/**
 * Admin-side: deny a request (e.g. no matching data, or legal obligation
 * to retain). Records the denial reason on the request row.
 */
async function denyDeletionRequest(requestId, deniedByUserId, denialReason) {
  const reason = typeof denialReason === 'string' ? denialReason.slice(0, 2000) : null;
  const { data: req, error: lookupErr } = await db()
    .from('data_deletion_requests')
    .select('id, fulfillment_status')
    .eq('id', requestId)
    .maybeSingle();
  if (lookupErr || !req) return { ok: false, error: 'not_found' };
  if (req.fulfillment_status !== 'pending') {
    return { ok: false, error: `already_${req.fulfillment_status}` };
  }

  await db()
    .from('data_deletion_requests')
    .update({
      fulfillment_status: 'denied',
      fulfilled_at: new Date().toISOString(),
      fulfilled_by: deniedByUserId,
      denial_reason: reason
    })
    .eq('id', requestId);

  log.info('[GDPR] Request denied', { requestId, reason });
  return { ok: true };
}

module.exports = {
  submitDeletionRequest,
  listPendingRequests,
  fulfillDeletionRequest,
  denyDeletionRequest,
  _internal: { normalizeEmail, notifyPlatformAdmins }
};
