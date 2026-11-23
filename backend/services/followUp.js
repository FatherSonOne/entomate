/**
 * Follow-up email after a meeting (surface audit gap 4; Slate pick C "Letter",
 * 2026-11-23).
 *
 * When a meeting's minutes land, Entomate drafts one email to the people who
 * were in it: an opening line, what was decided, who is on what (open action
 * items with owner and due date) and the next meeting with the same people.
 * The draft is sent on its own 20 minutes after the meeting ends unless someone
 * edits it (it then waits for Send now), stops it, or its owner has turned
 * auto-send off. Replies go to the owner (Reply-To); private notes are never
 * included.
 *
 * Recipients: the Google Calendar event behind the meeting (the owner's
 * calendar), the invitees of a bot run, and the email on each action item.
 * Anyone who opted out of a bot recording is left out.
 *
 * Table: public.follow_ups (migration 20261123000001). Writes use the service
 * role; callers check org access first.
 */

'use strict';

const mailer = require('./mailer');
const log = require('../utils/log');

const HOLD_MS = 20 * 60 * 1000; // after the meeting ends
const MIN_REVIEW_MS = 15 * 60 * 1000; // always at least this long to stop it
const FRESH_MS = 6 * 60 * 60 * 1000; // only meetings this recent are drafted by the job
const MAX_RECIPIENTS = 20;
const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;
const DONE = new Set(['done', 'completed', 'complete', 'cancelled', 'canceled']);
const DEFAULT_INCLUDE = Object.freeze({ decisions: true, items: true, next: true, summary: false, copy: true });
const EDITABLE = new Set(['draft', 'scheduled', 'stopped', 'failed']);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function db() {
  return require('../config/supabase').supabaseAdmin;
}

// ── Pure helpers ──

const asList = (v) => (Array.isArray(v) ? v : []);
const decisionText = (d) => String(typeof d === 'string' ? d : (d && (d.text || d.decision || d.title)) || '').trim();
const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || '';

/** Valid, de-duplicated (by lower-case email), at most 20, without `exclude`. */
function cleanRecipients(list, exclude = []) {
  const skip = new Set(asList(exclude).map((e) => String(e || '').trim().toLowerCase()).filter(Boolean));
  const seen = new Set();
  const out = [];
  for (const r of asList(list)) {
    const email = String(r?.email || '').trim();
    const key = email.toLowerCase();
    if (!EMAIL_RE.test(email) || skip.has(key) || seen.has(key)) continue;
    seen.add(key);
    const name = String(r?.name || '').trim().slice(0, 120) || null;
    out.push({ name, email, source: ['invite', 'owner', 'added'].includes(r?.source) ? r.source : 'added' });
    if (out.length >= MAX_RECIPIENTS) break;
  }
  return out;
}

/** When the meeting ended: end_time, else start + duration, else created_at + duration. */
function meetingEnd(meeting) {
  if (meeting?.end_time) return new Date(meeting.end_time);
  const start = new Date(meeting?.start_time || meeting?.created_at || Date.now());
  const mins = Number(meeting?.duration_minutes) || 0;
  return new Date(start.getTime() + mins * 60 * 1000);
}

/** 20 minutes after the meeting ends, and never sooner than 15 minutes from now. */
function sendAtFor(meeting, now = new Date()) {
  return new Date(Math.max(meetingEnd(meeting).getTime() + HOLD_MS, now.getTime() + MIN_REVIEW_MS));
}

/**
 * "Tue 24 Nov, 15:00" from an ISO date-time, read in the offset it was written
 * with (Google returns the calendar's own offset), so the server's UTC clock
 * does not shift it.
 */
function whenLabel(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(String(iso || ''));
  if (!m) return '';
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  const day = `${DAYS[d.getUTCDay()]} ${+m[3]} ${MONTHS[+m[2] - 1]}`;
  return m[4] ? `${day}, ${m[4]}:${m[5]}` : day;
}

function defaultSubject(meeting, startIso) {
  const date = whenLabel(startIso || meeting?.start_time || meeting?.created_at).replace(/^\w+ /, '').replace(/,.*$/, '');
  const title = String(meeting?.title || 'our meeting').trim();
  return `Follow-up: ${title}${date ? ` (${date})` : ''}`;
}

