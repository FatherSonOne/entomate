/**
 * Insights: is what we agree in meetings getting done, and who is behind?
 * (Insights Slate pass, direction A, 2026-11-22.)
 *
 * Follow-through = action items done by their due date, out of the items that
 * fell due in the period. Overdue = open items whose due date has passed.
 * Agent calls kept = agent changes (owner, due date, priority) that nobody has
 * changed back since.
 *
 * buildInsights is pure so it is easy to test; load() does the org-scoped reads.
 * shortcut: "today" is the server's UTC date. A user far from UTC can see an
 * item flip to overdue a few hours early or late.
 */

'use strict';

const { supabase } = require('../config/supabase');

const DAY = 24 * 60 * 60 * 1000;
const DONE = new Set(['done', 'completed', 'complete']);
const CANCELLED = new Set(['cancelled', 'canceled']);
const NO_OWNER = new Set(['', 'unassigned', 'none', 'no owner', 'unknown']);
const WEEKS = 6;
const MAX_ROWS = 5000;
const MAX_OWNER_ITEMS = 25;

const AGENTS = [
  { key: 'assignment', label: 'Owner', agent: 'Assignment agent', field: (i) => i.assigned_to_name },
  { key: 'deadline', label: 'Due date', agent: 'Deadline agent', field: (i) => (i.due_date ? String(i.due_date).slice(0, 10) : null) },
  { key: 'priority', label: 'Priority', agent: 'Priority agent', field: (i) => (i.priority ? String(i.priority).toLowerCase() : null) }
];

/** YYYY-MM-DD of a Date in UTC. */
const ymd = (d) => d.toISOString().slice(0, 10);

const statusOf = (item) => String(item.status || '').toLowerCase();
const isDone = (item) => DONE.has(statusOf(item));
const isCancelled = (item) => CANCELLED.has(statusOf(item));
const isOpen = (item) => !isDone(item) && !isCancelled(item);

/** When a done item was finished. Old rows marked done without completed_at fall back to updated_at. */
function doneDate(item) {
  const raw = item.completed_at || item.updated_at;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : ymd(d);
}

/** Done on or before its due date. */
function onTime(item) {
  if (!isDone(item) || !item.due_date) return false;
  const done = doneDate(item);
  return done != null && done <= String(item.due_date).slice(0, 10);
}

function ownerName(item) {
  const name = String(item.assigned_to_name || '').trim();
  if (name && !NO_OWNER.has(name.toLowerCase())) return name;
  const email = String(item.assigned_to_email || '').trim();
  return email || null;
}

const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : null);

/** Monday 00:00 UTC of the week containing d. */
function weekStart(d) {
  const s = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  s.setUTCDate(s.getUTCDate() - ((s.getUTCDay() + 6) % 7));
  return s;
}

function meetingDate(m) {
  return m.start_time || m.created_at || null;
}

function decisionCount(m) {
  return Array.isArray(m.decisions) ? m.decisions.length : 0;
}

/** Follow-through over items due between from and to (inclusive YYYY-MM-DD), never after today. */
function followThrough(items, from, to) {
  const due = items.filter((i) => !isCancelled(i) && i.due_date && String(i.due_date).slice(0, 10) >= from && String(i.due_date).slice(0, 10) <= to);
  const kept = due.filter(onTime).length;
  return { due: due.length, onTime: kept, rate: pct(kept, due.length) };
}

/**
 * @param {{items: object[], meetings: object[], days?: number, now?: Date}} input
 *   items: action_items rows (id, meeting_id, task_description, assigned_to_name,
 *   assigned_to_email, due_date, priority, status, created_at, updated_at,
 *   completed_at, agent_notes). meetings: id, title, start_time, created_at, decisions.
 */
