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
const GOAL_B = '000000b0-0000-4000-8000-0000000000b0';

const mockDb = {};
function resetDb() {
  mockDb.org_members = [{ user_id: USER_A, org_id: ORG_A }];
  mockDb.tasks = [
    { id: TASK_A, org_id: ORG_A, title: 'mine', status: 'open' },
    { id: TASK_B, org_id: ORG_B, title: 'theirs', status: 'open' },
  ];
  mockDb.goals = [{ id: GOAL_B, org_id: ORG_B, title: 'their goal' }];
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

describe('goals are limited to the caller\'s org', () => {
  const goals = () => app('../routes/goals', '/api/goals');

  test('another org\'s goal is not found', async () => {
    const res = await request(goals()).get(`/api/goals/${GOAL_B}`);
    expect(res.status).toBe(404);
  });

  test('another org\'s goal cannot be deleted', async () => {
    await request(goals()).delete(`/api/goals/${GOAL_B}`);
    expect(mockDb.goals).toHaveLength(1);
  });

  test('list hides other orgs', async () => {
    const res = await request(goals()).get('/api/goals');
    expect(JSON.stringify(res.body)).not.toContain(GOAL_B);
  });
});
