/**
 * Audit finding 3: a signed-in user must not read, change or delete rows
 * that belong to another org. Uses a small in-memory stand-in for the
 * Supabase query builder that honours eq/in filters.
 */
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test-service';

const ORG_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ORG_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const USER_A = '11111111-1111-4111-8111-111111111111';
const TASK_A = '0000000a-0000-4000-8000-00000000000a';
const TASK_B = '0000000b-0000-4000-8000-00000000000b';
const PROJ_A = '00000a00-0000-4000-8000-000000000a00';
const PROJ_B = '00000b00-0000-4000-8000-000000000b00';

const mockDb = {};
let mockReadFailure;
let mockBeforeUpdate;
function resetDb() {
  mockReadFailure = null;
  mockBeforeUpdate = null;
  mockDb.meetings = [];
  mockDb.action_items = [];
  mockDb.org_members = [{ user_id: USER_A, org_id: ORG_A }];
  mockDb.tasks = [
    { id: TASK_A, org_id: ORG_A, title: 'mine', status: 'open' },
    { id: TASK_B, org_id: ORG_B, title: 'theirs', status: 'open' },
  ];
  mockDb.projects = [
    { id: PROJ_A, org_id: ORG_A, name: 'mine' },
    { id: PROJ_B, org_id: ORG_B, name: 'theirs' },
  ];
}

function mockQuery(table) {
  const filters = [];
  let op = 'select';
  let patch = null;
  let single = null;
  let from = 0;
  let to;
  const q = {
    select() { return q; },
    update(p) { op = 'update'; patch = p; return q; },
    delete() { op = 'delete'; return q; },
    insert(rows) { op = 'insert'; patch = rows; return q; },
    eq(col, val) { filters.push((r) => r[col] === val); return q; },
    in(col, vals) { filters.push((r) => vals.includes(r[col])); return q; },
    neq() { return q; }, order() { return q; },
    limit(size) { to = from + size - 1; return q; },
    range(start, end) { from = start; to = end; return q; },
    or() { return q; }, ilike() { return q; }, gte() { return q; }, lte() { return q; },
    is(col, val) { filters.push((r) => (r[col] ?? null) === val); return q; }, not() { return q; },
    single() { single = 'single'; return q; },
    maybeSingle() { single = 'maybe'; return q; },
    then(resolve, reject) {
      try {
        if (op === 'select' && mockReadFailure?.table === table && mockReadFailure.from === from) {
          return resolve({ data: null, error: { message: 'test database failure' } });
        }
        const rows = mockDb[table] || [];
        if (op === 'update') mockBeforeUpdate?.(table);
        const hit = rows.filter((r) => filters.every((f) => f(r)));
        if (op === 'update') hit.forEach((r) => Object.assign(r, patch));
        if (op === 'delete') mockDb[table] = rows.filter((r) => !hit.includes(r));
        if (op === 'insert') { const list = [].concat(patch); rows.push(...list); return resolve({ data: list, error: null }); }
        if (single === 'single') {
          return resolve(hit.length === 1
            ? { data: hit[0], error: null }
            : { data: null, error: { code: 'PGRST116', message: 'no rows' } });
        }
        if (single === 'maybe') return resolve({ data: hit[0] || null, error: null });
        return resolve({ data: hit.slice(from, to === undefined ? undefined : to + 1), error: null, count: hit.length });
      } catch (e) { return reject(e); }
    },
  };
  return q;
}

jest.mock('../config/supabase', () => {
  const client = { from: (t) => mockQuery(t) };
  return { supabase: client, supabaseAdmin: client, supabaseAnon: client };
});

const express = require('express');
const request = require('supertest');

function app(routerPath, prefix, userId = USER_A) {
  const a = express();
  a.use(express.json());
  a.use((req, _res, next) => { req.user = { id: userId }; req.authVerified = true; next(); });
  a.use(prefix, require(routerPath));
  return a;
}

beforeEach(resetDb);

