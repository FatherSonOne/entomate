/**
 * Assignment is scoped to one org: the team comes from org_members, AI names
 * outside the team are dropped, and after-meeting runs only fill unowned items.
 */
/* global jest, beforeEach, describe, it, expect */

'use strict';

const { randomUUID } = require('node:crypto');
const express = require('express');
const request = require('supertest');

// Tables keyed by name; each query filters rows by eq/in and resolves { data, count }.
const tables = {};
function makeDb() {
  const calls = [];
  return {
    calls,
    from(table) {
      const filters = [];
      let insert;
      let changes;
      let sort;
      let limit;
      const q = {
        select() { return q; },
        eq(col, val) {
          const [field, key] = col.split('->>');
          filters.push(r => (key ? r[field]?.[key] : r[field]) === val);
          calls.push([table, 'eq', col, val]);
          return q;
        },
        neq(col, val) { filters.push(r => r[col] !== val); return q; },
        in(col, vals) { filters.push(r => vals.includes(r[col])); calls.push([table, 'in', col, vals]); return q; },
        is(col, val) { filters.push(r => (r[col] ?? null) === val); return q; },
        not(col, _operator, val) { filters.push(r => (r[col] ?? null) !== val); return q; },
        gt(col, val) { filters.push(r => r[col] > val); return q; },
        order(col) { sort = col; return q; },
        limit(count) { limit = count; return q; },
        update(input) { changes = input; return q; },
        insert(input) { insert = input; return q; },
        async maybeSingle() { const { data } = await q; return { data: data[0] || null, error: null }; },
        then(resolve) {
          if (insert) {
            tables[table] ??= [];
            tables[table].push(insert);
            return resolve({ data: null, error: null });
          }
          const rows = (tables[table] || []).filter(r => filters.every(f => f(r)));
          if (sort) rows.sort((a, b) => a[sort].localeCompare(b[sort]));
          const page = rows.slice(0, limit);
          if (changes) page.forEach(row => Object.assign(row, changes));
          resolve({ data: page.map(row => ({ ...row })), count: rows.length, error: null });
        }
      };
      return q;
    }
  };
}

