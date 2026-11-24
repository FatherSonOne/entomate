const express = require('express');
const request = require('supertest');

jest.mock('../middleware/auth', () => ({
  authenticate: (req, res, next) => { req.user = { id: 'entomate-user' }; next(); },
}));
jest.mock('../utils/orgContext', () => ({ attachOrgIds: (_req, _res, next) => next() }));
jest.mock('../config/supabase', () => ({ supabase: null }));
jest.mock('../services/calendarSettings', () => ({ updateCalendarSettings: jest.fn() }));
jest.mock('../services/calendarAutoJoin', () => ({ withdrawScheduled: jest.fn() }));

const calendar = require('../services/calendarService');
const settings = require('../services/calendarSettings');
const autoJoin = require('../services/calendarAutoJoin');
const { createState, verifyState } = require('../utils/oauthState');
const routes = require('../routes/calendar');

const app = express().use('/calendar', routes);
const returnUrl = '/settings?s=connections&dr=calendar';
const makeState = () => createState({ userId: 'entomate-user', returnUrl });
const previous = {
  tokens: { access_token: 'personal', refresh_token: 'personal-refresh' },
  auto_join: { enabled: true, bookings: { old: { decision: 'schedule' } } },
};

beforeEach(() => {
  jest.restoreAllMocks();
  settings.updateCalendarSettings.mockReset();
  autoJoin.withdrawScheduled.mockReset();
  jest.spyOn(calendar, 'isConfigured').mockReturnValue(true);
  jest.spyOn(calendar, 'getTokensFromCode');
});

test('Google authorization requests the account chooser and preserves signed state', () => {
  jest.replaceProperty(calendar, 'oauth2Client', new (require('googleapis').google.auth.OAuth2)(
    'calendar-test-client', undefined, 'http://localhost/calendar/callback'
  ));
  const url = new URL(calendar.getAuthUrl(makeState()));
  expect(url.hostname).toBe('accounts.google.com');
  expect(url.searchParams.get('prompt').split(' ')).toEqual(['select_account', 'consent']);
  expect(url.searchParams.get('access_type')).toBe('offline');
  expect(url.searchParams.has('login_hint')).toBe(false);
  expect(verifyState(url.searchParams.get('state'))).toEqual({ userId: 'entomate-user', returnUrl });
});

test('replaces the calendar grant and clears prior consent and bookings after Google authorizes', async () => {
  const tokens = { access_token: 'work', refresh_token: 'work-refresh' };
  calendar.getTokensFromCode.mockResolvedValue(tokens);
  settings.updateCalendarSettings.mockImplementation(async (_userId, update) => update(previous));
  autoJoin.withdrawScheduled.mockResolvedValue(1);

  const response = await request(app).get('/calendar/callback').query({ state: makeState(), code: 'google-code' }).expect(302);
  expect(response.headers.location).toContain(returnUrl + '&connected=true');
  expect(settings.updateCalendarSettings).toHaveBeenCalledWith('entomate-user', expect.any(Function), { create: true });
  const [saved] = await Promise.all(settings.updateCalendarSettings.mock.results.map(({ value }) => value));
  expect(saved).toEqual({ tokens, connected_at: expect.any(String) });
  const cutoff = new Date(saved.connected_at);
  expect(autoJoin.withdrawScheduled).toHaveBeenCalledWith('entomate-user', cutoff, { createdBefore: cutoff });
});

test('canceling Google authorization keeps the current connection and returns to the Calendar drawer', async () => {
  const response = await request(app).get('/calendar/callback').query({ state: makeState(), error: 'access_denied' }).expect(302);
  expect(response.headers.location).toContain(returnUrl + '&calendar_error=cancelled');
  expect(calendar.getTokensFromCode).not.toHaveBeenCalled();
  expect(settings.updateCalendarSettings).not.toHaveBeenCalled();
  expect(autoJoin.withdrawScheduled).not.toHaveBeenCalled();
});

test('keeps the old grant if Google does not provide offline access', async () => {
  calendar.getTokensFromCode.mockResolvedValue({ access_token: 'work' });
  const response = await request(app).get('/calendar/callback').query({ state: makeState(), code: 'google-code' }).expect(302);
  expect(response.headers.location).toContain(returnUrl + '&calendar_error=failed');
  expect(settings.updateCalendarSettings).not.toHaveBeenCalled();
  expect(autoJoin.withdrawScheduled).not.toHaveBeenCalled();
});
