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
  mockDb.ecosystem_config = [];
  mockDb.ecosystem_events = [];
  mockDb.platform_admins = [];
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
    lt(col, val) { filters.push((r) => r[col] < val); return q; },
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
        if (op === 'insert') {
          if (table === 'ecosystem_events' && rows.some((row) => row.id === patch.id)) {
            return resolve({ data: null, error: { code: '23505', message: 'event already exists' } });
          }
          const list = [].concat(patch);
          if (table === 'ecosystem_events') Object.assign(list[0], { retry_count: 0, created_at: new Date().toISOString() });
          rows.push(...list);
          return resolve({ data: table === 'ecosystem_events' && single ? list[0] : list, error: null });
        }
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
  const client = { from: (t) => mockQuery(t), rpc: jest.fn(async () => ({ error: null })) };
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


describe('project handoff to Pulse', () => {
  const root = '/api/projects/' + PROJ_A + '/handoff';
  const workspaceId = '0ca42b5b-1c03-4270-9d88-14cc4158b72d';
  const channelId = '2dbdd37d-3b69-4ed4-8f48-3878cf07c6fe';
  const reader = 'e8574c78-71ab-4ce1-8f14-a48366cafbbf';
  const bridge = require('../services/ecosystemBridge').ecosystemBridge;
  const api = (user) => request(app('../routes/projects', '/api/projects', user));
  const send = (user) => api(user).post(root).send({ channelId });

  beforeEach(async () => {
    mockDb.ecosystem_config.push({
      app_name: 'pulse', enabled: true, api_url: 'https://pulse-fixture.invalid/bridge', service_token: 'test-token',
      features: { project_handoff: { orgId: ORG_A, workspaceId, channelId, channelName: '#project-handoffs' } }
    });
    mockDb.org_members.push({ user_id: reader, org_id: ORG_A, role: 'member' });
    mockDb.platform_admins.push({ user_id: USER_A });
    await bridge.reload();
    jest.spyOn(global, 'fetch').mockImplementation(async () => { throw new Error('Unexpected fixture request'); });
  });

  afterEach(() => jest.restoreAllMocks());

  test('requires a configured workspace destination, platform admin, and matching channel', async () => {
    const status = await api(reader).get(root).expect(200);
    expect(status.body).toEqual({ channelName: '#project-handoffs', channelId: null, delivery: 'not_sent', connected: true });
    await send(reader).expect(403);
    await api().get('/api/projects/' + PROJ_B + '/handoff').expect(404);
    await api().post('/api/projects/' + PROJ_B + '/handoff').send({ channelId }).expect(404);
    await api().post(root).send({ channelId: workspaceId }).expect(409);

    mockDb.ecosystem_config[0].features.project_handoff.orgId = ORG_B;
    await bridge.reload();
    expect((await api().get(root).expect(200)).body).toEqual({
      channelName: null, channelId: null, delivery: 'not_sent', connected: false
    });
    await send().expect(409);
    await api().get('/api/projects/' + PROJ_A).expect(200);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockDb.ecosystem_events).toEqual([]);
  });

  test('records pending delivery, claims one concurrent handoff, and requires a receipt', async () => {
    let started;
    let reply;
    const requested = new Promise((resolve) => { started = resolve; });
    global.fetch.mockImplementationOnce(async () => {
      started();
      return new Promise((resolve) => { reply = resolve; });
    });

    const attempt = send().then((res) => res);
    await requested;
    try {
      expect((await api().get(root).expect(200)).body).toMatchObject({ delivery: 'pending', channelId: null });
      expect((await send().expect(200)).body.delivery).toBe('pending');
      expect(global.fetch).toHaveBeenCalledTimes(1);
      const payload = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(payload).toMatchObject({
        eventType: 'message.bot_post', entityType: 'project', entityId: PROJ_A,
        data: { workspaceId, channelId, content: expect.stringContaining('/projects/' + PROJ_A) }
      });
      expect(Object.keys(payload.data).sort()).toEqual(['channelId', 'content', 'workspaceId']);
    } finally {
      reply({ ok: true, json: async () => ({ received: false }) });
    }
    expect((await attempt).body).toMatchObject({ delivery: 'failed', channelId });
    expect(mockDb.ecosystem_events[0]).toMatchObject({ status: 'failed', next_retry_at: null });
    const ecosystem = request(app('../routes/ecosystem', '/api/ecosystem', reader));
    expect((await ecosystem.get('/api/ecosystem/status').expect(200)).body.connectedApps[0].features).not.toHaveProperty('project_handoff');
    expect((await ecosystem.get('/api/ecosystem/sync-status/' + PROJ_A).expect(200)).body.pulse).toBeNull();
    expect(await bridge.retryEvent(mockDb.ecosystem_events[0].id)).toMatchObject({ success: false });
    const oldId = mockDb.ecosystem_events[0].event_id;
    global.fetch.mockImplementationOnce(async (_url, request) => ({
      ok: true, json: async () => ({ received: true, eventId: JSON.parse(request.body).id })
    }));
    expect((await send().expect(200)).body).toMatchObject({ delivery: 'delivered', channelId: null });
    expect(JSON.parse(global.fetch.mock.calls[1][1].body).id).toBe(oldId);
    expect(mockDb.ecosystem_events).toHaveLength(1);
    expect(mockDb.ecosystem_events[0]).toMatchObject({ status: 'delivered', retry_count: 1, error_message: null });
    expect((await send().expect(200)).body.delivery).toBe('delivered');
    expect(global.fetch).toHaveBeenCalledTimes(2);

    mockDb.ecosystem_config[0].enabled = false;
    await bridge.reload();
    expect((await api(reader).get(root).expect(200)).body).toEqual({
      channelName: '#project-handoffs', channelId: null, delivery: 'delivered', connected: false
    });
  });

  test('recovers an expired delivery lease using the same event and confirmed destination', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 503, text: async () => 'fixture offline' });
    expect((await send().expect(200)).body.delivery).toBe('failed');
    const event = mockDb.ecosystem_events[0];
    Object.assign(event, { status: 'pending', next_retry_at: '2001-01-01T00:00:00Z' });
    mockDb.ecosystem_config[0].features.project_handoff.channelId = workspaceId;
    await bridge.reload();
    expect((await api().get(root).expect(200)).body).toMatchObject({ delivery: 'failed', channelId: null });
    await send().expect(409);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    mockDb.ecosystem_config[0].features.project_handoff.channelId = channelId;
    await bridge.reload();
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ received: true, eventId: event.id, deduped: true }) });
    expect((await send().expect(200)).body.delivery).toBe('delivered');
    expect(mockDb.ecosystem_events).toHaveLength(1);
  });
});

