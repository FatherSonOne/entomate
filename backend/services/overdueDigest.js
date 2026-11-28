/**
 * Daily overdue digest (surface audit 2026-11-22, gap 3: "chase what was agreed").
 *
 * Once a day each workspace member gets one email, only when there is something
 * in it:
 *   - "You owe": overdue action items whose owner is them (owner email, or the
 *     owner name matching their name in the workspace)
 *   - "Waiting on others": overdue items from meetings they captured, owned by
 *     someone else, so the person who ran the meeting can chase them
 *
 * Owners outside Entomate are never emailed by this job; reaching them is the
 * explicit Nudge action on an item (routes/meetings.js), which a person sends.
 *
 * Honours Settings › You › Overdue task emails (notifications_json
 * .email_overdue_reminder === false turns it off). notifications_json
 * .overdue_digest_sent_on (YYYY-MM-DD, UTC) makes the job safe to run twice.
 *
 * Runs from POST /api/internal/jobs/digest (GitHub Actions, daily) because
 * Render's free plan sleeps and in-process cron timers miss their slot.
 */

'use strict';

const { supabaseAdmin, supabase: anonClient } = require('../config/supabase');
const mailer = require('./mailer');
const log = require('../utils/log');

const DONE = new Set(['done', 'completed', 'complete', 'cancelled', 'canceled']);
const MAX_ROWS = 12;

const db = () => supabaseAdmin || anonClient;

const norm = (v) => (v == null ? '' : String(v).trim().toLowerCase().replace(/\s+/g, ' '));

/** YYYY-MM-DD in UTC. */
function isoDay(d = new Date()) {
  return new Date(d).toISOString().slice(0, 10);
}

