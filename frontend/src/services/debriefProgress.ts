/**
 * The numbers behind the debrief loader (components/bot/DebriefLoader.tsx):
 * how far the minutes have got after the bot left the call. Modelled on the
 * Logos Vision transcript loader's estimate()/glide().
 *
 * The step states are real (the backend's pipeline: left, transcript,
 * summary, action items, audio). Nobody reports a true percentage, so the
 * movement inside a step and the time left are estimates from the call's
 * length, and the loader says so.
 */

import type { BotStep } from './botView'

export type StepKey = BotStep['key']

export interface DebriefInfo {
  /** When the bot left the call, epoch ms. */
  endedAt: number | null
  /** Length of the call, ms. */
  durationMs: number
  steps: ReadonlyArray<Pick<BotStep, 'key' | 'state'>>
  /** When this screen first saw each step become the current one, epoch ms. */
  seenAt: Partial<Record<StepKey, number>>
  /** Transcript time as a share of the call's length (default 0.03, Recall's read-back). */
  transcriptRate?: number
  /** When the current step began, epoch ms, if the server says (better than seenAt after a reload). */
  stepStartedAt?: number | null
}

export interface DebriefState {
  /** Index of the current step (the first one not done); the last one when all are done. */
  step: number
  percent: number
  leftMs: number
  /** Taking longer than the estimate (> est × 1.6 + 20 s in this step). */
  over: boolean
  done: boolean
  /** Time in the current step, ms. */
  inStepMs: number
  /** Time since the bot left, ms. */
  elapsedMs: number
}

// Rough times for each step. Tune these once real calls have been timed.
const EST: Record<StepKey, (durationMs: number, rate: number) => number> = {
  left: () => 0,
  // Recall finishes the recording, then the transcript is read back and saved.
  transcript: (d, rate) => Math.max(40_000, d * rate),
  summary: () => 45_000,
  actions: () => 8_000,
  audio: () => 10_000,
}

const clamp = (v: number, lo = 0, hi = 1): number => Math.min(hi, Math.max(lo, v))

/** "0:42", "12:05", "1:02:05". */
export function loaderClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor(s / 60) % 60
  const x = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${x}` : `${m}:${x}`
}

export function minutesLeft(ms: number): string {
  return ms < 60_000 ? 'Less than a minute left' : `About ${Math.round(ms / 60_000)} min left`
}

/** The current step: the first one not done (the last when every step is done). */
export function currentStep(steps: DebriefInfo['steps']): number {
  const i = steps.findIndex((s) => s.state !== 'done')
  return i === -1 ? Math.max(0, steps.length - 1) : i
}

/** Where the minutes are, for drawing. `now` is this device's clock. */
export function estimate(info: DebriefInfo, now: number): DebriefState {
  const { steps } = info
  const est = steps.map((s) => EST[s.key]?.(info.durationMs, info.transcriptRate ?? 0.03) ?? 0)
  const total = est.reduce((a, b) => a + b, 0) || 1
  const allDone = steps.length > 0 && steps.every((s) => s.state === 'done')
  const step = currentStep(steps)
  const ended = info.endedAt ?? now
  const elapsedMs = Math.max(0, now - ended)
  if (allDone || !steps.length) {
    return { step, percent: 100, leftMs: 0, over: false, done: true, inStepMs: 0, elapsedMs }
  }
  const key = steps[step]?.key ?? 'transcript'
  const stepEst = est[step] ?? 0
  // The transcript starts when the bot leaves; later steps start when this screen saw them start.
  const since = Math.max(ended, info.stepStartedAt ?? info.seenAt[key] ?? (key === 'transcript' ? ended : now))
  const inStepMs = Math.max(0, now - since)
  const frac = stepEst ? clamp(inStepMs / stepEst, 0, 0.9) : 1
  const before = est.slice(0, step).reduce((a, b) => a + b, 0)
  const after = est.slice(step + 1).reduce((a, b) => a + b, 0)
  return {
    step,
    percent: clamp((before + stepEst * frac) / total) * 100,
    leftMs: Math.max(10_000, stepEst * (1 - frac) + after),
    over: inStepMs > stepEst * 1.6 + 20_000,
    done: false,
    inStepMs,
    elapsedMs,
  }
}

/**
 * The bar's next width. It never goes below what it already showed, and it
 * eases toward the target by the same share per 1/60 s at any frame rate.
 */
export function glide(shown: number, target: number, dtMs: number, reduced: boolean): number {
  const goal = Math.max(shown, target)
  if (reduced) return goal
  const next = shown + (goal - shown) * (1 - Math.pow(1 - 0.08, Math.max(0, dtMs) / (1000 / 60)))
  return goal - next < 0.05 ? goal : next
}

/** The line under the bar: what is happening now. */
export function stepWhere(key: StepKey, durationMs: number): string {
  switch (key) {
    case 'left': return 'Leaving the call'
    case 'transcript': return durationMs ? `Reading back ${loaderClock(durationMs)} of the call` : 'Reading back the call'
    case 'summary': return 'Writing the summary and decisions'
    case 'actions': return 'Pulling out the action items'
    case 'audio': return 'Saving the audio'
  }
}

/** "DL", "S", or "?" for the typed placeholder lines. */
export function initials(name: string): string {
  return name.trim().split(/\s+/).map((w) => w[0] || '').join('').slice(0, 2).toUpperCase() || '?'
}
