const { createHash } = require('node:crypto');
const log = require('../utils/log');

const MIN_MEETINGS = 3;
const PAGE_SIZE = 250;
const DECISIONS = { approve: 'active', dismiss: 'dismissed', disable: 'disabled' };

function normalize(text) {
  return String(text ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function scopeKey(meetingTitle, itemTitle) {
  const scope = [normalize(meetingTitle), normalize(itemTitle)];
  if (scope.some(value => !value)) return null;
  return createHash('sha256').update(JSON.stringify(scope)).digest('hex');
}

async function correctionScope(db, item, changes) {
  if (changes.task_description !== undefined && normalize(changes.task_description) !== normalize(item.task_description)) return null;
  const { data: meeting, error } = await db.from('meetings').select('title')
    .eq('id', item.meeting_id).eq('org_id', item.org_id).maybeSingle();
  if (error) throw error;
  const key = scopeKey(meeting?.title, item.task_description);
  return key ? { scopeKey: key, meetingTitle: meeting.title, itemTitle: item.task_description } : null;
}

function preferenceStore({ table, correctionColumn, correctionValue, storedValue, getLabels }) {
  async function readCorrections(db, orgId, key) {
    const rows = [];
    let after;
    for (;;) {
      let query = db.from('action_items').select(`id, meeting_id, ${correctionColumn}`)
        .eq('org_id', orgId).not(correctionColumn, 'is', null).order('id').limit(PAGE_SIZE);
      if (key) query = query.eq(`${correctionColumn}->>scopeKey`, key);
      if (after) query = query.gt('id', after);
      const { data, error } = await query;
      if (error) throw error;
      rows.push(...data);
      if (data.length < PAGE_SIZE) return rows;
      after = data.at(-1).id;
    }
  }

  function suggestions(rows, previous, labels) {
    const states = new Map(previous.map(row => [row.scope_key, row]));
    const scopes = new Map();
    for (const row of rows) {
      const correction = row[correctionColumn];
      const key = correction.scopeKey;
      if (states.get(key)?.status === 'active') continue;
      if (!scopes.has(key)) scopes.set(key, new Map());
      const meetings = scopes.get(key);
      const last = meetings.get(row.meeting_id);
      if (!last || last.correctedAt < correction.correctedAt) meetings.set(row.meeting_id, correction);
    }

    const result = [];
    for (const [key, meetings] of scopes) {
      const votes = [...meetings.values()].sort((a, b) => b.correctedAt.localeCompare(a.correctedAt));
      const byValue = new Map();
      for (const vote of votes) {
        const value = vote[correctionValue];
        if (!byValue.has(value)) byValue.set(value, []);
        byValue.get(value).push(vote);
      }
      for (const [value, matches] of byValue) {
        const label = labels.get(value);
        if (!label || states.get(key)?.[storedValue] === value || matches.length < MIN_MEETINGS || matches.length / votes.length < 0.7) continue;
        const { meetingTitle, itemTitle } = matches[0];
        const evidence = matches.slice(0, MIN_MEETINGS).map(({ from, to, correctedAt }) => ({ from, to, correctedAt }));
        result.push({ scopeKey: key, value, label, meetingTitle, itemTitle, evidence });
      }
    }
    return result;
  }

  async function list(db, orgId, key) {
    let approvals = db.from(table).select('*').eq('org_id', orgId);
    if (key) approvals = approvals.eq('scope_key', key);
    const [{ data: previous, error }, rows] = await Promise.all([approvals, readCorrections(db, orgId, key)]);
    if (error) throw error;
    if (!previous.length && !rows.length) return { suggested: [], active: [], previous };
    const labels = await getLabels(orgId, db);
    const active = previous.filter(row => row.status === 'active').map(row => ({
      scopeKey: row.scope_key,
      value: row[storedValue],
      label: labels.get(row[storedValue]) || null,
      meetingTitle: row.meeting_title,
      itemTitle: row.item_title,
      evidence: row.evidence
    }));
    return { suggested: suggestions(rows, previous, labels), active, previous };
  }

  async function decide(db, orgId, userId, { scopeKey: key, value, decision }) {
    const { suggested, previous } = await list(db, orgId, key);
    const [current] = previous;
    const status = DECISIONS[decision];
    if (current?.status === status && current[storedValue] === value) return true;

    const change = { status, updated_by: userId, updated_at: new Date().toISOString() };
    if (decision === 'disable') {
      if (current?.status !== 'active' || current[storedValue] !== value) return false;
    } else {
      const proposed = suggested.find(row => row.scopeKey === key && row.value === value);
      if (!proposed) return false;
      Object.assign(change, {
        [storedValue]: value, meeting_title: proposed.meetingTitle, item_title: proposed.itemTitle, evidence: proposed.evidence
      });
    }

    if (!current) {
      const { error } = await db.from(table).insert({ org_id: orgId, scope_key: key, ...change });
      if (error?.code === '23505') return false;
      if (error) throw error;
      return true;
    }
    const { data, error } = await db.from(table).update(change)
      .eq('org_id', orgId).eq('scope_key', key).eq('updated_at', current.updated_at)
      .eq('status', current.status).eq(storedValue, current[storedValue]).select('scope_key');
    if (error) throw error;
    return data.length === 1;
  }

  async function approved(db, orgId, meetingTitle, itemTitle) {
    const key = scopeKey(meetingTitle, itemTitle);
    if (!db || !orgId || !key) return null;
    try {
      const { data, error } = await db.from(table).select(storedValue)
        .eq('org_id', orgId).eq('scope_key', key).eq('status', 'active').maybeSingle();
      if (error) throw error;
      return data?.[storedValue] || null;
    } catch (error) {
      log.warn(`[${table}] Lookup failed:`, error.message);
      return null;
    }
  }

  return { list, decide, approved };
}

module.exports = { preferenceStore, correctionScope, normalize };
