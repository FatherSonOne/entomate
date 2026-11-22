/**
 * Live captions for a bot in a call.
 *
 * Recall posts each finished utterance (transcript.data) to
 * POST /api/admin/bots/realtime/:sessionId while the bot records. Lines are
 * kept in memory for the length of the call and the app reads them with
 * GET /api/admin/bots/:sessionId/captions?after=<seq> every couple of seconds
 * (the pop-out window and the live views). The finished transcript still
 * comes from Recall after the call; nothing here is stored.
 *
 * Invitees who opted out are hidden live too: an utterance from an
 * opted-out email (or from a participant id once seen with that email)
 * becomes "(opted out)" with no words.
 *
 * shortcut: lines live in this process's memory. Fine for the single Render
 * instance; with several instances, captions would need a shared store
 * (Redis or a table) because Recall's posts and the app's reads may land on
 * different processes.
 */

'use strict';

const crypto = require('crypto');

const MAX_LINES = 400;
const IDLE_DROP_MS = 3 * 60 * 60 * 1000; // forget a call's captions 3 h after its last line
const OPTED_OUT = '(opted out)';

/** @type {Map<string, {seq: number, lines: object[], optedOutIds: Set<string>, paused: boolean, touchedAt: number}>} */
const calls = new Map();

function secret() {
  return process.env.SESSION_SECRET || 'entomate-dev-session-secret';
}

/** Per-session token for the realtime URL: only Recall (given the URL at launch) can post captions. */
function captionToken(sessionId) {
  return crypto.createHmac('sha256', secret()).update(`captions:${sessionId}`).digest('base64url');
}

function verifyToken(sessionId, token) {
  if (typeof token !== 'string' || !token) return false;
  const want = Buffer.from(captionToken(sessionId));
  const got = Buffer.from(token);
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

/**
 * Recall's workspace-secret signature (webhook-id / webhook-timestamp /
 * webhook-signature headers), checked when RECALL_WORKSPACE_SECRET is set.
 */
function verifyWorkspaceSignature(headers, rawBody, secretValue = process.env.RECALL_WORKSPACE_SECRET) {
  if (!secretValue || !rawBody) return false;
  const id = headers['webhook-id'];
  const ts = headers['webhook-timestamp'];
  const sig = headers['webhook-signature'];
  if (!id || !ts || !sig) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 5 * 60) return false;
  const key = Buffer.from(String(secretValue).replace(/^whsec_/, ''), 'base64');
  const expected = crypto.createHmac('sha256', key).update(`${id}.${ts}.${rawBody.toString('utf8')}`).digest('base64');
  return String(sig).split(' ').some((part) => {
    const [, value] = part.split(',');
    if (!value) return false;
    const a = Buffer.from(value);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}

function callFor(sessionId) {
  let call = calls.get(sessionId);
  if (!call) {
    call = { seq: 0, lines: [], optedOutIds: new Set(), paused: false, touchedAt: Date.now() };
    calls.set(sessionId, call);
  }
  call.touchedAt = Date.now();
  return call;
}

function sweep(now = Date.now()) {
  for (const [id, call] of calls) if (now - call.touchedAt > IDLE_DROP_MS) calls.delete(id);
}

const relMs = (ts) => {
  const n = Number(ts?.relative);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 1000) : null;
};

/**
 * Add one transcript.data event. Returns the stored line, or null when the
 * payload has no words.
 * @param {string} sessionId
 * @param {object} payload  Recall realtime body ({ event, data: { data: { words, participant } } })
 * @param {Set<string>} optedOutEmails  lower-case emails of invitees who opted out
 */
function addTranscriptEvent(sessionId, payload, optedOutEmails = new Set()) {
  const inner = payload?.data?.data || {};
  const words = Array.isArray(inner.words) ? inner.words : [];
  const text = words.map((w) => (typeof w?.text === 'string' ? w.text : '')).join(' ').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  const call = callFor(sessionId);
  const p = inner.participant || {};
  const pid = p.id === undefined || p.id === null ? null : String(p.id);
  const email = typeof p.email === 'string' ? p.email.trim().toLowerCase() : '';
  if (email && optedOutEmails.has(email) && pid) call.optedOutIds.add(pid);
  const hidden = Boolean((email && optedOutEmails.has(email)) || (pid && call.optedOutIds.has(pid)));
  const name = typeof p.name === 'string' && p.name.trim() ? p.name.trim().slice(0, 80) : pid ? `Speaker ${pid}` : 'Speaker';
  call.seq += 1;
  const line = {
    seq: call.seq,
    atMs: relMs(words[0]?.start_timestamp),
    endMs: relMs(words[words.length - 1]?.end_timestamp),
    speaker: hidden ? null : name,
    text: hidden ? OPTED_OUT : text.slice(0, 2000),
    hidden
  };
  call.lines.push(line);
  if (call.lines.length > MAX_LINES) call.lines.splice(0, call.lines.length - MAX_LINES);
  if (call.seq % 50 === 0) sweep();
  return line;
}

/** Lines after `after` (exclusive), oldest first, plus the call's flags. */
function linesAfter(sessionId, after = 0, { optOutsHidden = false } = {}) {
  const call = calls.get(sessionId);
  const lines = call ? call.lines.filter((l) => l.seq > after) : [];
  return {
    lines: after > 0 ? lines : lines.slice(-60),
    seq: call?.seq || 0,
    paused: Boolean(call?.paused),
    optOutsHidden
  };
}

/** The last line's end (or start), as the time of a mark. */
function latestAtMs(sessionId) {
  const call = calls.get(sessionId);
  const last = call?.lines[call.lines.length - 1];
  return last ? (last.endMs ?? last.atMs) : null;
}

function latestLine(sessionId) {
  const call = calls.get(sessionId);
  return call?.lines[call.lines.length - 1] || null;
}

function setPaused(sessionId, paused) {
  callFor(sessionId).paused = Boolean(paused);
}

function isPaused(sessionId) {
  return Boolean(calls.get(sessionId)?.paused);
}

function clear(sessionId) {
  calls.delete(sessionId);
}

module.exports = {
  captionToken, verifyToken, verifyWorkspaceSignature, addTranscriptEvent, linesAfter,
  latestAtMs, latestLine, setPaused, isPaused, clear,
  _internal: { calls, sweep, OPTED_OUT, MAX_LINES }
};
