/**
 * In-browser meeting recorder: the rules and the server calls, without React.
 * Ported from Logos Vision's notetaker recorder (`notetakerCapture.ts`).
 *
 * The browser records audio in 30-second pieces and sends each one as soon as it exists,
 * so a closed tab loses at most one piece. The server joins them, transcribes with
 * speaker turns, and fills the meeting in; `recording_job` on the meeting says how far it is.
 */

import { meetingsApi, recordingsApi } from './api'
import { ISOLATED_AUDIO_TRACKS, readRecordingGaps, roomParticipantTracks, type AudioGap, type AudioTracks, type IsolatedAudioTrack, type PlaybackTrack, type RecordingGaps, type TrackCoverage } from './recordingAudioTracks'
import { lockRecording, recordingJournal, type RecordingPiece } from './recordingJournal'
import cache from './apiCache'

export type RecorderMode = 'mic' | 'camera' | 'tab'

/** One live piece every 30 s, as Logos Vision does. */
export const PIECE_MS = 30_000
/** The server refuses pieces over 10 MB; at 30 s of audio a piece is far below that. */
export const PIECE_MAX_BYTES = 10 * 1024 * 1024
const AUDIO_BITS_PER_SECOND = 64_000
const VIDEO_BITS_PER_SECOND = 1_500_000

/** `backup`: recorded beside the bot, which writes the minutes; this audio waits in case it cannot. */
export type RecordingStatus = 'recording' | 'transcribing' | 'stopping' | 'processing' | 'backup' | 'done' | 'failed'
/** Which engine is writing (or wrote) the minutes: the Recall bot, or this browser's recording. */
export type RecordingSource = 'bot' | 'browser' | 'room'

export interface RecordingJob {
  status: RecordingStatus
  /** Null for recordings made before the source was saved: those are browser recordings. */
  source: RecordingSource | null
  mode: RecorderMode | null
  error: string | null
  updatedAt: string | null
  speakers: number | null
  /** The transcript was saved but the summary step failed, with this reason. */
  summaryError: string | null
  /** While transcribing: how far the server has got. Null before the run starts. */
  stage: RecordingStage | null
  /** When the current stage began, ISO. */
  stageAt: string | null
  /** When Stop was pressed and transcribing began, ISO. */
  finishedAt: string | null
  /** Length of the recording, ms. */
  durationMs: number
  audioTracks?: AudioTracks
  audioGaps?: AudioGap[]
  roomOffsetMs?: number
  roomCapture?: 'daily'
  cloudStage?: string
  cloudCanRetry?: boolean
  startedBy?: string
  transcriptRebuildAt?: string
  transcriptRebuildError?: string
  transcriptRebuiltAt?: string
  transcriptRebuildProgress?: TranscriptRebuildProgress
}

export type { AudioTracks } from './recordingAudioTracks'
interface RecordingCoverage extends Pick<TrackCoverage, 'pieces' | 'durationMs'> { audioTracks?: AudioTracks }
export type RecoveryProgress = Partial<Record<'mix' | IsolatedAudioTrack, { savedMs: number; sentMs: number }>>

function readAudioTracks(raw: unknown, keys: readonly PlaybackTrack[] = ISOLATED_AUDIO_TRACKS): AudioTracks {
  const tracks: AudioTracks = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return tracks
  for (const track of keys) {
    const value = (raw as AudioTracks)[track]
    if (!value) continue
    const label = typeof value.label === 'string' ? value.label.trim() : ''
    const status = value.status === 'partial' || value.status === 'saved' || value.status === 'processing' || value.status === 'missing' ? value.status : undefined
    const playable = Number.isSafeInteger(value.pieces) && value.pieces > 0 && Number.isSafeInteger(value.durationMs) && value.durationMs >= 0
    if (!playable && status !== 'missing' && status !== 'processing') continue
    tracks[track] = { pieces: playable ? value.pieces : 0, durationMs: playable ? value.durationMs : 0,
      ...(label ? { label } : {}), ...(status ? { status } : {}),
    }
  }
  return tracks
}

export interface TranscriptRebuildProgress {
  stage: 'transcribing' | 'saving'
  processedMs: number
  totalMs: number
}

export type RecordingStage = 'transcript' | 'speakers' | 'summary' | 'saving'
const STAGES: RecordingStage[] = ['transcript', 'speakers', 'summary', 'saving']