function buildInsights({ items = [], meetings = [], days = 30, now = new Date() }) {
  const today = ymd(now);
  const start = new Date(now.getTime() - (days - 1) * DAY);
  const from = ymd(start);
  const inPeriod = (raw) => {
    if (!raw) return false;
    const d = ymd(new Date(raw));
    return d >= from && d <= today;
  };

  const byMeeting = new Map(meetings.map((m) => [m.id, m]));
  const counted = meetings.filter((m) => !m._labelOnly);
  const periodMeetings = counted.filter((m) => inPeriod(meetingDate(m)));
  const created = items.filter((i) => inPeriod(i.created_at));
  const overdue = items.filter((i) => isOpen(i) && i.due_date && String(i.due_date).slice(0, 10) < today);
  const ft = followThrough(items, from, today);

  // Agent calls on items created in the period: applied changes, and how many still stand.
  const agents = AGENTS.map(({ key, label, agent, field }) => {
    let calls = 0;
    let kept = 0;
    for (const item of created) {
      const note = item.agent_notes && item.agent_notes[key];
      if (!note || !note.applied || note.recommended == null) continue;
      calls++;
      const current = field(item);
      if (current != null && String(current).toLowerCase() === String(note.recommended).toLowerCase()) kept++;
    }
    return { key, label, agent, calls, kept, rate: pct(kept, calls) };
  });
  const agentCalls = agents.reduce((s, a) => s + a.calls, 0);
  const agentKept = agents.reduce((s, a) => s + a.kept, 0);

  // Owners: what each person owes now, and how they did in the period.
  const owners = new Map();
  const ownerOf = (name) => {
    const key = name || '';
    if (!owners.has(key)) owners.set(key, { name, open: 0, overdue: 0, done: 0, due: 0, onTime: 0, items: [] });
    return owners.get(key);
  };
  for (const item of items) {
    if (isCancelled(item)) continue;
    const o = ownerOf(ownerName(item));
    const due = item.due_date ? String(item.due_date).slice(0, 10) : null;
    if (isOpen(item)) {
      const late = due != null && due < today;
      o.open++;
      if (late) o.overdue++;
      const m = byMeeting.get(item.meeting_id);
      o.items.push({
        id: item.id,
        text: item.task_description || 'Untitled item',
        dueDate: due,
        overdue: late,
        priority: item.priority || null,
        meeting: m ? { id: m.id, title: m.title || 'Untitled meeting', date: meetingDate(m) } : null
      });
    } else if (inPeriod(doneDate(item))) {
      o.done++;
    }
    if (due && due >= from && due <= today) {
      o.due++;
      if (onTime(item)) o.onTime++;
    }
  }
  const ownerRows = [...owners.values()]
    .filter((o) => o.open > 0 || o.done > 0 || o.due > 0)
    .map((o) => ({
      name: o.name,
      open: o.open,
      overdue: o.overdue,
      done: o.done,
      onTimeRate: pct(o.onTime, o.due),
      items: o.items
        .sort((a, b) => (b.overdue - a.overdue) || String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999')))
        .slice(0, MAX_OWNER_ITEMS)
    }))
    // Most overdue first, then most open; "No owner" last.
    .sort((a, b) => ((a.name == null) - (b.name == null)) || (b.overdue - a.overdue) || (b.open - a.open) || String(a.name).localeCompare(String(b.name)));

  // Weeks, newest first.
  const weeks = [];
  const thisWeek = weekStart(now);
  for (let w = 0; w < WEEKS; w++) {
    const ws = new Date(thisWeek.getTime() - w * 7 * DAY);
    const we = new Date(ws.getTime() + 6 * DAY);
    const a = ymd(ws);
    const b = ymd(we);
    const within = (raw) => raw && ymd(new Date(raw)) >= a && ymd(new Date(raw)) <= b;
    const wm = counted.filter((m) => within(meetingDate(m)));
    const wi = items.filter((i) => within(i.created_at));
    const wf = followThrough(items, a, b < today ? b : today);
    weeks.push({
      start: a,
      end: b,
      current: w === 0,
      meetings: wm.length,
      decisions: wm.reduce((s, m) => s + decisionCount(m), 0),
      items: wi.length,
      done: wi.filter(isDone).length,
      due: wf.due,
      onTimeRate: wf.rate
    });
  }

  return {
    period: { days, from, to: today },
    followThrough: ft,
    overdue: overdue.length,
    meetings: periodMeetings.length,
    decisions: periodMeetings.reduce((s, m) => s + decisionCount(m), 0),
    actionItems: { created: created.length, done: created.filter(isDone).length },
    agents: { calls: agentCalls, kept: agentKept, rate: pct(agentKept, agentCalls), byAgent: agents },
    owners: ownerRows,
    weeks
  };
}

/**
 * Org-scoped reads for buildInsights. Reads every open item (for "who owes
 * what"), plus items created or due since the earliest date any view needs.
 * @param {string[]} orgIds
 * @param {number} days
 * @param {Date} [now]
 */
async function load(orgIds, days, now = new Date()) {
  if (!supabase || !Array.isArray(orgIds) || orgIds.length === 0) return buildInsights({ days, now });

  const earliest = new Date(Math.min(
    now.getTime() - (days - 1) * DAY,
    weekStart(now).getTime() - (WEEKS - 1) * 7 * DAY
  ));
  const since = ymd(earliest);
  const cols = 'id, meeting_id, task_description, assigned_to_name, assigned_to_email, due_date, priority, status, created_at, updated_at, completed_at, agent_notes';

  const [recent, open, meetingsRes] = await Promise.all([
    supabase.from('action_items').select(cols).in('org_id', orgIds)
      .or(`created_at.gte.${since},due_date.gte.${since},completed_at.gte.${since}`)
      .limit(MAX_ROWS),
    supabase.from('action_items').select(cols).in('org_id', orgIds)
      .not('status', 'in', '(done,completed,complete,cancelled,canceled)')
      .limit(MAX_ROWS),
    supabase.from('meetings').select('id, title, start_time, created_at, decisions').in('org_id', orgIds)
      .gte('created_at', since)
      .limit(MAX_ROWS)
  ]);
  for (const r of [recent, open, meetingsRes]) if (r.error) throw r.error;

  const items = new Map();
  for (const row of [...(recent.data || []), ...(open.data || [])]) items.set(row.id, row);

  // Open items can come from meetings older than the window: fetch those titles too.
  const meetings = new Map((meetingsRes.data || []).map((m) => [m.id, m]));
  const missing = [...new Set([...items.values()].map((i) => i.meeting_id).filter((id) => id && !meetings.has(id)))];
  if (missing.length) {
    const { data, error } = await supabase.from('meetings').select('id, title, start_time, created_at').in('org_id', orgIds).in('id', missing.slice(0, 500));
    if (error) throw error;
    // Older meetings only label rows; they must not count toward this period's meetings.
    for (const m of data || []) meetings.set(m.id, { ...m, decisions: null, _labelOnly: true });
  }

  return buildInsights({ items: [...items.values()], meetings: [...meetings.values()], days, now });
}

module.exports = { buildInsights, load, onTime, ownerName, weekStart };
