/**
 * Search everything — the one engine behind the ⌘K palette and the Search page.
 *
 * Returns results grouped by type (meetings, decisions, action items, tasks,
 * projects, notes). Each result carries the words that matched (a snippet with
 * the hit ranges marked) and, for meetings and decisions, the moment in the
 * recording (atMs) so the UI can jump to it.
 *
 * Meetings are matched in JS over the org's recent meetings because the words
 * we care about live in jsonb (transcript_segments, decisions), which PostgREST
 * can't filter with ilike. Capped at MEETING_SCAN rows; move to a tsvector
 * column when an org outgrows that.
 *
 * The pure helpers (terms, snippet, findSegmentHit, matchMeeting) are exported
 * for tests.
 */

const { supabase } = require('../config/supabase');
const log = require('../utils/log');

const MEETING_SCAN = 300;
const SNIPPET_RADIUS = 70;
const TYPES = ['meetings', 'decisions', 'action_items', 'tasks', 'projects', 'notes'];

const STOP = new Set(['what', 'when', 'where', 'which', 'who', 'whom', 'why', 'how', 'did', 'does', 'do',
  'about', 'with', 'from', 'that', 'this', 'there', 'their', 'have', 'were', 'was', 'will', 'is', 'it',
  'would', 'should', 'could', 'they', 'them', 'into', 'over', 'last', 'tell', 'show', 'give', 'any',
  'and', 'the', 'for', 'are', 'our', 'you', 'say', 'said', 'we', 'a', 'an', 'of', 'to', 'in', 'on', 'or']);

/**
 * Content words of a query, lowercased and de-duplicated. A query made only of
 * stop words falls back to the whole trimmed query so "who" still searches.
 * @param {string} query
 * @returns {string[]}
 */
