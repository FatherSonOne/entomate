import { describe, expect, test, vi } from 'vitest'

vi.mock('../services/supabaseClient', () => ({ supabase: {} }))
import { recordingSource, recordingSteps } from '../services/recordingProgress'
import { toRecordingJob } from '../services/meetingRecorderService'

describe('recordingProgress', () => {
  test('steps follow the server stage', () => {
    const states = (stage: Parameters<typeof recordingSteps>[0]) => recordingSteps(stage).map((s) => s.state)
    expect(states(null)).toEqual(['done', 'working', 'waiting', 'waiting'])
    expect(states('transcript')).toEqual(['done', 'working', 'waiting', 'waiting'])
    expect(states('speakers')).toEqual(['done', 'done', 'working', 'waiting'])
    expect(states('summary')).toEqual(['done', 'done', 'working', 'waiting'])
    expect(states('saving')).toEqual(['done', 'done', 'done', 'working'])
  })

  test('source carries the recording length, stop time and attendee names', () => {
    const job = toRecordingJob({ status: 'transcribing', durationMs: 120000, finishedAt: '2026-11-22T15:30:00Z', stage: 'summary', stageAt: '2026-11-22T15:31:00Z' })
    if (!job) throw new Error('job')
    const src = recordingSource(job, 'Standup', ['Dana', { name: 'Priya' }, null])
    expect(src).toMatchObject({ title: 'Standup', durationMs: 120000, endedAt: '2026-11-22T15:30:00Z', stepStartedAt: '2026-11-22T15:31:00Z', speakers: ['Dana', 'Priya'] })
    expect(src.sessionId).toBeUndefined()
  })
})
