jest.mock('../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../utils/log', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const { supabaseAdmin } = require('../config/supabase');
const { EcosystemBridge, ACTION_ITEM_STATUS_EVENT } = require('../services/ecosystemBridge');

const now = new Date('2026-11-27T05:03:00.000Z');
const event = {
  id: 'queue-row',
  event_id: 'original-event',
  target_app: 'pulse',
  entity_id: 'action-item',
  status: 'pending',
  retry_count: 0,
  payload: { data: { status: 'open', statusVersion: '2026-11-27T05:02:00.000001Z' } },
};

const originalFetch = global.fetch;

function setup(claim, acknowledgment) {
  const bridge = new EcosystemBridge();
  bridge._config.set('pulse', {
    enabled: true, api_url: 'https://pulse.test/bridge', service_token: 'test-secret',
  });
  const writes = [];
  supabaseAdmin.from.mockImplementation((table) => ({
    update(values) {
      const write = { table, values, filters: [] };
      writes.push(write);
      const query = {
        eq(column, value) {
          write.filters.push([column, value]);
          return query;
        },
        select() { return query; },
        async maybeSingle() { return { data: claim, error: null }; },
      };
      return query;
    },
  }));
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => acknowledgment });
  return { bridge, writes };
}

afterEach(() => {
  global.fetch = originalFetch;
  jest.clearAllMocks();
});

test('claims a delivery once and uses its original ID when applying Undo', async () => {
  const { bridge, writes } = setup({ id: event.id, retry_count: 1 }, { actionItemStatusSynced: true });
  const result = await bridge.deliverQueuedActionItemStatus(event, now);

  expect(result.success).toBe(true);
  expect(writes[0]).toMatchObject({
    values: { status: 'pending', retry_count: 1, next_retry_at: '2026-11-27T05:04:00.000Z' },
    filters: expect.arrayContaining([['retry_count', 0], ['status', 'pending']]),
  });
  expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toMatchObject({
    id: event.event_id, eventType: ACTION_ITEM_STATUS_EVENT, entityId: event.entity_id, data: event.payload.data,
  });
  expect(writes[1]).toMatchObject({
    values: { status: 'delivered', next_retry_at: null },
    filters: expect.arrayContaining([['retry_count', 1], ['status', 'pending']]),
  });
});

test('leaves an unacknowledged HTTP success eligible for retry', async () => {
  const { bridge, writes } = setup({ id: event.id, retry_count: 1 }, { received: true });
  const result = await bridge.deliverQueuedActionItemStatus(event, now);

  expect(result.success).toBe(false);
  expect(writes[1].values).toMatchObject({ status: 'failed', next_retry_at: expect.any(String) });
});

test('does not send when another worker claims the delivery', async () => {
  const { bridge } = setup(null, { actionItemStatusSynced: true });
  const result = await bridge.deliverQueuedActionItemStatus(event, now);

  expect(result.success).toBe(false);
  expect(global.fetch).not.toHaveBeenCalled();
});