describe('tasks are limited to the caller\'s org', () => {
  const tasks = () => app('../routes/tasks', '/api/tasks');

  test('list returns only own-org tasks', async () => {
    const res = await request(tasks()).get('/api/tasks');
    const ids = JSON.stringify(res.body);
    expect(ids).toContain(TASK_A);
    expect(ids).not.toContain(TASK_B);
  });

  test('another org\'s task is not found', async () => {
    const res = await request(tasks()).get(`/api/tasks/${TASK_B}`);
    expect(res.status).toBe(404);
  });

  test('another org\'s task cannot be changed or deleted', async () => {
    await request(tasks()).put(`/api/tasks/${TASK_B}`).send({ title: 'hacked' });
    await request(tasks()).post(`/api/tasks/${TASK_B}/complete`);
    await request(tasks()).delete(`/api/tasks/${TASK_B}`);
    const row = mockDb.tasks.find((t) => t.id === TASK_B);
    expect(row).toBeDefined();
    expect(row.title).toBe('theirs');
    expect(row.status).toBe('open');
  });
});


describe('projects are limited to the caller\'s org', () => {
  const projects = () => app('../routes/projects', '/api/projects');

  test('project list hides other orgs; their project is not found', async () => {
    const list = await request(projects()).get('/api/projects');
    expect(JSON.stringify(list.body)).toContain(PROJ_A);
    expect(JSON.stringify(list.body)).not.toContain(PROJ_B);
    const one = await request(projects()).get(`/api/projects/${PROJ_B}`);
    expect(one.status).toBe(404);
  });

  test('another org\'s project cannot be changed or deleted', async () => {
    await request(projects()).put(`/api/projects/${PROJ_B}`).send({ name: 'hacked' });
    await request(projects()).delete(`/api/projects/${PROJ_B}`);
    const row = mockDb.projects.find((p) => p.id === PROJ_B);
    expect(row).toBeDefined();
    expect(row.name).toBe('theirs');
  });

  test('a new project is stamped with the caller\'s org', async () => {
    const res = await request(projects()).post('/api/projects').send({ name: 'new one' });
    expect(res.status).toBe(201);
    expect(mockDb.projects.find((p) => p.name === 'new one').org_id).toBe(ORG_A);
  });

  test('portfolio and detail count all linked meeting work, including records in later query pages and batches', async () => {
    mockDb.meetings.push(...Array.from({ length: 251 }, (_, i) => ({
      id: `meeting-${i}`, project_id: PROJ_A, org_id: ORG_A, decisions: i === 250 ? ['Approve pilot'] : [],
    })));
    mockDb.action_items.push(...Array.from({ length: 251 }, (_, i) => ({
      id: `action-${i}`, meeting_id: 'meeting-0', org_id: ORG_A, status: 'done',
    })));
    mockDb.action_items.push(
      { id: 'older-action', meeting_id: 'meeting-250', org_id: ORG_A, status: 'open', due_date: '2020-01-01' },
      { id: 'other-org-action', meeting_id: 'meeting-250', org_id: ORG_B, status: 'open' },
    );
    mockDb.tasks[0].project_id = PROJ_A;

    const [list, detail] = await Promise.all([
      request(projects()).get('/api/projects'),
      request(projects()).get(`/api/projects/${PROJ_A}`),
    ]);
    expect(list.status).toBe(200);
    expect(detail.status).toBe(200);
    expect(detail.body.meetings).toHaveLength(251);
    expect(detail.body.actionItems).toHaveLength(252);
    expect(list.body.projects[0].rollup).toEqual(detail.body.rollup);
    expect(detail.body.rollup).toMatchObject({ total: 253, done: 251, late: 1, decisions: 1 });
    expect(list.body.needsYou[0].id).toBe('older-action');
  });

  test.each(['tasks', 'meetings', 'action_items'])('failed %s reads return a retryable error in portfolio and detail', async (table) => {
    mockDb.meetings.push({ id: 'meeting-0', project_id: PROJ_A, org_id: ORG_A });
    mockReadFailure = { table, from: 0 };
    const [list, detail] = await Promise.all([
      request(projects()).get('/api/projects'),
      request(projects()).get(`/api/projects/${PROJ_A}`),
    ]);
    expect(list.status).toBe(500);
    expect(list.body).toEqual({ error: 'Could not load projects and their work. Try again.' });
    expect(detail.status).toBe(500);
    expect(detail.body).toEqual({ error: 'Could not load this project and its work. Try again.' });
  });

  test('a failed later meeting page cannot return a partial detail rollup', async () => {
    mockDb.meetings.push(...Array.from({ length: 251 }, (_, i) => ({
      id: `meeting-${i}`, project_id: PROJ_A, org_id: ORG_A,
    })));
    mockReadFailure = { table: 'meetings', from: 250 };
    const detail = await request(projects()).get(`/api/projects/${PROJ_A}`);
    expect(detail.status).toBe(500);
    expect(detail.body).not.toHaveProperty('rollup');
  });

  test('portfolio pagination reports the final full page accurately', async () => {
    mockDb.projects.push({ id: 'project-2', org_id: ORG_A });
    const first = await request(projects()).get('/api/projects?limit=1');
    const last = await request(projects()).get('/api/projects?limit=1&offset=1');
    expect(first.body).toMatchObject({ count: 2, hasMore: true, projects: [{ id: PROJ_A }] });
    expect(last.body).toMatchObject({ count: 2, hasMore: false, projects: [{ id: 'project-2' }] });
  });
});

