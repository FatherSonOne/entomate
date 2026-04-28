/**
 * Settings validation tests (issue #8 tier 4).
 *
 * Guards the workspace data_controls_json validator that enforces the
 * P1.7 acceptance criteria for retention_days {30,90,365} and
 * consent_jurisdiction {permissive, two_party, gdpr}.
 *
 * Pure-function tests — no mocks needed beyond ignoring the Express
 * router import. We mock '../config/supabase' just to satisfy the
 * route file's load-time imports.
 */

'use strict';

// Satisfy middleware/auth.js's load-time createClient call. We don't
// actually use auth in these tests — we only import the route module
// to reach _internal.validateDataControls.
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test-service-key';

jest.mock('../config/supabase', () => ({
  supabaseAdmin: {},
  supabase: {}
}));

jest.mock('../utils/log', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const { _internal } = require('../routes/settings');
const { validateDataControls, ALLOWED_RETENTION_DAYS, ALLOWED_JURISDICTIONS } = _internal;

describe('validateDataControls — null + shape guards', () => {
  test('null → ok (treated as no change)', () => {
    expect(validateDataControls(null)).toEqual({ ok: true });
  });

  test('undefined → ok', () => {
    expect(validateDataControls(undefined)).toEqual({ ok: true });
  });

  test('non-object → error', () => {
    expect(validateDataControls('string')).toMatchObject({ ok: false });
    expect(validateDataControls(42)).toMatchObject({ ok: false });
    expect(validateDataControls(true)).toMatchObject({ ok: false });
  });

  test('array → error (arrays are technically objects but not what we want)', () => {
    expect(validateDataControls([1, 2, 3])).toMatchObject({ ok: false });
  });

  test('empty object → ok (no validated fields present)', () => {
    expect(validateDataControls({})).toEqual({ ok: true });
  });
});

describe('validateDataControls — retention_days', () => {
  test.each(ALLOWED_RETENTION_DAYS)('%i is accepted', (days) => {
    expect(validateDataControls({ retention_days: days })).toEqual({ ok: true });
  });

  test('null retention_days → ok (means "use default")', () => {
    expect(validateDataControls({ retention_days: null })).toEqual({ ok: true });
  });

  test.each([0, 1, 7, 60, 100, 180, 999])('rejects out-of-range %i', (bad) => {
    const r = validateDataControls({ retention_days: bad });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/retention_days must be one of/);
  });

  test('rejects non-numeric retention_days', () => {
    const r = validateDataControls({ retention_days: 'forever' });
    expect(r.ok).toBe(false);
  });

  test('accepts string-coerced number when it matches an allowed value', () => {
    // The validator does Number(v); '90' coerces to 90. Documenting the
    // current behavior so we'd notice if it changes.
    expect(validateDataControls({ retention_days: '90' })).toEqual({ ok: true });
  });
});

describe('validateDataControls — consent_jurisdiction', () => {
  test.each(ALLOWED_JURISDICTIONS)('%s is accepted', (j) => {
    expect(validateDataControls({ consent_jurisdiction: j })).toEqual({ ok: true });
  });

  test('null consent_jurisdiction → ok (means "use default")', () => {
    expect(validateDataControls({ consent_jurisdiction: null })).toEqual({ ok: true });
  });

  test.each(['ccpa', 'STRICT', 'two-party', 'eu', 'on'])('rejects unknown %s', (bad) => {
    const r = validateDataControls({ consent_jurisdiction: bad });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/consent_jurisdiction must be one of/);
  });

  test('rejects non-string types', () => {
    expect(validateDataControls({ consent_jurisdiction: 42 }).ok).toBe(false);
    expect(validateDataControls({ consent_jurisdiction: true }).ok).toBe(false);
  });
});

describe('validateDataControls — combined fields', () => {
  test('both fields valid → ok', () => {
    expect(validateDataControls({
      retention_days: 30,
      consent_jurisdiction: 'gdpr'
    })).toEqual({ ok: true });
  });

  test('one field invalid → error (first invalid surfaces)', () => {
    const r = validateDataControls({
      retention_days: 90,
      consent_jurisdiction: 'lol-invalid'
    });
    expect(r.ok).toBe(false);
  });

  test('preserves adjacent unknown keys (does not validate them)', () => {
    // Forward-compat: future keys can be added without re-deploying the
    // validator. We just don't check them.
    expect(validateDataControls({
      retention_days: 90,
      consent_jurisdiction: 'permissive',
      future_unrelated_key: 'whatever',
      nested: { also: 'fine' }
    })).toEqual({ ok: true });
  });
});

describe('validateDataControls — exposed constants', () => {
  test('ALLOWED_RETENTION_DAYS matches issue #7 acceptance criteria', () => {
    expect(ALLOWED_RETENTION_DAYS).toEqual([30, 90, 365]);
  });

  test('ALLOWED_JURISDICTIONS covers permissive / two_party / gdpr', () => {
    expect(ALLOWED_JURISDICTIONS).toEqual(['permissive', 'two_party', 'gdpr']);
  });
});
