jest.mock('../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../services/mailer', () => ({ send: jest.fn(), isConfigured: () => false, escapeHtml: String }));
jest.mock('../utils/log', () => ({ info: jest.fn(), warn: jest.fn() }));

const { supabaseAdmin } = require('../config/supabase');
const mailer = require('../services/mailer');
const followUp = require('../services/followUp');

// Verified against production information_schema.columns on 2026-11-23.
const MEETING_COLUMNS = new Set(['id', 'org_id', 'title', 'summary', 'decisions', 'attendees', 'start_time', 'end_time', 'duration_minutes', 'created_at', 'created_by']);
let meeting;
let readError;
let queries;
const insert = jest.fn();
const row = { id: 'f1', meeting_id: 'm1', org_id: 'org-a', status: 'draft', owner_id: 'owner-id' };

beforeEach(() => {
  jest.clearAllMocks();
  meeting = { id: 'm1', org_id: 'org-a', created_by: 'owner-id', title: 'Pilot review', summary: 'Agreed the next step.', decisions: ['Start the pilot'] };
  readError = null;
  queries = [];
  supabaseAdmin.from.mockImplementation(table => {
    const query = { table, fields: '', filters: [] };
    queries.push(query);
    const result = () => {
      if (table === 'meetings') {
        const missing = query.fields.split(',').map(s => s.trim()).find(s => !MEETING_COLUMNS.has(s));
        return { data: missing || readError ? null : meeting, error: missing ? { code: '42703', message: `column meetings.${missing} does not exist` } : readError };
      }
      if (table === 'action_items') return { data: [{ task_description: 'Prepare the pilot', status: 'open' }], error: null };
      if (table === 'follow_ups') return { data: row, error: null };
      throw new Error(`Unexpected table: ${table}`);
    };
    return {
      select(fields) { query.fields = fields; return this; },
      eq(field, value) { query.filters.push([field, value]); return this; },
      maybeSingle() { return Promise.resolve(result()); },
      then(resolve) { return Promise.resolve(result()).then(resolve); },
      insert,
    };
  });
});

test('loads the real meeting schema and reuses the draft without writes or sending', async () => {
  const result = await followUp.getOrCreate('m1', { userId: 'viewer-id' });
  expect(result.row).toBe(row);
  expect(result.meeting.created_by).toBe('owner-id');
  expect(result.parts.decisions).toEqual(['Start the pilot']);
  expect(result.parts.items[0].title).toBe('Prepare the pilot');
  expect(queries.find(q => q.table === 'action_items').filters).toEqual([['meeting_id', 'm1'], ['org_id', 'org-a']]);
  expect(insert).not.toHaveBeenCalled();
  expect(mailer.send).not.toHaveBeenCalled();
});

test('a missing meeting returns null without reading drafts', async () => {
  meeting = null;
  expect(await followUp.getOrCreate('m1')).toBeNull();
  expect(queries.map(q => q.table)).toEqual(['meetings']);
});

test('a database failure is propagated before any draft write', async () => {
  readError = { code: '08006', message: 'Connection lost' };
  await expect(followUp.getOrCreate('m1')).rejects.toBe(readError);
  expect(insert).not.toHaveBeenCalled();
});
