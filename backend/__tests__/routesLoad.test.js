/**
 * Every route module must load without throwing (catches ordering mistakes
 * such as using a middleware before it is required, which would crash the
 * server on boot).
 */
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-anon';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test-service';

jest.mock('../services/automationScheduler', () => ({
  initialize: jest.fn().mockResolvedValue(),
  handleAutomationUpdate: jest.fn(),
  handleAutomationDelete: jest.fn(),
  getScheduledStatus: jest.fn(() => ({})),
  getAutomationStatus: jest.fn(() => ({}))
}));

const fs = require('fs');
const path = require('path');

const routeFiles = fs.readdirSync(path.join(__dirname, '../routes')).filter((f) => f.endsWith('.js'));

test.each(routeFiles)('routes/%s loads', (file) => {
  expect(() => require(`../routes/${file}`)).not.toThrow();
});
