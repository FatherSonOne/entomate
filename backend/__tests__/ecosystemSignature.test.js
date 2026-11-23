/**
 * EAI-08 — bridge signing. The Edge Function's signature.ts (Web Crypto) runs
 * in a child Node process, so the backend signer is checked against the code
 * that production verifies with, not against a copy.
 */
const path = require('path');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');

jest.mock('../config/supabase', () => ({ supabaseAdmin: null, supabase: null }));
jest.mock('../utils/log', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const { EcosystemBridge, signBridgeRequest } = require('../services/ecosystemBridge');

const SIGNATURE_TS = pathToFileURL(
  path.join(__dirname, '..', '..', 'supabase', 'functions', 'ecosystem-inbound', 'signature.ts')
).href;

// Runs checkBridgeSignature for each case in the edge module; returns the results.
function edgeCheck(cases) {
  const script = `
    const m = await import(${JSON.stringify(SIGNATURE_TS)});
    const cases = ${JSON.stringify(cases)};
    const out = [];
    for (const c of cases) out.push(c.sign ? await m.signBridgeRequest(...c.sign) : await m.checkBridgeSignature(c));
    process.stdout.write(JSON.stringify(out));
  `;
  const stdout = execFileSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' });
  return JSON.parse(stdout);
}

const SECRET = 's'.repeat(64);
const NOW = 1_800_000_000;
const TS = String(NOW);
const ID = 'evt-1';
const BODY = JSON.stringify({ id: ID, eventType: 'task.created', data: { a: 1 } });
const SIG = signBridgeRequest(SECRET, TS, ID, BODY);
const base = { secret: SECRET, rawBody: BODY, eventId: ID, timestamp: TS, signature: SIG, requireSignature: true, nowSeconds: NOW };

describe('bridge signature (EAI-08)', () => {
  let results;
  beforeAll(() => {
    results = edgeCheck([
      { sign: [SECRET, TS, ID, BODY] },                                   // 0 edge signer
      base,                                                                // 1 valid
      { ...base, signature: null, requireSignature: false },               // 2 unsigned, allowed
      { ...base, signature: null },                                        // 3 unsigned, required
      { ...base, rawBody: BODY.replace('"a":1', '"a":2') },                // 4 body changed
      { ...base, secret: 't'.repeat(64) },                                 // 5 wrong secret
      { ...base, eventId: 'evt-2' },                                       // 6 replay under a new event id
      { ...base, nowSeconds: NOW + 301 },                                  // 7 stale
      { ...base, nowSeconds: NOW - 301 },                                  // 8 from the future
      { ...base, nowSeconds: NOW + 300 },                                  // 9 edge of window
      { ...base, eventId: null },                                          // 10 no event id
      { ...base, timestamp: 'abc' },                                       // 11 bad timestamp
      { ...base, signature: SIG.slice(0, -1) },                            // 12 truncated
    ]);
  });

  it('backend signer and edge signer agree byte for byte', () => {
    expect(results[0]).toBe(SIG);
    expect(SIG).toMatch(/^v1=[0-9a-f]{64}$/);
  });

  it('accepts a valid signature, and an unsigned request only when not required', () => {
    expect(results[1]).toEqual({ ok: true, signed: true });
    expect(results[2]).toEqual({ ok: true, signed: false });
    expect(results[3]).toEqual({ ok: false, status: 401, error: 'Signature required' });
  });

  it('rejects a changed body, a wrong secret and a replay under a new event id', () => {
    for (const r of [results[4], results[5], results[6], results[12]]) {
      expect(r).toEqual({ ok: false, status: 401, error: 'Invalid signature' });
    }
  });

  it('rejects a timestamp outside 300 s either way, and accepts 300 s', () => {
    expect(results[7].ok).toBe(false);
    expect(results[8].ok).toBe(false);
    expect(results[7].error).toMatch(/window/);
    expect(results[9]).toEqual({ ok: true, signed: true });
  });

  it('rejects a signed request without an event id or with a bad timestamp', () => {
    expect(results[10]).toMatchObject({ ok: false, status: 401, error: expect.stringMatching(/Event-Id/) });
    expect(results[11]).toMatchObject({ ok: false, status: 401 });
  });

  it('sendEvent signs exactly the body it sends', async () => {
    const bridge = new EcosystemBridge();
    bridge._config = new Map([['pulse', { api_url: 'https://example.test/fn', service_token: SECRET, features: {} }]]);
    bridge.isConnected = () => true;
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    global.fetch = fetchMock;
    await bridge.sendEvent('pulse', { id: ID, eventType: 'task.created', data: { a: 1 } });
    const [, init] = fetchMock.mock.calls[0];
    const h = init.headers;
    expect(h['X-Ecosystem-Event-Id']).toBe(ID);
    expect(h['X-Ecosystem-Signature']).toBe(
      signBridgeRequest(SECRET, h['X-Ecosystem-Timestamp'], ID, init.body)
    );
    const [edge] = edgeCheck([{
      secret: SECRET, rawBody: init.body, eventId: ID, timestamp: h['X-Ecosystem-Timestamp'],
      signature: h['X-Ecosystem-Signature'], requireSignature: true,
    }]);
    expect(edge).toEqual({ ok: true, signed: true });
  });
});
