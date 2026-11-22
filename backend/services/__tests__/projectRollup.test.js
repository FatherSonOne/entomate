const { rollup, summarizeProjects } = require('../projectRollup');

const NOW = new Date('2026-11-22T12:00:00Z');

describe('projectRollup', () => {
  it('folds tasks and meeting action items into one count, legacy statuses included', () => {
    const tasks = [
      { id: 't1', status: 'todo', due_date: '2026-11-20' },
      { id: 't2', status: 'completed' },
      { id: 't3', status: 'open', parent_task_id: 't1', due_date: '2026-11-01' },
    ];
    const meetings = [
      { id: 'm1', title: 'Check-in', start_time: '2026-11-21T10:00:00Z', decisions: ['A', 'B'] },
      { id: 'm2', title: 'Kickoff', start_time: '2026-10-28T10:00:00Z', decisions: ['C', ''] },
      { id: 'm3', title: 'Handoff', start_time: '2026-11-26T14:00:00Z', decisions: ['not yet'] },
    ];
    const actions = [
      { id: 'a1', meeting_id: 'm1', status: 'open', due_date: '2026-11-25' },
      { id: 'a2', meeting_id: 'm2', status: 'done', due_date: '2026-11-03' },
      { id: 'a3', meeting_id: 'm1', status: 'open', due_date: '2026-11-17' },
    ];
    const r = rollup(tasks, meetings, actions, NOW);
    expect(r).toMatchObject({ total: 5, done: 2, open: 3, late: 2, fromMeetings: 3, decisions: 3, meetings: 2 });
    expect(r.lastMeeting).toMatchObject({ id: 'm1', title: 'Check-in' });
    expect(r.nextMeeting).toMatchObject({ id: 'm3', title: 'Handoff' });
  });

  it('handles a project with nothing linked', () => {
    expect(rollup([], [], [], NOW)).toMatchObject({ total: 0, open: 0, late: 0, lastMeeting: null, nextMeeting: null });
  });

  it('summarizes a page of projects and lists late items across them, oldest first', () => {
    const projects = [{ id: 'p1', name: 'Northwind rollout' }, { id: 'p2', name: 'Website' }];
    const tasks = [
      { id: 't1', project_id: 'p1', title: 'Import seats', status: 'blocked', due_date: '2026-11-20', assigned_to: 'Priya' },
      { id: 't2', project_id: 'p9', title: 'Other org', status: 'open', due_date: '2026-11-01' },
    ];
    const meetings = [{ id: 'm1', project_id: 'p2', title: 'Design review', created_at: '2026-11-20T09:00:00Z' }];
    const actions = [{ id: 'a1', meeting_id: 'm1', task_description: 'Send mockups', status: 'open', due_date: '2026-11-18' }];
    const out = summarizeProjects(projects, tasks, meetings, actions, NOW);
    expect(out.projects.map((p) => p.rollup.late)).toEqual([1, 1]);
    expect(out.lateTotal).toBe(2);
    expect(out.needsYou.map((n) => n.key)).toEqual(['action:a1', 'task:t1']);
    expect(out.needsYou[0]).toMatchObject({ projectName: 'Website', meetingTitle: 'Design review' });
  });
});
