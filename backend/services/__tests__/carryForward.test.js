/**
 * Carry-forward picks earlier meetings with the same people or series, lists
 * their open items (overdue first) and what got done, and adds open items
 * owned by someone in the meeting. Speaker labels and generic titles never
 * count as a match.
 */

'use strict';

jest.mock('../../config/supabase', () => ({ supabase: null }));
const { buildCarryForward, personKey, seriesKey } = require('../carryForward');

const NOW = new Date('2026-11-20T15:00:00Z');
const meetings = [
  { id: 'w1', title: 'Weekly Sync - Nov 6', attendees: ['Dana Lee', 'Sam Ortiz'], created_at: '2026-11-06T15:00:00Z' },
  { id: 'w2', title: 'Weekly sync 11/13', attendees: ['Speaker 1'], created_at: '2026-11-13T15:00:00Z' },
  { id: 'c1', title: 'Acme pricing call', attendees: ['dana lee', 'Client: Mark Wilson'], created_at: '2026-11-10T15:00:00Z' },
  { id: 'r1', title: 'Recording, Nov 12, 2026', attendees: ['Speaker 1', 'Speaker 2'], created_at: '2026-11-12T15:00:00Z' },
  { id: 'x1', title: 'Hiring panel', attendees: ['Pat Kim'], created_at: '2026-11-11T15:00:00Z' },
  { id: 'late', title: 'Weekly Sync', attendees: ['Dana Lee'], created_at: '2026-11-25T15:00:00Z' },
];
const items = [
  { id: 'a', meeting_id: 'w1', task_description: 'Send deck', assigned_to_name: 'Sam Ortiz', due_date: '2026-11-10', status: 'open' },
  { id: 'b', meeting_id: 'w2', task_description: 'Book venue', assigned_to_name: null, due_date: '2026-11-30', status: 'in_progress' },
  { id: 'c', meeting_id: 'c1', task_description: 'Draft quote', assigned_to_name: 'Dana Lee', status: 'completed', completed_at: '2026-11-15T10:00:00Z' },
  { id: 'd', meeting_id: 'x1', task_description: 'Review CVs', assigned_to_email: 'sam@acme.test', assigned_to_name: 'Sam Ortiz', status: 'open' },
  { id: 'e', meeting_id: 'x1', task_description: 'Pat only', assigned_to_name: 'Pat Kim', status: 'open' },
  { id: 'f', meeting_id: 'r1', task_description: 'Speaker item', assigned_to_name: 'Speaker 1', status: 'open' },
  { id: 'g', meeting_id: 'late', task_description: 'Future', status: 'open' },
];

test('related by people and series; owner items added; generic labels ignored', () => {
  const target = { title: 'Weekly Sync — Nov 20', attendees: [{ name: 'Dana Lee', email: 'dana@acme.test' }, 'Sam Ortiz', 'Speaker 1'], at: NOW };
  const r = buildCarryForward(target, meetings, items, NOW);
  expect(r.lastMeeting.id).toBe('w2');          // newest related (same series)
  expect(r.lastMeeting.sameSeries).toBe(true);
  expect(r.open.map(i => i.id)).toEqual(['a', 'b', 'd']); // a overdue first, then by due date, undated last
  expect(r.open[0].overdue).toBe(true);
  expect(r.open.find(i => i.id === 'd').reason).toBe('owner');
  expect(r.done.map(i => i.id)).toEqual(['c']);
  expect(r.overdueCount).toBe(1);
  // never: other people's items, speaker-only meetings, meetings after the target
  expect([...r.open, ...r.done].map(i => i.id)).not.toEqual(expect.arrayContaining(['e', 'f', 'g']));
});

test('nothing related gives an empty result', () => {
  const r = buildCarryForward({ title: 'Recording, Nov 20, 2026', attendees: ['Speaker 1'], at: NOW }, meetings, items, NOW);
  expect(r).toMatchObject({ lastMeeting: null, openCount: 0, doneCount: 0, relatedMeetings: 0 });
});

test('the meeting itself is not its own history', () => {
  const r = buildCarryForward({ id: 'w2', title: 'Weekly sync 11/13', attendees: [], at: '2026-11-13T16:00:00Z' }, meetings, items, NOW);
  expect(r.lastMeeting.id).toBe('w1');
  expect(r.open.map(i => i.id)).toEqual(['a']);
});

test('keys', () => {
  expect(personKey('Speaker 3')).toBeNull();
  expect(personKey('Client: Mark Wilson')).toBe('mark wilson');
  expect(personKey('Dana <DANA@acme.test>')).toBe('dana@acme.test');
  expect(seriesKey('Recording, Nov 22, 2026')).toBeNull();
  expect(seriesKey('Weekly Sync - Nov 6')).toBe(seriesKey('weekly sync 11/13'));
});
