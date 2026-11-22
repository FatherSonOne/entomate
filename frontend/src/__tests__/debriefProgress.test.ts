import { describe, expect, it } from 'vitest'
import { currentStep, estimate, glide, initials, loaderClock, minutesLeft, stepWhere, type DebriefInfo } from '../services/debriefProgress'

type S = DebriefInfo['steps'][number]
const steps = (states: Array<S['state']>): S[] =>
  (['left', 'transcript', 'summary', 'actions', 'audio'] as const).map((key, i) => ({ key, state: states[i] ?? 'waiting' }))

const T0 = 1_000_000_000_000
const base = (over: Partial<DebriefInfo> = {}): DebriefInfo => ({
  endedAt: T0, durationMs: 24 * 60_000, steps: steps(['done', 'working']), seenAt: {}, ...over,
})

describe('debriefProgress', () => {
  it('formats clocks and minutes left', () => {
    expect(loaderClock(0)).toBe('0:00')
    expect(loaderClock(42_000)).toBe('0:42')
    expect(loaderClock(3_725_000)).toBe('1:02:05')
    expect(minutesLeft(30_000)).toBe('Less than a minute left')
    expect(minutesLeft(150_000)).toBe('About 3 min left')
  })

  it('takes the first step not done as current', () => {
    expect(currentStep(steps(['done', 'working']))).toBe(1)
    expect(currentStep(steps(['done', 'done', 'done', 'done', 'done']))).toBe(4)
  })

  it('moves inside the transcript step by time since the bot left, capped below the next step', () => {
    const a = estimate(base(), T0 + 5_000)
    const b = estimate(base(), T0 + 30_000)
    const c = estimate(base(), T0 + 10 * 60_000)
    expect(a.step).toBe(1)
    expect(b.percent).toBeGreaterThan(a.percent)
    expect(b.leftMs).toBeLessThan(a.leftMs)
    // Never claims the step finished before the server says so.
    const transcriptShare = 43_200 / (43_200 + 45_000 + 8_000 + 10_000)
    expect(c.percent).toBeLessThanOrEqual(transcriptShare * 90 + 0.001)
    expect(c.over).toBe(true)
    expect(c.leftMs).toBeGreaterThanOrEqual(10_000)
    expect(b.elapsedMs).toBe(30_000)
  })

  it('times later steps from when this screen first saw them', () => {
    const info = base({ steps: steps(['done', 'done', 'working']), seenAt: { summary: T0 + 60_000 } })
    const s = estimate(info, T0 + 70_000)
    expect(s.step).toBe(2)
    expect(s.inStepMs).toBe(10_000)
    expect(s.over).toBe(false)
  })

  it('reports done at 100% when every step is done', () => {
    const s = estimate(base({ steps: steps(['done', 'done', 'done', 'done', 'done']) }), T0 + 1)
    expect(s).toMatchObject({ done: true, percent: 100, leftMs: 0 })
  })

  it('glides toward the target without going back, at any frame rate', () => {
    expect(glide(40, 20, 16, false)).toBe(40)
    const one = glide(0, 50, 1000 / 60, false)
    const twoHalf = glide(glide(0, 50, 1000 / 120, false), 50, 1000 / 120, false)
    expect(one).toBeCloseTo(twoHalf, 5)
    expect(glide(0, 50, 16, true)).toBe(50)
  })

  it('says where the minutes are and builds initials', () => {
    expect(stepWhere('transcript', 24 * 60_000)).toBe('Reading back 24:00 of the call')
    expect(stepWhere('summary', 0)).toBe('Writing the summary and decisions')
    expect(initials('Dana Lee')).toBe('DL')
    expect(initials('  ')).toBe('?')
  })
})
