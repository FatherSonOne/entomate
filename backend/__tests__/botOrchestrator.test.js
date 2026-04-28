/**
 * Bot orchestrator regression tests (issue #8).
 *
 * Tier 1: pure-function helpers (mapRecallStatus, mapRecallEvent,
 *   latestRecallStatusCode, renderAnnouncement, token + email helpers).
 *
 * Tier 2: handleRecallWebhook integration with mocked supabase + mocked
 *   recallFetch. Covers unknown-bot ignore, status events, bot.done URL
 *   backfill, bot.fatal failure_reason, payload-shape variants.
 */

'use strict';

// ── Mock the supabase config module BEFORE requiring the orchestrator ────
//
// Each test resets the chain's terminal value via setTerminal(...) or
// per-method mockResolvedValueOnce overrides. The chain is reused across
// the whole module (matches how supabaseAdmin is a singleton in real use)
// but reset() between tests purges call history.
function makeSupabaseMock() {
  const state = {
    terminalQueue: [], // queued terminal results for sequential queries
    defaultTerminal: { data: null, error: null }
  };

  function nextTerminal() {
    if (state.terminalQueue.length > 0) return state.terminalQueue.shift();
    return state.defaultTerminal;
  }

  const chain = {
    // Test helpers
    __setDefaultTerminal: (v) => { state.defaultTerminal = v; return chain; },
    __queueTerminal: (...vs) => { state.terminalQueue.push(...vs); return chain; },
    __reset: () => {
      state.terminalQueue = [];
      state.defaultTerminal = { data: null, error: null };
      Object.keys(chain).forEach((k) => {
        if (typeof chain[k]?.mockClear === 'function') chain[k].mockClear();
      });
      return chain;
    },

    // Chainable query builders — return chain for fluent calls
    from:   jest.fn(() => chain),
    select: jest.fn(() => chain),
    insert: jest.fn(() => chain),
    update: jest.fn(() => chain),
    delete: jest.fn(() => chain),
    eq:     jest.fn(() => chain),
    is:     jest.fn(() => chain),
    lt:     jest.fn(() => chain),
    or:     jest.fn(() => chain),
    not:    jest.fn(() => chain),
    order:  jest.fn(() => chain),
    limit:  jest.fn(() => chain),

    // Terminal awaitables
    maybeSingle: jest.fn(() => Promise.resolve(nextTerminal())),
    single:      jest.fn(() => Promise.resolve(nextTerminal())),

    // Auth admin (for organizer email lookup)
    auth: {
      admin: {
        getUserById: jest.fn(() => Promise.resolve({ data: { user: null } })),
        listUsers:   jest.fn(() => Promise.resolve({ data: { users: [] } }))
      }
    },

    // Make the chain itself thenable so `await db().from().update().eq()`
    // resolves without an explicit terminal.
    then(resolve, reject) {
      return Promise.resolve(nextTerminal()).then(resolve, reject);
    }
  };

  return chain;
}

const mockSupabase = makeSupabaseMock();

jest.mock('../config/supabase', () => ({
  supabaseAdmin: mockSupabase,
  supabase: mockSupabase
}));

