/**
 * Carry-forward commitments (feature audit 2026-11-22, recommendation 5).
 *
 * Before a meeting (or while reading one), show what was promised the last time
 * the same people met, or the last time this recurring meeting ran: what is
 * still open, and what got done. Earlier meetings count as "related" when they
 * share a real attendee or the same series title. Open items owned by someone
 * in this meeting are included too, whatever meeting they came from.
 *
 * Pure matching lives in buildCarryForward so it is easy to test; load() does
 * the org-scoped reads.
 */

'use strict';

const { supabase } = require('../config/supabase');

const DONE = new Set(['done', 'completed', 'complete', 'cancelled', 'canceled']);
const MAX_OPEN = 12;
const MAX_DONE = 6;
const MAX_MEETINGS = 200;

/** Speaker labels from the recorder say nothing about who was there. */
const GENERIC_PERSON = /^(speaker|participant|guest|unknown)\s*\d*$/;
/** Titles that every meeting shares, so they can't define a series. */
const GENERIC_TITLE = new Set(['', 'recording', 'untitled meeting', 'untitled', 'meeting', 'call', 'smoke']);

/**
 * Lower-case key for a person, or null when it names nobody. Accepts a name,
 * an email, or "Name <email>". Strips a "Client:" style prefix.
 * @param {unknown} raw
 * @returns {string|null}
 */
function personKey(raw) {
  if (raw == null) return null;
  let s = typeof raw === 'object' ? (raw.email || raw.name || raw.displayName || '') : String(raw);
  const angle = s.match(/<([^>]+@[^>]+)>/);
  if (angle) s = angle[1];
  s = s.trim().toLowerCase().replace(/^[a-z ]{1,20}:\s*/, '').replace(/\s+/g, ' ');
  if (!s || GENERIC_PERSON.test(s)) return null;
  return s;
}

/** Every key a person can be matched by: the full name/email, and the name part of an email. */
function personKeys(list) {
  const keys = new Set();
  for (const raw of Array.isArray(list) ? list : []) {
    const k = personKey(raw);
    if (!k) continue;
    keys.add(k);
    if (typeof raw === 'object' && raw?.name) {
      const n = personKey(raw.name);
      if (n) keys.add(n);
    }
  }
  return keys;
}

/**
 * Series key of a title: lower case with dates, numbers and punctuation removed,
 * so "Weekly Sync - Nov 14" and "Weekly sync 11/21" match. Null for generic titles.
 * @param {unknown} title
 * @returns {string|null}
 */
function seriesKey(title) {
  const s = String(title || '')
    .toLowerCase()
    .replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/g, ' ')
    .replace(/\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b/g, ' ')
    .replace(/[^a-z]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  return GENERIC_TITLE.has(s) ? null : s;
}

function isOpen(item) {
  return !DONE.has(String(item.status || '').toLowerCase());
}

function ownerKeys(item) {
  return [personKey(item.assigned_to_email), personKey(item.assigned_to_name)].filter(Boolean);
}

/**
 * @param {{ id?: string, title?: string, attendees?: unknown[], at: Date|string }} target
 *   the meeting being prepped or read; `at` is its start (or creation) time
 * @param {Array<{id:string,title?:string,attendees?:unknown[],created_at:string}>} meetings
 *   the org's meetings, any order
 * @param {Array<object>} items action items of those meetings (meeting_id set)
 * @param {Date} [now]
 */
