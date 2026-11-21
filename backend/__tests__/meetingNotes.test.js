/**
 * Meeting Notes — route + service tests.
 *
 * The backend bypasses RLS (service-role), so these tests ARE the privacy gate for app
 * traffic. They run the real router and the real service against an in-memory fake of
 * the Supabase query builder, and cover:
 *   - private by default; team only on request
 *   - an author sees their private notes, a teammate does not
 *   - a user outside the meeting's org gets 404 (no existence leak)
 *   - only the author can edit or delete
 *   - recaps get team notes only, never private ones
 */

'use strict';

const ORG_A = '00000000-0000-4000-8000-00000000000a';
const ORG_B = '00000000-0000-4000-8000-00000000000b';
const MEETING_A = '00000000-0000-4000-8000-0000000000e1';
const MEETING_B = '00000000-0000-4000-8000-0000000000e2';
const AUTHOR = '00000000-0000-4000-8000-0000000000a1';
const TEAMMATE = '00000000-0000-4000-8000-0000000000a2';
const OUTSIDER = '00000000-0000-4000-8000-0000000000b3';

// ── In-memory fake of the subset of supabase-js the service uses ──────────
const mockDb = { meetings: [], org_members: [], meeting_notes: [] };
let mockIdSeq = 0;

function mockMakeQuery(table) {
  const filters = [];
  let mode = 'select';
  let payload = null;
  let orderBy = null;
  let limitN = null;
  let returning = false;

  const matches = (row) => filters.every((f) => f(row));
  const run = () => {
    const rows = mockDb[table];
    if (mode === 'insert') {
      const now = new Date(Date.now() + mockIdSeq).toISOString();
      const row = { id: `00000000-0000-4000-8000-${String(++mockIdSeq).padStart(12, '0')}`, created_at: now, updated_at: now, ...payload };
      rows.push(row);
      return [row];
    }
    if (mode === 'update') {
      const hit = rows.filter(matches);
      hit.forEach((r) => Object.assign(r, payload, { updated_at: new Date().toISOString() }));
      return hit;
    }
    if (mode === 'delete') {
      const hit = rows.filter(matches);
      mockDb[table] = rows.filter((r) => !matches(r));
      return hit;
    }
    let out = rows.filter(matches);
    if (orderBy) {
      out = [...out].sort((a, b) => (a[orderBy.col] < b[orderBy.col] ? -1 : 1) * (orderBy.asc ? 1 : -1));
    }
    if (limitN !== null) out = out.slice(0, limitN);
    return out;
  };

  const q = {
    select() { if (mode !== 'select') returning = true; return q; },
    insert(p) { mode = 'insert'; payload = p; return q; },
    update(p) { mode = 'update'; payload = p; return q; },
    delete() { mode = 'delete'; return q; },
    eq(col, val) { filters.push((r) => r[col] === val); return q; },
    or(expr) {
      const clauses = expr.split(',').map((c) => {
        const [col, op, ...rest] = c.split('.');
        if (op !== 'eq') throw new Error(`fake: unsupported op ${op}`);
        return { col, val: rest.join('.') };
      });
      filters.push((r) => clauses.some(({ col, val }) => r[col] === val));
      return q;
    },
    order(col, opts = {}) { orderBy = { col, asc: opts.ascending !== false }; return q; },
    limit(n) { limitN = n; return q; },
    maybeSingle() { const rows = run(); return Promise.resolve({ data: rows[0] || null, error: null }); },
    single() {
      const rows = run();
      return Promise.resolve(rows.length === 1 ? { data: rows[0], error: null } : { data: null, error: { message: 'not single' } });
    },
    then(resolve, reject) {
      try { resolve({ data: run(), error: null }); } catch (e) { reject(e); }
    }
  };
  void returning;
  return q;
}

jest.mock('../config/supabase', () => ({
  supabase: { from: (table) => mockMakeQuery(table) },
  supabaseAdmin: null
}));

jest.mock('../utils/log', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

// The test picks the signed-in user per request with an x-test-user header.
jest.mock('../middleware/auth', () => ({
  authenticate: (req, res, next) => {
    const id = req.headers['x-test-user'];
    if (!id) return res.status(401).json({ error: 'Authentication required' });
    req.user = { id, email: `${id.slice(-2)}@example.com`, firstName: 'User', lastName: id.slice(-2) };
    next();
  }
}));

const express = require('express');
const request = require('supertest');
const notesService = require('../services/meetingNotesService');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/meetings/:meetingId/notes', require('../routes/meetingNotes'));
  return app;
}