const mockDb = makeDb();
jest.mock('@supabase/supabase-js', () => ({ createClient: () => mockDb }));
jest.mock('../../config/supabase', () => ({ supabase: mockDb, supabaseAdmin: mockDb, supabaseAnon: null }));
jest.mock('../../config/ai', () => ({ isConfigured: () => false, chat: jest.fn() }));
jest.mock('../../utils/log', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../learning/LearningEngine', () => ({ applyLearning: jest.fn(s => s) }));
jest.mock('../../middleware/auth', () => ({
  ...jest.requireActual('../../middleware/auth'),
  authenticate(req, _res, next) { req.user = { id: req.get('X-Test-User') }; next(); }
}));

const { getOrgTeam, findMember } = require('../agents/orgTeam');
const assignmentAgent = require('../agents/assignmentAgent');
const { decideUpdates } = require('../meetingEvents');

beforeEach(() => {
  tables.org_members = [
    { org_id: 'org-a', user_id: 'u1' },
    { org_id: 'org-a', user_id: 'u2' },
    { org_id: 'org-b', user_id: 'u9' }
  ];
  tables.team_members = [
    { user_id: 'u1', name: 'Priya S.', email: 'priya@a.test', skills: ['spec'], active: true },
    { user_id: 'u2', name: 'Jon B.', email: 'jon@a.test', skills: [], active: true },
    { user_id: 'u9', name: 'Other Org Person', email: 'x@b.test', skills: [], active: true },
    { user_id: null, name: 'Unlinked', active: true }
  ];
  tables.users = [];
  tables.owner_preferences = [];
  tables.action_items = [
    { org_id: 'org-a', assigned_to_name: 'Priya S.', status: 'open' },
    { org_id: 'org-b', assigned_to_name: 'Jon B.', status: 'open' },
    { org_id: 'org-b', assigned_to_name: 'Jon B.', status: 'open' }
  ];
});

describe('getOrgTeam', () => {
  it('returns only members of the org', async () => {
    const team = await getOrgTeam('org-a', mockDb);
    expect(team.map(m => m.name).sort()).toEqual(['Jon B.', 'Priya S.']);
  });

  it('returns nothing without an org', async () => {
    expect(await getOrgTeam(null, mockDb)).toEqual([]);
  });

  // public.users has full_name and no name/active columns (X1).
  it('falls back to the org users when no team_members rows match', async () => {
    tables.team_members = [];
    tables.users = [
      { id: 'u1', full_name: 'Priya S.', email: 'priya@a.test' },
      { id: 'u2', full_name: null, email: 'jon@a.test' },
      { id: 'u9', full_name: 'Other', email: 'x@b.test' }
    ];
    const team = await getOrgTeam('org-a', mockDb);
    expect(team).toEqual([
      { name: 'Priya S.', email: 'priya@a.test', user_id: 'u1', role: null, skills: [] },
      { name: 'jon@a.test', email: 'jon@a.test', user_id: 'u2', role: null, skills: [] }
    ]);
  });

  it('matches names case-insensitively', () => {
    expect(findMember([{ name: 'Priya S.' }], ' priya s. ')).toEqual({ name: 'Priya S.' });
    expect(findMember([{ name: 'Priya S.' }], 'Someone')).toBeNull();
  });
});

describe('assignmentAgent', () => {
  it('has no team, and recommends no one, without an orgId', async () => {
    const s = await assignmentAgent.suggest({ task: 'Write the spec' });
    expect(s.recommended).toBeNull();
    expect(s.recommendedMember).toBeNull();
  });

  it('picks from the org only, counting workload inside the org', async () => {
    const s = await assignmentAgent.suggest({ task: 'Write the spec', orgId: 'org-a' });
    // Priya has 1 open item in org-a, Jon has 0 in org-a (his 2 are in org-b)
    expect(s.recommended).toBe('Jon B.');
    expect(s.recommendedMember).toEqual({ name: 'Jon B.', email: 'jon@a.test', user_id: 'u2' });
  });

  it('drops a recommendation that is not on the team', async () => {
    const s = await assignmentAgent.suggest({ task: 'x', team: [{ name: 'A' }, { name: 'B' }], orgId: 'org-a' });
    expect(['A', 'B']).toContain(s.recommended);
    const bad = await assignmentAgent.suggest({ task: 'x', team: [{ name: 'Only' }] });
    expect(bad.recommended).toBe('Only');
  });
});

describe('decideUpdates — owner', () => {
  const assignment = { recommended: 'Jon B.', confidence: 0.8, recommendedMember: { name: 'Jon B.', email: 'jon@a.test', user_id: 'u2' } };

  it('fills an unowned item with name, email and user id', () => {
    expect(decideUpdates({}, { assignment })).toEqual({ assigned_to_name: 'Jon B.', assigned_to_email: 'jon@a.test', assigned_to_id: 'u2' });
  });

  it('never replaces an owner named in the meeting', () => {
    expect(decideUpdates({ assigned_to_name: 'Priya S.' }, { assignment })).toEqual({});
    expect(decideUpdates({ assigned_to_email: 'p@a.test' }, { assignment })).toEqual({});
  });

  it('needs enough confidence and a matched member', () => {
    expect(decideUpdates({}, { assignment: { ...assignment, confidence: 0.5 } })).toEqual({});
    expect(decideUpdates({}, { assignment: { ...assignment, recommendedMember: null } })).toEqual({});
  });
});

describe('real agents, end to end through the orchestrator', () => {
  // Regression: baseAgent.log referenced an undefined `log`, so every agent
  // threw on its first log line and every run failed.
  const orchestrator = require('../agentOrchestrator');

  it('priority and deadline agents run without throwing', async () => {
    const r1 = await orchestrator.runAgent('priority', { task: 'Urgent: fix the login bug', orgId: 'org-a' });
    const r2 = await orchestrator.runAgent('deadline', { task: 'Review the draft', priority: 'high' });
    expect(r1.success).toBe(true);
    expect(r1.suggestion.recommended).toBe('high');
    expect(r2.success).toBe(true);
    expect(r2.suggestion.recommended).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('runs assignment only for unowned items in a known org', async () => {
    const meeting = { id: 'm1', org_id: 'org-a', title: 'Kickoff', created_at: '2026-11-21T10:00:00Z' };
    const items = [
      { id: 'a1', task_description: 'Write the spec', priority: 'medium' },
      { id: 'a2', task_description: 'Book venue', priority: 'low', assigned_to_name: 'Priya S.' }
    ];
    const result = await orchestrator.processMeetingWithAgents(meeting, items);
    const [first, second] = result.actionItems;
    expect(first.suggestions.assignment.recommendedMember.name).toBe('Jon B.');
    expect(second.suggestions.assignment).toBeUndefined();

    const noOrg = await orchestrator.processMeetingWithAgents({ ...meeting, org_id: null }, [items[0]]);
    expect(noOrg.actionItems[0].suggestions.assignment).toBeUndefined();
  });

  it('uses an approved owner on the next matching meeting action item', async () => {
    const scope = require('node:crypto').createHash('sha256').update(JSON.stringify(['kickoff', 'write the spec'])).digest('hex');
    tables.owner_preferences.push({ org_id: 'org-a', scope_key: scope, member_id: 'u1', status: 'active' });
    const meeting = { id: 'm-next', org_id: 'org-a', title: ' Kickoff ', created_at: '2026-11-23T10:00:00Z' };
    const items = [{ id: 'a-next', task_description: 'Write the spec', priority: 'medium' }];
    const result = await orchestrator.processMeetingWithAgents(meeting, items);
    const assignment = result.actionItems[0].suggestions.assignment;
    expect(assignment.recommendedMember.user_id).toBe('u1');
    expect(assignment.reason).toMatch(/approved owner preference/i);
  });
});

it('records corrections through the action item API, approves in Settings, and writes the next matching owner', async () => {
  const app = express().use(express.json());
  app.use('/meetings', require('../../routes/meetings'));
  app.use('/settings', require('../../routes/settings'));
  const { MeetingEvents } = require('../meetingEvents');
  const events = new MeetingEvents({ db: mockDb });
  const [orgId, otherOrgId, alex, jordan, outsider] = Array.from({ length: 5 }, () => randomUUID());
  tables.org_members = [
    { org_id: orgId, user_id: alex, role: 'owner' },
    { org_id: orgId, user_id: jordan, role: 'member' },
    { org_id: otherOrgId, user_id: outsider, role: 'owner' }
  ];
  tables.team_members = [
    { user_id: alex, name: 'Alex', email: 'alex@example.test', active: true },
    { user_id: jordan, name: 'Jordan', email: 'jordan@example.test', active: true },
    { user_id: outsider, name: 'Outside', active: true }
  ];
  tables.tenant_organizations = [{ id: orgId, settings: { meeting_agents: {
    assignment: { enabled: true, minConfidence: 0.6 }, priority: { enabled: false }, deadline: { enabled: false }
  } } }];
  tables.meetings = [];
  tables.action_items = [];
  const createMeeting = (title = 'Weekly Finance', task = 'Review invoices', fields = {}) => {
    const meeting = { id: randomUUID(), org_id: orgId, title };
    const item = { id: randomUUID(), org_id: orgId, meeting_id: meeting.id, task_description: task, ...fields };
    tables.meetings.push(meeting);
    tables.action_items.push(item);
    return [meeting, item];
  };
  const list = (user = alex, workspaceId = orgId) => request(app).get('/settings/owner-preferences').query({ workspaceId }).set('X-Test-User', user);
  const update = (item, user = jordan) => request(app).patch(`/meetings/action-items/${item.id}`).set('X-Test-User', user)
    .send({ assigned_to_name: 'Jordan', assigned_to_email: 'jordan@example.test', version: item.updated_at });
  const decide = (user, preference, decision, workspaceId = orgId) => request(app).patch('/settings/owner-preferences').set('X-Test-User', user)
    .send({ workspaceId, scopeKey: preference.scopeKey, memberId: preference.memberId, decision });

  for (let i = 0; i < 3; i++) {
    const [meeting, item] = createMeeting();
    await events.handleMeetingProcessed(meeting, [item]);
    expect(item.assigned_to_name).toBe('Alex');
    if (i === 0) await update(item, outsider).expect(404);
    const { body } = await update(item).expect(200);
    expect(body.assigned_to_name).toBe('Jordan');
    expect(body.owner_correction).toMatchObject({ from: 'Alex', to: 'Jordan', memberId: jordan });
    if (i < 2) expect((await list().expect(200)).body.suggested).toEqual([]);
  }

  const { body: { suggested } } = await list().expect(200);
  expect(suggested).toHaveLength(1);
  const [preference] = suggested;
  expect(preference.evidence).toHaveLength(3);
  expect((await list(outsider, otherOrgId).expect(200)).body.suggested).toEqual([]);
  await list(outsider).expect(403);
  await decide(jordan, preference, 'approve').expect(403);
  await decide(outsider, preference, 'approve', otherOrgId).expect(409);

  const [before, pendingItem] = createMeeting();
  await events.handleMeetingProcessed(before, [pendingItem]);
  expect(pendingItem.assigned_to_name).toBe('Alex');
  await decide(alex, preference, 'approve').expect(200);
  expect((await list().expect(200)).body).toMatchObject({ suggested: [], active: [preference] });

  const [next, item] = createMeeting(' weekly  finance ', 'Review  invoices');
  await events.handleMeetingProcessed(next, [item]);
  expect(item).toMatchObject({
    assigned_to_id: jordan,
    assigned_to_name: 'Jordan',
    assigned_to_email: 'jordan@example.test',
    agent_notes: { assignment: { applied: true, reason: expect.stringMatching(/approved owner preference/i) } }
  });
  const [unmatched, different] = createMeeting('Weekly Operations');
  await events.handleMeetingProcessed(unmatched, [different]);
  expect(different.assigned_to_name).toBe('Alex');
  const [sameMeetingTitle, differentTask] = createMeeting('Weekly Finance', 'Send payroll');
  await events.handleMeetingProcessed(sameMeetingTitle, [differentTask]);
  expect(differentTask.assigned_to_name).toBe('Alex');
  const [named, alreadyOwned] = createMeeting('Weekly Finance', 'Review invoices', { assigned_to_name: 'Named in meeting' });
  await events.handleMeetingProcessed(named, [alreadyOwned]);
  expect(alreadyOwned.assigned_to_name).toBe('Named in meeting');

  await decide(alex, preference, 'disable').expect(200);
  const [after, disabledItem] = createMeeting();
  await events.handleMeetingProcessed(after, [disabledItem]);
  expect(disabledItem.assigned_to_name).toBe('Alex');
});

describe('deadline agent weighs the owner workload', () => {
  const deadlineAgent = require('../agents/deadlineAgent');
  const base = { task: 'Draft the plan', priority: 'medium', meetingDate: '2026-11-23T10:00:00Z', orgId: 'org-a' };

  it('scales the window by open items', () => {
    expect([0, 2, 3, 6, 10].map(n => deadlineAgent.workloadMultiplier(n))).toEqual([1, 1, 1.25, 1.5, 2]);
    expect(deadlineAgent.workloadMultiplier(null)).toBe(1);
  });

  it('gives a busy owner more time, counting only their open items in the org', async () => {
    tables.action_items = [
      ...Array.from({ length: 6 }, (_, i) => ({ id: `b${i}`, org_id: 'org-a', assigned_to_name: 'Priya S.', status: 'open' })),
      { id: 'x1', org_id: 'org-b', assigned_to_name: 'Jon B.', status: 'open' },
      { id: 'x2', org_id: 'org-a', assigned_to_name: 'Jon B.', status: 'done' }
    ];
    const busy = await deadlineAgent.suggest({ ...base, assignedTo: 'Priya S.' });
    const free = await deadlineAgent.suggest({ ...base, assignedTo: 'Jon B.' });
    const unknown = await deadlineAgent.suggest({ ...base });

    expect(busy.ownerOpenItems).toBe(6);
    expect(free.ownerOpenItems).toBe(0);
    expect(unknown.ownerOpenItems).toBeNull();
    // medium (7) x medium (1): 7 business days; busy owner x1.5 -> 11
    expect(free.recommended).toBe(unknown.recommended);
    expect(busy.recommended > free.recommended).toBe(true);
    expect(busy.reason).toMatch(/Priya S\. has 6 other open items/);
  });

  it('does not count the item itself', async () => {
    tables.action_items = [{ id: 'self', org_id: 'org-a', assigned_to_name: 'Jon B.', status: 'open' }];
    const s = await deadlineAgent.suggest({ ...base, assignedTo: 'Jon B.', actionItemId: 'self' });
    expect(s.ownerOpenItems).toBe(0);
  });

  it('uses the suggested owner for unassigned meeting items', async () => {
    const orchestrator = require('../agentOrchestrator');
    tables.action_items = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, org_id: 'org-a', assigned_to_name: 'Priya S.', status: 'open' }));
    const meeting = { id: 'm2', org_id: 'org-a', title: 'Plan', created_at: '2026-11-23T10:00:00Z' };
    const result = await orchestrator.processMeetingWithAgents(meeting, [{ id: 'n1', task_description: 'Review the draft', priority: 'medium' }]);
    const s = result.actionItems[0].suggestions;
    // Two members, no AI: a 0.6 guess is below the bar, so it is not used
    expect(s.assignment.recommendedMember.name).toBe('Jon B.');
    expect(s.assignment.confidence).toBe(0.6);
    expect(s.deadline.ownerOpenItems).toBeNull();

    // One member: a sure pick, so their workload counts
    tables.org_members = [{ org_id: 'org-a', user_id: 'u1' }];
    const solo = await orchestrator.processMeetingWithAgents(meeting, [{ id: 'n2', task_description: 'Review the draft', priority: 'medium' }]);
    expect(solo.actionItems[0].suggestions.deadline.ownerOpenItems).toBe(10);
    expect(solo.actionItems[0].suggestions.deadline.reason).toMatch(/Priya S\. has 10 other open items/);
  });
});
