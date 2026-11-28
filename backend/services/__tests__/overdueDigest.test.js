jest.mock('../../config/supabase', () => ({ supabase: null, supabaseAdmin: null }));

const { buildDigests, renderDigest, isOverdue, daysOverdue } = require('../overdueDigest');
const { checkNudge, renderNudge, _recent } = require('../actionItemNudge');

const today = '2026-11-22';
const members = [
  { user_id: 'u1', email: 'dana@acme.test', name: 'Dana Ray' },
  { user_id: 'u2', email: 'lee@acme.test', name: 'Lee Park' },
];
const meetings = new Map([
  ['m1', { id: 'm1', title: 'Acme weekly sync', created_by: 'u1' }],
  ['m2', { id: 'm2', title: 'Globex review', created_by: 'u2' }],
]);
const item = (o) => ({ id: o.id, meeting_id: 'm1', task_description: o.id, status: 'open', due_date: '2026-11-20', ...o });

describe('overdue digest', () => {
  test('isOverdue ignores done, undated and not-yet-due items', () => {
    expect(isOverdue(item({ id: 'a' }), today)).toBe(true);
    expect(isOverdue(item({ id: 'b', status: 'done' }), today)).toBe(false);
    expect(isOverdue(item({ id: 'c', status: 'completed' }), today)).toBe(false);
    expect(isOverdue(item({ id: 'd', due_date: null }), today)).toBe(false);
    expect(isOverdue(item({ id: 'e', due_date: today }), today)).toBe(false);
  });

  test('items from [smoke] test meetings never reach a digest', () => {
    const withSmoke = new Map([...meetings, ['s1', { id: 's1', title: '[smoke] action-items 2026-05-04T23:54:29.284Z', created_by: 'u1' }]]);
    const items = [
      item({ id: 'smoke-waiting', meeting_id: 's1', assigned_to_name: 'Alice' }),
      item({ id: 'smoke-owed', meeting_id: 's1', assigned_to_name: 'Dana Ray' }),
    ];
    expect(buildDigests({ members, items, meetings: withSmoke, today })).toEqual([]);
  });

  test('daysOverdue counts whole days', () => {
    expect(daysOverdue('2026-11-20', today)).toBe(2);
  });

  test('owner by email or name gets "You owe"; meeting creator gets "Waiting on others"', () => {
    const items = [
      item({ id: 'mine-email', assigned_to_email: 'DANA@acme.test' }),
      item({ id: 'mine-name', assigned_to_name: 'dana ray' }),
      item({ id: 'external', assigned_to_name: 'Pat Client', assigned_to_email: 'pat@client.test' }),
      item({ id: 'lees', meeting_id: 'm2', assigned_to_name: 'Lee Park' }),
    ];
    const out = buildDigests({ members, items, meetings, today });
    const dana = out.find((d) => d.member.user_id === 'u1');
    const lee = out.find((d) => d.member.user_id === 'u2');
    expect(dana.owed.map((r) => r.id).sort()).toEqual(['mine-email', 'mine-name']);
    expect(dana.waiting.map((r) => r.id)).toEqual(['external']);
    expect(lee.owed.map((r) => r.id)).toEqual(['lees']);
    expect(lee.waiting).toEqual([]);
  });

  test('skips people who opted out or already got today’s digest, and people with nothing due', () => {
    const items = [item({ id: 'x', assigned_to_name: 'Dana Ray' })];
    expect(buildDigests({ members, items, meetings, today, optedOut: new Set(['u1']) })).toEqual([]);
    expect(buildDigests({ members, items, meetings, today, sentToday: new Set(['u1']) })).toEqual([]);
    expect(buildDigests({ members, items: [], meetings, today })).toEqual([]);
  });

  test('renderDigest escapes text and links each meeting', () => {
    const [d] = buildDigests({ members, items: [item({ id: '<b>x</b>', assigned_to_name: 'Dana Ray' })], meetings, today });
    const msg = renderDigest(d, 'https://app.test');
    expect(msg.subject).toBe('1 overdue item on you');
    expect(msg.html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(msg.html).toContain('https://app.test/meetings/m1');
    expect(msg.text).toContain('2 days late');
  });
});

describe('nudge', () => {
  beforeEach(() => _recent.clear());
  const base = { id: 'n1', status: 'open', task_description: 'Send the SOW', assigned_to_email: 'pat@client.test', assigned_to_name: 'Pat Client' };

  test('needs an owner email and an open item', () => {
    expect(checkNudge(base).ok).toBe(true);
    expect(checkNudge({ ...base, assigned_to_email: null }).code).toBe('no_email');
    expect(checkNudge({ ...base, status: 'done' }).code).toBe('done');
    expect(checkNudge(null).code).toBe('not_found');
  });

  test('once per 24 hours', () => {
    const now = Date.parse('2026-11-22T12:00:00Z');
    expect(checkNudge({ ...base, last_nudged_at: '2026-11-22T01:00:00Z' }, now).code).toBe('recent');
    expect(checkNudge({ ...base, last_nudged_at: '2026-11-21T01:00:00Z' }, now).ok).toBe(true);
    _recent.set('n1', now - 1000);
    expect(checkNudge(base, now).code).toBe('recent');
  });

  test('email names the sender and the meeting', () => {
    const msg = renderNudge({ item: base, meeting: { title: 'Acme weekly sync' }, sender: { name: 'Dana Ray', email: 'dana@acme.test' } }, 'https://app.test');
    expect(msg.subject).toBe('Reminder: Send the SOW');
    expect(msg.text).toContain('Dana Ray sent a reminder about something agreed in Acme weekly sync');
    expect(msg.html).toContain('Hi Pat');
  });
});