const app = makeApp();
const notesUrl = (meetingId) => `/api/meetings/${meetingId}/notes`;
const as = (user) => ({ 'x-test-user': user });

beforeEach(() => {
  mockIdSeq = 0;
  mockDb.meetings = [{ id: MEETING_A, org_id: ORG_A }, { id: MEETING_B, org_id: ORG_B }];
  mockDb.org_members = [
    { org_id: ORG_A, user_id: AUTHOR },
    { org_id: ORG_A, user_id: TEAMMATE },
    { org_id: ORG_B, user_id: OUTSIDER }
  ];
  mockDb.meeting_notes = [];
});

async function createNote(user, body, visibility) {
  const res = await request(app).post(notesUrl(MEETING_A)).set(as(user)).send({ body, visibility });
  expect(res.status).toBe(201);
  return res.body.data;
}

describe('creating notes', () => {
  test('a new note is private by default and stamped with org and author', async () => {
    const note = await createNote(AUTHOR, '  Follow up with legal  ');
    expect(note.visibility).toBe('private');
    expect(note.body).toBe('Follow up with legal');
    expect(note.isMine).toBe(true);
    expect(mockDb.meeting_notes[0]).toMatchObject({ org_id: ORG_A, author_id: AUTHOR, meeting_id: MEETING_A });
  });

  test('team visibility only when asked; unknown values fall back to private', async () => {
    expect((await createNote(AUTHOR, 'shared', 'team')).visibility).toBe('team');
    expect((await createNote(AUTHOR, 'odd', 'public')).visibility).toBe('private');
  });

  test('a blank note is rejected', async () => {
    const res = await request(app).post(notesUrl(MEETING_A)).set(as(AUTHOR)).send({ body: '   ' });
    expect(res.status).toBe(400);
    expect(mockDb.meeting_notes).toHaveLength(0);
  });

  test('the body is capped at 4,000 characters', async () => {
    const note = await createNote(AUTHOR, 'x'.repeat(5000));
    expect(note.body).toHaveLength(notesService.MEETING_NOTE_MAX_LENGTH);
  });

  test('org_id and author_id in the request body are ignored', async () => {
    await request(app).post(notesUrl(MEETING_A)).set(as(AUTHOR))
      .send({ body: 'sneaky', org_id: ORG_B, author_id: TEAMMATE, authorId: TEAMMATE });
    expect(mockDb.meeting_notes[0]).toMatchObject({ org_id: ORG_A, author_id: AUTHOR });
  });
});

describe('reading notes', () => {
  test('the author sees private and team notes; a teammate sees team notes only', async () => {
    await createNote(AUTHOR, 'my private thought');
    await createNote(AUTHOR, 'for the team', 'team');

    const mine = await request(app).get(notesUrl(MEETING_A)).set(as(AUTHOR));
    expect(mine.status).toBe(200);
    expect(mine.body.data.map((n) => n.body).sort()).toEqual(['for the team', 'my private thought']);

    const theirs = await request(app).get(notesUrl(MEETING_A)).set(as(TEAMMATE));
    expect(theirs.body.data.map((n) => n.body)).toEqual(['for the team']);
    expect(theirs.body.data[0].isMine).toBe(false);
  });

  test('newest first', async () => {
    await createNote(AUTHOR, 'first', 'team');
    await createNote(AUTHOR, 'second', 'team');
    const res = await request(app).get(notesUrl(MEETING_A)).set(as(AUTHOR));
    expect(res.body.data.map((n) => n.body)).toEqual(['second', 'first']);
  });

  test('a user outside the org gets 404, not the notes and not a 403', async () => {
    await createNote(AUTHOR, 'for the team', 'team');
    const res = await request(app).get(notesUrl(MEETING_A)).set(as(OUTSIDER));
    expect(res.status).toBe(404);
    expect(res.body.data).toBeUndefined();
  });

  test('an unknown meeting and a malformed id both answer 404', async () => {
    const missing = await request(app).get(notesUrl('00000000-0000-4000-8000-0000000000ff')).set(as(AUTHOR));
    expect(missing.status).toBe(404);
    const malformed = await request(app).get(notesUrl('not-a-uuid')).set(as(AUTHOR));
    expect(malformed.status).toBe(404);
  });

  test('signed-out requests are refused', async () => {
    const res = await request(app).get(notesUrl(MEETING_A));
    expect(res.status).toBe(401);
  });

  test('a non-UUID user id (e.g. the anonymous placeholder) is refused', async () => {
    const res = await request(app).get(notesUrl(MEETING_A)).set(as('anonymous'));
    expect(res.status).toBe(401);
  });
});