function buildCarryForward(target, meetings, items, now = new Date()) {
  const at = new Date(target.at).getTime();
  const people = personKeys(target.attendees);
  const series = seriesKey(target.title);

  const earlier = meetings
    .filter(m => m.id !== target.id && new Date(m.created_at).getTime() < at)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const related = new Map(); // meeting id -> { meeting, shared: string[], sameSeries }
  for (const m of earlier) {
    const theirs = personKeys(m.attendees);
    const shared = [...people].filter(p => theirs.has(p));
    const sameSeries = Boolean(series) && seriesKey(m.title) === series;
    if (shared.length > 0 || sameSeries) related.set(m.id, { meeting: m, shared, sameSeries });
  }

  const meetingById = new Map(earlier.map(m => [m.id, m]));
  const open = [];
  const done = [];
  const seen = new Set();
  const lastRelated = related.size ? [...related.values()][0].meeting : null;
  const today = new Date(now); today.setHours(0, 0, 0, 0);

  for (const item of items) {
    const source = meetingById.get(item.meeting_id);
    if (!source || seen.has(item.id)) continue;
    const viaMeeting = related.has(item.meeting_id);
    const viaOwner = ownerKeys(item).some(k => people.has(k));
    if (!viaMeeting && !(viaOwner && isOpen(item))) continue;
    seen.add(item.id);

    const row = {
      id: item.id,
      text: item.task_description,
      owner: item.assigned_to_name || item.assigned_to_email || null,
      dueDate: item.due_date || null,
      status: item.status,
      completedAt: item.completed_at || null,
      transcriptAtMs: item.transcript_at_ms ?? null,
      meeting: { id: source.id, title: source.title || 'Untitled meeting', date: source.created_at },
      reason: viaMeeting
        ? (related.get(item.meeting_id).sameSeries ? 'series' : 'people')
        : 'owner',
    };
    if (isOpen(item)) {
      row.overdue = Boolean(row.dueDate) && new Date(`${row.dueDate}T00:00:00`) < today;
      open.push(row);
    } else if (viaMeeting) {
      done.push(row);
    }
  }

  // Overdue first, then by due date (undated last), then newest meeting first.
  open.sort((a, b) =>
    (b.overdue - a.overdue)
    || ((a.dueDate || '9999') < (b.dueDate || '9999') ? -1 : (a.dueDate || '9999') > (b.dueDate || '9999') ? 1 : 0)
    || (new Date(b.meeting.date) - new Date(a.meeting.date)));
  done.sort((a, b) => new Date(b.completedAt || b.meeting.date) - new Date(a.completedAt || a.meeting.date));

  return {
    lastMeeting: lastRelated
      ? {
          id: lastRelated.id,
          title: lastRelated.title || 'Untitled meeting',
          date: lastRelated.created_at,
          sharedPeople: related.get(lastRelated.id).shared,
          sameSeries: related.get(lastRelated.id).sameSeries,
        }
      : null,
    relatedMeetings: related.size,
    openCount: open.length,
    overdueCount: open.filter(r => r.overdue).length,
    doneCount: done.length,
    open: open.slice(0, MAX_OPEN),
    done: done.slice(0, MAX_DONE),
  };
}

/**
 * Org-scoped read + build. `orgIds` must be the caller's orgs (req.orgIds).
 * @param {{ id?: string, title?: string, attendees?: unknown[], at: Date|string }} target
 * @param {string[]} orgIds
 */
async function load(target, orgIds) {
  if (!supabase || !Array.isArray(orgIds) || orgIds.length === 0) return buildCarryForward(target, [], []);

  const { data: meetings, error } = await supabase
    .from('meetings')
    .select('id, title, attendees, created_at')
    .in('org_id', orgIds)
    .lt('created_at', new Date(target.at).toISOString())
    .order('created_at', { ascending: false })
    .limit(MAX_MEETINGS);
  if (error) throw error;

  const ids = (meetings || []).map(m => m.id).filter(id => id !== target.id);
  let items = [];
  if (ids.length) {
    const { data, error: itemErr } = await supabase
      .from('action_items')
      .select('id, meeting_id, task_description, assigned_to_name, assigned_to_email, due_date, status, completed_at, transcript_at_ms')
      .in('org_id', orgIds)
      .in('meeting_id', ids);
    if (itemErr) throw itemErr;
    items = data || [];
  }
  return buildCarryForward(target, meetings || [], items);
}

module.exports = { buildCarryForward, load, personKey, seriesKey };