jest.mock('../utils/log', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

// Ensure required env vars exist before the module loads
process.env.RECALL_API_KEY = 'test-key';

const orchestrator = require('../services/botOrchestrator');
const {
  mapRecallStatus,
  mapRecallEvent,
  latestRecallStatusCode,
  resolveSessionFromPayload,
  renderAnnouncement,
  generateOptOutToken,
  hashOptOutToken,
  normalizeEmail,
  normalizeEmailList,
  DEFAULT_ANNOUNCEMENT_TEMPLATE
} = orchestrator._internal;

beforeEach(() => {
  mockSupabase.__reset();
});

// ─────────────────────────────────────────────────────────────────────────
// Tier 1 — pure function units
// ─────────────────────────────────────────────────────────────────────────

describe('mapRecallStatus', () => {
  test.each([
    ['ready', 'pending'],
    ['joining_call', 'joining'],
    ['in_waiting_room', 'joining'],
    ['in_call_not_recording', 'in_call'],
    ['in_call_recording', 'in_call'],
    ['recording_done', 'completed'],
    ['call_ended', 'completed'],
    ['done', 'completed'],
    ['fatal', 'failed'],
    ['timeout', 'timeout']
  ])('maps %s → %s', (code, expected) => {
    expect(mapRecallStatus(code)).toBe(expected);
  });

  test('unknown code returns null', () => {
    expect(mapRecallStatus('mystery_code')).toBeNull();
  });

  test('null returns null (silent-bug regression)', () => {
    // The exact bug flagged in the 2026-04-26 kickoff brief: a missing
    // status code in a workspace-Svix payload returned null but the
    // caller expected a string. Test guards that null-in stays null-out.
    expect(mapRecallStatus(null)).toBeNull();
  });

  test('undefined returns null (silent-bug regression)', () => {
    expect(mapRecallStatus(undefined)).toBeNull();
  });

  test('empty string returns null', () => {
    expect(mapRecallStatus('')).toBeNull();
  });
});

describe('mapRecallEvent', () => {
  test.each([
    ['bot.joining_call', 'joining'],
    ['bot.in_waiting_room', 'joining'],
    ['bot.in_call_not_recording', 'in_call'],
    ['bot.in_call_recording', 'in_call'],
    ['bot.call_ended', 'completed'],
    ['bot.done', 'completed'],
    ['bot.fatal', 'failed']
  ])('maps %s → %s', (event, expected) => {
    expect(mapRecallEvent(event)).toBe(expected);
  });

  test('event without bot. prefix returns null', () => {
    expect(mapRecallEvent('done')).toBeNull();
  });

  test('non-string returns null', () => {
    expect(mapRecallEvent(null)).toBeNull();
    expect(mapRecallEvent(undefined)).toBeNull();
    expect(mapRecallEvent(42)).toBeNull();
    expect(mapRecallEvent({ event: 'bot.done' })).toBeNull();
  });

  test('unknown bot. event returns null', () => {
    expect(mapRecallEvent('bot.future_unknown_event')).toBeNull();
  });
});

describe('latestRecallStatusCode', () => {
  test('returns last entry from status_changes', () => {
    const bot = {
      status_changes: [
        { code: 'joining_call' },
        { code: 'in_waiting_room' },
        { code: 'in_call_recording' }
      ]
    };
    expect(latestRecallStatusCode(bot)).toBe('in_call_recording');
  });

  test('falls back to bot.status.code when status_changes is empty', () => {
    expect(latestRecallStatusCode({ status_changes: [], status: { code: 'ready' } })).toBe('ready');
  });

  test('falls back to bot.status.code when status_changes missing', () => {
    expect(latestRecallStatusCode({ status: { code: 'fatal' } })).toBe('fatal');
  });

  test('returns null for missing bot', () => {
    expect(latestRecallStatusCode(null)).toBeNull();
    expect(latestRecallStatusCode(undefined)).toBeNull();
    expect(latestRecallStatusCode({})).toBeNull();
  });
});

describe('renderAnnouncement', () => {
  test('substitutes organizer name with " for X" suffix', () => {
    const result = renderAnnouncement(DEFAULT_ANNOUNCEMENT_TEMPLATE, 'Frank');
    expect(result).toMatch(/recording this meeting for Frank/);
    expect(result).toMatch(/Notes \+ transcript/);
  });

  test('drops suffix gracefully when organizer is null', () => {
    const result = renderAnnouncement(DEFAULT_ANNOUNCEMENT_TEMPLATE, null);
    expect(result).toMatch(/recording this meeting\./);
    expect(result).not.toMatch(/recording this meeting for/);
  });

  test('replaces {organizer} token in custom templates', () => {
    const custom = 'Hello! {organizer} is recording. Thanks.';
    expect(renderAnnouncement(custom, 'Alex')).toBe('Hello! Alex is recording. Thanks.');
  });

  test('falls back to "the meeting host" for {organizer} when name missing', () => {
    const custom = '{organizer} is recording.';
    expect(renderAnnouncement(custom, null)).toBe('the meeting host is recording.');
  });
});

describe('generateOptOutToken / hashOptOutToken', () => {
  test('generateOptOutToken produces 64-char hex raw + 64-char hex hash', () => {
    const { raw, hash } = generateOptOutToken();
    expect(raw).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test('hashOptOutToken is deterministic', () => {
    const { raw } = generateOptOutToken();
    expect(hashOptOutToken(raw)).toBe(hashOptOutToken(raw));
  });

  test('hashOptOutToken matches the hash from generateOptOutToken', () => {
    const { raw, hash } = generateOptOutToken();
    expect(hashOptOutToken(raw)).toBe(hash);
  });

  test('different raw tokens produce different hashes', () => {
    const a = generateOptOutToken();
    const b = generateOptOutToken();
    expect(a.raw).not.toBe(b.raw);
    expect(a.hash).not.toBe(b.hash);
  });
});

describe('normalizeEmail', () => {
  test('trims, lowercases valid emails', () => {
    expect(normalizeEmail('  Alice@Example.COM  ')).toBe('alice@example.com');
  });

  test('rejects malformed emails', () => {
    expect(normalizeEmail('no-at-sign.com')).toBeNull();
    expect(normalizeEmail('no-dot@there')).toBeNull();
    expect(normalizeEmail('a@b')).toBeNull();
    expect(normalizeEmail('')).toBeNull();
  });

  test('rejects non-strings', () => {
    expect(normalizeEmail(null)).toBeNull();
    expect(normalizeEmail(undefined)).toBeNull();
    expect(normalizeEmail(42)).toBeNull();
    expect(normalizeEmail({})).toBeNull();
  });

  test('rejects emails over 254 chars', () => {
    const huge = 'a'.repeat(250) + '@b.co';
    expect(normalizeEmail(huge)).toBeNull();
  });
});

describe('normalizeEmailList', () => {
  test('lowercases + dedupes', () => {
    const out = normalizeEmailList(['A@b.com', 'a@b.com', 'C@d.com'], null);
    expect(out).toEqual(['a@b.com', 'c@d.com']);
  });

  test('drops invalid entries', () => {
    const out = normalizeEmailList(['valid@x.com', 'no-at', '', null, 42, 'also@y.com'], null);
    expect(out).toEqual(['valid@x.com', 'also@y.com']);
  });

  test('filters out the organizer\'s own email', () => {
    const out = normalizeEmailList(
      ['Frank@qntmecos.com', 'alice@x.com', 'frank@QNTMECOS.com'],
      'frank@qntmecos.com'
    );
    expect(out).toEqual(['alice@x.com']);
  });

  test('returns empty array for non-array input', () => {
    expect(normalizeEmailList(null, null)).toEqual([]);
    expect(normalizeEmailList(undefined, null)).toEqual([]);
    expect(normalizeEmailList('not-an-array', null)).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Tier 2 — webhook integration tests
// ─────────────────────────────────────────────────────────────────────────

describe('resolveSessionFromPayload', () => {
  test('resolves by metadata.session_id when present', async () => {
    mockSupabase.__queueTerminal({ data: { id: 'session-from-meta' }, error: null });
    const result = await resolveSessionFromPayload({
      data: { bot: { id: 'recall-bot-1', metadata: { session_id: 'session-from-meta' } } }
    });
    expect(result).toBe('session-from-meta');
  });

  test('falls back to recall_bot_id when metadata missing', async () => {
    // First lookup (by session_id) should not happen because metadata is absent;
    // queue only the recall_bot_id lookup result.
    mockSupabase.__queueTerminal({ data: { id: 'session-from-bot-id' }, error: null });
    const result = await resolveSessionFromPayload({
      data: { bot: { id: 'recall-bot-2' } }
    });
    expect(result).toBe('session-from-bot-id');
  });

  test('returns null when neither lookup matches', async () => {
    mockSupabase.__queueTerminal(
      { data: null, error: null }, // metadata lookup miss
      { data: null, error: null }  // recall_bot_id lookup miss
    );
    const result = await resolveSessionFromPayload({
      data: { bot: { id: 'unknown-bot', metadata: { session_id: 'unknown-session' } } }
    });
    expect(result).toBeNull();
  });

  test('handles legacy payload shape (data.id without bot wrapper)', async () => {
    mockSupabase.__queueTerminal({ data: { id: 'session-from-legacy' }, error: null });
    const result = await resolveSessionFromPayload({
      data: { id: 'recall-bot-3' }
    });
    expect(result).toBe('session-from-legacy');
  });
});

describe('handleRecallWebhook', () => {
  // Stub global.fetch so bot.done URL backfill doesn't hit the network.
  // recallFetch (the lexical helper used inside handleRecallWebhook) calls
  // fetch() under the hood; spying on the _internal export wouldn't catch
  // the closure binding.
  let originalFetch;
  let mockFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function mockRecallResponse(json, status = 200) {
    mockFetch.mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      headers: new Map([['content-type', 'application/json']]),
      json: () => Promise.resolve(json),
      text: () => Promise.resolve(JSON.stringify(json))
    });
  }

  function mockRecallReject(message) {
    mockFetch.mockRejectedValueOnce(new Error(message));
  }

  test('unknown bot id and missing metadata → ok ignored, no DB write', async () => {
    mockSupabase.__queueTerminal({ data: null, error: null }); // recall_bot_id lookup miss
    const result = await orchestrator.handleRecallWebhook({
      event: 'bot.in_call_recording',
      data: { bot: { id: 'never-seen-this-bot' } }
    });
    expect(result).toEqual({ ok: true, ignored: true });
    // The chain's update() should not have been called
    expect(mockSupabase.update).not.toHaveBeenCalled();
  });

  test('bot.in_call_recording → status updated to in_call', async () => {
    mockSupabase.__queueTerminal(
      { data: { id: 'sess-1' }, error: null }, // session resolution
      { data: null, error: null }              // update terminal
    );
    const result = await orchestrator.handleRecallWebhook({
      event: 'bot.in_call_recording',
      data: { bot: { id: 'recall-1', metadata: { session_id: 'sess-1' } } }
    });
    expect(result).toEqual({ ok: true, sessionId: 'sess-1' });
    expect(mockSupabase.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'in_call' })
    );
  });

  test('bot.done → status completed + ended_at + recording/transcript URLs backfilled', async () => {
    mockRecallResponse({
      recordings: [{
        media_shortcuts: {
          video_mixed: { data: { download_url: 'https://recall.test/video.mp4' } },
          transcript:  { data: { download_url: 'https://recall.test/transcript.json' } }
        }
      }]
    });
    mockSupabase.__queueTerminal(
      { data: { id: 'sess-2' }, error: null }, // session resolution
      { data: null, error: null }              // update terminal
    );
    const result = await orchestrator.handleRecallWebhook({
      event: 'bot.done',
      data: { bot: { id: 'recall-2', metadata: { session_id: 'sess-2' } } }
    });
    expect(result.ok).toBe(true);
    const updateCall = mockSupabase.update.mock.calls[0][0];
    expect(updateCall).toMatchObject({
      status: 'completed',
      recording_url: 'https://recall.test/video.mp4',
      transcript_url: 'https://recall.test/transcript.json'
    });
    expect(updateCall.ended_at).toBeTruthy();
  });

  test('bot.done with backfill failure → status still updates (best-effort)', async () => {
    mockRecallReject('Recall API 503');
    mockSupabase.__queueTerminal(
      { data: { id: 'sess-3' }, error: null }, // session resolution
      { data: null, error: null }              // update terminal
    );
    const result = await orchestrator.handleRecallWebhook({
      event: 'bot.done',
      data: { bot: { id: 'recall-3', metadata: { session_id: 'sess-3' } } }
    });
    expect(result.ok).toBe(true);
    const updateCall = mockSupabase.update.mock.calls[0][0];
    expect(updateCall.status).toBe('completed');
    expect(updateCall).not.toHaveProperty('recording_url');
  });

  test('bot.fatal with fatal_reason → failure_reason recorded', async () => {
    mockSupabase.__queueTerminal(
      { data: { id: 'sess-4' }, error: null },
      { data: null, error: null }
    );
    await orchestrator.handleRecallWebhook({
      event: 'bot.fatal',
      data: {
        bot: { id: 'recall-4', metadata: { session_id: 'sess-4' } },
        fatal_reason: 'meeting host did not admit bot'
      }
    });
    const updateCall = mockSupabase.update.mock.calls[0][0];
    expect(updateCall).toMatchObject({
      status: 'failed',
      failure_reason: 'meeting host did not admit bot'
    });
  });

  test('legacy payload with status.code only → resolves via mapRecallStatus fallback', async () => {
    // No event field; legacy payload had data.status.code.
    mockSupabase.__queueTerminal(
      { data: { id: 'sess-5' }, error: null },
      { data: null, error: null }
    );
    const result = await orchestrator.handleRecallWebhook({
      data: {
        bot: { id: 'recall-5', metadata: { session_id: 'sess-5' } },
        status: { code: 'in_call_recording' }
      }
    });
    expect(result.ok).toBe(true);
    const updateCall = mockSupabase.update.mock.calls[0][0];
    expect(updateCall.status).toBe('in_call');
  });
});
