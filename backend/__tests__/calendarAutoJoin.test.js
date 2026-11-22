/** Calendar auto-join (feature audit 2026-11-22, rec 1). */
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test-service';

const mockLaunch = jest.fn(async () => ({ sessionId: 's-new' }));
const mockStop = jest.fn(async () => ({}));
const mockGetEvents = jest.fn();
jest.mock('../services/botOrchestrator', () => ({ launchBotSession: mockLaunch, stopBotSession: mockStop }));
jest.mock('../services/calendarService', () => ({ initialize: () => {}, isConfigured: () => true, getEvents: mockGetEvents }));

// Minimal fake of the supabase query builder for the tables the job reads.
let mockTables;
function mockQuery(table) {
  const filters = [];
  const q = {
    select: () => q,
    eq: (c, v) => { filters.push((r) => r[c] === v); return q; },
    neq: (c, v) => { filters.push((r) => r[c] !== v); return q; },
    not: (c, op, v) => { filters.push((r) => r[c] !== null && r[c] !== undefined); return q; },
    in: (c, vs) => { filters.push((r) => vs.includes(r[c])); return q; },
    gte: (c, v) => { filters.push((r) => r[c] && r[c] >= v); return q; },
    gt: (c, v) => { filters.push((r) => r[c] && r[c] > v); return q; },
    update: () => q,
    maybeSingle: async () => ({ data: rows()[0] || null, error: null }),
    then: (ok, bad) => Promise.resolve({ data: rows(), error: null }).then(ok, bad),
  };
  const rows = () => (mockTables[table] || []).filter((r) => filters.every((f) => f(r)));
  return q;
}
jest.mock('../config/supabase', () => ({
  supabase: null,
  supabaseAdmin: {
    from: (t) => mockQuery(t),
    auth: { admin: { getUserById: async () => ({ data: { user: { email: 'me@acme.com', user_metadata: { full_name: 'Me' } } } }) } },
  },
}));

const aj = require('../services/calendarAutoJoin');

const now = new Date('2026-11-22T15:00:00Z');
const inMin = (m) => new Date(now.getTime() + m * 60000).toISOString();
const event = (over = {}) => ({
  id: 'ev1',
  summary: 'Acme weekly',
  status: 'confirmed',
  start: { dateTime: inMin(30) },
  organizer: { self: true },
  attendees: [{ email: 'me@acme.com', self: true }, { email: 'ana@client.com' }],
  hangoutLink: 'https://meet.google.com/abc-defg-hij',
  ...over,
});

describe('finding the meeting link', () => {
  test('Meet, Zoom and Teams links', () => {
    expect(aj.findLink('Join https://meet.google.com/abc-defg-hij now')).toEqual({ platform: 'meet', url: 'https://meet.google.com/abc-defg-hij' });
    expect(aj.findLink('https://acme.zoom.us/j/123456789?pwd=xyz).')).toEqual({ platform: 'zoom', url: 'https://acme.zoom.us/j/123456789?pwd=xyz' });
    expect(aj.findLink('<https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc/0>').platform).toBe('teams');
    expect(aj.findLink('Room 4B')).toBeNull();
  });

  test('conference data wins over the description', () => {
    const e = event({ hangoutLink: null, description: 'https://acme.zoom.us/j/1',
      conferenceData: { entryPoints: [{ entryPointType: 'video', uri: 'https://meet.google.com/xyz-abcd-efg' }] } });
    expect(aj.meetingLink(e).platform).toBe('meet');
  });
});