const STATUSES: RecordingStatus[] = ['recording', 'transcribing', 'stopping', 'processing', 'backup', 'done', 'failed']
const MODES: RecorderMode[] = ['mic', 'camera', 'tab']

/** Reads `meetings.recording_job` defensively. Null for a meeting not recorded here. */
export function toRecordingJob(raw: unknown): RecordingJob | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const status = STATUSES.find((s) => s === r.status)
  if (!status) return null
  const audioGaps = readRecordingGaps(r, typeof r.durationMs === 'number' ? r.durationMs : 0)
  const progress = r.transcriptRebuildProgress as Partial<TranscriptRebuildProgress> | null | undefined
  const validProgress = progress && (progress.stage === 'transcribing' || progress.stage === 'saving')
    && typeof progress.totalMs === 'number' && Number.isFinite(progress.totalMs) && progress.totalMs >= 0
    && typeof progress.processedMs === 'number' && Number.isFinite(progress.processedMs) && progress.processedMs >= 0 && progress.processedMs <= progress.totalMs
  return {
    status,
    source: r.source === 'bot' || r.source === 'browser' || r.source === 'room' ? r.source : null,
    mode: MODES.find((m) => m === r.mode) ?? null,
    error: typeof r.error === 'string' && r.error ? r.error : null,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : null,
    speakers: typeof r.speakers === 'number' ? r.speakers : null,
    summaryError: typeof r.summaryError === 'string' && r.summaryError ? r.summaryError : null,
    stage: STAGES.find((x) => x === r.stage) ?? null,
    stageAt: typeof r.stageAt === 'string' ? r.stageAt : null,
    finishedAt: typeof r.finishedAt === 'string' ? r.finishedAt : null,
    ...(typeof r.transcriptRebuildAt === 'string' ? { transcriptRebuildAt: r.transcriptRebuildAt } : {}),
    ...(typeof r.transcriptRebuildError === 'string' ? { transcriptRebuildError: r.transcriptRebuildError } : {}),
    ...(typeof r.transcriptRebuiltAt === 'string' ? { transcriptRebuiltAt: r.transcriptRebuiltAt } : {}),
    ...(validProgress ? { transcriptRebuildProgress: progress as TranscriptRebuildProgress } : {}),
    durationMs: typeof r.durationMs === 'number' && r.durationMs > 0 ? r.durationMs : 0,
    ...(r.audioTracks || r.splitAudio === true ? { audioTracks: readAudioTracks(r.audioTracks) } : {}),
    ...(r.source === 'room' ? {
      audioTracks: readAudioTracks(r.participantTracks, roomParticipantTracks(r.participantTracks)),
      roomOffsetMs: typeof r.roomOffsetMs === 'number' && r.roomOffsetMs >= 0 ? r.roomOffsetMs : 0,
    } : {}),
    ...(r.source === 'room' && r.roomCapture === 'daily' ? {
      roomCapture: 'daily' as const,
      cloudStage: typeof r.cloudStage === 'string' ? r.cloudStage : undefined,
      cloudCanRetry: r.status === 'failed' && (r.cloudResumeStatus === 'stopping' || r.cloudResumeStatus === 'processing'),
      startedBy: typeof r.startedBy === 'string' ? r.startedBy : undefined,
    } : {}),
    ...(audioGaps.length ? { audioGaps } : {}),
  }
}

/** The recording's audio was kept after its transcript and retention has not removed it yet. */
export function canPlay(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
  const r = raw as Record<string, unknown>
  return r.status === 'done' && r.audioKept === true && !r.retentionDeletedAt && !r.audioRemovedAt
}

interface PlaybackResponse {
  mimeType?: unknown
  durationMs?: unknown
  url?: unknown
  serverWaveform?: unknown
  pieces?: Array<{ url?: unknown }>
}

