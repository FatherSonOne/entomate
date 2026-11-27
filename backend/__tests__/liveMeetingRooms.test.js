const express = require('express');
const request = require('supertest');

const host = '11111111-1111-4111-8111-111111111111';
const roomId = '22222222-2222-4222-8222-222222222222';
const inviteKey = '33333333-3333-4333-8333-333333333333';
const org = '44444444-4444-4444-8444-444444444444';
const visitor = '55555555-5555-4555-8555-555555555555';
const mockRoom = {
  id: roomId, host_id: host, org_id: org, invite_key: inviteKey,
  provider_name: 'pilot', url: 'https://example.daily.co/pilot', title: 'Pilot room',
  with_notes: true, expires_at: new Date(Date.now() + 60_000).toISOString(),
};
const mockLookup = jest.fn();
const mockFinish = jest.fn();
const mockChat = jest.fn();
let mockLines = [];
let mockSavedTranscript = [];

jest.mock('../config/supabase', () => ({
  supabaseAdmin: {
    from: (table) => {
      const filters = {};
      let update;
      const chain = {
        select: () => chain,
        eq: (name, value) => { filters[name] = value; return chain; },
        is: (name, value) => { filters[name] = value; return chain; },
        order: () => chain,
        range: async (start, end) => ({ data: mockLines.slice(start, end + 1) }),
        maybeSingle: async () => {
          if (table === 'meetings') return { data: { transcript_segments: mockSavedTranscript } };
          if (!update) return mockLookup(filters);
          if ((mockRoom.insights?.revision ?? null) !== filters['insights->>revision']) return { data: null };
          mockRoom.insights = update.insights;
          return { data: { insights: mockRoom.insights } };
        },
        update: (values) => { update = values; return chain; },
        then: (resolve) => resolve({ error: null }),
      };
      return chain;
    },
    rpc: (...args) => mockFinish(...args),
  },
}));
jest.mock('../config/ai', () => ({ isConfigured: () => true, chat: (...args) => mockChat(...args) }));
jest.mock('../services/aiUsage', () => ({ meterAiForOrg: (_org, _res, next) => next() }));
jest.mock('../middleware/auth', () => ({
  authenticate: (req, res, next) => {
    if (!req.get('X-Test-User')) return res.sendStatus(401);
    req.user = { id: req.get('X-Test-User') };
    next();
  },
}));
jest.mock('../utils/orgContext', () => ({
  getOrgIdForUser: async () => org,
  getOrgIdsForUser: async () => [org],
}));

const app = express().use(express.json()).use(require('../routes/liveMeetingRooms'));
const priorKey = process.env.DAILY_API_KEY;
const priorFetch = global.fetch;

beforeEach(() => {
  process.env.DAILY_API_KEY = 'fixture-key';
  global.fetch = jest.fn();
  mockLines = [];
  mockSavedTranscript = [];
  mockRoom.insights = null;
  delete mockRoom.ended_at;
  delete mockRoom.ending_at;
  delete mockRoom.meeting_id;
  mockLookup.mockReset().mockImplementation(async filters => ({
    data: Object.entries(filters).every(([name, value]) => mockRoom[name] === value) ? mockRoom : null,
  }));
  mockFinish.mockReset();
  mockChat.mockReset();
});

afterAll(() => {
  if (priorKey === undefined) delete process.env.DAILY_API_KEY;
  else process.env.DAILY_API_KEY = priorKey;
  global.fetch = priorFetch;
});

test('a guest needs the invite secret before learning the room title and must consent before receiving a non-owner token', async () => {
  await request(app).post(`/${roomId}/guest`).send({ inviteKey: visitor }).expect(404);
  const lobby = await request(app).post(`/${roomId}/guest`).send({ inviteKey }).expect(200);
  expect(lobby.headers['cache-control']).toBe('no-store');
  expect(lobby.body).toMatchObject({ title: 'Pilot room', withNotes: true });
  expect(lobby.body).not.toHaveProperty('url');
  expect(lobby.body).not.toHaveProperty('inviteKey');
  await request(app).post(`/${roomId}/guest/join`).send({ name: 'Guest', inviteKey }).expect(400);
  expect(global.fetch).not.toHaveBeenCalled();

  global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'guest-token' }) });
  await request(app).post(`/${roomId}/guest/join`).send({ name: 'Guest', inviteKey, acceptNotes: true })
    .expect(200).expect(({ body }) => expect(body).toMatchObject({ host: false, token: 'guest-token' }));
  expect(JSON.parse(global.fetch.mock.calls[0][1].body).properties).toMatchObject({ is_owner: false, room_name: 'pilot' });
});

