/**
 * In-browser meeting recorder: the rules and the server calls, without React.
 * Ported from Logos Vision's notetaker recorder (`notetakerCapture.ts`).
 *
 * The browser records audio in 30-second pieces and sends each one as soon as it exists,
 * so a closed tab loses at most one piece. The server joins them, transcribes with
 * speaker turns, and fills the meeting in; `recording_job` on the meeting says how far it is.
 */

import { meetingsApi, recordingsApi } from './api'
import cache from './apiCache'

export type RecorderMode = 'mic' | 'camera' | 'tab'

/** One live piece every 30 s, as Logos Vision does. */
export const PIECE_MS = 30_000
/** The server refuses pieces over 10 MB; at 30 s of audio a piece is far below that. */
export const PIECE_MAX_BYTES = 10 * 1024 * 1024
const AUDIO_BITS_PER_SECOND = 64_000
const VIDEO_BITS_PER_SECOND = 1_500_000

export type RecordingStatus = 'recording' | 'transcribing' | 'done' | 'failed'

export interface RecordingJob {
  status: RecordingStatus
  mode: RecorderMode | null
  error: string | null
  updatedAt: string | null
  speakers: number | null
  /** The transcript was saved but the summary step failed, with this reason. */
  summaryError: string | null
}

const STATUSES: RecordingStatus[] = ['recording', 'transcribing', 'done', 'failed']
const MODES: RecorderMode[] = ['mic', 'camera', 'tab']

/** Reads `meetings.recording_job` defensively. Null for a meeting not recorded here. */
export function toRecordingJob(raw: unknown): RecordingJob | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const status = STATUSES.find((s) => s === r.status)
  if (!status) return null
  return {
    status,
    mode: MODES.find((m) => m === r.mode) ?? null,
    error: typeof r.error === 'string' && r.error ? r.error : null,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : null,
    speakers: typeof r.speakers === 'number' ? r.speakers : null,
    summaryError: typeof r.summaryError === 'string' && r.summaryError ? r.summaryError : null,
  }
}

/** The recording's audio was kept after its transcript and retention has not removed it yet. */
export function canPlay(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
  const r = raw as Record<string, unknown>
  return r.status === 'done' && r.audioKept === true && !r.retentionDeletedAt
}

interface PlaybackResponse {
  mimeType?: unknown
  durationMs?: unknown
  url?: unknown
  pieces?: Array<{ url?: unknown }>
}

export interface RecordingAudio {
  /** A signed link to the server's seekable copy: it streams, and it seeks at once. */
  url?: string
  /** Or, without that copy, the saved pieces joined in memory. */
  blob?: Blob
  durationMs: number
}

/**
 * The recording to play. Usually a signed link to the server's seekable copy. A recording
 * without one (made before the copy existed, or when ffmpeg failed) comes as its pieces:
 * those are fetched by their signed links and joined in order. A later piece alone does not
 * play (only the first has the header), and a Blob in memory seeks well although the
 * recorder's WebM has no index. `onProgress` gets the share of pieces downloaded (0 to 1).
 */
export async function loadRecordingAudio(
  meetingId: string,
  fetcher: typeof fetch = fetch,
  onProgress?: (fraction: number) => void,
): Promise<RecordingAudio> {
  let res: PlaybackResponse
  try {
    cache.invalidate(`/recordings/${meetingId}/playback`)
    res = (await recordingsApi.playback(meetingId)) as unknown as PlaybackResponse
  } catch (err) {
    throw new Error(errorText(err, 'The recording could not be loaded.'))
  }
  const durationMs = typeof res?.durationMs === 'number' ? res.durationMs : 0
  if (typeof res?.url === 'string') return { url: res.url, durationMs }
  const urls = (Array.isArray(res?.pieces) ? res.pieces : []).map((p) => p?.url)
  if (!urls.length || urls.some((u) => typeof u !== 'string')) throw new Error('The recording could not be loaded.')
  let downloaded = 0
  const parts = await Promise.all(
    (urls as string[]).map(async (url) => {
      const r = await fetcher(url)
      if (!r.ok) throw new Error('Part of the recording could not be downloaded. Try again.')
      const part = await r.blob()
      downloaded += 1
      onProgress?.(downloaded / urls.length)
      return part
    }),
  )
  const type = typeof res.mimeType === 'string' ? res.mimeType : 'audio/webm'
  return { blob: new Blob(parts, { type }), durationMs }
}