function nameList(recipients) {
  const names = asList(recipients).map((r) => firstName(r.name) || r.email.split('@')[0]);
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length > 4) return 'all';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function defaultOpening(recipients) {
  const who = nameList(recipients);
  return `Hi ${who || 'all'}, thanks for the time today. Here is what we agreed and who is on what.`;
}

/** What goes in the email, from the minutes. Pure. */
function parts(meeting, actionItems) {
  return {
    summary: String(meeting?.summary || '').trim(),
    decisions: asList(meeting?.decisions).map(decisionText).filter(Boolean).slice(0, 12),
    items: asList(actionItems)
      .filter((i) => !DONE.has(String(i.status || '').toLowerCase()))
      .map((i) => ({
        title: String(i.task_description || i.title || '').trim(),
        owner: i.assigned_to_name || null,
        due: i.due_date ? whenLabel(String(i.due_date).slice(0, 10)) : null,
      }))
      .filter((i) => i.title)
      .slice(0, 20),
  };
}

/**
 * The email itself. Every value is escaped; the text part mirrors the HTML.
 * @returns {{ subject: string, html: string, text: string }}
 */
function render(row, p, ownerName) {
  const e = mailer.escapeHtml;
  const inc = { ...DEFAULT_INCLUDE, ...(row.include || {}) };
  const opening = String(row.opening || '').trim();
  const signoff = String(row.signoff || '').trim() || `Thanks,\n${firstName(ownerName) || ''}`.trim();
  const next = row.next_meeting && row.next_meeting.title ? row.next_meeting : null;
  const H = 'font:600 11px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#7D7D77;margin:22px 0 6px;padding-bottom:6px;border-bottom:1px solid #E2E1DB';
  const html = [];
  const text = [];
  html.push(`<div style="font:15px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#161615;max-width:600px">`);
  if (opening) { html.push(`<p style="margin:0 0 12px">${e(opening).replace(/\n/g, '<br>')}</p>`); text.push(opening, ''); }
  if (inc.summary && p.summary) {
    html.push(`<div style="${H}">Summary</div><p style="margin:0">${e(p.summary)}</p>`);
    text.push('SUMMARY', p.summary, '');
  }
  if (inc.decisions && p.decisions.length) {
    html.push(`<div style="${H}">Decided</div>`);
    html.push(p.decisions.map((d) => `<div style="padding:6px 0 6px 12px;border-left:3px solid #E0004D;margin:6px 0">${e(d)}</div>`).join(''));
    text.push('DECIDED', ...p.decisions.map((d) => `- ${d}`), '');
  }
  if (inc.items && p.items.length) {
    html.push(`<div style="${H}">Who is on what</div><table role="presentation" style="border-collapse:collapse;width:100%">`);
    html.push(p.items.map((i) => `<tr><td style="padding:6px 12px 6px 0;border-bottom:1px solid #EEEDE8">${e(i.title)}</td><td style="padding:6px 12px 6px 0;border-bottom:1px solid #EEEDE8;color:#4A4A46;white-space:nowrap">${e(i.owner || '')}</td><td style="padding:6px 0;border-bottom:1px solid #EEEDE8;text-align:right;white-space:nowrap;font-family:Menlo,Consolas,monospace;font-size:13px">${e(i.due || '')}</td></tr>`).join(''));
    html.push('</table>');
    text.push('WHO IS ON WHAT', ...p.items.map((i) => `- ${i.title}${i.owner ? ` (${i.owner}` : ''}${i.owner && i.due ? `, ${i.due})` : i.owner ? ')' : i.due ? ` (${i.due})` : ''}`), '');
  }
  if (inc.next && next) {
    const line = `${next.title}${next.when ? ` · ${next.when}` : ''}`;
    html.push(`<div style="${H}">Next</div><p style="margin:0">${e(line)}</p>`);
    text.push('NEXT', line, '');
  }
  html.push(`<p style="margin:22px 0 0">${e(signoff).replace(/\n/g, '<br>')}</p>`);
  html.push(`<p style="margin:28px 0 0;font-size:12px;color:#A9A9A2">Sent with Entomate. Reply to this email to reach ${e(ownerName || 'the sender')}.</p></div>`);
  text.push(signoff, '', `Sent with Entomate. Reply to this email to reach ${ownerName || 'the sender'}.`);
  return { subject: String(row.subject || '').trim() || 'Follow-up', html: html.join(''), text: text.join('\n') };
}

