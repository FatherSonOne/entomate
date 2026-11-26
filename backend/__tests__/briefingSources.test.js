const { createClient } = require('@supabase/supabase-js');

const mockFetch = jest.fn();
const mockClient = createClient('https://briefings.example.test', 'test-key', {
  global: { fetch: mockFetch },
  auth: { persistSession: false, autoRefreshToken: false },
});
jest.mock('../config/supabase', () => ({ supabase: mockClient, supabaseAdmin: mockClient }));
jest.mock('../utils/orgContext', () => ({ requestOrgIds: () => ['workspace-1'] }));

const meetingPrep = require('../services/intelligence/MeetingPrepService');
const actionItemTracker = require('../services/intelligence/ActionItemTrackerService');
const dealRisks = require('../services/intelligence/DealRiskService');

const json = data => new Response(JSON.stringify(data), {
  headers: { 'Content-Type': 'application/json' },
});

beforeEach(() => mockFetch.mockReset());
afterEach(() => jest.restoreAllMocks());

test('meeting prep loads scheduled meetings using the attendees column', async () => {
  mockFetch.mockResolvedValueOnce(json([{ id: 'meeting-1', attendees: ['Frank'] }]));
  jest.spyOn(meetingPrep, 'getMeetingPrep').mockImplementation(async (_id, meeting) => meeting);

  await expect(meetingPrep.getUpcomingMeetingPrep('user-1', { hours: 48 })).resolves.toEqual([
    { id: 'meeting-1', attendees: ['Frank'] },
  ]);
  const query = new URL(mockFetch.mock.calls[0][0]).searchParams;
  expect(query.get('select')).toContain(',attendees,');
  expect(query.get('org_id')).toBe('in.(workspace-1)');
  const [start, end] = query.getAll('start_time').map(filter => Date.parse(filter.slice(4)));
  expect(end - start).toBe(48 * 60 * 60 * 1000);
});

test('action item lookup includes assigned items and items from meetings the caller created', async () => {
  mockFetch.mockResolvedValueOnce(json([{ id: 'action-1', task_description: 'Send the transcript' }]));
  await expect(actionItemTracker.getUserActionItems('user-1')).resolves.toMatchObject([{ id: 'action-1' }]);
  const query = new URL(mockFetch.mock.calls[0][0]).searchParams;
  expect(query.get('org_id')).toBe('in.(workspace-1)');
  expect(query.get('owned_meeting.org_id')).toBe('in.(workspace-1)');
  expect(query.get('owned_meeting.created_by')).toBe('eq.user-1');
  expect(query.get('or')).toBe('(assigned_to_id.eq.user-1,owned_meeting.not.is.null)');
});

test('cached deal risks are shown only for deals still linked to the caller’s projects', async () => {
  const calculated_at = new Date().toISOString();
  mockFetch.mockResolvedValueOnce(json([{ id: 'project-1', crm_deal_id: 'linked', name: 'Account review' }]))
    .mockResolvedValueOnce(json([
      { deal_id: 'unlinked', score: 80, risk_level: 'high', calculated_at },
      { deal_id: 'linked', score: 40, risk_level: 'high', calculated_at },
    ]));
  jest.replaceProperty(dealRisks, 'hubClient', null);

  await expect(dealRisks.getAtRiskDeals('user-1', { riskLevel: ['high'], limit: 1 })).resolves.toMatchObject([
    { deal: { id: 'linked', name: 'Account review' } },
  ]);
});
