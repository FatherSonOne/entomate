'use strict';

const { buildBotView, sessionPhase, friendlyFailure } = require('../services/botView');

const NOW = Date.parse('2026-11-22T15:30:00Z');
const base = {
  id: 's1', org_id: 'o1', meeting_id: 'm1', platform: 'meet',
  started_at: '2026-11-22T15:00:00Z', ended_at: '2026-11-22T15:24:00Z',
  title: 'Acme weekly', recall_bot_id: 'secret-bot', meeting_url: 'https://meet.google.com/abc'
};

describe('sessionPhase', () => {
  test('a bot due later is scheduled, one due now is joining', () => {
    expect(sessionPhase({ status: 'pending', join_at: '2026-11-22T17:00:00Z' }, null, NOW)).toBe('scheduled');
    expect(sessionPhase({ status: 'launching', join_at: null }, null, NOW)).toBe('joining');
  });
  test('in the call is live', () => {
    expect(sessionPhase({ status: 'in_call' }, null, NOW)).toBe('live');
  });
  test('finished but no meeting yet is processing; a summarised meeting is ready', () => {
    expect(sessionPhase({ ...base, status: 'completed' }, null, NOW)).toBe('processing');
    expect(sessionPhase({ ...base, status: 'completed' }, { id: 'm1' }, NOW)).toBe('processing');
    expect(sessionPhase({ ...base, status: 'completed' }, { id: 'm1', summary: 'x' }, NOW)).toBe('ready');
  });
  test('failed and timeout read as failed', () => {
    expect(sessionPhase({ status: 'failed' }, null, NOW)).toBe('failed');
    expect(sessionPhase({ status: 'timeout' }, null, NOW)).toBe('failed');
  });
  test('stopped before joining is stopped; a call with no meeting 20 min after it ended is stopped', () => {
    expect(sessionPhase({ status: 'stopped', started_at: null }, null, NOW)).toBe('stopped');
    expect(sessionPhase({ ...base, status: 'stopped', ended_at: '2026-11-22T15:25:00Z' }, null, NOW)).toBe('processing');
    expect(sessionPhase({ ...base, status: 'stopped', ended_at: '2026-11-22T15:00:00Z' }, null, NOW)).toBe('stopped');
    expect(sessionPhase({ ...base, status: 'completed', ended_at: '2026-11-22T15:00:00Z' }, null, NOW)).toBe('stopped');
  });
});

describe('buildBotView', () => {
  test('live sessions carry no debrief and no debug fields', () => {
    const v = buildBotView({ session: { ...base, status: 'in_call', ended_at: null }, now: NOW });
    expect(v.phase).toBe('live');
    expect(v.debrief).toBeNull();
    expect(JSON.stringify(v)).not.toMatch(/secret-bot|meet\.google/);
  });

  test('a ready debrief counts what the bot caught and where it went', () => {
    const meeting = {
      id: 'm1', title: 'Acme × Entomate weekly', summary: 'Pilot agreed', summary_template: 'sales_call',
      decisions: ['Pilot', 'SSO later'],
      transcript_segments: [{ atMs: 0, endMs: 4000, speaker: 'Dana' }, { atMs: 5000, endMs: 1421000, speaker: 'Frank' }],
      recording_job: { source: 'bot', playbackFile: 'o1/m1/playback.webm', bytes: 3250585 }
    };
    const v = buildBotView({
      session: { ...base, status: 'completed' }, meeting,
      actionItems: [{ id: 1 }, { id: 2 }, { id: 3 }],
      attendees: [{ email_status: 'sent' }, { email_status: 'sent', opted_out_at: 'x' }, { email_status: 'failed' }],
      now: NOW
    });
    expect(v.phase).toBe('ready');
    expect(v.title).toBe('Acme × Entomate weekly');
    expect(v.debrief).toMatchObject({ durationMs: 1421000, speakers: 2, decisions: 2, actionItems: 3, audioSaved: true, invitees: { total: 3, told: 2, optedOut: 1 } });
    const byKey = Object.fromEntries(v.debrief.steps.map((s) => [s.key, s]));
    expect(byKey.transcript).toMatchObject({ state: 'done', value: '2 lines' });
    expect(byKey.summary).toMatchObject({ state: 'done', value: 'Sales call' });
    expect(byKey.actions.value).toBe('3');
    expect(byKey.audio).toMatchObject({ state: 'done', value: '3.1 MB' });
  });

  test('processing shows the transcript being written and falls back to session times', () => {
    const v = buildBotView({ session: { ...base, status: 'completed' }, now: NOW });
    expect(v.phase).toBe('processing');
    expect(v.debrief.durationMs).toBe(24 * 60 * 1000);
    expect(v.debrief.steps.find((s) => s.key === 'transcript')).toMatchObject({ state: 'working' });
    expect(v.debrief.steps.find((s) => s.key === 'summary')).toMatchObject({ state: 'waiting' });
  });

  test('a failure is explained in plain words', () => {
    const v = buildBotView({ session: { ...base, status: 'failed', failure_reason: 'bot_kicked_from_waiting_room' }, now: NOW });
    expect(v.failure).toBe('Nobody let the bot in from the waiting room.');
    expect(friendlyFailure('recall_launch_failed: Recall API 400')).toMatch(/could not be started/);
    expect(friendlyFailure(null)).toMatch(/could not finish/);
  });
});

describe('debrief steps while the minutes are written', () => {
  test('a meeting claimed by the bot run but without lines yet is still writing the transcript', () => {
    const v = buildBotView({
      session: { ...base, status: 'completed' },
      meeting: { id: 'm1', summary: null, transcript_segments: null, recording_job: { status: 'transcribing', source: 'bot', stage: 'transcript' } },
      now: NOW,
    });
    expect(v.phase).toBe('processing');
    expect(v.debrief.steps.find((s) => s.key === 'transcript')).toMatchObject({ state: 'working', value: 'Writing' });
    expect(v.debrief.steps.find((s) => s.key === 'summary').state).toBe('waiting');
  });
});

describe('recording state', () => {
  test('the view says when the bot is in the call without recording', () => {
    const v = buildBotView({ session: { ...base, status: 'in_call', ended_at: null, live_state: { recording: false, captions: true } }, now: NOW });
    expect(v).toMatchObject({ phase: 'live', recording: false, captionsOn: true });
    expect(buildBotView({ session: { ...base, status: 'in_call', ended_at: null }, now: NOW }).recording).toBeNull();
  });
});