describe('editing and deleting', () => {
  test('the author can edit body and visibility', async () => {
    const note = await createNote(AUTHOR, 'draft');
    const res = await request(app).patch(`${notesUrl(MEETING_A)}/${note.id}`).set(as(AUTHOR))
      .send({ body: 'final', visibility: 'team' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ body: 'final', visibility: 'team' });
  });

  test('a teammate cannot edit or delete someone else\'s team note', async () => {
    const note = await createNote(AUTHOR, 'shared', 'team');
    const edit = await request(app).patch(`${notesUrl(MEETING_A)}/${note.id}`).set(as(TEAMMATE)).send({ body: 'hijacked' });
    expect(edit.status).toBe(404);
    const del = await request(app).delete(`${notesUrl(MEETING_A)}/${note.id}`).set(as(TEAMMATE));
    expect(del.status).toBe(404);
    expect(mockDb.meeting_notes[0].body).toBe('shared');
  });

  test('a blank edit is rejected instead of wiping the note', async () => {
    const note = await createNote(AUTHOR, 'keep me');
    const res = await request(app).patch(`${notesUrl(MEETING_A)}/${note.id}`).set(as(AUTHOR)).send({ body: '  ' });
    expect(res.status).toBe(400);
    expect(mockDb.meeting_notes[0].body).toBe('keep me');
  });

  test('a note cannot be edited through a different meeting\'s URL', async () => {
    const note = await createNote(AUTHOR, 'meeting A note');
    mockDb.meetings.push({ id: '00000000-0000-4000-8000-0000000000e3', org_id: ORG_A });
    const res = await request(app).patch(`/api/meetings/00000000-0000-4000-8000-0000000000e3/notes/${note.id}`)
      .set(as(AUTHOR)).send({ body: 'moved' });
    expect(res.status).toBe(404);
  });

  test('the author can delete their note', async () => {
    const note = await createNote(AUTHOR, 'temporary');
    const res = await request(app).delete(`${notesUrl(MEETING_A)}/${note.id}`).set(as(AUTHOR));
    expect(res.status).toBe(200);
    expect(mockDb.meeting_notes).toHaveLength(0);
  });
});

describe('recap notes', () => {
  test('getTeamNotesForMeeting returns team notes only, oldest first', async () => {
    await createNote(AUTHOR, 'private, never sent');
    await createNote(AUTHOR, 'team one', 'team');
    await createNote(TEAMMATE, 'team two', 'team');
    const recap = await notesService.getTeamNotesForMeeting(ORG_A, MEETING_A);
    expect(recap.map((n) => n.body)).toEqual(['team one', 'team two']);
  });

  test('another org\'s id returns nothing', async () => {
    await createNote(AUTHOR, 'team one', 'team');
    expect(await notesService.getTeamNotesForMeeting(ORG_B, MEETING_A)).toEqual([]);
  });
});

describe('chat recap formatting', () => {
  const chatService = require('../services/chatService');
  const meeting = { title: 'Weekly', summary: 'ok', key_points: [], decisions: [], created_at: '2026-11-21T00:00:00Z' };

  test('Slack recap gets a Team Notes block with mentions neutralised', () => {
    const out = chatService.formatSlackRecap(meeting, [], [{ authorName: 'Ann', body: 'ping <!channel> & @here' }]);
    const notes = out.blocks.find((b) => b.text?.text?.startsWith('*Team Notes:*'));
    expect(notes.text.text).toContain('&lt;!channel&gt; &amp; @‍here (Ann)');
  });

  test('no Team Notes section when there are none', () => {
    const slack = chatService.formatSlackRecap(meeting, [], []);
    expect(JSON.stringify(slack)).not.toContain('Team Notes');
    expect(chatService.formatPlainRecap(meeting, []).text).not.toContain('Team Notes');
  });

  test('every provider format includes team notes', () => {
    const notes = [{ authorName: null, body: 'shared note' }];
    expect(JSON.stringify(chatService.formatTeamsRecap(meeting, [], notes))).toContain('shared note');
    expect(JSON.stringify(chatService.formatDiscordRecap(meeting, [], notes))).toContain('shared note');
    expect(chatService.formatPlainRecap(meeting, [], notes).text).toContain('• shared note');
  });
});
