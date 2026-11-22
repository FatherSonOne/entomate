/**
 * meetingEvents — agents + workflow triggers after a meeting is processed.
 * All dependencies are injected; no network or database.
 */

'use strict';

jest.mock('../../utils/log', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const { MeetingEvents, decideUpdates, buildAgentNotes, hasTrigger, hasCodeNode } = require('../meetingEvents');

// Minimal chainable supabase stub: from().update().eq().eq() and from().select().eq().eq()
function makeDb({ workflows = [], updateError = null, failOn = null } = {}) {
  const calls = { updates: [], selects: [] };
  const db = {
    calls,
    from(table) {
      return {
        update(values) {
          const entry = { table, values, filters: {} };
          calls.updates.push(entry);
          const q = {
            eq(col, val) { entry.filters[col] = val; return q; },
            then(resolve) {
              if (failOn && failOn in values) return resolve({ error: { message: `column "${failOn}" does not exist` } });
              resolve({ error: updateError });
            }
          };
          return q;
        },
        select() {
          const entry = { table, filters: {} };
          calls.selects.push(entry);
          const q = {
            eq(col, val) { entry.filters[col] = val; return q; },
            then(resolve) {
              const rows = workflows.filter(w =>
                Object.entries(entry.filters).every(([c, v]) => w[c] === v));
              resolve({ data: rows, error: null });
            }
          };
          return q;
        }
      };
    }
  };
  return db;
}

const trigger = subtype => ({ id: 't', type: 'trigger', subtype });
const meeting = { id: 'm1', org_id: 'org-a', title: 'Kickoff', summary: 's', transcript: 't' };
const items = [
  { id: 'a1', org_id: 'org-a', task_description: 'Send proposal', priority: 'medium', due_date: null },
  { id: 'a2', org_id: 'org-a', task_description: 'Book venue', priority: 'low', due_date: '2026-12-01' }
];

const ENV_KEYS = ['MEETING_AGENTS_ENABLED', 'MEETING_WORKFLOW_TRIGGERS_ENABLED'];
let savedEnv;
beforeEach(() => { savedEnv = Object.fromEntries(ENV_KEYS.map(k => [k, process.env[k]])); ENV_KEYS.forEach(k => delete process.env[k]); });
afterEach(() => { ENV_KEYS.forEach(k => { if (savedEnv[k] === undefined) delete process.env[k]; else process.env[k] = savedEnv[k]; }); });

describe('decideUpdates', () => {
  it('fills a missing due date from the deadline agent', () => {
    expect(decideUpdates({ due_date: null }, { deadline: { recommended: '2026-12-05', confidence: 0.6 } }))
      .toEqual({ due_date: '2026-12-05' });
  });

  it('never overwrites an existing due date', () => {
    expect(decideUpdates({ due_date: '2026-12-01' }, { deadline: { recommended: '2026-12-05' } })).toEqual({});
  });

  it('ignores "existing" and malformed deadlines', () => {
    expect(decideUpdates({}, { deadline: { recommended: '2026-12-05', isExisting: true } })).toEqual({});
    expect(decideUpdates({}, { deadline: { recommended: 'next week' } })).toEqual({});
  });

  it('changes priority only above the confidence threshold', () => {
    expect(decideUpdates({ priority: 'medium' }, { priority: { recommended: 'high', confidence: 0.85 } }))
      .toEqual({ priority: 'high' });
    expect(decideUpdates({ priority: 'medium' }, { priority: { recommended: 'high', confidence: 0.5 } }))
      .toEqual({});
  });

  it('rejects invalid or unchanged priorities', () => {
    expect(decideUpdates({ priority: 'medium' }, { priority: { recommended: 'urgent', confidence: 0.9 } })).toEqual({});
    expect(decideUpdates({ priority: 'high' }, { priority: { recommended: 'HIGH', confidence: 0.9 } })).toEqual({});
  });
});

describe('buildAgentNotes', () => {
  const now = new Date('2026-11-22T12:00:00Z');

  it('records each recommendation, its reason, confidence and whether it was applied', () => {
    const notes = buildAgentNotes({
      priority: { recommended: 'HIGH', reason: 'Mentions a launch blocker', confidence: 0.876 },
      deadline: { recommended: '2026-12-05T00:00:00Z', reason: 'Based on high priority and low complexity', confidence: 0.7 },
      assignment: { recommended: 'Jon B.', reason: 'Lowest workload', confidence: 0.6, recommendedMember: { name: 'Jon B.' } }
    }, { priority: 'high', due_date: '2026-12-05' }, now);
    expect(notes).toEqual({
      reviewed_at: '2026-11-22T12:00:00.000Z',
      priority: { recommended: 'high', reason: 'Mentions a launch blocker', confidence: 0.88, applied: true },
      deadline: { recommended: '2026-12-05', reason: 'Based on high priority and low complexity', confidence: 0.7, applied: true },
      assignment: { recommended: 'Jon B.', reason: 'Lowest workload', confidence: 0.6, applied: false }
    });
  });

  it('skips echoed deadlines and returns null when there is nothing to say', () => {
    expect(buildAgentNotes({ deadline: { recommended: '2026-12-01', isExisting: true } }, {}, now)).toBeNull();
    expect(buildAgentNotes({}, {}, now)).toBeNull();
  });
});

describe('hasTrigger / hasCodeNode', () => {
  it('detects trigger subtypes and code nodes', () => {
    const wf = { nodes: [trigger('meeting_processed'), { type: 'action', subtype: 'code' }] };
    expect(hasTrigger(wf, 'meeting_processed')).toBe(true);
    expect(hasTrigger(wf, 'action_item_created')).toBe(false);
    expect(hasCodeNode(wf)).toBe(true);
    expect(hasCodeNode({ nodes: null })).toBe(false);
  });
});

describe('handleMeetingProcessed', () => {
  const { normalize } = require('../meetingAgentConfig');
  function setup({ workflows = [], suggestions, agents } = {}) {
    const db = makeDb({ workflows });
    const orchestrator = {
      processMeetingWithAgents: jest.fn().mockResolvedValue({
        actionItems: suggestions || [
          { id: 'a1', suggestions: { priority: { recommended: 'high', confidence: 0.9 }, deadline: { recommended: '2026-12-05' } } },
          { id: 'a2', suggestions: { priority: { recommended: 'low', confidence: 0.9 }, deadline: { recommended: '2026-12-01', isExisting: true } } }
        ]
      })
    };
    const executor = { execute: jest.fn().mockResolvedValue({ success: true }) };
    const agentConfig = { load: jest.fn().mockResolvedValue(normalize(agents)) };
    return { db, orchestrator, executor, agentConfig, events: new MeetingEvents({ db, orchestrator, executor, agentConfig }) };
  }

  it('runs agents and writes only the allowed updates, scoped by org', async () => {
    const { db, orchestrator, events } = setup();
    const result = await events.handleMeetingProcessed(meeting, items);

    expect(orchestrator.processMeetingWithAgents).toHaveBeenCalledWith(meeting, items, {
      agents: { assignment: true, priority: true, deadline: true },
      assignMinConfidence: 0.7
    });
    // a1 gets its changes plus notes; a2 only notes (nothing applied)
    expect(db.calls.updates).toHaveLength(2);
    expect(db.calls.updates[0].values).toMatchObject({ priority: 'high', due_date: '2026-12-05' });
    expect(db.calls.updates[0].values.agent_notes.priority).toMatchObject({ recommended: 'high', applied: true });
    expect(db.calls.updates[0].filters).toEqual({ id: 'a1', org_id: 'org-a' });
    expect(db.calls.updates[1].values).not.toHaveProperty('priority');
    expect(db.calls.updates[1].values.agent_notes.priority).toMatchObject({ recommended: 'low', applied: false });
    expect(db.calls.updates[1].values.agent_notes).not.toHaveProperty('deadline');
    expect(result.agents).toEqual({ reviewed: 2, updated: 1 });
  });

  it('still applies changes before the agent_notes column exists', async () => {
    const { orchestrator, executor, agentConfig } = setup();
    const db = makeDb({ failOn: 'agent_notes' });
    const events = new MeetingEvents({ db, orchestrator, executor, agentConfig });
    const result = await events.handleMeetingProcessed(meeting, items);
    const retried = db.calls.updates.find(u => !('agent_notes' in u.values));
    expect(retried.values).toMatchObject({ priority: 'high', due_date: '2026-12-05' });
    expect(result.agents).toEqual({ reviewed: 2, updated: 1 });
  });

  it('fires workflows by default', async () => {
    const { executor, events } = setup({ workflows: [{ id: 'w1', org_id: 'org-a', active: true, nodes: [trigger('meeting_processed')] }] });
    const result = await events.handleMeetingProcessed(meeting, items);
    expect(executor.execute).toHaveBeenCalledTimes(1);
    expect(executor.execute.mock.calls[0][1].org_id).toBe('org-a');
    expect(result.workflows).toEqual({ fired: 1, failed: 0 });
  });

  it('respects MEETING_WORKFLOW_TRIGGERS_ENABLED=false', async () => {
    process.env.MEETING_WORKFLOW_TRIGGERS_ENABLED = 'false';
    const { executor, events } = setup({ workflows: [{ id: 'w1', org_id: 'org-a', active: true, nodes: [trigger('meeting_processed')] }] });
    const result = await events.handleMeetingProcessed(meeting, items);
    expect(executor.execute).not.toHaveBeenCalled();
    expect(result.workflows).toEqual({ skipped: true });
  });

  it('runs only the agents switched on in Settings, at the workspace bar', async () => {
    const { orchestrator, agentConfig, db, events } = setup({
      agents: { priority: { enabled: true, minConfidence: 0.95 }, deadline: { enabled: false } }
    });
    await events.handleMeetingProcessed(meeting, items);
    expect(agentConfig.load).toHaveBeenCalledWith('org-a', db);
    expect(orchestrator.processMeetingWithAgents.mock.calls[0][2].agents)
      .toEqual({ assignment: true, priority: true, deadline: false });
    // priority confidence 0.9 is under the 0.95 bar, so it is noted but not applied
    expect(db.calls.updates[0].values).not.toHaveProperty('priority');
    expect(db.calls.updates[0].values.agent_notes.priority).toMatchObject({ applied: false });
  });

  it('skips the agent step when every agent is off', async () => {
    const { orchestrator, events } = setup({
      agents: { assignment: { enabled: false }, priority: { enabled: false }, deadline: { enabled: false } }
    });
    const result = await events.handleMeetingProcessed(meeting, items);
    expect(orchestrator.processMeetingWithAgents).not.toHaveBeenCalled();
    expect(result.agents).toMatchObject({ reviewed: 0, disabled: true });
  });

  it('respects MEETING_AGENTS_ENABLED=false', async () => {
    process.env.MEETING_AGENTS_ENABLED = 'false';
    const { orchestrator, events } = setup();
    await events.handleMeetingProcessed(meeting, items);
    expect(orchestrator.processMeetingWithAgents).not.toHaveBeenCalled();
  });

  describe('with workflow triggers enabled', () => {
    beforeEach(() => { process.env.MEETING_WORKFLOW_TRIGGERS_ENABLED = 'true'; });

    const workflows = [
      { id: 'w-meeting', name: 'Recap', org_id: 'org-a', active: true, nodes: [trigger('meeting_processed')] },
      { id: 'w-item', name: 'Per item', org_id: 'org-a', active: true, nodes: [trigger('action_item_created')] },
      { id: 'w-code', name: 'Custom', org_id: 'org-a', active: true, nodes: [trigger('meeting_processed'), { type: 'action', subtype: 'code' }] },
      { id: 'w-inactive', name: 'Off', org_id: 'org-a', active: false, nodes: [trigger('meeting_processed')] },
      { id: 'w-other-org', name: 'Theirs', org_id: 'org-b', active: true, nodes: [trigger('meeting_processed')] }
    ];

    it('fires matching workflows in the same org only, skipping Code nodes', async () => {
      const { executor, events } = setup({ workflows });
      const result = await events.handleMeetingProcessed(meeting, items);

      const fired = executor.execute.mock.calls.map(([wf, , opts]) => [wf.id, opts.triggeredBy]);
      expect(fired).toEqual([
        ['w-meeting', 'meeting_processed'],
        ['w-item', 'action_item_created'],
        ['w-item', 'action_item_created']
      ]);
      expect(result.workflows).toEqual({ fired: 3, failed: 0 });
    });

    it('passes agent-updated action items to the workflows', async () => {
      const { executor, events } = setup({ workflows });
      await events.handleMeetingProcessed(meeting, items);
      const [, payload] = executor.execute.mock.calls[0];
      expect(payload.meeting_id).toBe('m1');
      expect(payload.action_items[0]).toMatchObject({ id: 'a1', priority: 'high', due_date: '2026-12-05' });
    });

    it('fires nothing for a meeting without org_id', async () => {
      const { executor, events } = setup({ workflows });
      await events.handleMeetingProcessed({ ...meeting, org_id: undefined }, items);
      expect(executor.execute).not.toHaveBeenCalled();
    });

    it('counts a failing workflow without throwing', async () => {
      const { executor, events } = setup({ workflows: [workflows[0]] });
      executor.execute.mockRejectedValueOnce(new Error('boom'));
      const result = await events.handleMeetingProcessed(meeting, items);
      expect(result.workflows).toEqual({ fired: 0, failed: 1 });
    });
  });

  it('never throws when the agent step fails', async () => {
    const { orchestrator, events } = setup();
    orchestrator.processMeetingWithAgents.mockRejectedValueOnce(new Error('AI down'));
    const result = await events.handleMeetingProcessed(meeting, items);
    expect(result.agents).toEqual({ error: 'AI down' });
  });

  it('ignores a missing meeting', async () => {
    const { orchestrator, events } = setup();
    await events.handleMeetingProcessed(null, items);
    expect(orchestrator.processMeetingWithAgents).not.toHaveBeenCalled();
  });
});