/** Remove a finished recording's audio for good; the transcript and notes stay. */
export async function removeRecordingAudio(meetingId: string): Promise<void> {
  try {
    await recordingsApi.removeAudio(meetingId)
  } catch (err) {
    throw new Error(errorText(err, 'The audio could not be removed. Try again.'))
  }
}

/** A job still transcribing after this long has died with the server and may be retried. */
export const STALE_JOB_MS = 20 * 60 * 1000

export function canRetry(job: RecordingJob | null, now = Date.now()): boolean {
  if (!job) return false
  if (job.status === 'failed') return true
  if (job.status !== 'transcribing') return false
  const at = job.updatedAt ? Date.parse(job.updatedAt) : NaN
  return !Number.isFinite(at) || now - at > STALE_JOB_MS
}

type IsTypeSupported = (type: string) => boolean

/** The first audio format this browser records that the server can transcribe. */
export function pickAudioMime(isTypeSupported: IsTypeSupported): string | null {
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].find(isTypeSupported) ?? null
}

export function pickVideoMime(isTypeSupported: IsTypeSupported): string | null {
  return ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find(isTypeSupported) ?? null
}

/** The container type without codec parameters, as the server stores it. */
export function baseMime(mime: string): string {
  return mime.split(';')[0]!.trim()
}

/** Tab audio needs `getDisplayMedia` with audio, which phones and tablets do not offer. */
export function tabCaptureSupported(nav: { userAgent?: string; mediaDevices?: { getDisplayMedia?: unknown } } | undefined): boolean {
  return !!nav?.mediaDevices?.getDisplayMedia && !/Android|iPhone|iPad|iPod/i.test(nav.userAgent ?? '')
}

export function recorderOptions(kind: 'audio' | 'video', mimeType: string): MediaRecorderOptions {
  return kind === 'audio'
    ? { mimeType, audioBitsPerSecond: AUDIO_BITS_PER_SECOND }
    : { mimeType, videoBitsPerSecond: VIDEO_BITS_PER_SECOND, audioBitsPerSecond: AUDIO_BITS_PER_SECOND }
}

/** What a failed browser permission or device call means, in words. */
export function captureErrorMessage(err: unknown, mode: RecorderMode): string {
  const name = err && typeof err === 'object' && 'name' in err ? String((err as { name: unknown }).name) : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return mode === 'tab'
      ? 'Sharing was cancelled or blocked. Choose a tab and allow it to record.'
      : `Your browser blocked the ${mode === 'camera' ? 'camera or microphone' : 'microphone'}. Allow it in the address bar and try again.`
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return mode === 'camera' ? 'No camera or microphone was found.' : 'No microphone was found.'
  }
  if (name === 'NotReadableError') return 'Another app is using the device. Close it and try again.'
  if (err instanceof Error && err.message) return err.message
  return 'Recording could not start.'
}

/** Server error text from an api.js error. */
function errorText(err: unknown, fallback: string): string {
  const e = err as { message?: string; originalError?: { response?: { data?: { error?: unknown } } } } | null
  const server = e?.originalError?.response?.data?.error
  if (typeof server === 'string' && server) return server
  return e?.message || fallback
}

export interface StartInput {
  title: string
  attendees: string
  mode: RecorderMode
  mimeType: string
}

export async function startRecording(input: StartInput): Promise<{ meetingId: string }> {
  try {
    const res = (await recordingsApi.start({ ...input, consentAcknowledged: true })) as unknown as { meetingId?: unknown }
    if (typeof res?.meetingId !== 'string') throw new Error('The recording could not be started.')
    cache.invalidate('/meetings')
    return { meetingId: res.meetingId }
  } catch (err) {
    throw new Error(errorText(err, 'The recording could not be started.'))
  }
}

export async function finishRecording(meetingId: string, pieces: number): Promise<void> {
  try {
    await recordingsApi.finish(meetingId, pieces)
    cache.invalidate('/meetings')
  } catch (err) {
    throw new Error(errorText(err, 'The recording could not be finished.'))
  }
}

