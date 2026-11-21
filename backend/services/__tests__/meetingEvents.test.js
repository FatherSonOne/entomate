/**
 * meetingEvents — agents + workflow triggers after a meeting is processed.
 * All dependencies are injected; no network or database.
 */

'use strict';

jest.mock('../../utils/log', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const { MeetingEvents, decideUpdates, hasTrigger, hasCodeNode } = require('../meetingEvents');

// Minimal chainable supabase stub: from().update().eq().eq() and from().select().eq().eq()
function makeDb({ workflows = [], updateError = null } = {}) {
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
            then(resolve) { resolve({ error: updateError }); }
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
  function setup({ workflows = [], suggestions } = {}) {
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
    return { db, orchestrator, executor, events: new MeetingEvents({ db, orchestrator, executor }) };
  }

  it('runs agents and writes only the allowed updates, scoped by org', async () => {
    const { db, orchestrator, events } = setup();
    const result = await events.handleMeetingProcessed(meeting, items);

    expect(orchestrator.processMeetingWithAgents).toHaveBeenCalledWith(meeting, items);
    expect(db.calls.updates).toHaveLength(1);
    expect(db.calls.updates[0].values).toMatchObject({ priority: 'high', due_date: '2026-12-05' });
    expect(db.calls.updates[0].filters).toEqual({ id: 'a1', org_id: 'org-a' });
    expect(result.agents).toEqual({ reviewed: 2, updated: 1 });
  });

  it('does not fire workflows by default', async () => {
    const { executor, events } = setup({ workflows: [{ id: 'w1', org_id: 'org-a', active: true, nodes: [trigger('meeting_processed')] }] });
    const result = await events.handleMeetingProcessed(meeting, items);
    expect(executor.execute).not.toHaveBeenCalled();
    expect(result.workflows).toEqual({ skipped: true });
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
