/**
 * Nudge: a person sends the owner of an action item one reminder email
 * (surface audit 2026-11-22, gap 3). The person presses the button, so the
 * email goes out in their name with Reply-To set to them; Entomate never
 * emails an owner on its own.
 *
 * One nudge per item per 24 hours. The last time is kept on the item
 * (action_items.last_nudged_at, nudge_count; migration 20261122000018). Until
 * that migration has run, an in-memory record keeps the same limit per server.
 */

'use strict';

const mailer = require('./mailer');

const WINDOW_MS = 24 * 60 * 60 * 1000;
const DONE = new Set(['done', 'completed', 'complete', 'cancelled', 'canceled']);
const recent = new Map(); // item id -> ms, fallback while the columns are missing

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

/**
 * Can this item be nudged now? Pure.
 * @returns {{ ok: true } | { ok: false, status: number, error: string, code: string }}
 */
function checkNudge(item, now = Date.now()) {
  if (!item) return { ok: false, status: 404, code: 'not_found', error: 'Action item not found' };
  if (DONE.has(String(item.status || '').toLowerCase())) return { ok: false, status: 409, code: 'done', error: 'This item is already done.' };
  const to = String(item.assigned_to_email || '').trim();
  if (!EMAIL_RE.test(to)) return { ok: false, status: 422, code: 'no_email', error: 'The owner has no email address on this item. Add one, then nudge.' };
  const last = Math.max(item.last_nudged_at ? Date.parse(item.last_nudged_at) : 0, recent.get(item.id) || 0);
  if (last && now - last < WINDOW_MS) return { ok: false, status: 429, code: 'recent', error: 'Already nudged in the last 24 hours.' };
  return { ok: true };
}

function renderNudge({ item, meeting, sender }, base = mailer.appUrl()) {
  const e = mailer.escapeHtml;
  const from = sender?.name || sender?.email || 'A teammate';
  const owner = (item.assigned_to_name || '').split(' ')[0] || 'there';
  const due = item.due_date ? String(item.due_date).slice(0, 10) : null;
  const title = meeting?.title || 'a recent meeting';
  const subject = `Reminder: ${String(item.task_description || 'an action item').slice(0, 120)}`;
  const text = `Hi ${owner},\n\n${from} sent a reminder about something agreed in ${title}:\n\n"${item.task_description}"${due ? `\nDue ${due}` : ''}\n\nReply to this email to answer ${from} directly.\n\nSent from Entomate on behalf of ${from}.`;
  const html = `<div style="max-width:560px;margin:0 auto;padding:24px 20px;background:#faf9f7;font:15px/1.5 -apple-system,Segoe UI,sans-serif;color:#1d1b19">`
    + `<p style="margin:0 0 14px">Hi ${e(owner)},</p>`
    + `<p style="margin:0 0 14px">${e(from)} sent a reminder about something agreed in <strong>${e(title)}</strong>:</p>`
    + `<p style="margin:0 0 6px;padding:12px 14px;background:#fff;border:1px solid #e4e2df;border-radius:4px">${e(item.task_description)}</p>`
    + (due ? `<p style="margin:0 0 14px;font:12px ui-monospace,Menlo,monospace;color:#6b6560">DUE ${e(due)}</p>` : '')
    + `<p style="margin:18px 0 0">Reply to this email to answer ${e(from)} directly.</p>`
    + `<p style="margin:24px 0 0;font-size:12px;color:#8a837d">Sent from <a href="${base}" style="color:#8a837d">Entomate</a> on behalf of ${e(from)}.</p>`
    + `</div>`;
  return { subject, text, html };
}

/**
 * Send it. `db` is the service client; `item` has id, status, task_description,
 * assigned_to_name, assigned_to_email, due_date, last_nudged_at?, nudge_count?.
 */
async function sendNudge(db, { item, meeting, sender }, now = new Date()) {
  const check = checkNudge(item, now.getTime());
  if (!check.ok) return check;
  if (!mailer.isConfigured()) return { ok: false, status: 503, code: 'no_mail', error: 'Email is not set up on the server.' };

  const msg = renderNudge({ item, meeting, sender });
  const res = await mailer.send({ to: item.assigned_to_email.trim(), replyTo: sender?.email || null, ...msg });
  if (res.skipped) return { ok: false, status: 503, code: 'no_mail', error: 'Email is not set up on the server.' };

  recent.set(item.id, now.getTime());
  const at = now.toISOString();
  const { error } = await db
    .from('action_items')
    .update({ last_nudged_at: at, nudge_count: (Number(item.nudge_count) || 0) + 1 })
    .eq('id', item.id);
  // 42703 = the columns aren't there yet; the in-memory record still holds the limit.
  const stored = !error;
  return { ok: true, nudgedAt: at, to: item.assigned_to_email.trim(), stored };
}

module.exports = { checkNudge, renderNudge, sendNudge, _recent: recent };