export async function salvageRecording(meetingId: string): Promise<void> {
  try {
    await recordingsApi.salvage(meetingId)
    cache.invalidate(`/meetings/${meetingId}`)
  } catch (err) {
    throw new Error(errorText(err, 'The saved audio could not be sent for a transcript.'))
  }
}

/** Write the summary again from the saved transcript (the audio is gone by then). */
export async function rewriteSummary(meetingId: string): Promise<void> {
  try {
    await meetingsApi.reprocess(meetingId)
    cache.invalidate(`/meetings/${meetingId}`)
  } catch (err) {
    throw new Error(errorText(err, 'The summary could not be written.'))
  }
}

export async function retryRecording(meetingId: string): Promise<void> {
  try {
    await recordingsApi.retry(meetingId)
    cache.invalidate(`/meetings/${meetingId}`)
  } catch (err) {
    throw new Error(errorText(err, 'The transcript could not be restarted.'))
  }
}

export async function discardRecording(meetingId: string): Promise<void> {
  try {
    await recordingsApi.discard(meetingId)
    cache.invalidate('/meetings')
  } catch (err) {
    throw new Error(errorText(err, 'The recording could not be discarded.'))
  }
}

type SendPiece = (seq: number, durationMs: number, blob: Blob) => Promise<void>

export interface UploaderState {
  /** Pieces recorded so far. */
  recorded: number
  /** Pieces the server has. */
  sent: number
  /** The last send failed and is being retried. */
  retrying: boolean
  /** The server refused a piece for good (e.g. the recording was closed); sending stopped. */
  failed: string | null
}

/** A 4xx other than timeout or rate limit will not succeed on a retry. */
function isPermanent(err: unknown): boolean {
  const status = (err as { status?: unknown } | null)?.status
  return typeof status === 'number' && status >= 400 && status < 500 && status !== 408 && status !== 429
}

/**
 * Sends pieces in order, one at a time, retrying each until it lands. A piece stays in
 * memory until the server has it, so a dropped connection only delays the upload.
 */
export class PieceUploader {
  private queue: Array<{ seq: number; durationMs: number; blob: Blob }> = []
  private recorded = 0
  private sent = 0
  private retrying = false
  private failed: string | null = null
  private pumping: Promise<void> | null = null
  private stopped = false

  constructor(
    private readonly send: SendPiece,
    private readonly onChange: (state: UploaderState) => void = () => {},
    private readonly retryDelayMs: (attempt: number) => number = (n) => Math.min(30_000, 1000 * 2 ** n),
  ) {}

  get state(): UploaderState {
    return { recorded: this.recorded, sent: this.sent, retrying: this.retrying, failed: this.failed }
  }

  add(blob: Blob, durationMs: number): void {
    if (blob.size === 0) return
    this.queue.push({ seq: this.recorded++, durationMs: Math.max(0, Math.min(120_000, Math.round(durationMs))), blob })
    this.onChange(this.state)
    void this.pump()
  }

  /** Resolves once every recorded piece is on the server. */
  async drain(): Promise<void> {
    while (this.queue.length && !this.failed && !this.stopped) await this.pump()
    if (this.failed) throw new Error(this.failed)
  }

  /** Stop retrying (the recording was discarded). */
  cancel(): void {
    this.stopped = true
    this.queue = []
  }

  private pump(): Promise<void> {
    if (!this.pumping) {
      this.pumping = this.run().finally(() => {
        this.pumping = null
      })
    }
    return this.pumping
  }

  private async run(): Promise<void> {
    let attempt = 0
    while (this.queue.length && !this.stopped && !this.failed) {
      const next = this.queue[0]!
      try {
        await this.send(next.seq, next.durationMs, next.blob)
        this.queue.shift()
        this.sent += 1
        attempt = 0
        this.retrying = false
      } catch (err) {
        if (isPermanent(err)) {
          this.failed = errorText(err, 'The server stopped accepting this recording.')
          this.retrying = false
          this.onChange(this.state)
          return
        }
        this.retrying = true
        this.onChange(this.state)
        await new Promise((r) => setTimeout(r, this.retryDelayMs(attempt++)))
        continue
      }
      this.onChange(this.state)
    }
  }
}

export function sendPieceTo(meetingId: string, contentType: string): SendPiece {
  return async (seq, durationMs, blob) => {
    await recordingsApi.uploadPiece(meetingId, seq, durationMs, blob, contentType)
  }
}
