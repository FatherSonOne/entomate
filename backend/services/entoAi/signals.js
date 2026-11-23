/**
 * Entomate AI proactive signals (EAI-06, docs/app-dev/entomate-ai-APP-PRODUCT.md §6 P5).
 *
 * GET /api/ento-ai/signals reads these. They replace the 10-minute client poll in
 * EntoAIProactiveChecker, which listed tasks and meetings and checked fields the rows
 * do not have (`dueDate`, status `completed`, `date` / `scheduled_at`), so no badge
 * ever came from an overdue task or a meeting that was about to start.
 *
 * Read under the caller's user-JWT client (D2): RLS is the perimeter, the
 * `.in('org_id', orgIds)` on each query is the second fence. A failed read throws,
 * so the route answers 502 and the launcher keeps what it had; it never shows
 * "nothing waiting" because a query broke.
 *
 * A signal is live state, not a stored row: it goes away when the task is done or
 * moved, so there is nothing to dismiss and no table (no migration).
 */

const { CLOSED, trunc } = require('./tools');

const CLOSED_FILTER = `(${CLOSED.map((s) => `"${s}"`).join(',')})`;
/** At most this many signals go to the panel; `total` still counts all of them. */
const MAX_SIGNALS = 5;
const SOON_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function rows({ data, error, count }) {
  if (error) throw new Error(error.message || 'query failed');
  return { list: data || [], count: count ?? (data || []).length };
}

const daysLate = (due, today) => Math.max(1, Math.round((Date.parse(today) - Date.parse(due)) / DAY_MS));
const lateText = (n) => (n === 1 ? '1 day overdue' : `${n} days overdue`);

async function signalsFor(ctx, nowDate = new Date()) {
  const { db, orgIds } = ctx;
  if (!orgIds.length) return { signals: [], total: 0 };
  const today = nowDate.toISOString().slice(0, 10);
  const nowIso = nowDate.toISOString();
  const soonIso = new Date(nowDate.getTime() + SOON_MS).toISOString();

  const [meetings, tasks, items] = await Promise.all([
    db.from('meetings').select('id, title, start_time', { count: 'exact' })
      .in('org_id', orgIds).gte('start_time', nowIso).lt('start_time', soonIso)
      .order('start_time', { ascending: true }).limit(MAX_SIGNALS).then(rows),
    db.from('tasks').select('id, title, due_date', { count: 'exact' })
      .in('org_id', orgIds).not('status', 'in', CLOSED_FILTER).lt('due_date', today)
      .order('due_date', { ascending: true }).limit(MAX_SIGNALS).then(rows),
    db.from('action_items').select('id, task_description, due_date, meeting_id', { count: 'exact' })
      .in('org_id', orgIds).not('status', 'in', CLOSED_FILTER).lt('due_date', today)
      .order('due_date', { ascending: true }).limit(MAX_SIGNALS).then(rows),
  ]);

  const signals = [
    ...meetings.list.map((m) => {
      const mins = Math.max(1, Math.round((Date.parse(m.start_time) - nowDate.getTime()) / 60000));
      const title = trunc(m.title || 'A meeting', 60);
      return {
        id: `meeting:${m.id}`,
        kind: 'meeting_soon',
        label: `"${title}" starts in ${mins} min`,
        query: `My meeting "${title}" starts in ${mins} minutes. Brief me: what was decided last time and which action items are still open?`,
      };
    }),
    ...tasks.list.map((t) => {
      const late = lateText(daysLate(t.due_date, today));
      const title = trunc(t.title, 60);
      return {
        id: `task:${t.id}`,
        kind: 'overdue_task',
        label: `"${title}" is ${late}`,
        query: `My task "${title}" is ${late} (it was due ${t.due_date}). Help me deal with it: should I move the date, reassign it or mark it done?`,
      };
    }),
    ...items.list.map((a) => {
      const late = lateText(daysLate(a.due_date, today));
      const text = trunc(a.task_description, 60);
      return {
        id: `action_item:${a.id}`,
        kind: 'overdue_action_item',
        label: `Action item "${text}" is ${late}`,
        query: `The action item "${text}" is ${late} (it was due ${a.due_date}). Help me deal with it.`,
      };
    }),
  ].slice(0, MAX_SIGNALS);

  return { signals, total: meetings.count + tasks.count + items.count };
}

module.exports = { signalsFor, MAX_SIGNALS };
