const { supabase } = require('../config/supabase');
const log = require('./log');

/**
 * Org context resolution (S1c — tenancy enforcement).
 *
 * The backend runs on the service-role key (BYPASSRLS), so it must stamp
 * `org_id` on every INSERT itself — RLS can't infer it (there is no end-user
 * JWT / auth.uid() on a service-role connection). This module is the single
 * source of truth for "which org does this write belong to".
 *
 * Source of truth for membership is `org_members` (NOT user_metadata, which is
 * never populated) — same convention as authorizeOrgRole() in middleware/auth.
 *
 * Resolution is best-effort: a null return means "could not determine an org".
 * Pre-enforcement (org_id still NULLABLE) that simply writes a NULL org_id, so
 * capture never breaks. Once org_id is NOT NULL, an unresolved org fails the
 * insert closed — which correctly surfaces a mis-wired write path instead of
 * silently mis-assigning a row to the wrong tenant.
 */

// Small in-process cache: userId -> { orgId, ts }. Org membership changes
// rarely; a short TTL keeps a hot capture path from hitting org_members on
// every insert without risking a stale binding for long.
const _cache = new Map();
const TTL_MS = 5 * 60 * 1000;

/**
 * Resolve the org_id for a user via org_members.
 * @param {string|null|undefined} userId
 * @returns {Promise<string|null>} org_id, or null if none / anonymous / error.
 */
async function getOrgIdForUser(userId) {
  if (!userId || userId === 'anonymous' || userId === 'system') return null;

  const hit = _cache.get(userId);
  if (hit && (Date.now() - hit.ts) < TTL_MS) return hit.orgId;

  if (!supabase) return null;
  const { data, error } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    log.error('[orgContext] getOrgIdForUser failed:', error.message);
    return null;
  }

  const orgId = data?.org_id || null;
  _cache.set(userId, { orgId, ts: Date.now() });
  return orgId;
}

/**
 * Derive org_id from a parent meeting row (for action_items and other
 * meeting-derived writes that carry no user of their own).
 * @param {string|null|undefined} meetingId
 * @returns {Promise<string|null>}
 */
async function getOrgIdForMeeting(meetingId) {
  if (!meetingId || !supabase) return null;
  const { data, error } = await supabase
    .from('meetings')
    .select('org_id')
    .eq('id', meetingId)
    .maybeSingle();

  if (error) {
    log.error('[orgContext] getOrgIdForMeeting failed:', error.message);
    return null;
  }
  return data?.org_id || null;
}

/** Clear the cache (tests / after a membership change). */
function _clearCache() {
  _cache.clear();
}

module.exports = { getOrgIdForUser, getOrgIdForMeeting, _clearCache };
