/**
 * Audit findings 9 and 10: the secrets vault refuses a fallback key in
 * production, and inbound workflow webhook auth fails closed with a
 * working raw-body HMAC check.
 */
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test-service';

const crypto = require('crypto');

describe('workflow webhook authentication (finding 10)', () => {
  const { _validateAuthentication: check } = require('../routes/webhooks');
  const req = (headers = {}, extra = {}) => ({ headers, query: {}, body: {}, ...extra });

  test('unknown or unsupported types are rejected', async () => {
    expect((await check({ type: 'bearr', token: 'x' }, req())).valid).toBe(false);
    expect((await check({ type: 'jwt', secret: 's' }, req({ authorization: 'Bearer a.b.c' }))).valid).toBe(false);
  });

  test('bearer, header and api_key compare correctly and reject empty config', async () => {
    expect((await check({ type: 'bearer', token: 'tok' }, req({ authorization: 'Bearer tok' }))).valid).toBe(true);
    expect((await check({ type: 'bearer', token: 'tok' }, req({ authorization: 'Bearer nope' }))).valid).toBe(false);
    expect((await check({ type: 'bearer' }, req({ authorization: 'Bearer ' }))).valid).toBe(false);
    expect((await check({ type: 'header', name: 'X-Hook', value: 'v' }, req({ 'x-hook': 'v' }))).valid).toBe(true);
    expect((await check({ type: 'api_key', value: 'k' }, req({ 'x-api-key': 'k2' }))).valid).toBe(false);
  });

  test('basic auth allows colons in the password', async () => {
    const h = 'Basic ' + Buffer.from('u:p:w').toString('base64');
    expect((await check({ type: 'basic', username: 'u', password: 'p:w' }, req({ authorization: h }))).valid).toBe(true);
  });

  test('hmac is computed over the raw bytes sent', async () => {
    const raw = Buffer.from('{"b":1,  "a":2}');
    const sig = crypto.createHmac('sha256', 'shh').update(raw).digest('hex');
    const cfg = { type: 'hmac', secret: 'shh', signatureHeader: 'X-Hub-Signature-256' };
    const ok = await check(cfg, req({ 'x-hub-signature-256': `sha256=${sig}` }, { rawBody: raw, body: { b: 1, a: 2 } }));
    expect(ok.valid).toBe(true);
    const bad = await check(cfg, req({ 'x-hub-signature-256': 'sha256=00' }, { rawBody: raw }));
    expect(bad.valid).toBe(false);
    const noSecret = await check({ type: 'hmac' }, req({ 'x-signature': sig }, { rawBody: raw }));
    expect(noSecret.valid).toBe(false);
  });
});

describe('secrets vault key (finding 9)', () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; jest.resetModules(); });

  test('production without SECRETS_MASTER_KEY stays locked instead of using a fallback', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.SECRETS_MASTER_KEY;
    const vault = require('../services/secretsVault');
    expect(() => vault.encrypt('token')).toThrow(/SECRETS_MASTER_KEY/);
  });

  test('production with SECRETS_MASTER_KEY round-trips', () => {
    process.env.NODE_ENV = 'production';
    process.env.SECRETS_MASTER_KEY = crypto.randomBytes(32).toString('hex');
    const vault = require('../services/secretsVault');
    expect(vault.decrypt(vault.encrypt('token'))).toBe('token');
  });
});
