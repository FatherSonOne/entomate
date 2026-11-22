/**
 * Org-scoped team list for the Assignment Agent.
 *
 * team_members has no org_id, so membership comes from org_members:
 *   1. team_members rows whose user_id belongs to the org (keeps skills/role)
 *   2. otherwise the org's users (name + email, no skills)
 * No orgId → no team. Never read team_members unscoped (cross-tenant leak).
 */

const log = require('../../utils/log');

/**
 * @param {string} orgId
 * @param {object} db - supabase client
 * @returns {Promise<Array<{name: string, email?: string, user_id?: string, skills: string[], role?: string}>>}
 */
async function getOrgTeam(orgId, db) {
  if (!orgId || !db) return [];

  try {
    const { data: memberRows, error: memberError } = await db
      .from('org_members')
      .select('user_id')
      .eq('org_id', orgId);
    if (memberError) throw memberError;

    const userIds = (memberRows || []).map(m => m.user_id).filter(Boolean);
    if (userIds.length === 0) return [];

    const { data: teamRows } = await db
      .from('team_members')
      .select('user_id, name, email, role, skills')
      .in('user_id', userIds)
      .eq('active', true);

    if (teamRows && teamRows.length > 0) {
      return teamRows
        .filter(m => m.name)
        .map(m => ({ name: m.name, email: m.email || null, user_id: m.user_id, role: m.role || null, skills: m.skills || [] }));
    }

    // public.users has full_name, no name/active; org membership is the active check.
    const { data: users } = await db
      .from('users')
      .select('id, full_name, email, role')
      .in('id', userIds);

    return (users || [])
      .filter(u => u.full_name || u.email)
      .map(u => ({ name: u.full_name || u.email, email: u.email || null, user_id: u.id, role: u.role || null, skills: [] }));
  } catch (error) {
    log.warn('[orgTeam] Could not load org team:', error.message);
    return [];
  }
}

/** Case-insensitive match of an AI-returned name to a team member. */
function findMember(team, name) {
  if (!name || !Array.isArray(team)) return null;
  const wanted = String(name).trim().toLowerCase();
  return team.find(m => String(m.name || '').trim().toLowerCase() === wanted) || null;
}

module.exports = { getOrgTeam, findMember };
