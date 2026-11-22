const { buildProjectReport, reportStatus } = require('../services/projectReport');

describe('projectReport', () => {
  const now = new Date('2026-11-22T12:00:00Z');

  test('maps task and action item statuses onto three groups', () => {
    expect(reportStatus('completed')).toBe('done');
    expect(reportStatus('done')).toBe('done');
    expect(reportStatus('review')).toBe('in_progress');
    expect(reportStatus('todo')).toBe('open');
    expect(reportStatus(null)).toBe('open');
  });

  test('builds totals, overdue and workload from tasks and action items', () => {
    const r = buildProjectReport({
      project: { id: 'p1', name: 'Launch' },
      tasks: [
        { title: 'Draft brief', status: 'completed', assigned_to: 'Ana' },
        { title: 'Book venue', status: 'todo', assigned_to: 'Ben', due_date: '2026-11-20' },
      ],
      actionItems: [
        { task_description: 'Send deck', status: 'open', assigned_to_name: 'Ana', due_date: '2026-11-30' },
        { task_description: 'Call vendor', status: 'done' },
      ],
      now,
    });
    expect(r.project).toEqual({ id: 'p1', title: 'Launch', total_items: 4, complete_items: 2, overdue_items: 1, progress_percent: 50 });
    expect(r.items.map((i) => i.status)).toEqual(['done', 'open', 'open', 'done']);
    expect(r.teamWorkload).toEqual([
      { team_member: 'Ana', total_assigned: 2, completed_items: 1 },
      { team_member: 'Ben', total_assigned: 1, completed_items: 0 },
    ]);
  });

  test('an empty project reports zero progress', () => {
    const r = buildProjectReport({ project: { id: 'p2' }, now });
    expect(r.project.progress_percent).toBe(0);
    expect(r.project.title).toBe('Untitled project');
  });
});
