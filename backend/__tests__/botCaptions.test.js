'use strict';

const crypto = require('crypto');
const captions = require('../services/botCaptions');

const event = (text, participant = { id: 1, name: 'Dana Lee', email: 'dana@acme.com' }, start = 12.5, end = 14) => ({
  event: 'transcript.data',
  data: {
    data: {
      words: text.split(' ').map((w, i, a) => ({
        text: w,
        start_timestamp: { relative: start + i * 0.1 },
        end_timestamp: i === a.length - 1 ? { relative: end } : null
      })),
      participant
    },
    bot: { id: 'recall-bot', metadata: {} }
  }
});

beforeEach(() => captions._internal.calls.clear());

describe('botCaptions', () => {
  test('stores a finished utterance as one timed line', () => {
    const line = captions.addTranscriptEvent('s1', event('We decide on SSO after the review'));
    expect(line).toMatchObject({ seq: 1, atMs: 12500, endMs: 14000, speaker: 'Dana Lee', text: 'We decide on SSO after the review', hidden: false });
    expect(captions.latestAtMs('s1')).toBe(14000);
  });

  test('ignores events with no words', () => {
    expect(captions.addTranscriptEvent('s1', { data: { data: { words: [] } } })).toBeNull();
    expect(captions.addTranscriptEvent('s1', {})).toBeNull();
  });

  test('hides an opted-out invitee, also on later lines without the email', () => {
    const opted = new Set(['sam@acme.com'])
    captions.addTranscriptEvent('s1', event('I can own that', { id: 7, name: 'Sam Ortiz', email: 'sam@acme.com' }), opted);
    captions.addTranscriptEvent('s1', event('and the review too', { id: 7, name: 'Sam Ortiz', email: null }), opted);
    const { lines } = captions.linesAfter('s1', 0);
    expect(lines.map((l) => [l.speaker, l.text])).toEqual([[null, '(opted out)'], [null, '(opted out)']]);
    expect(JSON.stringify(lines)).not.toMatch(/Sam|review/);
  });

  test('reads only new lines after a seq, and keeps a bounded tail', () => {
    for (let i = 0; i < 5; i += 1) captions.addTranscriptEvent('s1', event(`line ${i}`));
    expect(captions.linesAfter('s1', 3).lines.map((l) => l.seq)).toEqual([4, 5]);
    for (let i = 0; i < captions._internal.MAX_LINES + 10; i += 1) captions.addTranscriptEvent('s2', event(`x ${i}`));
    expect(captions._internal.calls.get('s2').lines.length).toBe(captions._internal.MAX_LINES);
    expect(captions.linesAfter('s2', 0).lines.length).toBe(60);
  });

  test('pause flag follows setPaused', () => {
    captions.setPaused('s1', true);
    expect(captions.linesAfter('s1', 0).paused).toBe(true);
    captions.setPaused('s1', false);
    expect(captions.isPaused('s1')).toBe(false);
  });

  test('token is per session and checked in constant time', () => {
    const t = captions.captionToken('s1');
    expect(captions.verifyToken('s1', t)).toBe(true);
    expect(captions.verifyToken('s2', t)).toBe(false);
    expect(captions.verifyToken('s1', 'nope')).toBe(false);
    expect(captions.verifyToken('s1', undefined)).toBe(false);
  });

  test('accepts Recall workspace-secret signatures and rejects tampering', () => {
    const key = crypto.randomBytes(24);
    const secret = `whsec_${key.toString('base64')}`;
    const body = Buffer.from(JSON.stringify(event('hello')));
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = crypto.createHmac('sha256', key).update(`msg_1.${ts}.${body}`).digest('base64');
    const headers = { 'webhook-id': 'msg_1', 'webhook-timestamp': ts, 'webhook-signature': `v1,${sig}` };
    expect(captions.verifyWorkspaceSignature(headers, body, secret)).toBe(true);
    expect(captions.verifyWorkspaceSignature(headers, Buffer.from('{}'), secret)).toBe(false);
    expect(captions.verifyWorkspaceSignature({ ...headers, 'webhook-timestamp': '1' }, body, secret)).toBe(false);
    expect(captions.verifyWorkspaceSignature(headers, body, '')).toBe(false);
  });
});
