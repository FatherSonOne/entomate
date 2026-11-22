import { describe, it, expect, vi } from 'vitest'

vi.mock('../services/supabaseClient', () => ({ supabase: {} }))
import { meetingLengthMs } from '../services/meetingView'
import { isAutoTitle } from '../services/meetingView'

const seg = (atMs: number) => ({ atMs, speaker: 'A', text: 'hello' })

describe('meetingLengthMs', () => {
  it('uses the recorded duration when the transcript stops early', () => {
    expect(meetingLengthMs({ id: 'm', created_at: '2026-11-22', duration_minutes: 38, transcript_segments: [seg(0), seg(405_000)] } as never)).toBe(38 * 60_000)
  })
  it('uses the transcript end when it runs past the recorded duration', () => {
    expect(meetingLengthMs({ id: 'm', created_at: '2026-11-22', duration_minutes: 1, transcript_segments: [seg(0), seg(125_000)] } as never)).toBe(125_000)
  })
  it('falls back to the recorded duration with no transcript, and 0 with neither', () => {
    expect(meetingLengthMs({ id: 'm', created_at: '2026-11-22', duration_minutes: 5 } as never)).toBe(300_000)
    expect(meetingLengthMs({ id: 'm', created_at: '2026-11-22' } as never)).toBe(0)
  })
})

import { actionCounts, firstDecision, plural } from '../services/meetingView'

describe('list row helpers', () => {
  it('reads action counts defensively', () => {
    expect(actionCounts({ id: 'm', created_at: 'x', action_counts: { total: 3, open: 2, mine: 1 } } as never)).toEqual({ total: 3, open: 2, mine: 1 })
    expect(actionCounts({ id: 'm', created_at: 'x', action_counts: { total: 'x', open: -1 } } as never)).toEqual({ total: 0, open: 0, mine: 0 })
    expect(actionCounts({ id: 'm', created_at: 'x' } as never)).toEqual({ total: 0, open: 0, mine: 0 })
  })
  it('gives the first decision and the count after it', () => {
    expect(firstDecision({ id: 'm', created_at: 'x', decisions: ['A', '', 'B'] } as never)).toEqual({ text: 'A', more: 1 })
    expect(firstDecision({ id: 'm', created_at: 'x', decisions: [] } as never)).toBeNull()
  })
  it('pluralises', () => {
    expect(plural(1, 'action')).toBe('1 action')
    expect(plural(2, 'action')).toBe('2 actions')
  })
})

describe('isAutoTitle', () => {
  test('spots the names the app makes up', () => {
    expect(isAutoTitle('Google Meet meeting, Nov 20, 2026')).toBe(true)
    expect(isAutoTitle('Zoom meeting')).toBe(true)
    expect(isAutoTitle('Google Meet meeting, Nov 20')).toBe(true)
    expect(isAutoTitle('Recording, Nov 22, 2026')).toBe(true)
    expect(isAutoTitle('')).toBe(true)
    expect(isAutoTitle(null)).toBe(true)
  })
  test('leaves real names alone', () => {
    expect(isAutoTitle('Northwind pilot scope')).toBe(false)
    expect(isAutoTitle('Recording studio review')).toBe(false)
    expect(isAutoTitle('Zoom meeting with Dana')).toBe(false)
  })
})