/** The calendar event behind a meeting: the event id in `key`, else the closest start within 45 minutes. */
function pickEvent(events, meeting, key) {
  const list = asList(events).filter((ev) => ev?.start?.dateTime && ev.status !== 'cancelled');
  const id = key ? String(key).split('@')[0] : null;
  if (id) {
    const hit = list.find((ev) => ev.id === id);
    if (hit) return hit;
  }
  const at = new Date(meeting?.start_time || meeting?.created_at || 0).getTime();
  let best = null;
  let bestGap = 45 * 60 * 1000;
  for (const ev of list) {
    const gap = Math.abs(new Date(ev.start.dateTime).getTime() - at);
    if (gap <= bestGap) { best = ev; bestGap = gap; }
  }
  return best;
}

/** The next event after `after` that shares an invitee email or the same title. */
function pickNext(events, emails, title, after) {
  const want = new Set(asList(emails).map((x) => String(x).toLowerCase()));
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const t = norm(title);
  return asList(events)
    .filter((ev) => ev?.start?.dateTime && ev.status !== 'cancelled' && new Date(ev.start.dateTime) > after)
    .sort((a, b) => new Date(a.start.dateTime) - new Date(b.start.dateTime))
    .find((ev) => (t && norm(ev.summary) === t) || asList(ev.attendees).some((a) => !a.self && want.has(String(a.email || '').toLowerCase()))) || null;
}

/** Should the job send this one on its own? Pure. */
function shouldAutoSend({ autoSend, recipients, p, meeting, now = new Date() }) {
  if (!autoSend || !asList(recipients).length) return false;
  if (!p.decisions.length && !p.items.length) return false;
  return now.getTime() - meetingEnd(meeting).getTime() < FRESH_MS;
}

// ── Data ──

async function identity(userId) {
  if (!userId) return { email: null, name: null };
  try {
    const { data } = await db().auth.admin.getUserById(userId);
    const u = data?.user;
    const meta = u?.user_metadata || {};
    const name = meta.full_name || meta.name || [meta.first_name, meta.last_name].filter(Boolean).join(' ') || (u?.email ? u.email.split('@')[0] : null);
    return { email: u?.email || null, name: name || null };
  } catch {
    return { email: null, name: null };
  }
}

async function ownerSettings(userId) {
  if (!userId) return { autoSend: false, calendar: null };
  const { data } = await db().from('user_settings').select('calendar_json, follow_up_auto_send').eq('user_id', userId).maybeSingle();
  return { autoSend: data ? data.follow_up_auto_send !== false : true, calendar: data?.calendar_json || null };
}

/** Invitees and the next meeting from the owner's Google Calendar. Never throws. */
async function fromCalendar(meeting, ownerId, calendarJson, botKey) {
  const tokens = calendarJson?.tokens;
  if (!tokens) return { invitees: [], next: null, startIso: null };
  try {
    const service = require('./calendarService');
    service.initialize();
    if (!service.isConfigured()) return { invitees: [], next: null, startIso: null };
    const autoJoin = require('./calendarAutoJoin');
    const live = { ...tokens, _onRefresh: (t) => autoJoin.persistTokens(ownerId, t) };
    const at = new Date(meeting.start_time || meeting.created_at);
    const around = await service.getEvents(live, {
      timeMin: new Date(at.getTime() - 3 * 60 * 60 * 1000).toISOString(),
      timeMax: new Date(at.getTime() + 3 * 60 * 60 * 1000).toISOString(),
      maxResults: 50,
    });
    const ev = pickEvent(around, meeting, botKey);
    const invitees = asList(ev?.attendees)
      .filter((a) => !a.self && !a.resource && a.email && a.responseStatus !== 'declined')
      .map((a) => ({ name: a.displayName || null, email: a.email, source: 'invite' }));
    const ahead = await service.getEvents(live, {
      timeMin: new Date(Math.max(Date.now(), meetingEnd(meeting).getTime())).toISOString(),
      timeMax: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      maxResults: 100,
    });
    const nx = pickNext(ahead, invitees.map((i) => i.email), ev?.summary || meeting.title, meetingEnd(meeting));
    const next = nx ? { title: nx.summary || 'Next meeting', start: nx.start.dateTime, when: whenLabel(nx.start.dateTime) } : null;
    return { invitees, next, startIso: ev?.start?.dateTime || null };
  } catch (err) {
    log.warn('[FollowUp] calendar lookup failed', { meetingId: meeting.id, error: err.message });
    return { invitees: [], next: null, startIso: null };
  }
}