/** Whole days between a YYYY-MM-DD due date and today (UTC). */
function daysOverdue(dueDate, today) {
  const due = Date.parse(`${String(dueDate).slice(0, 10)}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  return Math.max(0, Math.round((now - due) / 86400000));
}

/** Meetings the smoke scripts create (backend/scripts/verify-*.js) are test data. */
const isSmokeMeeting = (m) => Boolean(m && /^\[smoke\]/i.test(String(m.title || '').trim()));

function isOverdue(item, today) {
  if (!item || !item.due_date) return false;
  if (DONE.has(norm(item.status))) return false;
  return String(item.due_date).slice(0, 10) < today;
}

/** Does this item belong to this member? Email first, then the full name. */
function ownedBy(item, member) {
  const email = norm(item.assigned_to_email);
  if (email && member.email && email === norm(member.email)) return true;
  const name = norm(item.assigned_to_name);
  return Boolean(name && member.name && name === norm(member.name));
}

/**
 * Pure: who gets what. Members of one org, that org's overdue items, and the
 * meetings those items came from.
 * @param {{ members: Array<{user_id:string,email:string|null,name:string|null}>,
 *           items: Array<object>, meetings: Map<string, {id:string,title?:string,created_by?:string}>,
 *           optedOut?: Set<string>, sentToday?: Set<string>, today: string }} input
 * @returns {Array<{ member: object, owed: object[], waiting: object[] }>}
 */
function buildDigests({ members, items, meetings, optedOut = new Set(), sentToday = new Set(), today }) {
  const overdue = items.filter((i) => isOverdue(i, today) && !isSmokeMeeting(meetings.get(i.meeting_id)));
  const row = (i) => {
    const m = meetings.get(i.meeting_id) || null;
    return {
      id: i.id,
      text: i.task_description || 'Untitled item',
      owner: i.assigned_to_name || i.assigned_to_email || null,
      dueDate: String(i.due_date).slice(0, 10),
      daysOverdue: daysOverdue(i.due_date, today),
      meeting: m ? { id: m.id, title: m.title || 'Untitled meeting' } : null,
    };
  };
  const byAge = (a, b) => b.daysOverdue - a.daysOverdue;

  const out = [];
  for (const member of members) {
    if (!member.email || optedOut.has(member.user_id) || sentToday.has(member.user_id)) continue;
    const owed = overdue.filter((i) => ownedBy(i, member)).map(row).sort(byAge);
    const waiting = overdue
      .filter((i) => !ownedBy(i, member) && meetings.get(i.meeting_id)?.created_by === member.user_id)
      .map(row)
      .sort(byAge);
    if (owed.length || waiting.length) out.push({ member, owed, waiting });
  }
  return out;
}

function renderDigest({ member, owed, waiting }, base = mailer.appUrl()) {
  const e = mailer.escapeHtml;
  const first = (member.name || '').split(' ')[0] || 'there';
  const total = owed.length + waiting.length;
  const subject = owed.length
    ? `${owed.length} overdue item${owed.length === 1 ? '' : 's'} on you${waiting.length ? `, ${waiting.length} waiting on others` : ''}`
    : `${waiting.length} overdue item${waiting.length === 1 ? '' : 's'} from your meetings`;

  const line = (r, withOwner) => {
    const age = `${r.daysOverdue} day${r.daysOverdue === 1 ? '' : 's'} late`;
    const from = r.meeting ? ` · from ${r.meeting.title}` : '';
    const who = withOwner && r.owner ? `${r.owner} · ` : '';
    return { text: `- ${r.text} (${who}${age}${from})`, html: `<tr><td style="padding:8px 0;border-bottom:1px solid #e4e2df;font:15px/1.4 -apple-system,Segoe UI,sans-serif;color:#1d1b19">${e(r.text)}<div style="font:12px/1.4 ui-monospace,Menlo,monospace;color:#6b6560;margin-top:3px">${e(who)}${e(age)}${r.meeting ? ` · <a href="${base}/meetings/${encodeURIComponent(r.meeting.id)}" style="color:#6b6560">${e(r.meeting.title)}</a>` : ''}</div></td></tr>` };
  };
  const block = (title, rows, withOwner) => {
    if (!rows.length) return { text: '', html: '' };
    const shown = rows.slice(0, MAX_ROWS).map((r) => line(r, withOwner));
    const more = rows.length > MAX_ROWS ? rows.length - MAX_ROWS : 0;
    return {
      text: `${title}\n${shown.map((s) => s.text).join('\n')}${more ? `\n...and ${more} more` : ''}\n\n`,
      html: `<p style="font:600 11px/1 ui-monospace,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:#6b6560;margin:24px 0 6px">${e(title)}</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${shown.map((s) => s.html).join('')}</table>${more ? `<p style="font:13px -apple-system,Segoe UI,sans-serif;color:#6b6560">and ${more} more</p>` : ''}`,
    };
  };
  const a = block('You owe', owed, false);
  const b = block('Waiting on others', waiting, true);
  const settings = `${base}/settings`;
  const text = `Hi ${first},\n\n${total} item${total === 1 ? ' is' : 's are'} past due.\n\n${a.text}${b.text}Open your work: ${base}/tasks\n\nTurn these emails off in Settings: ${settings}\n`;
  const html = `<div style="max-width:560px;margin:0 auto;padding:24px 20px;background:#faf9f7">`
    + `<p style="font:600 13px/1 ui-monospace,Menlo,monospace;letter-spacing:.06em;color:#1d1b19;margin:0 0 20px">ENTOMATE</p>`
    + `<p style="font:15px/1.5 -apple-system,Segoe UI,sans-serif;color:#1d1b19;margin:0">Hi ${e(first)}, ${total} item${total === 1 ? ' is' : 's are'} past due.</p>`
    + a.html + b.html
    + `<p style="margin:28px 0 0"><a href="${base}/tasks" style="display:inline-block;padding:10px 16px;background:#b3123a;color:#fff;text-decoration:none;font:600 14px -apple-system,Segoe UI,sans-serif;border-radius:4px">Open your work</a></p>`
    + `<p style="font:12px/1.5 -apple-system,Segoe UI,sans-serif;color:#8a837d;margin:24px 0 0">You get this when something from your meetings is overdue. <a href="${settings}" style="color:#8a837d">Turn it off in Settings</a>.</p>`
    + `</div>`;
  return { subject, text, html };
}

/** Members of every org, with name and email. */
async function loadMembers() {
  const { data, error } = await db().from('org_members').select('org_id, user_id, user_name, user_email');
  if (error) throw error;
  const rows = data || [];
  const missing = [...new Set(rows.filter((r) => !r.user_email || !r.user_name).map((r) => r.user_id))];
  const users = new Map();
  if (missing.length) {
    const { data: u } = await db().from('users').select('id, email, full_name').in('id', missing);
    for (const x of u || []) users.set(x.id, x);
  }
  return rows.map((r) => ({
    org_id: r.org_id,
    user_id: r.user_id,
    email: r.user_email || users.get(r.user_id)?.email || null,
    name: r.user_name || users.get(r.user_id)?.full_name || null,
  }));
}

/**
 * The job. Returns counts for the job log.
 * @param {{ now?: Date, dryRun?: boolean }} [opts]
 */
async function runOverdueDigest({ now = new Date(), dryRun = false } = {}) {
  if (!db()) return { skipped: 'database not configured' };
  if (!dryRun && !mailer.isConfigured()) return { skipped: 'no email transport (set RESEND_API_KEY)' };
  const today = isoDay(now);

  const { data: items, error } = await db()
    .from('action_items')
    .select('id, org_id, meeting_id, task_description, assigned_to_name, assigned_to_email, due_date, status')
    .lt('due_date', today)
    .not('status', 'in', '("done","completed","complete","cancelled","canceled")')
    .limit(2000);
  if (error) throw error;
  if (!items?.length) return { overdue: 0, sent: 0 };

  const meetingIds = [...new Set(items.map((i) => i.meeting_id).filter(Boolean))];
  const meetings = new Map();
  if (meetingIds.length) {
    const { data: m } = await db().from('meetings').select('id, title, created_by, org_id').in('id', meetingIds);
    for (const x of m || []) meetings.set(x.id, x);
  }

  const members = await loadMembers();
  const userIds = [...new Set(members.map((m) => m.user_id))];
  const prefs = new Map();
  if (userIds.length) {
    const { data: s } = await db().from('user_settings').select('user_id, notifications_json').in('user_id', userIds);
    for (const x of s || []) prefs.set(x.user_id, x.notifications_json || {});
  }
  const optedOut = new Set([...prefs].filter(([, n]) => n.email_overdue_reminder === false).map(([id]) => id));
  const sentToday = new Set([...prefs].filter(([, n]) => n.overdue_digest_sent_on === today).map(([id]) => id));

  // One digest per person per day, even when they belong to several orgs: merge per user.
  const perUser = new Map();
  const orgIds = [...new Set(members.map((m) => m.org_id))];
  for (const orgId of orgIds) {
    const orgMembers = members.filter((m) => m.org_id === orgId);
    const orgItems = items.filter((i) => i.org_id === orgId);
    if (!orgItems.length) continue;
    for (const d of buildDigests({ members: orgMembers, items: orgItems, meetings, optedOut, sentToday, today })) {
      const prev = perUser.get(d.member.user_id);
      if (prev) { prev.owed.push(...d.owed); prev.waiting.push(...d.waiting); } else perUser.set(d.member.user_id, d);
    }
  }

  let sent = 0;
  let failed = 0;
  for (const [userId, digest] of perUser) {
    const msg = renderDigest(digest);
    if (dryRun) { sent++; continue; }
    try {
      const res = await mailer.send({ to: digest.member.email, ...msg });
      if (res.skipped) continue;
      sent++;
      const next = { ...(prefs.get(userId) || {}), overdue_digest_sent_on: today };
      const { error: upErr } = await db().from('user_settings').upsert({ user_id: userId, notifications_json: next }, { onConflict: 'user_id' });
      if (upErr) log.warn('[OverdueDigest] could not mark sent', { userId, error: upErr.message });
    } catch (err) {
      failed++;
      log.warn('[OverdueDigest] send failed', { userId, error: err.message });
    }
  }
  return { overdue: items.length, recipients: perUser.size, sent, failed, dryRun };
}

module.exports = { runOverdueDigest, buildDigests, renderDigest, isOverdue, isSmokeMeeting, ownedBy, daysOverdue, isoDay };
