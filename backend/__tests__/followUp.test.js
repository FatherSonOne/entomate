process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test-service-key';

const fu = require('../services/followUp');

const meeting = {
  id: 'm1',
  title: 'Q4 roadmap',
  summary: 'We agreed on the launch plan.',
  decisions: ['Ship on 1 Dec', { text: 'Drop the beta' }, ''],
  start_time: '2026-11-23T14:00:00Z',
  end_time: '2026-11-23T14:45:00Z',
};

describe('cleanRecipients', () => {
  it('keeps valid, unique emails and drops excluded ones', () => {
    const out = fu.cleanRecipients([
      { name: 'Ana', email: 'ana@x.com', source: 'invite' },
      { email: 'ANA@x.com' },
      { email: 'not-an-email' },
      { email: 'me@x.com' },
      { email: 'bo@x.com', source: 'weird' },
    ], ['Me@x.com']);
    expect(out).toEqual([
      { name: 'Ana', email: 'ana@x.com', source: 'invite' },
      { name: null, email: 'bo@x.com', source: 'added' },
    ]);
  });

  it('caps the list at 20', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ email: `p${i}@x.com` }));
    expect(fu.cleanRecipients(many)).toHaveLength(20);
  });
});

describe('timing', () => {
  it('sends 20 minutes after the meeting ends', () => {
    const now = new Date('2026-11-23T14:46:00Z');
    expect(fu.sendAtFor(meeting, now).toISOString()).toBe('2026-11-23T15:05:00.000Z');
  });

  it('always leaves at least 15 minutes to review', () => {
    const now = new Date('2026-11-23T16:00:00Z');
    expect(fu.sendAtFor(meeting, now).toISOString()).toBe('2026-11-23T16:15:00.000Z');
  });

  it('falls back to start + duration when there is no end time', () => {
    const end = fu.meetingEnd({ start_time: '2026-11-23T10:00:00Z', duration_minutes: 30 });
    expect(end.toISOString()).toBe('2026-11-23T10:30:00.000Z');
  });
});

describe('labels', () => {
  it('reads the time in the offset it was written with', () => {
    expect(fu.whenLabel('2026-11-24T15:00:00-05:00')).toBe('Tue 24 Nov, 15:00');
    expect(fu.whenLabel('2026-11-24')).toBe('Tue 24 Nov');
    expect(fu.whenLabel('')).toBe('');
  });

  it('builds the subject from the title and date', () => {
    expect(fu.defaultSubject(meeting)).toBe('Follow-up: Q4 roadmap (23 Nov)');
  });

  it('greets by first names', () => {
    expect(fu.defaultOpening([{ name: 'Ana Ruiz', email: 'a@x.com' }, { name: null, email: 'bo@x.com' }]))
      .toMatch(/^Hi Ana and bo,/);
  });
});

describe('parts', () => {
  it('takes decisions and open items only', () => {
    const p = fu.parts(meeting, [
      { task_description: 'Draft the brief', assigned_to_name: 'Ana', due_date: '2026-11-27', status: 'pending' },
      { task_description: 'Old thing', status: 'completed' },
    ]);
    expect(p.decisions).toEqual(['Ship on 1 Dec', 'Drop the beta']);
    expect(p.items).toEqual([{ title: 'Draft the brief', owner: 'Ana', due: 'Fri 27 Nov' }]);
  });
});

describe('render', () => {
  it('escapes every value and skips what is ticked off', () => {
    const p = { summary: 'S', decisions: ['<b>Ship</b>'], items: [{ title: 'Fix & test', owner: 'Ana', due: null }] };
    const row = { subject: 'Hi', opening: 'Hello <script>', include: { items: false, summary: false } };
    const out = fu.render(row, p, 'Frank M');
    expect(out.html).toContain('&lt;b&gt;Ship&lt;/b&gt;');
    expect(out.html).toContain('Hello &lt;script&gt;');
    expect(out.html).not.toContain('<script>');
    expect(out.html).not.toContain('Fix &amp; test');
    expect(out.text).toContain('DECIDED\n- <b>Ship</b>');
    expect(out.text).toContain('Thanks,\nFrank');
  });
});

describe('calendar matching', () => {
  const events = [
    { id: 'e1', summary: 'Q4 roadmap', start: { dateTime: '2026-11-23T14:05:00Z' }, attendees: [{ email: 'ana@x.com' }] },
    { id: 'e2', summary: 'Other', start: { dateTime: '2026-11-23T16:00:00Z' } },
    { id: 'e3', summary: 'Sync', start: { dateTime: '2026-11-30T14:00:00Z' }, attendees: [{ email: 'ANA@x.com' }] },
  ];

  it('prefers the bot event key, else the closest start', () => {
    expect(fu.pickEvent(events, meeting, 'e2@2026-11-23T16:00:00Z').id).toBe('e2');
    expect(fu.pickEvent(events, meeting, null).id).toBe('e1');
    expect(fu.pickEvent(events, { start_time: '2026-11-25T00:00:00Z' }, null)).toBeNull();
  });

  it('finds the next meeting with the same people', () => {
    const next = fu.pickNext(events, ['ana@x.com'], 'Q4 roadmap', new Date('2026-11-23T15:00:00Z'));
    expect(next.id).toBe('e3');
  });
});

describe('shouldAutoSend', () => {
  const p = { decisions: ['x'], items: [] };
  const recipients = [{ email: 'a@x.com' }];
  const now = new Date('2026-11-23T15:00:00Z');

  it('needs the switch on, someone to send to and something to say', () => {
    expect(fu.shouldAutoSend({ autoSend: true, recipients, p, meeting, now })).toBe(true);
    expect(fu.shouldAutoSend({ autoSend: false, recipients, p, meeting, now })).toBe(false);
    expect(fu.shouldAutoSend({ autoSend: true, recipients: [], p, meeting, now })).toBe(false);
    expect(fu.shouldAutoSend({ autoSend: true, recipients, p: { decisions: [], items: [] }, meeting, now })).toBe(false);
  });

  it('never sends for an old meeting', () => {
    expect(fu.shouldAutoSend({ autoSend: true, recipients, p, meeting, now: new Date('2026-11-24T15:00:00Z') })).toBe(false);
  });
});
