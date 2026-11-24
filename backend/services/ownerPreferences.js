const { createHash } = require('node:crypto');
const { getOrgTeam } = require('./agents/orgTeam');
const log = require('../utils/log');

const MIN_MEETINGS = 3;
const PAGE_SIZE = 250;

function normalize(text) {
  return String(text ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function scopeKey(meetingTitle, itemTitle) {
  const scope = [normalize(meetingTitle), normalize(itemTitle)];
  if (scope.some(value => !value)) return null;
  return createHash('sha256').update(JSON.stringify(scope)).digest('hex');
}

async function correctionForEdit(db, item, changes, correctedAt) {
  const note = item.agent_notes?.assignment;
  const from = normalize(note?.recommended);
  const to = normalize(changes.assigned_to_name);
  if (!note?.applied || !from || from !== normalize(item.assigned_to_name) || !to || from === to) return null;
  if (changes.task_description !== undefined && normalize(changes.task_description) !== normalize(item.task_description)) return null;

  const [{ data: meeting, error }, team] = await Promise.all([
    db.from('meetings').select('title').eq('id', item.meeting_id).eq('org_id', item.org_id).maybeSingle(),
    getOrgTeam(item.org_id, db)
  ]);
  if (error) throw error;
  const key = scopeKey(meeting?.title, item.task_description);
  const email = normalize(changes.assigned_to_email);
  const candidates = team.filter(member => member.user_id && normalize(member.name) === to && (!email || normalize(member.email) === email));
  if (!key || candidates.length !== 1) return null;

  return {
    scopeKey: key,
    memberId: candidates[0].user_id,
    meetingTitle: meeting.title,
    itemTitle: item.task_description,
    from: note.recommended,
    to: candidates[0].name,
    correctedAt
  };
}

async function approvals(db, orgId, key) {
  let query = db.from('owner_preferences').select('*').eq('org_id', orgId);
  if (key) query = query.eq('scope_key', key);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function corrections(db, orgId, key) {
  const rows = [];
  let after;
  for (;;) {
    let query = db.from('action_items').select('id, meeting_id, owner_correction')
      .eq('org_id', orgId).not('owner_correction', 'is', null).order('id').limit(PAGE_SIZE);
    if (key) query = query.eq('owner_correction->>scopeKey', key);
    if (after) query = query.gt('id', after);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
    after = data.at(-1).id;
  }
}

function suggestions(rows, previous, team) {
  const states = new Map(previous.map(row => [row.scope_key, row]));
  const members = new Map(team.map(member => [member.user_id, member]));
  const scopes = new Map();
  for (const row of rows) {
    const correction = row.owner_correction;
    if (states.get(correction.scopeKey)?.status === 'active') continue;
    if (!scopes.has(correction.scopeKey)) scopes.set(correction.scopeKey, new Map());
    const meetings = scopes.get(correction.scopeKey);
    const last = meetings.get(row.meeting_id);
    if (!last || last.correctedAt < correction.correctedAt) meetings.set(row.meeting_id, correction);
  }

  const result = [];
  for (const [key, meetings] of scopes) {
    const votes = [...meetings.values()].sort((a, b) => b.correctedAt.localeCompare(a.correctedAt));
    const byMember = new Map();
    for (const vote of votes) {
      if (!byMember.has(vote.memberId)) byMember.set(vote.memberId, []);
      byMember.get(vote.memberId).push(vote);
    }
    for (const [memberId, matches] of byMember) {
      const member = members.get(memberId);
      if (!member || states.get(key)?.member_id === memberId || matches.length < MIN_MEETINGS || matches.length / votes.length < 0.7) continue;
      const { meetingTitle, itemTitle } = matches[0];
      const evidence = matches.slice(0, MIN_MEETINGS).map(({ from, to, correctedAt }) => ({ from, to, correctedAt }));
      result.push({ scopeKey: key, memberId, memberName: member.name, meetingTitle, itemTitle, evidence });
    }
  }
  return result;
}

async function list(db, orgId, key) {
  const [previous, rows] = await Promise.all([
    approvals(db, orgId, key), corrections(db, orgId, key)
  ]);
  if (!previous.length && !rows.length) return { suggested: [], active: [], previous };
  const team = await getOrgTeam(orgId, db);
  const names = new Map(team.map(member => [member.user_id, member.name]));
  const active = previous.filter(row => row.status === 'active').map(row => ({
    scopeKey: row.scope_key,
    memberId: row.member_id,
    memberName: names.get(row.member_id) || null,
    meetingTitle: row.meeting_title,
    itemTitle: row.item_title,
    evidence: row.evidence
  }));
  return { suggested: suggestions(rows, previous, team), active, previous };
}

async function decide(db, orgId, userId, { scopeKey: key, memberId, decision }) {
  const { suggested, previous } = await list(db, orgId, key);
  const current = previous[0];
  const status = { approve: 'active', dismiss: 'dismissed', disable: 'disabled' }[decision];
  if (current?.status === status && current.member_id === memberId) return true;

  const change = { status, updated_by: userId, updated_at: new Date().toISOString() };
  if (decision === 'disable') {
    if (current?.status !== 'active' || current.member_id !== memberId) return false;
  } else {
    const proposed = suggested.find(row => row.scopeKey === key && row.memberId === memberId);
    if (!proposed) return false;
    Object.assign(change, { member_id: memberId, meeting_title: proposed.meetingTitle, item_title: proposed.itemTitle, evidence: proposed.evidence });
  }

  if (!current) {
    const { error } = await db.from('owner_preferences').insert({ org_id: orgId, scope_key: key, ...change });
    if (error?.code === '23505') return false;
    if (error) throw error;
    return true;
  }
  const { data, error } = await db.from('owner_preferences').update(change)
    .eq('org_id', orgId).eq('scope_key', key).eq('updated_at', current.updated_at)
    .eq('status', current.status).eq('member_id', current.member_id).select('scope_key');
  if (error) throw error;
  return data.length === 1;
}

async function approvedMember(db, orgId, meetingTitle, itemTitle, team) {
  const key = scopeKey(meetingTitle, itemTitle);
  if (!db || !orgId || !key || !team.length) return null;
  try {
    const { data, error } = await db.from('owner_preferences').select('member_id')
      .eq('org_id', orgId).eq('scope_key', key).eq('status', 'active').maybeSingle();
    if (error) throw error;
    return team.find(member => member.user_id === data?.member_id) || null;
  } catch (error) {
    log.warn('[Owner preferences] Lookup failed:', error.message);
    return null;
  }
}

module.exports = { correctionForEdit, list, decide, approvedMember };