function terms(query) {
  const raw = String(query || '').toLowerCase().replace(/[?!.,;:"“”()]/g, ' ').split(/\s+/).filter(Boolean);
  const seen = new Set();
  const words = raw.filter((w) => w.length >= 2 && !STOP.has(w) && !seen.has(w) && seen.add(w));
  if (words.length) return words.slice(0, 8);
  const whole = String(query || '').trim().toLowerCase();
  return whole ? [whole] : [];
}

/** Every [start, end) range where any term occurs, merged and sorted. */
function hitRanges(text, words) {
  const lower = String(text || '').toLowerCase();
  const ranges = [];
  for (const w of words) {
    let i = lower.indexOf(w);
    while (i !== -1) {
      ranges.push([i, i + w.length]);
      i = lower.indexOf(w, i + w.length);
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  return merged;
}

/** How many distinct terms appear in the text. */
function termHits(text, words) {
  const lower = String(text || '').toLowerCase();
  return words.reduce((n, w) => n + (lower.includes(w) ? 1 : 0), 0);
}

/** Close spelling is a fallback only; exact words always score higher. */
function closeSpelling(a, b) {
  if (a.length < 4 || a.length > 40 || b.length > 40) return false;
  const max = a.length >= 6 ? 2 : 1;
  if (Math.abs(a.length - b.length) > max) return false;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[a.length][b.length] <= max;
}

function closeHits(text, words) {
  const tokens = String(text || '').toLowerCase().slice(0, 2000).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return words.reduce((n, w) => n + (tokens.some(t => closeSpelling(w, t)) ? 0.25 : 0), 0);
}

/** Reuse the caller's scoped query; never scan another workspace or change clients. */
async function searchRows(makeQuery, fields, words, limit) {
  const exact = await makeQuery().or(orFilter(fields, words)).limit(limit);
  if (exact.error || exact.data?.length || !words.some(w => w.length >= 4 && w.length <= 40)) return exact;
  const fallback = await makeQuery().limit(100);
  if (fallback.error) return fallback;
  return { ...fallback, data: (fallback.data || []).filter(row => fields.some(field => closeHits(row[field], words) > 0)) };
}

/**
 * A short window of text around the first hit, with hit ranges relative to
 * the returned text. Ellipses mark cut ends.
 * @returns {{ text: string, hits: Array<[number, number]> }}
 */
function snippet(text, words, radius = SNIPPET_RADIUS) {
  const src = String(text || '').replace(/\s+/g, ' ').trim();
  if (!src) return { text: '', hits: [] };
  const all = hitRanges(src, words);
  if (!all.length) {
    const cut = src.length > radius * 2 ? src.slice(0, radius * 2).replace(/\s+\S*$/, '') + '…' : src;
    return { text: cut, hits: [] };
  }
  let start = Math.max(0, all[0][0] - radius);
  let end = Math.min(src.length, all[0][1] + radius);
  if (start > 0) { const sp = src.indexOf(' ', start); if (sp !== -1 && sp < all[0][0]) start = sp + 1; }
  if (end < src.length) { const sp = src.lastIndexOf(' ', end); if (sp > all[0][1]) end = sp; }
  const prefix = start > 0 ? '…' : '';
  const suffix = end < src.length ? '…' : '';
  const body = src.slice(start, end);
  const hits = all
    .filter(([s, e]) => s >= start && e <= end)
    .map(([s, e]) => [s - start + prefix.length, e - start + prefix.length]);
  return { text: prefix + body + suffix, hits };
}

/**
 * First transcript segment that matches, with up to two lines either side.
 * @param {Array<{atMs?: number, text?: string, speaker?: string}>} segments
 */
function findSegmentHit(segments, words) {
  if (!Array.isArray(segments)) return null;
  let best = -1;
  let bestScore = 0;
  segments.forEach((s, i) => {
    const score = termHits(s && s.text, words);
    if (score > bestScore) { best = i; bestScore = score; }
  });
  if (best === -1) return null;
  const seg = segments[best];
  const context = segments.slice(Math.max(0, best - 2), best + 3).map((s, j) => ({
    atMs: Number.isFinite(s.atMs) ? s.atMs : null,
    speaker: s.speaker || null,
    text: String(s.text || ''),
    hit: Math.max(0, best - 2) + j === best,
  }));
  return {
    atMs: Number.isFinite(seg.atMs) ? seg.atMs : null,
    speaker: seg.speaker || null,
    text: String(seg.text || ''),
    context,
  };
}

const asList = (v) => (Array.isArray(v) ? v : []);
const decisionText = (d) => (typeof d === 'string' ? d : (d && (d.text || d.decision || d.title)) || '');

/**
 * Match one meeting row. Returns the meeting result (or null) and any matching
 * decisions as their own results.
 */
function matchMeeting(m, words) {
  const title = m.title || 'Untitled meeting';
  const date = m.created_at || null;
  const decisions = asList(m.decisions).map(decisionText);
  const decisionMs = asList(m.summary_moments && m.summary_moments.decisions);

  const decisionResults = [];
  decisions.forEach((d, i) => {
    if (!d || !(termHits(d, words) || closeHits(d, words))) return;
    const at = Number.isFinite(decisionMs[i]) ? decisionMs[i] : null;
    decisionResults.push({
      type: 'decision',
      id: `${m.id}:${i}`,
      title: d,
      titleHits: hitRanges(d, words),
      snippet: '',
      snippetHits: [],
      meta: { meetingId: m.id, meetingTitle: title, date, atMs: at, spellingMatch: !termHits(d, words) },
      score: (termHits(d, words) || closeHits(d, words)) * 10,
    });
  });

  const titleScore = termHits(title, words) || closeHits(title, words);
  const seg = findSegmentHit(m.transcript_segments, words);
  const summaryScore = termHits(m.summary, words);
  const transcriptScore = seg ? 0 : termHits(m.transcript, words);
  const total = titleScore * 3 + (seg ? termHits(seg.text, words) * 2 : 0) + summaryScore + transcriptScore + decisionResults.length;
  if (!total) return { meeting: null, decisions: decisionResults };

  let snip;
  if (seg) snip = snippet(seg.text, words);
  else if (summaryScore) snip = snippet(m.summary, words);
  else if (transcriptScore) snip = snippet(m.transcript, words);
  else snip = snippet(m.summary || '', words);

  return {
    meeting: {
      type: 'meeting',
      id: m.id,
      title,
      titleHits: hitRanges(title, words),
      snippet: snip.text,
      snippetHits: snip.hits,
      meta: {
        date,
        atMs: seg ? seg.atMs : null,
        speaker: seg ? seg.speaker : null,
        context: seg ? seg.context : [],
        decisions: decisions.filter(Boolean).slice(0, 5),
        spellingMatch: !termHits(title, words) && titleScore > 0 && !seg && !summaryScore && !transcriptScore,
      },
      score: total,
    },
    decisions: decisionResults,
  };
}

function textResult(type, id, title, body, words, meta) {
  const snip = body ? snippet(body, words) : { text: '', hits: [] };
  const titleScore = termHits(title, words);
  const bodyScore = termHits(body, words);
  const closeScore = (titleScore ? 0 : closeHits(title, words)) * 3 + (bodyScore ? 0 : closeHits(body, words));
  return {
    type,
    id,
    title: title || '',
    titleHits: hitRanges(title, words),
    snippet: snip.text,
    snippetHits: snip.hits,
    meta: { ...meta, spellingMatch: !titleScore && !bodyScore && closeScore > 0 },
    score: titleScore * 3 + bodyScore + closeScore,
  };
}

const byScoreThenDate = (a, b) => (b.score - a.score) || String(b.meta.date || '').localeCompare(String(a.meta.date || ''));

/**
 * Build an `or()` filter for PostgREST over the given columns. Terms are
 * stripped of characters that would break the filter grammar.
 */
function orFilter(columns, words) {
  const safe = words.map((w) => w.replace(/[%,()*\\]/g, '')).filter(Boolean);
  return columns.flatMap((c) => safe.map((w) => `${c}.ilike.%${w}%`)).join(',');
}

/**
 * @param {{ query: string, types?: string[], limit?: number, orgIds: string[], userId: string, db?: object }} opts
 *   `db` defaults to the service client; Entomate AI passes the caller's user-JWT client (D2).
 */
async function search({ query, types = TYPES, limit = 8, orgIds, userId, db = supabase }) {
  const words = terms(query);
  const want = new Set(types.filter((t) => TYPES.includes(t)));
  const empty = { query, terms: words, groups: {}, total: 0 };
  if (!db || !words.length || !Array.isArray(orgIds) || !orgIds.length) return empty;

  const jobs = [];
  const groups = {};

  if (want.has('meetings') || want.has('decisions')) {
    jobs.push(db
      .from('meetings')
      .select('id, title, summary, transcript, transcript_segments, decisions, summary_moments, created_at')
      .in('org_id', orgIds)
      .order('created_at', { ascending: false })
      .limit(MEETING_SCAN)
      .then(({ data, error }) => {
        if (error) throw error;
        const meetings = [];
        const decisions = [];
        for (const m of data || []) {
          const r = matchMeeting(m, words);
          if (r.meeting) meetings.push(r.meeting);
          decisions.push(...r.decisions);
        }
        if (want.has('meetings')) groups.meetings = meetings.sort(byScoreThenDate);
        if (want.has('decisions')) groups.decisions = decisions.sort(byScoreThenDate);
      }));
  }

  if (want.has('action_items')) {
    jobs.push(searchRows(() => db
      .from('action_items')
      .select('id, task_description, context, assigned_to_name, status, priority, due_date, meeting_id, transcript_at_ms, agent_notes, created_at, meetings(title)')
      .in('org_id', orgIds)
      .order('created_at', { ascending: false }), ['task_description', 'assigned_to_name', 'context'], words, 50)
      .then(({ data, error }) => {
        if (error) throw error;
        groups.action_items = (data || []).map((a) => textResult('action_item', a.id, a.task_description, a.context, words, {
          date: a.created_at,
          status: a.status,
          priority: a.priority,
          owner: a.assigned_to_name || null,
          dueDate: a.due_date || null,
          meetingId: a.meeting_id || null,
          meetingTitle: (a.meetings && a.meetings.title) || null,
          atMs: Number.isFinite(a.transcript_at_ms) ? a.transcript_at_ms : null,
          agent: agentCall(a.agent_notes),
        })).sort(byScoreThenDate);
      }));
  }

  if (want.has('tasks')) {
    jobs.push(searchRows(() => db
      .from('tasks')
      .select('id, title, description, status, priority, due_date, project_id, created_at, projects(name)')
      .in('org_id', orgIds)
      .order('created_at', { ascending: false }), ['title', 'description'], words, 50)
      .then(({ data, error }) => {
        if (error) throw error;
        groups.tasks = (data || []).map((t) => textResult('task', t.id, t.title, t.description, words, {
          date: t.created_at,
          status: t.status,
          priority: t.priority,
          dueDate: t.due_date || null,
          projectId: t.project_id || null,
          projectName: (t.projects && t.projects.name) || null,
        })).sort(byScoreThenDate);
      }));
  }

  if (want.has('projects')) {
    jobs.push(searchRows(() => db
      .from('projects')
      .select('id, name, description, status, created_at')
      .in('org_id', orgIds)
      .order('created_at', { ascending: false }), ['name', 'description'], words, 30)
      .then(({ data, error }) => {
        if (error) throw error;
        groups.projects = (data || []).map((p) => textResult('project', p.id, p.name, p.description, words, {
          date: p.created_at,
          status: p.status,
        })).sort(byScoreThenDate);
      }));
  }

  if (want.has('notes') && userId) {
    const notes = [];
    jobs.push(Promise.all([
      searchRows(() => db
        .from('search_notes')
        .select('id, kind, body, source_type, source_id, source_label, at_ms, created_at')
        .eq('user_id', userId)
        .in('org_id', orgIds)
        .order('created_at', { ascending: false }), ['body', 'source_label'], words, 30),
      searchRows(() => db
        .from('meeting_notes')
        .select('id, meeting_id, author_id, body, visibility, created_at, meetings(title)')
        .in('org_id', orgIds)
        .order('created_at', { ascending: false }), ['body'], words, 30),
    ]).then(([clips, mnotes]) => {
      // A missing table (clips not migrated yet) must not sink the whole search.
      if (clips.error) log.warn('[searchEverything] search_notes:', clips.error.message);
      for (const n of clips.data || []) {
        notes.push(textResult('note', n.id, n.source_label || firstLine(n.body), n.body, words, {
          date: n.created_at, kind: n.kind, sourceType: n.source_type, sourceId: n.source_id, atMs: n.at_ms,
        }));
      }
      if (mnotes.error) log.warn('[searchEverything] meeting_notes:', mnotes.error.message);
      // Privacy rule from meetingNotesService: your own notes, or ones shared with the team.
      for (const n of (mnotes.data || []).filter((x) => x.author_id === userId || x.visibility === 'team')) {
        const mt = (n.meetings && n.meetings.title) || 'Meeting';
        notes.push(textResult('meeting_note', n.id, `Note on ${mt}`, n.body, words, {
          date: n.created_at, meetingId: n.meeting_id, meetingTitle: mt, visibility: n.visibility,
        }));
      }
      groups.notes = notes.sort(byScoreThenDate);
    }));
  }

  await Promise.all(jobs);

  let total = 0;
  const counts = {};
  for (const key of Object.keys(groups)) {
    counts[key] = groups[key].length;
    total += groups[key].length;
    groups[key] = groups[key].slice(0, limit).map(({ score, ...r }) => r);
  }
  return { query, terms: words, groups, counts, total };
}

function firstLine(body) {
  const s = String(body || '').trim().split('\n')[0];
  return s.length > 80 ? s.slice(0, 80).replace(/\s+\S*$/, '') + '…' : s;
}

/**
 * The agent call that was applied on an action item, as { field, confidence }.
 * agent_notes is keyed by field: { owner: { applied, confidence, ... }, priority: {...} }.
 * Only applied calls count: amber means an agent made the call.
 */
function agentCall(notes) {
  if (!notes || typeof notes !== 'object' || Array.isArray(notes)) return null;
  for (const [field, n] of Object.entries(notes)) {
    if (!n || typeof n !== 'object' || n.applied !== true) continue;
    const conf = Number(n.confidence);
    if (!Number.isFinite(conf)) continue;
    return { field, confidence: conf <= 1 ? Math.round(conf * 100) : Math.round(conf) };
  }
  return null;
}

module.exports = { search, terms, hitRanges, snippet, findSegmentHit, matchMeeting, orFilter, agentCall, TYPES };
