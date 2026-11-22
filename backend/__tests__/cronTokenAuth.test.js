/* global describe, test, expect, jest, beforeEach */
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test';
const mockRpc = jest.fn();
jest.mock('../config/supabase', () => ({ supabaseAdmin: { rpc: (...a) => mockRpc(...a) } }));
jest.mock('../utils/log', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const { internalJobAuth } = require('../middleware/cronTokenAuth');

function run(headers) {
  const req = { headers };
  const res = { code: null, status(c) { this.code = c; return this; }, json() { return this; } };
  const next = jest.fn();
  return Promise.resolve(internalJobAuth(req, res, next)).then(() => ({ req, res, next }));
}

describe('internalJobAuth', () => {
  beforeEach(() => { internalJobAuth._reset(); mockRpc.mockReset(); process.env.INTERNAL_API_KEY = 'k1'; });

  test('accepts the DB cron token', async () => {
    mockRpc.mockResolvedValue({ data: 'tok', error: null });
    const { req, next } = await run({ 'x-cron-token': 'tok' });
    expect(next).toHaveBeenCalled();
    expect(req.jobCaller).toBe('pg_cron');
    expect(mockRpc).toHaveBeenCalledWith('internal_cron_token', { p_name: 'jobs' });
  });

  test('rejects a wrong cron token', async () => {
    mockRpc.mockResolvedValue({ data: 'tok', error: null });
    const { res, next } = await run({ 'x-cron-token': 'nope' });
    expect(next).not.toHaveBeenCalled();
    expect(res.code).toBe(401);
  });

  test('rejects when the token cannot be read', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'down' } });
    const { res } = await run({ 'x-cron-token': 'tok' });
    expect(res.code).toBe(401);
  });

  test('falls back to X-API-Key without a cron token', async () => {
    const ok = await run({ 'x-api-key': 'k1' });
    expect(ok.next).toHaveBeenCalled();
    const bad = await run({ 'x-api-key': 'k2' });
    expect(bad.res.code).toBe(401);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  test('caches the token', async () => {
    mockRpc.mockResolvedValue({ data: 'tok', error: null });
    await run({ 'x-cron-token': 'tok' });
    await run({ 'x-cron-token': 'tok' });
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });
});
