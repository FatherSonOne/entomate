/**
 * Environment Validation Tests
 *
 * Tests the startup environment variable validation logic.
 * Mocks the log utility and process.exit to verify behavior.
 */

// Store original env and process.exit
const originalEnv = { ...process.env };
const originalExit = process.exit;

// Mock the log utility
jest.mock('../utils/log', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

describe('validateEnv', () => {
  let mockExit;
  let log;

  beforeEach(() => {
    // Reset modules so validateEnv is re-evaluated fresh
    jest.resetModules();

    // Re-apply the mock after resetModules
    jest.mock('../utils/log', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    }));

    // Clean environment
    delete process.env.NODE_ENV;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_KEY;
    delete process.env.SESSION_SECRET;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.SENTRY_DSN;
    delete process.env.SLACK_BOT_TOKEN;

    // Mock process.exit
    mockExit = jest.fn();
    process.exit = mockExit;

    // Get the mocked log
    log = require('../utils/log');
  });

  afterEach(() => {
    // Restore
    process.exit = originalExit;

    // Restore env
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
  });

  it('should detect missing SUPABASE_URL (always required)', () => {
    process.env.NODE_ENV = 'development';

    const { validateEnv } = require('../config/validateEnv');
    validateEnv();

    expect(log.error).toHaveBeenCalledWith(
      expect.stringContaining('SUPABASE_URL')
    );
  });

  it('should not exit in development mode when vars are missing', () => {
    process.env.NODE_ENV = 'development';

    const { validateEnv } = require('../config/validateEnv');
    validateEnv();

    expect(mockExit).not.toHaveBeenCalled();
  });

  it('should exit in production mode when required vars are missing', () => {
    process.env.NODE_ENV = 'production';

    const { validateEnv } = require('../config/validateEnv');
    validateEnv();

    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should pass in production when all required vars are set', () => {
    process.env.NODE_ENV = 'production';
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
    process.env.SESSION_SECRET = 'a'.repeat(32);

    const { validateEnv } = require('../config/validateEnv');
    validateEnv();

    expect(mockExit).not.toHaveBeenCalled();
  });

  it('should exit when SESSION_SECRET is too short in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
    process.env.SESSION_SECRET = 'too-short';

    const { validateEnv } = require('../config/validateEnv');
    validateEnv();

    expect(mockExit).toHaveBeenCalledWith(1);
    expect(log.error).toHaveBeenCalledWith(
      expect.stringContaining('SESSION_SECRET')
    );
  });

  it('should warn when no AI provider is configured', () => {
    process.env.NODE_ENV = 'development';
    process.env.SUPABASE_URL = 'https://test.supabase.co';

    const { validateEnv } = require('../config/validateEnv');
    validateEnv();

    const warnCalls = log.warn.mock.calls.map(c => c[0]);
    expect(warnCalls.some(w => w.includes('AI provider') || w.includes('OPENAI_API_KEY'))).toBe(true);
  });

  it('should not warn about AI when OPENAI_API_KEY is set', () => {
    process.env.NODE_ENV = 'development';
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.OPENAI_API_KEY = 'sk-test';

    const { validateEnv } = require('../config/validateEnv');
    validateEnv();

    const warnCalls = log.warn.mock.calls.map(c => c[0]);
    expect(warnCalls.some(w => w.includes('AI provider') || w.includes('OPENAI_API_KEY'))).toBe(false);
  });

  it('should not warn about AI when GEMINI_API_KEY is set (alt key)', () => {
    process.env.NODE_ENV = 'development';
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.GEMINI_API_KEY = 'test-gemini-key';

    const { validateEnv } = require('../config/validateEnv');
    validateEnv();

    const warnCalls = log.warn.mock.calls.map(c => c[0]);
    expect(warnCalls.some(w => w.includes('AI provider') || w.includes('OPENAI_API_KEY'))).toBe(false);
  });

  it('should warn when SENTRY_DSN is not set', () => {
    process.env.NODE_ENV = 'development';
    process.env.SUPABASE_URL = 'https://test.supabase.co';

    const { validateEnv } = require('../config/validateEnv');
    validateEnv();

    const warnCalls = log.warn.mock.calls.map(c => c[0]);
    expect(warnCalls.some(w => w.includes('SENTRY_DSN') || w.includes('Error tracking'))).toBe(true);
  });

  it('should warn when SLACK_BOT_TOKEN is not set', () => {
    process.env.NODE_ENV = 'development';
    process.env.SUPABASE_URL = 'https://test.supabase.co';

    const { validateEnv } = require('../config/validateEnv');
    validateEnv();

    const warnCalls = log.warn.mock.calls.map(c => c[0]);
    expect(warnCalls.some(w => w.includes('SLACK_BOT_TOKEN') || w.includes('Slack'))).toBe(true);
  });

  it('should print startup summary', () => {
    process.env.NODE_ENV = 'development';
    process.env.SUPABASE_URL = 'https://test.supabase.co';

    const { validateEnv } = require('../config/validateEnv');
    validateEnv();

    expect(log.info).toHaveBeenCalledWith(
      expect.stringContaining('[ENV]'),
      expect.any(String)
    );
  });
});