test('the public invite and a signed-in non-host cannot use host actions', async () => {
  await request(app).post(`/${roomId}/end`).send({ inviteKey }).expect(401);
  await request(app).post(`/${roomId}/end`).set('X-Test-User', visitor).expect(404);
  await request(app).get(`/${roomId}/host`).set('X-Test-User', visitor).expect(404);
  expect(global.fetch).not.toHaveBeenCalled();
});

test('the host ends the provider session and then finalizes the saved meeting', async () => {
  global.fetch.mockImplementation(async url => ({
    ok: true, json: async () => url.endsWith('/presence') ? { data: [{ id: 'attendee' }] } : {},
  }));
  mockFinish.mockResolvedValue({ data: roomId });
  await request(app).post(`/${roomId}/end`).set('X-Test-User', host).expect(200, { meetingId: roomId });
  expect(global.fetch.mock.calls.map(([url, init]) => [new URL(url).pathname, init.method])).toEqual([
    ['/v1/rooms/pilot', 'POST'], ['/v1/rooms/pilot/presence', 'GET'],
    ['/v1/rooms/pilot/eject', 'POST'], ['/v1/rooms/pilot', 'DELETE'],
  ]);
  expect(mockFinish).toHaveBeenCalledWith('finish_live_meeting', { p_room: roomId, p_host: host });
});

test('live drafts cite saved transcript lines and refreshing them never creates tasks', async () => {
  const cue = { event_id: visitor, at_ms: 14000, speaker: 'Priya', text: 'We decided to launch Friday. I will send the checklist.' };
  mockLines = [cue];
  mockChat.mockResolvedValue(JSON.stringify({
    summary: [{ text: 'Launch is Friday.', sourceId: cue.event_id }],
    decisions: [{ text: 'Launch Friday', sourceId: cue.event_id }, { text: 'Uncited decision', sourceId: roomId }],
    actions: [{ text: 'Send the checklist', owner: 'Priya', sourceId: cue.event_id }],
  }));
  const root = `/${roomId}/insights`;
  await request(app).get(root).set('X-Test-User', visitor).expect(404);
  await request(app).post(`${root}/refresh`).set('X-Test-User', visitor).expect(404);
  expect(mockChat).not.toHaveBeenCalled();
  const first = await request(app).post(`${root}/refresh`).set('X-Test-User', host).expect(200);
  expect(first.body).toMatchObject({
    throughMs: 14000, summary: [{ text: 'Launch is Friday.' }], decisions: [{ text: 'Launch Friday' }],
    actions: [{ text: 'Send the checklist', owner: 'Priya', source: { id: visitor, atMs: 14000, speaker: 'Priya', text: cue.text } }],
  });
  expect(first.body.decisions).toHaveLength(1);
  expect(first.body.actions[0]).not.toHaveProperty('taskId');
  expect(mockFinish).not.toHaveBeenCalled();
  await request(app).post(`${root}/refresh`).set('X-Test-User', host).expect(200, first.body);
  expect(mockChat).toHaveBeenCalledTimes(1);

  const draftId = first.body.actions[0].id;
  await request(app).post(`${root}/actions/${draftId}/approve`).set('X-Test-User', visitor).expect(404);
  expect(mockFinish).not.toHaveBeenCalled();
  mockFinish.mockResolvedValue({ data: { taskId: draftId, insights: {
    ...first.body, actions: [{ ...first.body.actions[0], taskId: draftId }],
  } } });
  await request(app).post(`${root}/actions/${draftId}/approve`).set('X-Test-User', host).expect(200);
  expect(mockFinish).toHaveBeenCalledTimes(1);
  expect(mockFinish).toHaveBeenCalledWith('approve_live_meeting_action', {
    p_room: roomId, p_host: host, p_draft: draftId,
  });
});

test('the host can refresh drafts from the finished transcript after live checkpoints are cleared', async () => {
  mockRoom.ended_at = '2026-11-26T20:00:00Z';
  mockRoom.meeting_id = roomId;
  mockSavedTranscript = [{ eventId: visitor, atMs: 1200, speaker: 'Host', text: 'We will publish tomorrow.' }];
  mockChat.mockResolvedValue(JSON.stringify({
    summary: [{ sourceId: visitor, text: 'Publishing tomorrow.' }],
    decisions: [{ sourceId: visitor, text: 'Publish tomorrow' }], actions: [],
  }));
  const refresh = () => request(app).post(`/${roomId}/insights/refresh`).set('X-Test-User', host).expect(200);
  const result = await refresh();
  expect(result.body.summary[0].source).toMatchObject({ id: visitor, atMs: 1200, text: 'We will publish tomorrow.' });

  mockSavedTranscript[0].speaker = 'Priya';
  const renamed = await refresh();
  expect(mockChat).toHaveBeenCalledTimes(2);
  expect(renamed.body.decisions).toMatchObject([{ id: result.body.decisions[0].id, source: { speaker: 'Priya' } }]);
});