async function loadMeeting(meetingId) {
  const { data: meeting, error } = await db()
    .from('meetings')
    .select('id, org_id, title, summary, decisions, attendees, start_time, end_time, duration_minutes, created_at, created_by')
    .eq('id', meetingId)
    .maybeSingle();
  if (error) throw error;
  if (!meeting) return null;
  const { data: items } = await db()
    .from('action_items')
    .select('id, task_description, assigned_to_name, assigned_to_email, due_date, status')
    .eq('meeting_id', meetingId)
    .eq('org_id', meeting.org_id);
  return { meeting, items: items || [] };
}

function ownerOf(meeting, fallbackUserId) {
  const id = meeting.user_id || meeting.created_by || fallbackUserId || null;
  return id && /^[0-9a-f-]{36}$/i.test(String(id)) ? String(id) : (fallbackUserId || null);
}

/** One or two plain sentences from the summary; the template line when AI is off or slow. */
async function writeOpening(meeting, recipients, p) {
  const fallback = defaultOpening(recipients);
  try {
    const gemini = require('../config/gemini');
    if (!gemini.isConfigured() || !p.summary) return fallback;
    const prompt = [
      'Write the opening of a follow-up email sent right after a meeting.',
      `Greet: ${nameList(recipients) || 'all'}. Then one sentence on what the meeting settled.`,
      'Rules: at most 2 sentences and 45 words. Plain, warm, no exclamation marks, no promises, no subject line, no sign-off.',
      'Do not list the decisions or tasks; they follow below the opening.',
      `Meeting: ${meeting.title || 'Untitled'}`,
      `Summary: ${p.summary.slice(0, 1500)}`,
    ].join('\n');
    const out = await Promise.race([
      gemini.chat(prompt, { temperature: 0.4 }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
    ]);
    const line = String(out || '').replace(/\s+/g, ' ').replace(/^["']|["']$/g, '').trim();
    return line && line.length <= 400 ? line : fallback;
  } catch (err) {
    log.info('[FollowUp] opening fell back to the template', { meetingId: meeting.id, error: err.message });
    return fallback;
  }
}

/** Bot-run invitees and opt-outs for this meeting. */
async function fromBot(meetingId) {
  const { data: sessions } = await db().from('bot_sessions').select('id, calendar_event_key').eq('meeting_id', meetingId);
  const ids = asList(sessions).map((s) => s.id);
  if (!ids.length) return { invitees: [], optedOut: [], key: null };
  const { data: rows } = await db().from('bot_session_attendees').select('email, opted_out_at').in('session_id', ids);
  const list = asList(rows);
  return {
    invitees: list.filter((r) => !r.opted_out_at).map((r) => ({ name: null, email: r.email, source: 'invite' })),
    optedOut: list.filter((r) => r.opted_out_at).map((r) => r.email),
    key: asList(sessions).find((s) => s.calendar_event_key)?.calendar_event_key || null,
  };
}

/**
 * The follow-up for a meeting, drafted on first ask.
 * @param {string} meetingId
 * @param {{ userId?: string|null, now?: Date }} [opts] userId: the person asking (owner when the meeting has none)
 */
async function getOrCreate(meetingId, { userId = null, now = new Date() } = {}) {
  const loaded = await loadMeeting(meetingId);
  if (!loaded) return null;
  const { meeting, items } = loaded;
  const { data: existing } = await db().from('follow_ups').select('*').eq('meeting_id', meetingId).maybeSingle();
  const p = parts(meeting, items);
  if (existing) return { row: existing, meeting, parts: p };
  // Nothing to say until the minutes land; drafting now would freeze an empty letter.
  if (!p.summary && !p.decisions.length && !p.items.length) return { row: null, meeting, parts: p };

  const ownerId = ownerOf(meeting, userId);
  const [me, settings, bot] = await Promise.all([identity(ownerId), ownerSettings(ownerId), fromBot(meetingId)]);
  const cal = await fromCalendar(meeting, ownerId, settings.calendar, bot.key);
  const owners = items.filter((i) => i.assigned_to_email).map((i) => ({ name: i.assigned_to_name, email: i.assigned_to_email, source: 'owner' }));
  const recipients = cleanRecipients([...cal.invitees, ...bot.invitees, ...owners], [me.email, ...bot.optedOut]);
  const auto = shouldAutoSend({ autoSend: settings.autoSend, recipients, p, meeting, now });
  const row = {
    org_id: meeting.org_id,
    meeting_id: meeting.id,
    owner_id: ownerId,
    status: auto ? 'scheduled' : 'draft',
    recipients,
    subject: defaultSubject(meeting, cal.startIso),
    opening: await writeOpening(meeting, recipients, p),
    signoff: `Thanks,\n${firstName(me.name) || ''}`.trim(),
    include: { ...DEFAULT_INCLUDE, next: Boolean(cal.next) },
    next_meeting: cal.next,
    send_at: auto ? sendAtFor(meeting, now).toISOString() : null,
  };
  const { data: created, error } = await db().from('follow_ups').insert(row).select('*').single();
  if (error) {
    // Two callers raced: the other insert won, so read it.
    if (/duplicate key|follow_ups_meeting_id_key/i.test(error.message)) {
      const { data: again } = await db().from('follow_ups').select('*').eq('meeting_id', meetingId).single();
      return { row: again, meeting, parts: p };
    }
    throw error;
  }
  log.info('[FollowUp] drafted', { meetingId, status: created.status, recipients: recipients.length });
  return { row: created, meeting, parts: p };
}

/** Save edits. Editing a scheduled follow-up holds it for Send now. */
async function update(meetingId, patch, { now = new Date() } = {}) {
  const { data: row } = await db().from('follow_ups').select('*').eq('meeting_id', meetingId).maybeSingle();
  if (!row) return { error: 'not_found' };
  if (!EDITABLE.has(row.status)) return { error: 'locked', status: row.status };
  const next = { edited_at: now.toISOString() };
  if (patch.recipients !== undefined) next.recipients = cleanRecipients(patch.recipients.map((r) => ({ ...r, source: r.source || 'added' })));
  if (typeof patch.subject === 'string') next.subject = patch.subject.trim().slice(0, 200);
  if (typeof patch.opening === 'string') next.opening = patch.opening.trim().slice(0, 2000);
  if (typeof patch.signoff === 'string') next.signoff = patch.signoff.trim().slice(0, 300);
  if (patch.include && typeof patch.include === 'object') {
    next.include = { ...DEFAULT_INCLUDE, ...(row.include || {}) };
    for (const k of Object.keys(DEFAULT_INCLUDE)) if (typeof patch.include[k] === 'boolean') next.include[k] = patch.include[k];
  }
  if (row.status === 'scheduled') { next.status = 'draft'; next.send_at = null; }
  const { data, error } = await db().from('follow_ups').update(next).eq('id', row.id).select('*').single();
  if (error) throw error;
  return { row: data };
}

async function stop(meetingId) {
  const { data, error } = await db()
    .from('follow_ups')
    .update({ status: 'stopped', send_at: null })
    .eq('meeting_id', meetingId)
    .in('status', ['scheduled', 'draft', 'failed'])
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Send it now. Claims the row first (status -> sending) so the job and a
 * person pressing Send cannot both send it.
 * @returns {Promise<{ row?: object, error?: string, status?: number }>}
 */
async function send(meetingId, { now = new Date() } = {}) {
  const { data: claimed, error: claimError } = await db()
    .from('follow_ups')
    .update({ status: 'sending', error: null })
    .eq('meeting_id', meetingId)
    .in('status', ['draft', 'scheduled', 'stopped', 'failed'])
    .select('*')
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return { error: 'Already sent or being sent.', status: 409 };

  const fail = async (message, status = 502) => {
    await db().from('follow_ups').update({ status: 'failed', error: message.slice(0, 500) }).eq('id', claimed.id);
    return { error: message, status };
  };

  const recipients = cleanRecipients(claimed.recipients);
  if (!recipients.length) return fail('Add at least one person to send it to.', 422);
  if (!mailer.isConfigured()) return fail('Email is not set up on the server.', 422);
  const loaded = await loadMeeting(meetingId);
  if (!loaded) return fail('The meeting is gone.', 404);
  const me = await identity(claimed.owner_id);
  const msg = render(claimed, parts(loaded.meeting, loaded.items), me.name);
  try {
    const res = await mailer.send({ to: recipients.map((r) => r.email), replyTo: me.email, ...msg });
    if (res.skipped) return fail('Email is not set up on the server.', 422);
    if (claimed.include?.copy !== false && me.email) {
      await mailer.send({ to: me.email, ...msg, subject: `Copy: ${msg.subject}` }).catch((err) => log.warn('[FollowUp] copy failed', { meetingId, error: err.message }));
    }
    const { data } = await db()
      .from('follow_ups')
      .update({ status: 'sent', sent_at: now.toISOString(), sent_to: recipients, provider_id: res.id || null, error: null, send_at: null })
      .eq('id', claimed.id)
      .select('*')
      .single();
    log.info('[FollowUp] sent', { meetingId, to: recipients.length });
    return { row: data };
  } catch (err) {
    log.warn('[FollowUp] send failed', { meetingId, error: err.message });
    const sandbox = /resend\.dev|only send testing emails|verify a domain/i.test(err.message);
    // 422 for the sandbox: a retry cannot fix it, so the browser should not retry.
    return sandbox
      ? fail('Email can only reach your own address until a sending domain is verified in Resend.', 422)
      : fail('The email could not be sent. Try again in a minute.');
  }
}

async function setAutoSend(userId, enabled) {
  const { error } = await db()
    .from('user_settings')
    .upsert({ user_id: userId, follow_up_auto_send: Boolean(enabled) }, { onConflict: 'user_id' });
  if (error) throw error;
  return Boolean(enabled);
}

/** The person it is sent for, or a workspace owner/admin, may send or stop it. */
async function canSend(userId, row, orgId) {
  if (!userId || !row) return false;
  if (row?.owner_id && row.owner_id === userId) return true;
  const { data } = await db().from('org_members').select('role').eq('org_id', orgId).eq('user_id', userId).maybeSingle();
  return ['owner', 'admin'].includes(data?.role);
}

async function autoSendFor(userId) {
  return (await ownerSettings(userId)).autoSend;
}

/**
 * The job: draft follow-ups for meetings whose minutes landed in the last six
 * hours, then send the ones that are due. Idempotent.
 */
async function runFollowUps(now = new Date()) {
  if (!db()) return { skipped: 'no_database' };
  const out = { drafted: 0, sent: 0, failed: 0 };
  const since = new Date(now.getTime() - FRESH_MS).toISOString();
  const { data: recent, error } = await db()
    .from('meetings')
    .select('id, summary')
    .gte('created_at', since)
    .not('summary', 'is', null)
    .limit(50);
  if (error) throw error;
  const ids = asList(recent).filter((m) => String(m.summary || '').trim()).map((m) => m.id);
  if (ids.length) {
    const { data: have } = await db().from('follow_ups').select('meeting_id').in('meeting_id', ids);
    const done = new Set(asList(have).map((r) => r.meeting_id));
    for (const id of ids.filter((x) => !done.has(x))) {
      try { if (await getOrCreate(id, { now })) out.drafted += 1; } catch (err) { log.warn('[FollowUp] draft failed', { meetingId: id, error: err.message }); }
    }
  }
  const { data: due } = await db()
    .from('follow_ups')
    .select('meeting_id')
    .eq('status', 'scheduled')
    .lte('send_at', now.toISOString())
    .limit(20);
  for (const r of asList(due)) {
    const res = await send(r.meeting_id, { now }).catch((err) => ({ error: err.message }));
    if (res.row) out.sent += 1; else out.failed += 1;
  }
  return out;
}

let timer = null;
let running = false;
function initialize(intervalMs = 5 * 60 * 1000) {
  if (timer || process.env.NODE_ENV === 'test') return;
  timer = setInterval(() => {
    if (running) return;
    running = true;
    runFollowUps().catch((err) => log.warn('[FollowUp] run failed', { error: err.message })).finally(() => { running = false; });
  }, intervalMs);
  if (timer.unref) timer.unref();
}

module.exports = {
  HOLD_MS,
  DEFAULT_INCLUDE,
  cleanRecipients,
  meetingEnd,
  sendAtFor,
  whenLabel,
  defaultSubject,
  defaultOpening,
  parts,
  render,
  pickEvent,
  pickNext,
  shouldAutoSend,
  getOrCreate,
  update,
  stop,
  send,
  setAutoSend,
  autoSendFor,
  canSend,
  runFollowUps,
  initialize,
};
