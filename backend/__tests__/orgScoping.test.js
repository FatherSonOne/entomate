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
const AUTO_B = '0000b000-0000-4000-8000-00000000b000';

const mockDb = {};
function resetDb() {
  mockDb.org_members = [{ user_id: USER_A, org_id: ORG_A }];
  mockDb.tasks = [
    { id: TASK_A, org_id: ORG_A, title: 'mine', status: 'open' },
    { id: TASK_B, org_id: ORG_B, title: 'theirs', status: 'open' },
  ];
  mockDb.projects = [
    { id: PROJ_A, org_id: ORG_A, name: 'mine' },
    { id: PROJ_B, org_id: ORG_B, name: 'theirs' },
  ];
  mockDb.automations = [{ id: AUTO_B, org_id: ORG_B, name: 'their automation', enabled: true }];
}

function mockQuery(table) {
  const filters = [];
  let op = 'select';
  let patch = null;
  let single = null;
  const q = {
    select() { return q; },
    update(p) { op = 'update'; patch = p; return q; },
    delete() { op = 'delete'; return q; },
    insert(rows) { op = 'insert'; patch = rows; return q; },
    eq(col, val) { filters.push((r) => r[col] === val); return q; },
    in(col, vals) { filters.push((r) => vals.includes(r[col])); return q; },
    neq() { return q; }, order() { return q; }, limit() { return q; }, range() { return q; },
    or() { return q; }, ilike() { return q; }, gte() { return q; }, lte() { return q; },
    is() { return q; }, not() { return q; },
    single() { single = 'single'; return q; },
    maybeSingle() { single = 'maybe'; return q; },
    then(resolve, reject) {
      try {
        const rows = mockDb[table] || [];
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
        return resolve({ data: hit, error: null, count: hit.length });
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

function app(routerPath, prefix) {
  const a = express();
  a.use(express.json());
  a.use((req, _res, next) => { req.user = { id: USER_A }; req.authVerified = true; next(); });
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


describe('projects and automations are limited to the caller\'s org', () => {
  const projects = () => app('../routes/projects', '/api/projects');
  const automations = () => app('../routes/automations', '/api/automations');

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

  test('another org\'s automation is hidden and cannot be deleted', async () => {
    const list = await request(automations()).get('/api/automations');
    expect(JSON.stringify(list.body)).not.toContain(AUTO_B);
    await request(automations()).delete(`/api/automations/${AUTO_B}`);
    expect(mockDb.automations).toHaveLength(1);
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
