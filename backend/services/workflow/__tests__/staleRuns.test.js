/* global describe, test, expect */
const { expireStaleRuns, isStale, STALE_AFTER_MS, TIMEOUT_MESSAGE } = require('../staleRuns');

const now = Date.parse('2026-11-22T12:00:00Z');
const ago = (ms) => new Date(now - ms).toISOString();

describe('stale workflow runs', () => {
  test('isStale: only running runs past the limit', () => {
    expect(isStale({ status: 'running', started_at: ago(STALE_AFTER_MS + 1000) }, now)).toBe(true);
    expect(isStale({ status: 'running', started_at: ago(60 * 1000) }, now)).toBe(false);
    expect(isStale({ status: 'completed', started_at: ago(STALE_AFTER_MS * 4) }, now)).toBe(false);
    expect(isStale({ status: 'running' }, now)).toBe(false);
  });

  test('expireStaleRuns marks old running runs failed, scoped to the given workflows', async () => {
    const calls = {};
    const q = {
      update(v) { calls.update = v; return q; },
      eq(k, v) { calls.eq = [k, v]; return q; },
      lt(k, v) { calls.lt = [k, v]; return q; },
      in(k, v) { calls.in = [k, v]; return q; },
      select() { return Promise.resolve({ data: [{ id: 'r1' }, { id: 'r2' }], error: null }); },
    };
    const db = { from(t) { calls.table = t; return q; } };
    const n = await expireStaleRuns(db, ['w1'], new Date(now));
    expect(n).toBe(2);
    expect(calls.table).toBe('workflow_executions');
    expect(calls.update).toMatchObject({ status: 'failed', error_message: TIMEOUT_MESSAGE });
    expect(calls.eq).toEqual(['status', 'running']);
    expect(calls.lt).toEqual(['started_at', ago(STALE_AFTER_MS)]);
    expect(calls.in).toEqual(['workflow_id', ['w1']]);
  });

  test('no workflows or a db error: closes nothing and does not throw', async () => {
    expect(await expireStaleRuns({}, [])).toBe(0);
    const db = { from() { throw new Error('boom'); } };
    expect(await expireStaleRuns(db, ['w1'])).toBe(0);
  });
});
