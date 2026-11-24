const mockRows = [];

function mockQuery() {
  const filters = [];
  let kind = 'select';
  let values;
  const result = () => {
    const rows = mockRows.filter((row) => filters.every((filter) => filter(row)));
    if (kind === 'update') rows.forEach((row) => Object.assign(row, values));
    if (kind === 'delete') rows.forEach((row) => mockRows.splice(mockRows.indexOf(row), 1));
    if (kind === 'upsert') {
      const keys = ['user_id', 'org_id', 'event_id', 'calendar_binding'];
      if (mockRows.some((row) => keys.every((key) => row[key] === values[key]))) return [];
      const row = { id: `schedule-${mockRows.length}`, ...values };
      mockRows.push(row);
      return [row];
    }
    return rows.map((row) => ({ ...row }));
  };
  const query = {
    select: () => query, order: () => query, limit: () => query,
    eq(key, value) { filters.push((row) => row[key] === value); return query; },
    neq(key, value) { filters.push((row) => row[key] !== value); return query; },
    lte(key, value) { filters.push((row) => row[key] <= value); return query; },
    match(scope) { Object.entries(scope).forEach(([key, value]) => query.eq(key, value)); return query; },
    update(fields) { kind = 'update'; values = fields; return query; },
    upsert(fields) { kind = 'upsert'; values = fields; return query; },
    delete() { kind = 'delete'; return query; },
    maybeSingle: async () => ({ data: result()[0] || null }),
    then: (success) => Promise.resolve({ data: result() }).then(success),
  };
  return query;
}

jest.mock('../config/supabase', () => ({ supabaseAdmin: { from: jest.fn(() => mockQuery()), rpc: jest.fn() } }));
jest.mock('../utils/orgContext', () => ({ getOrgIdsForUser: jest.fn(async () => ['org-a']) }));
jest.mock('../services/calendarSettings', () => ({ readCalendarSettings: jest.fn() }));
jest.mock('../services/calendarService', () => ({ getEvent: jest.fn() }));
jest.mock('../services/calendarAutoJoin', () => ({ meetingLink: (event) => ({ url: event.hangoutLink }), persistTokens: jest.fn() }));
jest.mock('../services/aiUsage', () => ({ withAiUsage: jest.fn(async (_org, run) => run()), addUsage: jest.fn() }));
jest.mock('../config/gemini', () => ({ isConfigured: () => true, genAI: { getGenerativeModel: jest.fn() } }));
jest.mock('../services/entoAi/tools', () => ({ ...jest.requireActual('../services/entoAi/tools'), runTool: jest.fn() }));

const { supabaseAdmin } = require('../config/supabase');
const { getOrgIdsForUser } = require('../utils/orgContext');
const { getEvent } = require('../services/calendarService');
const { readCalendarSettings } = require('../services/calendarSettings');
const { runTool } = require('../services/entoAi/tools');
const { withAiUsage } = require('../services/aiUsage');
const { genAI } = require('../config/gemini');
const { manage, runScheduledBriefs } = require('../services/entoAi/scheduledBriefs');

const meetingId = '829a2f51-8415-430f-8d89-463b7d8c6274';
const request = { leadMinutes: 15, timeZone: 'America/New_York' };
const event = (start) => ({
  id: 'chosen_20261201T150000Z', summary: 'Juniper Review', description: 'Review the rollout',
  start: { dateTime: `2026-12-01T${start}:00Z` }, hangoutLink: 'https://meet.google.com/abc-defg-hij',
});
const eventId = event('15:00').id;

beforeEach(() => {
  jest.clearAllMocks();
  mockRows.length = 0;
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-12-01T14:30:00Z'));
  getOrgIdsForUser.mockResolvedValue(['org-a']);
  getEvent.mockResolvedValue(event('15:00'));
  readCalendarSettings.mockResolvedValue({ calendar_json: { connected_at: 'same-connection', tokens: { refresh_token: 'offline-access' }, auto_join: { enabled: false } } });
  supabaseAdmin.rpc.mockImplementation(async (_fn, args) => {
    const row = mockRows.find(({ id, check_at }) => args.p_id === id && args.p_claim === check_at);
    if (!row) return { data: null };
    Object.assign(row, { status: 'ready', thread_id: 'new-thread' });
    return { data: row.thread_id };
  });
});

afterEach(() => jest.useRealTimers());

test('one event is scheduled independently of auto-join and publishes once after a reschedule', async () => {
  await Promise.all([manage('user-a', 'org-a', eventId, 'PUT', request), manage('user-a', 'org-a', eventId, 'PUT', request)]);
  expect(mockRows).toHaveLength(1);
  expect(await manage('user-b', 'org-a', eventId, 'GET')).toBeNull();
  await expect(manage('user-a', 'different-org', eventId, 'GET')).rejects.toMatchObject({ status: 403 });

  jest.setSystemTime(new Date('2026-12-01T14:35:00Z'));
  getEvent.mockResolvedValue(event('15:30'));
  await runScheduledBriefs();
  expect(mockRows[0].starts_at).toBe('2026-12-01T15:30:00.000Z');
  expect(genAI.getGenerativeModel).not.toHaveBeenCalled();

  jest.setSystemTime(new Date('2026-12-01T15:15:00Z'));
  runTool.mockImplementation(async (name) => ({ ok: true, response: name === 'search_everything'
    ? { groups: { notes: [{ meetingId }] } }
    : { meeting: { id: meetingId, title: 'Juniper Kickoff', date: '2026-11-30', dateLocal: 'Nov 30', notes: [{ text: 'Alex owns the appendix' }], actionItems: [] } },
  }));
  const generateContent = jest.fn(async () => ({ response: { text: () => 'Juniper Kickoff recorded that Alex owns the appendix.' } }));
  genAI.getGenerativeModel.mockReturnValue({ generateContent });
  await Promise.all([runScheduledBriefs(), runScheduledBriefs()]);
  await runScheduledBriefs();

  expect(generateContent).toHaveBeenCalledTimes(1);
  expect(generateContent.mock.calls[0][0]).toContain('Alex owns the appendix');
  expect(withAiUsage).toHaveBeenCalledWith('org-a', expect.any(Function));
  expect(runTool).toHaveBeenCalledWith('get_meeting', { meeting_id: meetingId, transcript_chars: 0 }, expect.objectContaining({ userId: 'user-a', orgIds: ['org-a'] }));
  expect(supabaseAdmin.rpc).toHaveBeenCalledWith('complete_ento_ai_brief_schedule', expect.objectContaining({
    p_messages: expect.arrayContaining([expect.objectContaining({
      content: expect.stringContaining('[Join meeting](https://meet.google.com/abc-defg-hij)'),
      recordLinks: [{ kind: 'meeting', id: meetingId, label: 'Juniper Kickoff' }],
    })]),
  }));
  expect(await manage('user-a', 'org-a', eventId, 'GET')).toMatchObject({ status: 'ready', threadId: 'new-thread' });
});

test('cancelling a schedule or disconnecting Calendar prevents preparation', async () => {
  await manage('user-a', 'org-a', eventId, 'PUT', request);
  expect(await manage('user-a', 'org-a', eventId, 'DELETE')).toBeNull();
  await manage('user-a', 'org-a', eventId, 'PUT', request);
  jest.setSystemTime(new Date('2026-12-01T14:45:00Z'));
  readCalendarSettings.mockResolvedValue(null);
  await runScheduledBriefs();
  expect(mockRows[0].status).toBe('failed');
  expect(genAI.getGenerativeModel).not.toHaveBeenCalled();
  expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
});
