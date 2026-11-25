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

jest.mock('../config/supabase', () => ({
  supabaseAdmin: {
    from: () => {
      const filters = {};
      const chain = {
        select: () => chain,
        eq: (name, value) => { filters[name] = value; return chain; },
        is: (name, value) => { filters[name] = value; return chain; },
        maybeSingle: () => mockLookup(filters),
        update: () => chain,
        then: (resolve) => resolve({ error: null }),
      };
      return chain;
    },
    rpc: (...args) => mockFinish(...args),
  },
}));
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
  mockLookup.mockReset().mockImplementation(async filters => ({
    data: Object.entries(filters).every(([name, value]) => mockRoom[name] === value) ? mockRoom : null,
  }));
  mockFinish.mockReset();
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