describe('projects are limited to the caller\'s org', () => {
  const projects = () => app('../routes/projects', '/api/projects');

  test.each(['planning', 'active', 'completed'])('archives and restores %s with all native history intact', async (status) => {
    const root = '/api/projects/' + PROJ_A;
    const meetingId = 'b21eea97-3cfe-47dc-a591-1d8b25a2dc92';
    Object.assign(mockDb.projects[0], {
      status, owner_id: USER_A, settings: { brief: { outcome: 'Keep the outcome', scope: '', successCriteria: '', ownerId: USER_A, resources: [] }, unrelated: true }
    });
    mockDb.tasks[0].project_id = PROJ_A;
    mockDb.tasks[0].due_date = '2001-01-01';
    mockDb.meetings.push({ id: meetingId, org_id: ORG_A, project_id: PROJ_A, title: 'Project kickoff', decisions: ['Keep the decision'] });
    mockDb.action_items.push({ id: 'action-1', org_id: ORG_A, meeting_id: meetingId, status: 'open', due_date: '2001-01-01' });
    const api = request(projects());
    const milestone = await api.patch(root + '/progress').send({
      operation: 'addMilestone', version: null, title: 'Keep the milestone', dueDate: '2030-01-10', ownerId: USER_A
    }).expect(200);
    const progress = await api.patch(root + '/progress').send({
      operation: 'postUpdate', version: milestone.body.version, health: 'on_track', note: 'Keep the update'
    }).expect(200);
    const brief = (await api.get(root + '/brief').expect(200)).body.brief;
    expect(brief.outcome).toBe('Keep the outcome');
    const before = (await api.get(root).expect(200)).body;
    expect(before.rollup).toMatchObject({ total: 2, late: 2 });
    expect(before.tasks).toHaveLength(1);
    expect(before.meetings).toHaveLength(1);
    expect(before.actionItems).toHaveLength(1);

    const expectHistory = async (expectedStatus) => {
      const detail = (await api.get(root).expect(200)).body;
      expect(detail).toMatchObject({
        status: expectedStatus, tasks: before.tasks, meetings: before.meetings,
        actionItems: before.actionItems, rollup: before.rollup, settings: { unrelated: true }
      });
      expect((await api.get(root + '/brief').expect(200)).body.brief).toEqual(brief);
      expect((await api.get(root + '/progress').expect(200)).body).toEqual(progress.body);
    };

    await api.put(root).send({ status: 'archived' }).expect(200);
    await api.put(root).send({ status: 'archived' }).expect(200);
    await expectHistory('archived');
    const archive = await api.get('/api/projects?status=archived').expect(200);
    expect(archive.body).toMatchObject({ projects: [{ id: PROJ_A }], needsYou: [], lateTotal: 0 });
    await api.delete(root).expect(405);
    await api.patch(root + '/restore').expect(200);
    await api.patch(root + '/restore').expect(200);
    await expectHistory(status);
  });

  test('guards lifecycle writes, preserves restore settings, and recovers a legacy archived project', async () => {
    const member = 'e8574c78-71ab-4ce1-8f14-a48366cafbbf';
    mockDb.org_members.push({ user_id: member, org_id: ORG_A, role: 'member' });
    mockDb.org_members[0].role = 'admin';
    Object.assign(mockDb.projects[0], { status: 'archived', settings: { archive: { previousStatus: 'active' } } });
    const root = '/api/projects/' + PROJ_A;
    const reader = request(app('../routes/projects', '/api/projects', member));
    await reader.get(root).expect(200);
    await reader.patch(root + '/restore').expect(403);
    await reader.put(root).send({ status: 'active' }).expect(403);
    await reader.put(root).send({ settings: { archive: null } }).expect(400);
    await reader.put(root).send({ settings: { other: 7 } }).expect(200);
    await reader.patch('/api/projects/' + PROJ_B + '/restore').expect(404);

    const admin = request(projects());
    const restored = await admin.patch(root + '/restore').expect(200);
    expect(restored.body).toEqual({ status: 'active' });
    expect(mockDb.projects[0].settings).toEqual({ other: 7 });

    Object.assign(mockDb.projects[0], { status: 'archived', settings: {} });
    mockBeforeUpdate = (table) => {
      if (table === 'projects') mockDb.projects[0].updated_at = '2040-01-01T00:00:00Z';
    };
    await admin.patch(root + '/restore').expect(409);
    expect(mockDb.projects[0].status).toBe('archived');
    mockBeforeUpdate = null;
    expect((await admin.patch(root + '/restore').expect(200)).body.status).toBe('planning');
  });

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

describe('project milestones and status updates', () => {
  const meetingId = '0000000a-0000-4000-8000-0000000000a3';
  const memberId = '11111111-1111-4111-8111-111111111112';
  const projects = (user) => app('../routes/projects', '/api/projects', user);
  const path = '/api/projects/' + PROJ_A + '/progress';
  const milestone = { title: 'Pilot ready', dueDate: '2026-11-30', ownerId: memberId };
  const brief = { outcome: 'Clinic pilot', scope: '', successCriteria: '', ownerId: null, resources: [] };
  const add = (version = null, fields = milestone) =>
    request(projects()).patch(path).send({ ...fields, operation: 'addMilestone', version });

  beforeEach(() => {
    Object.assign(mockDb.org_members[0], { user_name: 'Alex Rivera', role: 'member' });
    mockDb.org_members.push({ org_id: ORG_A, user_id: memberId, user_name: 'Morgan Chen', role: 'member' });
    Object.assign(mockDb.projects[0], { owner_id: USER_A, settings: { brief, retained: true } });
    Object.assign(mockDb.tasks[0], { project_id: PROJ_A, due_date: '2020-01-01' });
    mockDb.tasks.push({ id: 'subtask', org_id: ORG_A, project_id: PROJ_A, parent_task_id: TASK_A, status: 'done' });
    mockDb.meetings.push({ id: meetingId, org_id: ORG_A, project_id: PROJ_A, title: 'Launch', created_at: '2025-01-01T00:00:00Z' });
    mockDb.action_items.push({ id: 'linked-action', meeting_id: meetingId, org_id: ORG_A, status: 'completed' });
  });

  test('creates, edits, completes and reopens an owned milestone while preserving the brief', async () => {
    const created = (await add().expect(200)).body;
    const item = created.milestones[0];
    expect(item).toMatchObject({ ...milestone, ownerName: 'Morgan Chen', completedAt: null });
    const edit = (await request(projects()).patch(path).send({
      ...milestone, title: 'Pilot reviewed', dueDate: '2026-12-01', id: item.id, operation: 'editMilestone', version: created.version,
    }).expect(200)).body;
    expect(edit.milestones[0]).toMatchObject({ id: item.id, title: 'Pilot reviewed', dueDate: '2026-12-01' });
    const done = (await request(projects()).patch(path).send({
      operation: 'setMilestoneDone', id: item.id, done: true, version: edit.version,
    }).expect(200)).body;
    expect(done.milestones[0].completedAt).toEqual(expect.any(String));
    const open = (await request(projects()).patch(path).send({
      operation: 'setMilestoneDone', id: item.id, done: false, version: done.version,
    }).expect(200)).body;
    expect(open.milestones[0].completedAt).toBeNull();
    expect(mockDb.projects[0].settings).toMatchObject({ brief, retained: true });
  });

  test('does not accept stale edits, forged authors or outside owners', async () => {
    await add(null, { ...milestone, ownerId: PROJ_B }).expect(400);
    await add().expect(200);
    await add().expect(409);
    await request(projects()).patch(path).send({ operation: 'postUpdate', health: 'on_track', note: 'Pilot underway', version: null, authorName: 'Other' }).expect(400);
    await request(projects(memberId)).patch(path).send({ operation: 'addMilestone', version: null, ...milestone }).expect(403);
    await request(projects()).get('/api/projects/' + PROJ_B + '/progress').expect(404);
    const data = (await request(projects(memberId)).get(path).expect(200)).body;
    expect(data).toMatchObject({ canEdit: false, members: [], milestones: [expect.objectContaining({ ownerName: 'Morgan Chen' })] });
  });

  test('rolls up the same work in Projects, Ask Entomate, the PDF and an attributed snapshot', async () => {
    const created = (await add().expect(200)).body;
    const posted = (await request(projects()).patch(path).send({
      operation: 'postUpdate', health: 'at_risk', note: 'Confirm a second site.', version: created.version,
    }).expect(200)).body;
    const counts = { total: 2, done: 1, late: 1 };
    expect(posted.updates[0]).toMatchObject({
      counts: { ...counts, milestones: 1, milestonesDone: 0 },
      health: 'at_risk', note: 'Confirm a second site.', authorName: 'Alex Rivera', authorId: USER_A, postedAt: expect.any(String),
    });
    const detail = await request(projects()).get('/api/projects/' + PROJ_A).expect(200);
    expect(detail.body.rollup).toMatchObject(counts);
    const carry = await request(app('../routes/meetings', '/api/meetings'))
      .get('/api/meetings/' + meetingId + '/carry-forward').expect(200);
    expect(carry.body.projectContext.nextMilestone).toMatchObject({ title: milestone.title, dueDate: milestone.dueDate });
    const { runTool } = require('../services/entoAi/tools');
    const ctx = { db: require('../config/supabase').supabase, orgIds: [ORG_A] };
    const ai = await runTool('get_project', { project_id: PROJ_A }, ctx);
    expect(ai.response.project).toMatchObject({ work: counts, latestUpdate: { counts }, milestones: { total: 1, done: 0 } });
    const list = await runTool('list_projects', {}, ctx);
    expect(list.response.projects[0].work).toMatchObject(counts);

    const pdf = require('../services/reportService');
    const generate = jest.spyOn(pdf, 'generateProjectReportPDF');
    try {
      const report = await request(app('../routes/reports', '/api/reports')).get('/api/reports/project/' + PROJ_A + '/pdf').expect(200);
      expect(report.headers['content-type']).toContain('application/pdf');
      expect(generate).toHaveBeenCalledWith(expect.objectContaining({
        total_items: 2, complete_items: 1, overdue_items: 1, milestone_counts: { total: 1, done: 0 },
        latest_update: expect.objectContaining({ note: 'Confirm a second site.' }),
      }), expect.arrayContaining([expect.objectContaining({ status: 'done' })]), expect.any(Array));
    } finally {
      generate.mockRestore();
    }

    mockDb.tasks[0].status = 'done';
    const after = await request(projects()).get(path).expect(200);
    expect(after.body.updates[0].counts).toMatchObject(counts);
  });

  test('generic settings writes preserve the plan and cannot replace progress', async () => {
    const created = (await add().expect(200)).body;
    await request(projects()).put('/api/projects/' + PROJ_A).send({ settings: { other: 7 } }).expect(200);
    const data = (await request(projects()).get(path).expect(200)).body;
    expect(data.version).toBe(created.version);
    expect(data.milestones).toHaveLength(1);
    await request(projects()).put('/api/projects/' + PROJ_A).send({ settings: { progress: {} } }).expect(400);
  });

  test('a concurrent settings write or failed work read cannot post a misleading snapshot', async () => {
    const created = (await add().expect(200)).body;
    const post = () => request(projects()).patch(path).send({
      operation: 'postUpdate', health: 'on_track', note: 'Ready for review', version: created.version,
    });
    mockReadFailure = { table: 'tasks', from: 0 };
    await post().expect(500);
    mockReadFailure = null;
    mockBeforeUpdate = (table) => {
      if (table === 'projects') Object.assign(mockDb.projects[0], { updated_at: '2040-01-01T00:00:00Z' });
    };
    await post().expect(409);
    expect(mockDb.projects[0].settings.progress.updates).toEqual([]);
  });
});

describe('reviewing project brief changes from shared minutes', () => {
  const source = '0000000a-0000-4000-8000-0000000000a1';
  const next = '0000000a-0000-4000-8000-0000000000a2';
  const version = '2026-11-22T10:00:00Z';
  const current = { outcome: 'Current goal', scope: '', successCriteria: '', ownerId: null, resources: [] };
  const project = () => app('../routes/projects', '/api/projects');
  const meetings = () => app('../routes/meetings', '/api/meetings');
  const draft = (id = source) => request(project()).post('/api/projects/' + PROJ_A + '/brief/suggestions').send({ meetingId: id });
  const gemini = require('../config/gemini');
  const originalModel = gemini.model;
  let completion;

  beforeEach(() => {
    Object.assign(mockDb.projects[0], { owner_id: USER_A, updated_at: version, settings: { brief: current, other: true } });
    mockDb.meetings = [
      { id: source, org_id: ORG_A, project_id: PROJ_A, title: 'Planning minutes', created_at: '2026-11-22T10:00:00Z',
        summary: 'A pilot was agreed', decisions: ['Pilot in two clinics'], summary_moments: { decisions: [42000] },
        transcript: 'PRIVATE-TRANSCRIPT-SENTINEL', privateNotes: 'PRIVATE-NOTE-SENTINEL' },
      { id: next, org_id: ORG_A, project_id: PROJ_A, title: 'Next meeting', created_at: '2026-11-23T10:00:00Z' },
    ];
    jest.spyOn(gemini, 'isConfigured').mockReturnValue(true);
    completion = jest.fn(async () => ({
      response: { text: () => JSON.stringify({ suggestions: [
        { field: 'outcome', value: 'Pilot in two clinics', evidence: 1 },
        { field: 'scope', value: 'Unsupported text', evidence: 99 },
      ] }) }
    }));
    gemini.model = { generateContent: completion };
  });

  afterEach(() => {
    gemini.model = originalModel;
    jest.restoreAllMocks();
  });

  test('a sourced draft does not change the project until saved, then carries to its next meeting', async () => {
    const result = await draft().expect(200);
    expect(result.body).toEqual({
      source: { meetingId: source, meetingTitle: 'Planning minutes' },
      version,
      suggestions: [{ field: 'outcome', value: 'Pilot in two clinics',
        evidence: { kind: 'Decision', text: 'Pilot in two clinics', atMs: 42000 } }]
    });
    const input = JSON.stringify(completion.mock.calls[0][0]);
    expect(input).toContain('Pilot in two clinics');
    expect(input).not.toContain('PRIVATE-');
    expect(require('../config/supabase').supabase.rpc).toHaveBeenCalledWith('record_ai_usage', expect.objectContaining({ p_org_id: ORG_A }));
    const carryPath = '/api/meetings/' + next + '/carry-forward';
    const before = await request(meetings()).get(carryPath).expect(200);
    expect(before.body.projectContext.outcome).toBe('Current goal');

    await request(project()).put('/api/projects/' + PROJ_A + '/brief').send({
      version, brief: { ...current, outcome: 'Pilot in two clinics', sources: { outcome: { meetingId: source, atMs: 42000 } } },
    }).expect(200);
    const saved = await request(project()).get('/api/projects/' + PROJ_A + '/brief').expect(200);
    expect(saved.body.brief.sources.outcome).toEqual({ meetingId: source, atMs: 42000 });
    const after = await request(meetings()).get(carryPath).expect(200);
    expect(after.body.projectContext).toEqual({
      id: PROJ_A, name: 'mine', outcome: 'Pilot in two clinics', scope: '', successCriteria: '',
    });
    expect(mockDb.projects[0].settings.other).toBe(true);
  });

  test('a linked meeting with no minutes offers no suggestions without calling AI', async () => {
    const res = await draft(next).expect(200);
    expect(res.body.suggestions).toEqual([]);
    expect(completion).not.toHaveBeenCalled();
  });

  test('a meeting outside the project or workspace cannot become a source', async () => {
    mockDb.meetings[0].org_id = ORG_B;
    await draft().expect(404);
    mockDb.meetings[0].org_id = ORG_A;
    mockDb.meetings[0].project_id = null;
    await draft().expect(404);
    await request(project()).put('/api/projects/' + PROJ_A + '/brief').send({
      version, brief: { ...current, sources: { outcome: { meetingId: source, atMs: null } } },
    }).expect(400);
    expect(completion).not.toHaveBeenCalled();
  });

  test('a reader cannot generate suggestions and a false cross-workspace link reveals no plan', async () => {
    mockDb.projects[0].owner_id = null;
    await draft().expect(403);
    expect(completion).not.toHaveBeenCalled();
    mockDb.meetings[1].project_id = PROJ_B;
    const res = await request(meetings()).get('/api/meetings/' + next + '/carry-forward').expect(200);
    expect(res.body.projectContext).toBeUndefined();
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