describe('which events qualify', () => {
  test('an organised call with a link and a guest', () => {
    expect(aj.qualifies(event(), { now }).join).toBe(true);
  });
  test.each([
    ['cancelled', { status: 'cancelled' }],
    ['all_day', { start: { date: '2026-11-22' } }],
    ['started', { start: { dateTime: inMin(-10) } }],
    ['later', { start: { dateTime: inMin(180) } }],
    ['declined', { attendees: [{ email: 'me@acme.com', self: true, responseStatus: 'declined' }, { email: 'a@b.com' }] }],
    ['no_invitees', { attendees: [{ email: 'me@acme.com', self: true }, { email: 'room@acme.com', resource: true }] }],
    ['not_organizer', { organizer: { email: 'boss@acme.com' } }],
    ['no_link', { hangoutLink: null }],
  ])('%s is skipped', (reason, over) => {
    expect(aj.qualifies(event(over), { now })).toEqual({ join: false, reason });
  });
  test("scope 'all' takes other people's meetings", () => {
    expect(aj.qualifies(event({ organizer: { email: 'boss@acme.com' } }), { now, scope: 'all' }).join).toBe(true);
  });
  test('a moved event gets a new key', () => {
    expect(aj.eventKey(event())).not.toBe(aj.eventKey(event({ start: { dateTime: inMin(45) } })));
  });
});

describe('settings', () => {
  test('enabled needs consent and an org', () => {
    expect(aj.normalizeSettings({ enabled: true, org_id: 'o1' }).enabled).toBe(false);
    expect(aj.normalizeSettings({ enabled: true, org_id: 'o1', consent_at: '2026-11-22' }).enabled).toBe(true);
    expect(aj.normalizeSettings({ scope: 'bogus' }).scope).toBe('organized');
  });
});

describe('runForUser', () => {
  const row = { user_id: 'u1', calendar_json: { tokens: { access_token: 't' }, auto_join: { enabled: true, org_id: 'o1', consent_at: '2026-11-22T00:00:00Z' } } };
  beforeEach(() => {
    mockLaunch.mockClear(); mockStop.mockClear(); mockGetEvents.mockReset();
    mockTables = { org_members: [{ user_id: 'u1', org_id: 'o1', role: 'owner' }], bot_sessions: [] };
  });

  test('schedules a bot at the start time with the event title and invitees', async () => {
    mockGetEvents.mockResolvedValue([event()]);
    const r = await aj.runForUser(row, now);
    expect(r.scheduled).toBe(1);
    expect(mockLaunch).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: 'o1', platform: 'meet', meetingUrl: 'https://meet.google.com/abc-defg-hij',
      joinAt: inMin(30), title: 'Acme weekly', consentAcknowledgedBy: 'u1',
      participantEmails: ['ana@client.com'], calendarEventKey: aj.eventKey(event()),
    }));
  });

  test('does not schedule the same event twice', async () => {
    mockGetEvents.mockResolvedValue([event()]);
    mockTables.bot_sessions = [{ id: 's1', org_id: 'o1', consent_acknowledged_by: 'u1', calendar_event_key: aj.eventKey(event()), status: 'launching', join_at: inMin(30) }];
    const r = await aj.runForUser(row, now);
    expect(r.scheduled).toBe(0);
    expect(mockLaunch).not.toHaveBeenCalled();
    expect(mockStop).not.toHaveBeenCalled();
  });

  test('withdraws a bot whose event moved, and schedules the new time', async () => {
    mockGetEvents.mockResolvedValue([event({ start: { dateTime: inMin(60) } })]);
    mockTables.bot_sessions = [{ id: 's1', org_id: 'o1', consent_acknowledged_by: 'u1', calendar_event_key: aj.eventKey(event()), status: 'launching', join_at: inMin(30) }];
    const r = await aj.runForUser(row, now);
    expect(mockStop).toHaveBeenCalledWith('s1', 'calendar_changed');
    expect(r).toMatchObject({ scheduled: 1, withdrawn: 1 });
  });

  test('does nothing for someone who is no longer an admin', async () => {
    mockGetEvents.mockResolvedValue([event()]);
    mockTables.org_members = [{ user_id: 'u1', org_id: 'o1', role: 'member' }];
    const r = await aj.runForUser(row, now);
    expect(r.scheduled).toBe(0);
    expect(mockGetEvents).not.toHaveBeenCalled();
  });
});
