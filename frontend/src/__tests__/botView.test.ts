import { describe, expect, test } from 'vitest'
import {
  debriefToNotify, elapsedMs, formatElapsed, isDebriefDelayed, markSeen, phaseSignal, readSeen, runTitle,
  type BotSessionView,
} from '../services/botView'

const NOW = Date.parse('2026-11-22T16:00:00Z')
const run = (over: Partial<BotSessionView>): BotSessionView => ({
  sessionId: 's1', meetingId: 'm1', title: null, platform: 'meet', status: 'completed', phase: 'ready',
  joinAt: null, startedAt: '2026-11-22T15:00:00Z', endedAt: '2026-11-22T15:24:00Z', launchedBy: 'u1',
  autoJoin: false, failure: null, meetingReady: true, marks: [], debrief: null, ...over,
})

describe('botView', () => {
  test('formats elapsed time as a clock', () => {
    expect(formatElapsed(1421000)).toBe('23:41')
    expect(formatElapsed(3725000)).toBe('1:02:05')
    expect(formatElapsed(-5)).toBe('00:00')
  })

  test('elapsed runs to now while live and stops at the end', () => {
    expect(elapsedMs({ startedAt: '2026-11-22T15:00:00Z', endedAt: null }, NOW)).toBe(3600000)
    expect(elapsedMs({ startedAt: '2026-11-22T15:00:00Z', endedAt: '2026-11-22T15:24:00Z' }, NOW)).toBe(1440000)
    expect(elapsedMs({ startedAt: null, endedAt: null }, NOW)).toBe(0)
  })

  test('titles fall back to the platform', () => {
    expect(runTitle({ title: null, platform: 'zoom' })).toBe('Zoom meeting')
    expect(runTitle({ title: 'Acme weekly', platform: 'meet' })).toBe('Acme weekly')
  })

  test('every phase is an LED plus a word', () => {
    expect(phaseSignal('live')).toEqual({ tone: 'live', word: 'Recording' })
    expect(phaseSignal('ready').tone).toBe('mint')
    expect(phaseSignal('failed').tone).toBe('brand')
  })

  test('selects an unseen debrief this person sent', () => {
    const sessions = [
      run({ sessionId: 'live', phase: 'live', endedAt: null }),
      run({ sessionId: 'other', launchedBy: 'u2' }),
      run({ sessionId: 'mine' }),
    ]
    expect(debriefToNotify(sessions, { userId: 'u1', seen: [], now: NOW })?.sessionId).toBe('mine')
    expect(debriefToNotify(sessions, { userId: 'u1', seen: ['mine'], now: NOW })).toBeNull()
  })

  test('skips stale, failed, and unsaved minutes', () => {
    const opts = { userId: 'u1', seen: [], now: NOW }
    expect(debriefToNotify([run({ endedAt: '2026-11-21T01:00:00Z' })], opts)).toBeNull()
    expect(debriefToNotify([run({ phase: 'failed' })], opts)).toBeNull()
    expect(debriefToNotify([run({ phase: 'stopped' })], opts)).toBeNull()
    expect(debriefToNotify([run({ phase: 'processing', meetingReady: false })], opts)).toBeNull()
    expect(debriefToNotify([run({ phase: 'ready', meetingReady: false })], opts)).toBeNull()
  })

  test('distinguishes delayed minutes from ongoing and completed work', () => {
    expect(isDebriefDelayed(run({ phase: 'processing' }), NOW)).toBe(true)
    expect(isDebriefDelayed(run({ phase: 'processing', endedAt: '2026-11-22T15:59:00Z' }), NOW)).toBe(false)
    expect(isDebriefDelayed(run({ phase: 'ready' }), NOW)).toBe(false)
  })

  test('seen list survives bad storage', () => {
    const store = new Map<string, string>()
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) } }
    markSeen(storage, 'a'); markSeen(storage, 'b'); markSeen(storage, 'a')
    expect(readSeen(storage)).toEqual(['a', 'b'])
    store.set('entomate.bot.debriefSeen', '{nope')
    expect(readSeen(storage)).toEqual([])
  })
})