export interface RecordingAudio {
  /** A signed link to the server's seekable copy: it streams, and it seeks at once. */
  url?: string
  /** Or, without that copy, the saved pieces joined in memory. */
  blob?: Blob
  durationMs: number
  serverWaveform?: true
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
  signal?: AbortSignal,
  track?: PlaybackTrack,
): Promise<RecordingAudio> {
  let res: PlaybackResponse
  try {
    cache.invalidate(`/recordings/${meetingId}/playback`)
    res = (await (track ? recordingsApi.playback(meetingId, track) : recordingsApi.playback(meetingId))) as unknown as PlaybackResponse
  } catch (err) {
    throw new Error(errorText(err, 'The recording could not be loaded.'))
  }
  signal?.throwIfAborted()
  const durationMs = typeof res?.durationMs === 'number' ? res.durationMs : 0
  if (typeof res?.url === 'string') {
    return { url: res.url, durationMs, ...(res.serverWaveform === true ? { serverWaveform: true } : {}) }
  }
  const urls = (Array.isArray(res?.pieces) ? res.pieces : []).map((p) => p?.url)
  if (!urls.length || urls.some((u) => typeof u !== 'string')) throw new Error('The recording could not be loaded.')
  let downloaded = 0
  const parts = await Promise.all(
    (urls as string[]).map(async (url) => {
      const r = await fetcher(url, { signal })
      if (!r.ok) throw new Error('Part of the recording could not be downloaded. Try again.')
      // Bytes, not a Blob: a Blob from fetch and the page's Blob can be
      // different classes (jsdom), and new Blob() would stringify it.
      const part = await r.arrayBuffer()
      downloaded += 1
      onProgress?.(downloaded / urls.length)
      return part
    }),
  )
  const type = typeof res.mimeType === 'string' ? res.mimeType : 'audio/webm'
  return { blob: new Blob(parts, { type }), durationMs }
}

export async function loadRecordingWaveformPeaks(meetingId: string, signal: AbortSignal, track?: PlaybackTrack): Promise<number[]> {
  const result = (await (track ? recordingsApi.waveform(meetingId, signal, track) : recordingsApi.waveform(meetingId, signal))) as unknown as { peaks?: unknown }
  const peaks = toWaveformPeaks(result?.peaks)
  if (!peaks) throw new Error('Waveform unavailable')
  return peaks
}

export function toWaveformPeaks(peaks: unknown): number[] | null {
  if (!Array.isArray(peaks) || !peaks.length || peaks.length > 160 ||
      !peaks.every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1)) {
    return null
  }
  return peaks
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

export function isRebuildingTranscript(job: RecordingJob | null): boolean {
  const started = Date.parse(job?.transcriptRebuildAt ?? '')
  const lastProgress = Date.parse(job?.updatedAt ?? '') || 0
  return Number.isFinite(started) && Date.now() - Math.max(started, lastProgress) < STALE_JOB_MS
}

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
  /** Add this recording to that bot's meeting (one call, one meeting). */
  botSessionId?: string
  /** The person says this is a different meeting from the bot's. */
  separate?: boolean
  splitAudio?: boolean
}

/** A bot of the person's in a call now, or about to join one. */
export interface BotInCall {
  sessionId: string
  meetingId: string
  title: string | null
  platform: string | null
  phase: 'live' | 'joining' | 'scheduled'
  joinAt: string | null
}

export function toBotInCall(raw: unknown): BotInCall | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  if (typeof r.sessionId !== 'string' || typeof r.meetingId !== 'string') return null
  const phase = r.phase === 'live' || r.phase === 'joining' || r.phase === 'scheduled' ? r.phase : 'joining'
  return {
    sessionId: r.sessionId,
    meetingId: r.meetingId,
    title: typeof r.title === 'string' && r.title ? r.title : null,
    platform: typeof r.platform === 'string' && r.platform ? r.platform : null,
    phase,
    joinAt: typeof r.joinAt === 'string' ? r.joinAt : null,
  }
}

/** Is a bot of mine in a call right now? A failed check is "no": the server checks again on start. */
export async function checkBotInCall(): Promise<BotInCall | null> {
  try {
    const res = (await recordingsApi.botCheck()) as unknown as { bot?: unknown }
    return toBotInCall(res?.bot)
  } catch {
    return null
  }
}

/** Start refused because a bot is in a call: the recorder asks which meeting this is. */
export class BotInCallError extends Error {
  readonly bot: BotInCall
  constructor(message: string, bot: BotInCall) {
    super(message)
    this.name = 'BotInCallError'
    this.bot = bot
  }
}

export async function startRecording(input: StartInput): Promise<{ meetingId: string }> {
  try {
    const res = (await recordingsApi.start({ ...input, consentAcknowledged: true })) as unknown as { meetingId?: unknown }
    if (typeof res?.meetingId !== 'string') throw new Error('The recording could not be started.')
    cache.invalidate('/meetings')
    return { meetingId: res.meetingId }
  } catch (err) {
    const data = (err as { originalError?: { response?: { data?: { code?: unknown; bot?: unknown } } } } | null)?.originalError?.response?.data
    const bot = data?.code === 'bot_in_call' ? toBotInCall(data.bot) : null
    if (bot) throw new BotInCallError(errorText(err, 'The bot is already in this call.'), bot)
    throw new Error(errorText(err, 'The recording could not be started.'))
  }
}

