import { describe, it, expect, vi } from 'vitest'

vi.mock('../services/supabaseClient', () => ({ supabase: {} }))
import { meetingLengthMs } from '../services/meetingView'

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
