jest.mock('../../config/supabase', () => ({ supabase: null }));

const { buildInsights, onTime, ownerName, weekStart } = require('../insights');

const NOW = new Date('2026-11-21T15:00:00Z'); // Saturday

function item(over = {}) {
  return {
    id: over.id || Math.random().toString(36).slice(2),
    meeting_id: 'm1',
    task_description: 'Do the thing',
    assigned_to_name: 'Priya S.',
    due_date: '2026-11-18',
    priority: 'medium',
    status: 'open',
    created_at: '2026-11-10T10:00:00Z',
    updated_at: '2026-11-10T10:00:00Z',
    completed_at: null,
    agent_notes: null,
    ...over
  };
}

const meetings = [
  { id: 'm1', title: 'Weekly team sync', start_time: '2026-11-17T15:00:00Z', created_at: '2026-11-17T15:00:00Z', decisions: ['a', 'b'] },
  { id: 'm2', title: 'Old planning', start_time: '2026-08-01T15:00:00Z', created_at: '2026-08-01T15:00:00Z', decisions: ['x'] }
];

describe('onTime', () => {
  it('counts done on or before the due date', () => {
    expect(onTime(item({ status: 'done', completed_at: '2026-11-18T23:00:00Z' }))).toBe(true);
    expect(onTime(item({ status: 'completed', completed_at: '2026-11-19T01:00:00Z' }))).toBe(false);
  });
  it('falls back to updated_at when a done row has no completed_at', () => {
    expect(onTime(item({ status: 'done', updated_at: '2026-11-17T09:00:00Z' }))).toBe(true);
  });
  it('is false for open items and items without a due date', () => {
    expect(onTime(item())).toBe(false);
    expect(onTime(item({ status: 'done', due_date: null, completed_at: '2026-11-01T00:00:00Z' }))).toBe(false);
  });
});

describe('ownerName', () => {
  it('treats Unassigned as no owner and falls back to email', () => {
    expect(ownerName(item({ assigned_to_name: 'Unassigned' }))).toBeNull();
    expect(ownerName(item({ assigned_to_name: '', assigned_to_email: 'jon@x.io' }))).toBe('jon@x.io');
  });
});

describe('weekStart', () => {
  it('returns the Monday of the week', () => {
    expect(weekStart(NOW).toISOString().slice(0, 10)).toBe('2026-11-16');
  });
});

describe('buildInsights', () => {
  const items = [
    item({ id: 'a', status: 'done', completed_at: '2026-11-17T12:00:00Z' }), // on time
    item({ id: 'b', status: 'done', completed_at: '2026-11-20T12:00:00Z' }), // late
    item({ id: 'c' }), // overdue
    item({ id: 'd', due_date: '2026-11-30' }), // open, not due
    item({ id: 'e', status: 'cancelled' }), // ignored
    item({ id: 'f', assigned_to_name: 'Unassigned', due_date: '2026-11-01', created_at: '2026-10-20T00:00:00Z' }), // overdue, no owner
    item({ id: 'g', assigned_to_name: 'Ana R.', status: 'done', due_date: '2026-11-19', completed_at: '2026-11-19T08:00:00Z' })
  ];
  const out = buildInsights({ items, meetings, days: 30, now: NOW });

  it('computes follow-through over items due in the period, ignoring cancelled', () => {
    // due in period: a b c f g (d not yet due, e cancelled) -> on time a, g
    expect(out.followThrough).toEqual({ due: 5, onTime: 2, rate: 40 });
  });

  it('counts overdue open items', () => {
    expect(out.overdue).toBe(2);
  });

  it('counts meetings and decisions in the period only', () => {
    expect(out.meetings).toBe(1);
    expect(out.decisions).toBe(2);
  });

  it('orders owners by overdue, puts No owner last, and lists open items overdue first', () => {
    expect(out.owners.map((o) => o.name)).toEqual(['Priya S.', 'Ana R.', null]);
    const priya = out.owners[0];
    expect(priya).toMatchObject({ open: 2, overdue: 1, done: 2, onTimeRate: 33 });
    expect(priya.items.map((i) => i.id)).toEqual(['c', 'd']);
    expect(priya.items[0].meeting).toMatchObject({ id: 'm1', title: 'Weekly team sync' });
  });

  it('builds six weeks newest first with the current week flagged', () => {
    expect(out.weeks).toHaveLength(6);
    expect(out.weeks[0]).toMatchObject({ start: '2026-11-16', end: '2026-11-22', current: true, meetings: 1, decisions: 2 });
    // due 16-21 Nov: a b c g -> a g on time
    expect(out.weeks[0]).toMatchObject({ due: 4, onTimeRate: 50 });
  });

  it('counts agent calls kept only when the value still matches', () => {
    const agentItems = [
      item({ agent_notes: { priority: { recommended: 'high', applied: true }, assignment: { recommended: 'Priya S.', applied: true } }, priority: 'high' }),
      item({ agent_notes: { priority: { recommended: 'high', applied: true } }, priority: 'low' }),
      item({ agent_notes: { deadline: { recommended: '2026-11-18', applied: false } } })
    ];
    const r = buildInsights({ items: agentItems, meetings, days: 30, now: NOW });
    expect(r.agents).toMatchObject({ calls: 3, kept: 2, rate: 67 });
    expect(r.agents.byAgent.find((a) => a.key === 'priority')).toMatchObject({ calls: 2, kept: 1, rate: 50 });
    expect(r.agents.byAgent.find((a) => a.key === 'deadline')).toMatchObject({ calls: 0, rate: null });
  });

  it('returns nulls, not zeros, for rates with nothing to measure', () => {
    const empty = buildInsights({ days: 7, now: NOW });
    expect(empty.followThrough.rate).toBeNull();
    expect(empty.agents.rate).toBeNull();
    expect(empty.owners).toEqual([]);
  });
});