export async function finishRecording(meetingId: string, pieces: number, gaps?: RecordingGaps): Promise<RecordingCoverage | undefined> {
  try {
    const response = (gaps?.micAudioGaps?.length || gaps?.tabAudioGaps?.length
      ? await recordingsApi.finish(meetingId, pieces, gaps) : await recordingsApi.finish(meetingId, pieces)) as unknown as RecordingCoverage | undefined
    cache.invalidate('/meetings')
    return typeof response?.durationMs === 'number' ? response : undefined
  } catch (err) {
    throw new Error(errorText(err, 'The recording could not be sent.'))
  }
}

export function receivedRecordingTracks(coverage: RecordingCoverage): RecoveryProgress {
  const result: RecoveryProgress = { mix: { savedMs: 0, sentMs: coverage.durationMs } }
  if (coverage.audioTracks) {
    for (const track of ISOLATED_AUDIO_TRACKS) {
      result[track] = { savedMs: 0, sentMs: coverage.audioTracks[track]?.durationMs ?? 0 }
    }
  }
  return result
}

export async function recoverRecording(
  id: string, userId: string, onProgress?: (tracks: RecoveryProgress) => void,
): Promise<RecoveryProgress> {
  const release = await lockRecording(id)
  if (!release) throw new Error('This recording is open in another tab. Finish it there or close that tab.')
  try {
    const saved = await recordingJournal.read(id)
    if (!saved || saved.recording.userId !== userId) throw new Error('This recording is no longer available on this device.')
    const cloud = (await recordingsApi.recovery(id)) as unknown as RecordingCoverage & { status: RecordingStatus }
    let progress: RecoveryProgress = {}
    if (cloud.status === 'recording') {
      const makePlan = (coverage: RecordingCoverage, track?: IsolatedAudioTrack, maxPieces = Infinity) => {
        const pending: RecordingPiece[] = []
        let next = coverage.pieces
        for (const piece of saved.pieces) {
          if (piece.track !== track || piece.seq < next) continue
          if (piece.seq !== next || next >= maxPieces) break
          pending.push(piece)
          next += 1
        }
        const name: 'mix' | IsolatedAudioTrack = track ?? 'mix'
        progress[name] = {
          savedMs: pending.reduce((total, piece) => total + piece.durationMs, coverage.durationMs),
          sentMs: coverage.durationMs,
        }
        return { coverage, pending, name, track }
      }
      const mix = makePlan(cloud)
      const count = cloud.pieces + mix.pending.length
      if (!count) throw new Error('No continuous audio could be recovered.')
      const tracks = readAudioTracks(cloud.audioTracks)
      const sides = cloud.audioTracks ? ISOLATED_AUDIO_TRACKS.map(track =>
        makePlan(tracks[track] ?? { pieces: 0, durationMs: 0 }, track, count)) : []
      onProgress?.({ ...progress })
      const uploadMissing = async ({ coverage, pending, name, track }: ReturnType<typeof makePlan>): Promise<void> => {
        const send = sendPieceTo(id, saved.recording.mimeType, track)
        let durationMs = coverage.durationMs
        for (const piece of pending) {
          try { await send(piece.seq, piece.durationMs, piece.blob) } catch (err) {
            if (track && isPermanent(err)) break
            throw err
          }
          durationMs += piece.durationMs
          const acknowledged = track ? recordingJournal.acknowledge(id, piece.seq, durationMs, track)
            : recordingJournal.acknowledge(id, piece.seq, durationMs)
          await acknowledged.catch(() => {})
          progress[name] = { savedMs: progress[name]!.savedMs, sentMs: durationMs }
          onProgress?.({ ...progress })
        }
      }
      await uploadMissing(mix)
      const uploaded = await Promise.allSettled(sides.map(uploadMissing))
      for (const result of uploaded) if (result.status === 'rejected') throw result.reason
      const { micAudioGaps, tabAudioGaps } = saved.recording
      const finished = await finishRecording(id, count, { micAudioGaps, tabAudioGaps })
      if (finished) progress = receivedRecordingTracks(finished)
    } else if (typeof cloud.durationMs === 'number') {
      progress = receivedRecordingTracks(cloud)
    }
    await recordingJournal.remove(id).catch(() => {})
    return progress
  } catch (err) {
    throw new Error(errorText(err, 'The saved recording could not be recovered.'))
  } finally {
    release()
  }
}