describe('shared project brief', () => {
  const MANAGER = '22222222-2222-4222-8222-222222222222';
  const LEAD = '33333333-3333-4333-8333-333333333333';
  const OTHER = '44444444-4444-4444-8444-444444444444';
  const path = `/api/projects/${PROJ_A}/brief`;
  const projects = (user) => request(app('../routes/projects', '/api/projects', user));
  const draft = {
    outcome: 'Launch the pilot', scope: 'Two locations', successCriteria: 'Both sites can onboard',
    ownerId: LEAD, resources: ['https://example.org/pilot'],
  };

  beforeEach(() => {
    mockDb.projects[0].owner_id = USER_A;
    mockDb.projects[0].settings = { sourceType: 'crm_deal' };
    mockDb.projects[0].updated_at = null;
    mockDb.org_members.push(
      { user_id: MANAGER, org_id: ORG_A, role: 'admin', user_name: 'Pat Admin' },
      { user_id: LEAD, org_id: ORG_A, role: 'member', user_name: 'Jules Lead' },
      { user_id: OTHER, org_id: ORG_B, role: 'admin', user_name: 'Other Admin' },
    );
  });

  test('the record owner can save the brief and its lead, and a workspace reader can reload it', async () => {
    const initial = await projects(USER_A).get(path);
    expect(initial.body).toMatchObject({ canEdit: true, brief: { ownerId: USER_A }, version: null });
    expect(initial.body.members.map(({id}) => id)).not.toContain(OTHER);
    const save = await projects(USER_A).put(path).send({ brief: { ...draft, outcome: ` ${draft.outcome} ` }, version: initial.body.version });
    expect(save.status).toBe(200);
    expect(mockDb.projects[0]).toMatchObject({ owner_id: USER_A, settings: { sourceType: 'crm_deal', brief: draft } });
    const reader = await projects(LEAD).get(path);
    expect(reader.body).toEqual({ canEdit: false, brief: draft, owner: { id: LEAD, name: 'Jules Lead' }, members: [], version: save.body.version });
    expect((await projects(LEAD).put(path).send({ brief: draft, version: save.body.version })).status).toBe(403);
    expect((await projects(OTHER).get(path)).status).toBe(404);
    expect((await projects(OTHER).put(path).send({ brief: draft, version: save.body.version })).status).toBe(404);
  });

  test('an admin can assign a lead on a legacy project and can clear that assignment', async () => {
    mockDb.projects[0].owner_id = null;
    const saved = await projects(MANAGER).put(path).send({ brief: draft, version: null });
    expect(saved.status).toBe(200);
    expect((await projects(MANAGER).put(path).send({ brief: { ...draft, ownerId: null }, version: saved.body.version })).status).toBe(200);
    expect((await projects(MANAGER).get(path)).body).toMatchObject({ brief: { ownerId: null }, owner: null });
  });

  test.each([
    { ownerId: OTHER },
    { resources: ['ftp://example.org/resource'] },
    { resources: ['https:example.org/resource'] },
    { resources: ['https://user:password@example.org/resource'] },
    { resources: Array.from({ length: 11 }, () => 'https://example.org/pilot') },
  ])('rejects an invalid lead or resource without saving (%j)', async (invalid) => {
    expect((await projects(MANAGER).put(path).send({ brief: { ...draft, ...invalid }, version: null })).status).toBe(400);
    expect(mockDb.projects[0].settings).toEqual({ sourceType: 'crm_deal' });
  });

  test('rejects stale edits and a save that races a change after the access check', async () => {
    const saved = await projects(USER_A).put(path).send({ brief: draft, version: null });
    expect(saved.status).toBe(200);
    expect((await projects(MANAGER).put(path).send({ brief: { ...draft, outcome: 'Stale text' }, version: null })).status).toBe(409);
    mockBeforeUpdate = (table) => {
      if (table === 'projects') mockDb.projects[0].updated_at = '2030-01-01T00:00:00.000Z';
    };
    expect((await projects(MANAGER).put(path).send({ brief: { ...draft, outcome: 'Racing text' }, version: saved.body.version })).status).toBe(409);
    expect(mockDb.projects[0].settings.brief).toEqual(draft);
  });

  test('a general settings update preserves the brief and cannot write its reserved key', async () => {
    expect((await projects(USER_A).put(path).send({ brief: draft, version: null })).status).toBe(200);
    const url = `/api/projects/${PROJ_A}`;
    expect((await projects(LEAD).put(url).send({ settings: { brief: null } })).status).toBe(400);
    expect((await projects(LEAD).put(url).send({ settings: { sourceType: 'manual' } })).status).toBe(200);
    expect(mockDb.projects[0].settings).toEqual({ sourceType: 'manual', brief: draft });
  });
});

