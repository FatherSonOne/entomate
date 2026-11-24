/**
 * Project rollup (Projects Slate pass, 2026-11-22).
 *
 * A project's work lives in two places: the tasks people add to it and the action
 * items its linked meetings produce. These pure helpers fold both (plus the linked
 * meetings' decisions) into the counts the Projects list and project page show.
 * Kept free of I/O so routes/projects.js stays a thin data loader and this is testable.
 */

const DONE = new Set(['done', 'completed', 'complete']);

function isDone(status) {
  return DONE.has(status);
}

/** YYYY-MM-DD for a Date, in UTC (due dates are date-only columns). */
function isoDay(d) {
  return d.toISOString().slice(0, 10);
}

function asList(v) {
  return Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim().length > 0) : [];
}

/** When a meeting happened (or will): its start time, else when the row was made. */
function meetingTime(m) {
  const t = Date.parse(m.start_time || m.created_at || '');
  return Number.isFinite(t) ? t : null;
}

function isLate(item, today) {
  return !isDone(item.status) && typeof item.due_date === 'string' && item.due_date.slice(0, 10) < today;
}

/**
 * Counts for one project.
 * @param {object[]} tasks     tasks rows with project_id = project (any depth; subtasks are skipped)
 * @param {object[]} meetings  meetings rows linked to the project
 * @param {object[]} actions   action_items rows of those meetings
 * @param {Date} now
 */
function rollup(tasks = [], meetings = [], actions = [], now = new Date()) {
  const today = isoDay(now);
  const items = [...tasks.filter((t) => !t.parent_task_id), ...actions];
  const done = items.filter((i) => isDone(i.status)).length;
  const late = items.filter((i) => isLate(i, today)).length;

  const nowMs = now.getTime();
  const held = meetings.filter((m) => {
    const t = meetingTime(m);
    return t == null || t <= nowMs;
  });
  const upcoming = meetings
    .filter((m) => {
      const t = meetingTime(m);
      return t != null && t > nowMs;
    })
    .sort((a, b) => meetingTime(a) - meetingTime(b));
  const last = [...held].sort((a, b) => (meetingTime(b) ?? 0) - (meetingTime(a) ?? 0))[0] || null;
  const next = upcoming[0] || null;

  return {
    total: items.length,
    done,
    open: items.length - done,
    late,
    fromMeetings: actions.length,
    decisions: held.reduce((n, m) => n + asList(m.decisions).length, 0),
    meetings: held.length,
    lastMeeting: last ? { id: last.id, title: last.title || null, at: last.start_time || last.created_at || null } : null,
    nextMeeting: next ? { id: next.id, title: next.title || null, at: next.start_time } : null,
  };
}

/** Group rows by a key column. */
function byKey(rows, key) {
  const out = new Map();
  for (const r of rows || []) {
    const k = r[key];
    if (!k) continue;
    if (!out.has(k)) out.set(k, []);
    out.get(k).push(r);
  }
  return out;
}

/**
 * Rollups for a page of projects, plus the late items across them ("Needs you").
 * @returns {{ projects: object[], needsYou: object[] }}
 */
function summarizeProjects(projects = [], tasks = [], meetings = [], actions = [], now = new Date(), needsLimit = 8) {
  const today = isoDay(now);
  const tasksBy = byKey(tasks, 'project_id');
  const meetingsBy = byKey(meetings, 'project_id');
  const actionsBy = byKey(actions, 'meeting_id');
  const meetingById = new Map((meetings || []).map((m) => [m.id, m]));
  const nameById = new Map(projects.filter((p) => p.status !== 'archived').map((p) => [p.id, p.name]));

  const out = projects.map((p) => {
    const ms = meetingsBy.get(p.id) || [];
    const as = ms.flatMap((m) => actionsBy.get(m.id) || []);
    return { ...p, rollup: rollup(tasksBy.get(p.id) || [], ms, as, now) };
  });

  const late = [];
  for (const t of tasks || []) {
    if (t.parent_task_id || !nameById.has(t.project_id) || !isLate(t, today)) continue;
    late.push({
      key: `task:${t.id}`, kind: 'task', id: t.id, title: (t.title || 'Untitled task').trim(),
      owner: t.assigned_to || null, due: t.due_date, projectId: t.project_id, projectName: nameById.get(t.project_id),
      meetingId: null, meetingTitle: null,
    });
  }
  for (const a of actions || []) {
    const m = meetingById.get(a.meeting_id);
    if (!m || !nameById.has(m.project_id) || !isLate(a, today)) continue;
    late.push({
      key: `action:${a.id}`, kind: 'action', id: a.id, title: (a.task_description || 'Untitled action item').trim(),
      owner: a.assigned_to_name || null, due: a.due_date, projectId: m.project_id, projectName: nameById.get(m.project_id),
      meetingId: m.id, meetingTitle: m.title || null,
    });
  }
  late.sort((a, b) => String(a.due).localeCompare(String(b.due)));

  return { projects: out, needsYou: late.slice(0, needsLimit), lateTotal: late.length };
}

module.exports = { rollup, summarizeProjects, isDone, _internal: { isoDay, meetingTime, isLate } };