export async function salvageRecording(meetingId: string, recoveryUserId?: string, onProgress?: (tracks: RecoveryProgress) => void): Promise<void> {
  try {
    const saved = recoveryUserId ? await recordingJournal.list(recoveryUserId).catch(() => []) : []
    if (recoveryUserId && saved.some(recording => recording.id === meetingId)) {
      await recoverRecording(meetingId, recoveryUserId, onProgress)
    } else {
      await recordingsApi.salvage(meetingId)
    }
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

export async function rebuildRecordingTranscript(meetingId: string): Promise<void> {
  try {
    await recordingsApi.rebuildTranscript(meetingId)
  } catch (err) {
    throw new Error(errorText(err, 'The transcript could not be rebuilt.'))
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
  sentMs: number
  savedMs: number
  localSaveFailed: boolean
  /** The last send failed and is being retried. */
  retrying: boolean
  /** The server refused a piece for good (e.g. the recording was closed); sending stopped. */
  failed: string | null
}

export const EMPTY_UPLOAD: UploaderState = {
  recorded: 0, sent: 0, sentMs: 0, savedMs: 0, localSaveFailed: false, retrying: false, failed: null,
}

/** A 4xx other than timeout or rate limit will not succeed on a retry. */
function isPermanent(err: unknown): boolean {
  const status = (err as { status?: unknown } | null)?.status
  return typeof status === 'number' && status >= 400 && status < 500 && status !== 408 && status !== 429
}

/**
 * Sends pieces in order, retrying each until it lands. Store a recoverable copy before
 * upload when the recorder has an open journal.
 */
export class PieceUploader {
  private queue: Array<RecordingPiece & { saved: Promise<void> }> = []
  private recorded = 0
  private recordedMs = 0
  private sent = 0
  private sentMs = 0
  private savedMs = 0
  private localSaveFailed = false
  private retrying = false
  private failed: string | null = null
  private pumping: Promise<void> | null = null
  private stopped = false

  constructor(
    private readonly send: SendPiece,
    private readonly onChange: (state: UploaderState) => void = () => {},
    private readonly retryDelayMs: (attempt: number) => number = (n) => Math.min(30_000, 1000 * 2 ** n),
    private readonly journalId?: string,
    private readonly track?: IsolatedAudioTrack,
  ) {}

  get state(): UploaderState {
    return {
      recorded: this.recorded, sent: this.sent, sentMs: this.sentMs, savedMs: this.savedMs,
      localSaveFailed: this.localSaveFailed, retrying: this.retrying, failed: this.failed,
    }
  }

  add(blob: Blob, durationMs: number): void {
    if (blob.size === 0 || this.stopped) return
    const piece = { seq: this.recorded++, durationMs: Math.max(0, Math.min(120_000, Math.round(durationMs))), blob,
      ...(this.track ? { track: this.track } : {}) }
    this.recordedMs += piece.durationMs
    const saved = this.journalId
      ? recordingJournal.append(this.journalId, piece, this.recordedMs).then(ms => {
        this.savedMs = Math.max(this.savedMs, ms)
        if (!this.stopped) this.onChange(this.state)
      }, () => {
        this.localSaveFailed = true
        if (!this.stopped) this.onChange(this.state)
      })
      : Promise.resolve()
    this.queue.push({ ...piece, saved })
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
        await next.saved
        if (this.stopped) return
        await this.send(next.seq, next.durationMs, next.blob)
        if (this.stopped) return
        this.queue.shift()
        this.sent += 1
        this.sentMs += next.durationMs
        if (this.journalId) {
          const acknowledged = this.track ? recordingJournal.acknowledge(this.journalId, next.seq, this.sentMs, this.track)
            : recordingJournal.acknowledge(this.journalId, next.seq, this.sentMs)
          await acknowledged.catch(() => {})
        }
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

export function sendPieceTo(meetingId: string, contentType: string, track?: PlaybackTrack): SendPiece {
  return async (seq, durationMs, blob) => {
    if (track) await recordingsApi.uploadPiece(meetingId, seq, durationMs, blob, contentType, track)
    else await recordingsApi.uploadPiece(meetingId, seq, durationMs, blob, contentType)
  }
}
