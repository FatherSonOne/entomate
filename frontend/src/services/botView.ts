/**
 * View logic for the bot flow (Bot page, meeting-page live view and debrief,
 * and the watcher that moves the app to a debrief when a call ends). Pure
 * functions over the backend's bot view (backend/services/botView.js).
 */

import type { SignalTone } from '../components/bench'

export type BotPhase = 'scheduled' | 'joining' | 'live' | 'processing' | 'ready' | 'failed' | 'stopped'
export type StepState = 'done' | 'working' | 'waiting'

export interface BotStep {
  key: 'left' | 'transcript' | 'summary' | 'actions' | 'audio'
  label: string
  state: StepState
  value: string
}

export interface BotDebrief {
  steps: BotStep[]
  durationMs: number
  speakers: number
  decisions: number
  actionItems: number
  invitees: { total: number; told: number; optedOut: number }
  audioSaved: boolean
}

export interface BotSessionView {
  sessionId: string
  meetingId: string
  title: string | null
  platform: 'meet' | 'zoom' | 'teams'
  status: string
  phase: BotPhase
  joinAt: string | null
  startedAt: string | null
  endedAt: string | null
  launchedBy: string | null
  autoJoin: boolean
  failure: string | null
  meetingReady: boolean
  marks: BotMark[]
  debrief: BotDebrief | null
}

export interface BotMark {
  id: string
  atMs: number | null
  quote: string | null
  speaker: string | null
  note: string | null
}

export interface CaptionLine {
  seq: number
  atMs: number | null
  endMs: number | null
  speaker: string | null
  text: string
  hidden: boolean
}

export const PLATFORM_LABEL: Record<BotSessionView['platform'], string> = {
  meet: 'Google Meet',
  zoom: 'Zoom',
  teams: 'Microsoft Teams',
}

/** LED tone + word for a phase (live = phosphor, scheduled = off, done = mint). */
export function phaseSignal(phase: BotPhase): { tone: SignalTone; word: string } {
  switch (phase) {
    case 'live': return { tone: 'live', word: 'Recording' }
    case 'joining': return { tone: 'ai', word: 'Joining' }
    case 'scheduled': return { tone: 'off', word: 'Scheduled' }
    case 'processing': return { tone: 'ai', word: 'Writing minutes' }
    case 'ready': return { tone: 'mint', word: 'Debrief ready' }
    case 'failed': return { tone: 'brand', word: 'Failed' }
    case 'stopped': return { tone: 'off', word: 'Stopped' }
  }
}

export const isActive = (phase: BotPhase): boolean => phase === 'live' || phase === 'joining'

/** "23:41", or "1:02:05" past an hour. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

/** Time in the call so far (live) or the call's length (after). */
export function elapsedMs(view: Pick<BotSessionView, 'startedAt' | 'endedAt'>, now = Date.now()): number {
  if (!view.startedAt) return 0
  const start = Date.parse(view.startedAt)
  const end = view.endedAt ? Date.parse(view.endedAt) : now
  return Number.isFinite(start) && end > start ? end - start : 0
}

/** Title for a bot run: its own name, else "<Platform> meeting". */
export function runTitle(view: Pick<BotSessionView, 'title' | 'platform'>): string {
  return view.title || `${PLATFORM_LABEL[view.platform] || 'Online'} meeting`
}

/** Fired on window after a launch, so the watcher starts polling at once. */
export const BOT_LAUNCHED_EVENT = 'entomate:bot-launched'

export const meetingPath = (meetingId: string): string => `/meetings/${meetingId}?debrief=1`

// ── Debrief takes focus ─────────────────────────────────────────────

export const SEEN_KEY = 'entomate.bot.debriefSeen'
const FOCUS_WINDOW_MS = 12 * 60 * 60 * 1000

export function readSeen(storage: Pick<Storage, 'getItem'> | null): string[] {
  try {
    const raw = storage?.getItem(SEEN_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function markSeen(storage: Pick<Storage, 'getItem' | 'setItem'> | null, sessionId: string): void {
  try {
    const next = [sessionId, ...readSeen(storage).filter((s) => s !== sessionId)].slice(0, 50)
    storage?.setItem(SEEN_KEY, JSON.stringify(next))
  } catch {
    /* private mode: the debrief may open twice, nothing worse */
  }
}

/**
 * The debrief the app should move to, if any: a run this person sent (or
 * their calendar sent) that ended in the last 12 hours and hasn't been shown
 * yet. Its minutes may still be writing: the meeting page shows that. Newest first.
 */
export function debriefToOpen(
  sessions: ReadonlyArray<BotSessionView>,
  opts: { userId: string | null; seen: ReadonlyArray<string>; now?: number },
): BotSessionView | null {
  const now = opts.now ?? Date.now()
  return sessions.find((s) =>
    (s.phase === 'ready' || s.phase === 'processing')
    && (!opts.userId || !s.launchedBy || s.launchedBy === opts.userId)
    && !opts.seen.includes(s.sessionId)
    && s.endedAt != null
    && now - Date.parse(s.endedAt) < FOCUS_WINDOW_MS,
  ) || null
}