describe('editing a meeting action item from any workspace view', () => {
  const MEETING = 'aaaa0001-0000-4000-8000-000000000001';
  const ACTION = 'aaaa0002-0000-4000-8000-000000000002';
  const VERSION = '2026-11-21T16:00:00.000Z';
  const endpoint = `/api/meetings/action-items/${ACTION}`;
  const meetings = () => request(app('../routes/meetings', '/api/meetings'));
  const original = {
    id: ACTION, org_id: ORG_A, meeting_id: MEETING, transcript_at_ms: 42000,
    task_description: 'Submit the first draft', assigned_to_name: 'Sam', assigned_to_email: 'sam@example.org', assigned_to_id: USER_A,
    due_date: '2026-12-10', status: 'done', completed_at: VERSION, priority: 'high', crm_sync_status: 'synced', updated_at: VERSION,
  };

  beforeEach(() => {
    mockDb.meetings.push({ id: MEETING, org_id: ORG_A, project_id: PROJ_A, title: 'Pilot check-in' });
    mockDb.action_items.push({ ...original });
  });

  test('corrections are read back on the original meeting, project and Tasks API', async () => {
    const changes = { task_description: '  Submit the final draft  ', assigned_to_name: 'Jordan', assigned_to_email: 'jordan@example.org', due_date: '2026-12-15' };
    const saved = await meetings().patch(endpoint).send({ ...changes, version: VERSION });
    expect(saved.status).toBe(200);
    const expected = { ...original, ...changes, task_description: 'Submit the final draft', assigned_to_id: null, updated_at: saved.body.updated_at };
    expect(mockDb.action_items).toEqual([expected]);
    const [meeting, project, tasks] = await Promise.all([
      meetings().get(`/api/meetings/${MEETING}`),
      request(app('../routes/projects', '/api/projects')).get(`/api/projects/${PROJ_A}`),
      request(app('../routes/dashboard', '/api/dashboard')).get('/api/dashboard/action-items'),
    ]);
    for (const view of [meeting, project, tasks]) {
      expect(view.status).toBe(200);
      expect(view.body.actionItems).toEqual([expected]);
    }
  });

  test('a different name clears the prior email and account link, and a date can be cleared', async () => {
    const save = await meetings().patch(endpoint).send({ assigned_to_name: 'Jordan', due_date: null, version: VERSION });
    expect(save.status).toBe(200);
    expect(save.body).toMatchObject({ assigned_to_name: 'Jordan', assigned_to_email: null, assigned_to_id: null, due_date: null });
  });

  test('a status-only edit still supports reopening and completing', async () => {
    const open = await meetings().patch(endpoint).send({ status: 'open' });
    expect(open.body).toMatchObject({ status: 'open', completed_at: null, assigned_to_id: USER_A });
    const done = await meetings().patch(endpoint).send({ status: 'done' });
    expect(done.body).toMatchObject({ status: 'done', completed_at: done.body.updated_at });
  });

  test('a stale edit or a race during the write preserves other changes', async () => {
    expect((await meetings().patch(endpoint).send({ task_description: 'Old edit', version: null })).status).toBe(409);
    mockBeforeUpdate = (table) => {
      if (table === 'action_items') Object.assign(mockDb.action_items[0], { task_description: 'Newer edit', updated_at: '2030-01-01T00:00:00.000Z' });
    };
    expect((await meetings().patch(endpoint).send({ task_description: 'Racing edit', version: VERSION })).status).toBe(409);
    expect(mockDb.action_items[0].task_description).toBe('Newer edit');
  });

  test.each([
    { task_description: ' ' }, { due_date: '2026-02-30' }, { assigned_to_email: 'not-an-email' },
    { transcript_at_ms: 0 }, { meeting_id: MEETING }, { assigned_to_id: USER_A }, { version: VERSION },
  ])('rejects invalid edits or attempts to replace provenance (%j)', async (invalid) => {
    expect((await meetings().patch(endpoint).send(invalid)).status).toBe(400);
    expect(mockDb.action_items[0]).toEqual(original);
  });

  test('another workspace or a mismatched action item workspace cannot edit the item', async () => {
    mockDb.meetings[0].org_id = ORG_B;
    expect((await meetings().patch(endpoint).send({ task_description: 'Other workspace' })).status).toBe(404);
    mockDb.meetings[0].org_id = ORG_A;
    mockDb.action_items[0].org_id = ORG_B;
    expect((await meetings().patch(endpoint).send({ task_description: 'Mismatched workspace' })).status).toBe(404);
    expect(mockDb.action_items[0].task_description).toBe(original.task_description);
  });
});

describe('conversations are private to their owner', () => {
  const askService = require('../services/askService');
  const USER_B = '22222222-2222-4222-8222-222222222222';
  const CONV_B = '0000c00b-0000-4000-8000-00000000c00b';

  beforeEach(() => {
    mockDb.conversations = [{ id: CONV_B, user_id: USER_B, title: 'theirs' }];
    mockDb.conversation_messages = [{ id: 'm1', conversation_id: CONV_B, role: 'user', content: 'secret' }];
  });

  test('another user\'s conversation is not owned, listed, read or deleted', async () => {
    expect(await askService.ownedConversationId(CONV_B, USER_A)).toBeNull();
    expect(await askService.ownedConversationId(CONV_B, USER_B)).toBe(CONV_B);
    expect(await askService.listConversations(20, USER_A)).toEqual([]);
    expect(await askService.getConversation(CONV_B, USER_A)).toEqual([]);
    await askService.deleteConversation(CONV_B, USER_A);
    expect(mockDb.conversations).toHaveLength(1);
    expect(mockDb.conversation_messages).toHaveLength(1);
  });
});
