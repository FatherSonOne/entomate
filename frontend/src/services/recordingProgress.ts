/**
 * The writing loader's input for a meeting recorded in the browser: the same
 * loader the bot debrief uses (components/bot/DebriefLoader.tsx), fed from
 * `meetings.recording_job`. The server marks each stage as it starts
 * (transcript, speakers, summary, saving), so the steps are real; movement
 * inside a step and the time left are estimates.
 */

import type { BotStep, StepState } from './botView'
import type { DebriefSource } from '../components/bot/DebriefLoader'
import type { RecordingJob, RecordingStage } from './meetingRecorderService'

/** Gemini reads audio back faster than real time; about a tenth of the length, at least 40 s. */
const TRANSCRIPT_RATE = 0.1

/** Which loader step each server stage belongs to (0 = recording saved). */
const STEP_OF: Record<RecordingStage, number> = { transcript: 1, speakers: 2, summary: 2, saving: 3 }

const STEPS: ReadonlyArray<Pick<BotStep, 'key' | 'label'>> = [
  { key: 'left', label: 'Recording saved' },
  { key: 'transcript', label: 'Transcript' },
  { key: 'summary', label: 'Speakers, summary and decisions' },
  { key: 'actions', label: 'Action items' },
]

export function recordingSteps(stage: RecordingStage | null): BotStep[] {
  const at = stage ? STEP_OF[stage] : 1
  return STEPS.map((s, i) => {
    const state: StepState = i < at ? 'done' : i === at ? 'working' : 'waiting'
    return { ...s, state, value: '' }
  })
}

export function recordingSource(job: RecordingJob, title: string | null | undefined, attendees: unknown): DebriefSource {
  const names = Array.isArray(attendees)
    ? attendees.map((a) => (typeof a === 'string' ? a : (a as { name?: unknown } | null)?.name)).filter((n): n is string => typeof n === 'string' && n.trim() !== '')
    : []
  return {
    title: title || 'Recording',
    endedAt: job.finishedAt ?? job.updatedAt,
    durationMs: job.durationMs,
    steps: recordingSteps(job.stage),
    headline: 'Recording stopped · writing the minutes',
    sinceLabel: 'since you stopped',
    speakers: names.slice(0, 6),
    transcriptRate: TRANSCRIPT_RATE,
    stepStartedAt: job.stage ? job.stageAt : null,
  }
}
