/** Calendar auto-join (feature audit 2026-11-22, rec 1). */
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test-service';

const mockLaunch = jest.fn(async () => ({ sessionId: 's-new' }));
const mockReschedule = jest.fn(async () => {});
const mockStop = jest.fn(async () => ({}));
const mockGetEvents = jest.fn();
const mockGetEvent = jest.fn();
jest.mock('../services/botOrchestrator', () => ({ launchBotSession: mockLaunch, stopBotSession: mockStop, rescheduleBotSession: mockReschedule }));
jest.mock('../services/calendarService', () => ({ initialize: () => {}, isConfigured: () => true, getEvents: mockGetEvents, getEvent: mockGetEvent }));

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
    lt: (c, v) => { filters.push((r) => r[c] && r[c] < v); return q; },
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
    ['later', { start: { dateTime: inMin(13 * 60) } }],
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
  const row = { user_id: 'u1', updated_at: '2026-11-22T00:00:00', calendar_json: { tokens: { access_token: 't' }, auto_join: { enabled: true, org_id: 'o1', consent_at: '2026-11-22T00:00:00Z' } } };
  beforeEach(() => {
    mockLaunch.mockClear(); mockStop.mockClear(); mockReschedule.mockClear(); mockGetEvents.mockReset();
    mockTables = { org_members: [{ user_id: 'u1', org_id: 'o1', role: 'owner' }], bot_sessions: [], user_settings: [row] };
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

  test('uses the lead time and preserves a bot already scheduled for that time', async () => {
    const early = {
      ...row,
      calendar_json: { ...row.calendar_json, auto_join: { ...row.calendar_json.auto_join, lead_minutes: 5 } },
    };
    mockTables.user_settings = [early];
    mockGetEvents.mockResolvedValue([event()]);
    expect((await aj.runForUser(early, now)).scheduled).toBe(1);
    expect(mockLaunch).toHaveBeenLastCalledWith(expect.objectContaining({ joinAt: inMin(25) }));

    mockTables.bot_sessions = [{ id: 's1', org_id: 'o1', consent_acknowledged_by: 'u1',
      calendar_event_key: aj.eventKey(event()), status: 'launching', recall_bot_id: 'recall-1', join_at: inMin(25) }];
    expect((await aj.runForUser(early, now)).scheduled).toBe(0);
    expect(mockLaunch).toHaveBeenCalledTimes(1);
    expect(mockStop).not.toHaveBeenCalled();

    mockTables.bot_sessions[0].join_at = inMin(30);
    expect(await aj.runForUser(early, now)).toMatchObject({ scheduled: 0, withdrawn: 0 });
    expect(mockReschedule).toHaveBeenCalledWith(expect.objectContaining({ id: 's1', recall_bot_id: 'recall-1' }), inMin(25));
    expect(mockStop).not.toHaveBeenCalled();
    expect(mockLaunch).toHaveBeenCalledTimes(1);
  });

  test('leaves short-notice early arrivals for a run at or after the target time', async () => {
    const early = {
      ...row,
      calendar_json: { ...row.calendar_json, auto_join: { ...row.calendar_json.auto_join, lead_minutes: 5 } },
    };
    mockTables.user_settings = [early];
    mockGetEvents.mockResolvedValue([event({ start: { dateTime: inMin(9) } })]);
    expect((await aj.runForUser(early, now)).scheduled).toBe(0);
    expect(mockLaunch).not.toHaveBeenCalled();
    expect((await aj.runForUser(early, new Date(inMin(4)))).scheduled).toBe(1);
  });

  test('stops preparing bots if the calendar disconnects during the provider read', async () => {
    mockGetEvents.mockImplementation(async () => {
      mockTables.user_settings = [];
      return [event()];
    });
    expect((await aj.runForUser(row, now)).scheduled).toBe(0);
    expect(mockLaunch).not.toHaveBeenCalled();
  });

  test('only books the selected Google occurrence when recurring auto-join is off', async () => {
    const selected = { ...row, calendar_json: { ...row.calendar_json, auto_join: {
      enabled: false, org_id: 'o1', bookings: { ev1: { decision: 'schedule', leadMinutes: 5, start: inMin(30) } },
    } } };
    mockTables.user_settings = [selected];
    mockGetEvents.mockResolvedValue([event(), event({ id: 'ev2' })]);

    expect(await aj.runForUser(selected, now)).toMatchObject({ scheduled: 1, skipped: 1 });
    expect(mockLaunch).toHaveBeenCalledTimes(1);
    expect(mockLaunch).toHaveBeenCalledWith(expect.objectContaining({
      calendarEventKey: aj.eventKey(event()), joinAt: inMin(25), requireScheduled: true,
    }));

    selected.calendar_json.auto_join.bookings.ev1.decision = 'cancel';
    mockTables.bot_sessions = [{ id: 'selected-bot', org_id: 'o1', consent_acknowledged_by: 'u1',
      calendar_event_key: aj.eventKey(event()), status: 'launching', join_at: inMin(25) }];
    expect(await aj.runForUser(selected, now)).toMatchObject({ scheduled: 0, withdrawn: 1 });
    expect(mockStop).toHaveBeenCalledWith('selected-bot', 'calendar_booking_cancelled');
    expect(mockLaunch).toHaveBeenCalledTimes(1);
  });

  test('retimes a selected occurrence and updates its changed video link in place', async () => {
    const selected = { ...row, calendar_json: { ...row.calendar_json, auto_join: {
      enabled: false, org_id: 'o1', bookings: { ev1: { decision: 'schedule', leadMinutes: 5, start: inMin(30) } },
    } } };
    mockTables.user_settings = [selected];
    mockTables.bot_sessions = [{ id: 'selected-bot', org_id: 'o1', consent_acknowledged_by: 'u1',
      calendar_event_key: aj.eventKey(event()), recall_bot_id: 'recall-1', status: 'launching',
      join_at: inMin(25), meeting_url: event().hangoutLink }];
    const moved = event({ start: { dateTime: inMin(45) }, hangoutLink: 'https://meet.google.com/xyz-abcd-efg' });
    mockGetEvents.mockResolvedValue([moved]);
    await aj.runForUser(selected, now);
    expect(mockReschedule).toHaveBeenCalledWith(expect.objectContaining({ id: 'selected-bot' }), inMin(40), {
      calendarEventKey: aj.eventKey(moved), meetingUrl: moved.hangoutLink, platform: 'meet',
    });
    expect(mockLaunch).not.toHaveBeenCalled();
    expect(mockStop).not.toHaveBeenCalled();
  });

  test('withdraws a reservation when Google reports a cancelled one-off occurrence', async () => {
    const selected = { ...row, calendar_json: { ...row.calendar_json, auto_join: {
      enabled: false, org_id: 'o1', bookings: { ev1: { decision: 'schedule', leadMinutes: 5, start: inMin(30) } },
    } } };
    mockTables.user_settings = [selected];
    mockTables.bot_sessions = [{ id: 'selected-bot', org_id: 'o1', consent_acknowledged_by: 'u1',
      calendar_event_key: aj.eventKey(event()), status: 'launching', join_at: inMin(25) }];
    mockGetEvents.mockResolvedValue([]);
    mockGetEvent.mockResolvedValueOnce(event({ status: 'cancelled' }));

    expect(await aj.runForUser(selected, now)).toMatchObject({ scheduled: 0, withdrawn: 1 });
    expect(mockStop).toHaveBeenCalledWith('selected-bot', 'calendar_changed');
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

describe('missed meetings', () => {
  const started = (min, over = {}) => event({ id: `ev${min}`, start: { dateTime: inMin(-min) }, ...over });

  test('a qualifying call that started 3 to 60 minutes ago with no bot is missed', () => {
    const missed = aj.missedEvents([started(10), started(1), started(90)], [], 'organized', now);
    expect(missed).toEqual([expect.objectContaining({ title: 'Acme weekly', reason: 'no_bot', start: inMin(-10) })]);
  });

  test('a bot that got in is fine; one that failed is reported', () => {
    const ev = started(10);
    const key = aj.eventKey(ev);
    expect(aj.missedEvents([ev], [{ id: 's1', calendar_event_key: key, status: 'completed' }], 'organized', now)).toEqual([]);
    expect(aj.missedEvents([ev], [{ id: 's1', calendar_event_key: key, status: 'failed' }], 'organized', now)[0])
      .toMatchObject({ reason: 'failed', sessionId: 's1' });
  });

  test('a call auto-join would not have taken is never missed', () => {
    expect(aj.missedEvents([started(10, { organizer: { self: false } })], [], 'organized', now)).toEqual([]);
    expect(aj.missedEvents([started(10, { hangoutLink: null })], [], 'all', now)).toEqual([]);
  });

  test('healthOf hides dismissed ones', () => {
    const h = aj.healthOf({ auto_join_health: { lastRunAt: 'x', missed: [{ key: 'a' }, { key: 'b', dismissedAt: 'y' }] } });
    expect(h).toEqual({ lastRunAt: 'x', missed: [{ key: 'a' }] });
    expect(aj.healthOf(null)).toEqual({ lastRunAt: null, missed: [] });
  });
});

describe('per-meeting skip and join', () => {
  const key = aj.eventKey(event());
  test('skip keeps the bot out of a meeting auto-join would take', () => {
    const d = aj.decide(event(), { now, overrides: { [key]: 'skip' } });
    expect(d).toMatchObject({ join: false, reason: 'skipped', override: 'skip', canJoin: true });
  });
  test("join sends it to someone else's meeting, but never one without a link", () => {
    const theirs = event({ organizer: { email: 'lee@client.com' } });
    const k = aj.eventKey(theirs);
    expect(aj.decide(theirs, { now }).join).toBe(false);
    expect(aj.decide(theirs, { now, overrides: { [k]: 'join' } })).toMatchObject({ join: true, override: 'join' });
    const noLink = event({ organizer: { email: 'lee@client.com' }, hangoutLink: undefined });
    expect(aj.decide(noLink, { now, overrides: { [aj.eventKey(noLink)]: 'join' } })).toMatchObject({ join: false, reason: 'not_organizer', canJoin: false });
  });
  test('overrides keep valid entries and drop old meetings', () => {
    const out = aj.normalizeOverrides({ [key]: 'skip', 'old@2026-11-01T10:00:00.000Z': 'join', bad: 'maybe' }, now);
    expect(out).toEqual({ [key]: 'skip' });
  });
  test('runForUser respects a skip and withdraws the scheduled bot', async () => {
    mockLaunch.mockClear(); mockStop.mockClear(); mockReschedule.mockClear(); mockGetEvents.mockReset();
    mockTables = {
      org_members: [{ user_id: 'u1', org_id: 'o1', role: 'owner' }],
      bot_sessions: [{ id: 's1', org_id: 'o1', consent_acknowledged_by: 'u1', calendar_event_key: key, status: 'pending', join_at: inMin(30) }],
    };
    mockGetEvents.mockResolvedValue([event()]);
    const row = { user_id: 'u1', updated_at: '2026-11-22T00:00:00', calendar_json: { tokens: { access_token: 't' }, auto_join: { enabled: true, org_id: 'o1', consent_at: '2026-11-22T00:00:00Z', overrides: { [key]: 'skip' } } } };
    mockTables.user_settings = [row];
    const r = await aj.runForUser(row, now);
    expect(r.scheduled).toBe(0);
    expect(mockStop).toHaveBeenCalledWith('s1', 'calendar_changed');
  });
});

test('switching calendars withdraws old bookings while keeping new bookings', async () => {
  const switchedAt = new Date('2026-11-22T14:00:00Z');
  const common = { consent_acknowledged_by: 'u1', calendar_event_key: 'calendar-event', status: 'pending', join_at: '2026-11-22T15:00:00Z' };
  mockTables = { bot_sessions: [
    { ...common, id: 'old', created_at: '2026-11-22T13:55:00Z' },
    { ...common, id: 'new', created_at: '2026-11-22T14:01:00Z' },
  ] };
  mockStop.mockClear();
  expect(await aj.withdrawScheduled('u1', switchedAt, { createdBefore: switchedAt })).toBe(1);
  expect(mockStop.mock.calls).toEqual([['old', 'auto_join_off']]);
});
