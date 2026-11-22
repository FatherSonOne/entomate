/**
 * Assignment is scoped to one org: the team comes from org_members, AI names
 * outside the team are dropped, and after-meeting runs only fill unowned items.
 */

'use strict';

// Tables keyed by name; each query filters rows by eq/in and resolves { data, count }.
const tables = {};
function makeDb() {
  const calls = [];
  return {
    calls,
    from(table) {
      const filters = [];
      const q = {
        select() { return q; },
        eq(col, val) { filters.push(r => r[col] === val); calls.push([table, 'eq', col, val]); return q; },
        in(col, vals) { filters.push(r => vals.includes(r[col])); calls.push([table, 'in', col, vals]); return q; },
        then(resolve) {
          const rows = (tables[table] || []).filter(r => filters.every(f => f(r)));
          resolve({ data: rows, count: rows.length, error: null });
        }
      };
      return q;
    }
  };
}

const mockDb = makeDb();
jest.mock('../../config/supabase', () => ({ supabase: mockDb, supabaseAdmin: mockDb, supabaseAnon: null }));
jest.mock('../../config/ai', () => ({ isConfigured: () => false, chat: jest.fn() }));
jest.mock('../../utils/log', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../learning/LearningEngine', () => ({ applyLearning: jest.fn(s => s) }));

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

  it('falls back to the org users when no team_members rows match', async () => {
    tables.team_members = [];
    tables.users = [{ id: 'u1', name: 'Priya S.', email: 'priya@a.test', active: true }, { id: 'u9', name: 'Other', active: true }];
    const team = await getOrgTeam('org-a', mockDb);
    expect(team).toEqual([{ name: 'Priya S.', email: 'priya@a.test', user_id: 'u1', role: null, skills: [] }]);
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
});
