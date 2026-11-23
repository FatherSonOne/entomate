/**
 * EAI-07: every route that answers a user's AI question is metered, so the
 * monthly limit cannot be passed by calling a fallback route directly.
 * Reads each router's own middleware list (no request is sent).
 */

'use strict';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test-service-key';

jest.mock('../services/aiUsage', () => ({ meterAi: jest.fn((req, res, next) => next()), addUsage: jest.fn() }));
jest.mock('../utils/log', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../services/embeddingService');
jest.mock('../services/askService');
jest.mock('../services/searchEverything');
jest.mock('../services/searchNotesService');
jest.mock('../services/calendarService', () => ({ isConfigured: () => false, getEvents: jest.fn() }));

const { meterAi } = require('../services/aiUsage');

const METERED = [
  ['../routes/entoAi', '/query'],
  ['../routes/assistant', '/query'],
  ['../routes/search', '/ask'],
  ['../routes/search', '/ask/stream'],
  ['../routes/search', '/ask/follow-up'],
];

test.each(METERED)('%s POST %s runs meterAi before the handler', (file, path) => {
  const router = require(file);
  const layer = router.stack.find((l) => l.route?.path === path && l.route.methods.post);
  expect(layer).toBeDefined();
  const handles = layer.route.stack.map((s) => s.handle);
  const at = handles.indexOf(meterAi);
  expect(at).toBeGreaterThan(0); // after authenticate
  expect(at).toBeLessThan(handles.length - 1); // before the handler
});
