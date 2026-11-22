/**
 * Plays a meeting recorded in the browser, beside its transcript. Ported in spirit from
 * Logos Vision `NotetakerPlaybackPanel.tsx`, played with the browser's own controls
 * (keyboard and screen-reader ready, and neutral to the design style).
 *
 * Usually the audio streams from a short-lived signed link to the server's seekable copy.
 * An older recording without that copy downloads its saved pieces and joins them in memory
 * (an hour is about 29 MB), with the progress shown. Nothing loads until "Play the
 * recording" or a timecode is pressed. The page reads the position (whole seconds) to mark
 * the line being spoken, and calls `playFrom` when a transcript line or timecode is chosen.
 */

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { AlertTriangle, Loader2, Play, RotateCcw } from 'lucide-react'
import { formatClock } from '../../services/meetingTranscriptService'
import { loadRecordingAudio, removeRecordingAudio } from '../../services/meetingRecorderService'

export interface RecordingPlayerHandle {
  /** The audio is loaded, so a timecode can move it. */
  isReady: () => boolean
  /** Play from this moment (ms from the start); loads the recording first if needed. */
  playFrom: (atMs: number) => void
}

export interface RecordingPlayerProps {
  meetingId: string
  /** Length from `recording_job.durationMs`, shown before the audio loads. */
  durationMs?: number | null
  /** The playing position in whole seconds, as ms; null before anything plays. */
  onTime?: (atMs: number | null) => void
  /** When given, offers "Remove audio"; called after the audio is removed. */
  onAudioRemoved?: () => void
}

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

const BUTTON =
  'inline-flex min-h-9 items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-content-primary ' +
  'hover:border-line-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary disabled:opacity-50'
const QUIET_BUTTON =
  'inline-flex min-h-8 items-center rounded px-1 text-xs text-content-secondary hover:text-content-primary ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary disabled:opacity-50'

export const RecordingPlayer = forwardRef<RecordingPlayerHandle, RecordingPlayerProps>(function RecordingPlayer(
  { meetingId, durationMs, onTime, onAudioRemoved },
  ref,
) {
  const [state, setState] = useState<LoadState>('idle')
  const [url, setUrl] = useState<string | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [removing, setRemoving] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const pending = useRef<number | null>(null)
  // MediaRecorder WebM has no duration: seek past the end once so the browser measures it.
  const measuring = useRef(false)
  const lastSecond = useRef<number | null>(null)
  // A streamed link that failed was renewed once; playing again allows the next renewal.
  const renewed = useRef(false)

  useEffect(() => () => {
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
  }, [url])

  const fetchAudio = async (): Promise<string> => {
    setProgress(null)
    const audio = await loadRecordingAudio(meetingId, fetch, setProgress)
    if (audio.url) return audio.url
    return URL.createObjectURL(audio.blob!)
  }

  const load = async (): Promise<void> => {
    if (state === 'loading' || state === 'ready') return
    setState('loading')
    setError(null)
    try {
      setUrl(await fetchAudio())
      setState('ready')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The recording could not be loaded.')
      setState('error')
    }
  }

  const seekNow = (audio: HTMLAudioElement, atMs: number): void => {
    audio.currentTime = Math.max(0, atMs) / 1000
    void audio.play().catch(() => {})
  }

  useImperativeHandle(ref, () => ({
    isReady: () => state === 'ready',
    playFrom: (atMs: number) => {
      const audio = audioRef.current
      if (state === 'ready' && audio && !measuring.current) return seekNow(audio, atMs)
      pending.current = atMs
      void load()
    },
  }))

  const onLoadedMetadata = (): void => {
    const audio = audioRef.current
    if (!audio) return
    if (!Number.isFinite(audio.duration)) {
      measuring.current = true
      audio.currentTime = 1e101
      return
    }
    applyPending(audio)
  }

  const onDurationChange = (): void => {
    const audio = audioRef.current
    if (!audio || !measuring.current || !Number.isFinite(audio.duration)) return
    measuring.current = false
    audio.currentTime = 0
    applyPending(audio)
  }

  const applyPending = (audio: HTMLAudioElement): void => {
    if (pending.current === null) return
    const atMs = pending.current
    pending.current = null
    seekNow(audio, atMs)
  }

  const onTimeUpdate = (): void => {
    const audio = audioRef.current
    if (!audio || measuring.current) return
    const second = Math.floor(audio.currentTime)
    if (second === lastSecond.current) return
    lastSecond.current = second
    onTime?.(second * 1000)
  }

  // A signed link lasts an hour; a long pause can outlive it. Get a new one and carry on.
  const onError = async (): Promise<void> => {
    const audio = audioRef.current
    if (url && !url.startsWith('blob:') && !renewed.current) {
      renewed.current = true
      pending.current = audio ? Math.round(audio.currentTime * 1000) : null
      try {
        setUrl(await fetchAudio())
        return
      } catch {
        // Falls through to the error below.
      }
    }
    setUrl(null)
    setError('The recording could not be played. Try again.')
    setState('error')
  }

  const remove = async (): Promise<void> => {
    setRemoving(true)
    setError(null)
    try {
      await removeRecordingAudio(meetingId)
      onAudioRemoved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The audio could not be removed. Try again.')
      setRemoving(false)
      setConfirmRemove(false)
    }
  }

  const removeControl = onAudioRemoved && (
    <div className="flex flex-wrap items-center justify-end gap-1 text-xs">
      {confirmRemove ? (
        <>
          <span className="text-content-secondary">Remove the audio for good? The transcript and notes stay.</span>
          <button type="button" className={`${QUIET_BUTTON} text-semantic-error`} onClick={() => void remove()} disabled={removing}>
            {removing ? 'Removing…' : 'Remove audio'}
          </button>
          <button type="button" className={QUIET_BUTTON} onClick={() => setConfirmRemove(false)} disabled={removing}>
            Keep
          </button>
        </>
      ) : (
        <button type="button" className={QUIET_BUTTON} onClick={() => setConfirmRemove(true)}>
          Remove audio
        </button>
      )}
    </div>
  )

  const errorLine = error && (
    <p role="alert" className="flex items-center gap-1.5 text-sm text-semantic-error">
      <AlertTriangle className="h-4 w-4 flex-shrink-0" aria-hidden="true" /> {error}
    </p>
  )

  if (state === 'ready' && url) {
    return (
      <div className="mb-3 space-y-1">
        <audio
          ref={audioRef}
          src={url}
          controls
          preload="auto"
          aria-label="Meeting recording"
          data-testid="recording-player"
          className="w-full"
          onLoadedMetadata={onLoadedMetadata}
          onDurationChange={onDurationChange}
          onTimeUpdate={onTimeUpdate}
          onPlaying={() => {
            renewed.current = false
          }}
          onError={() => void onError()}
        />
        {errorLine}
        {removeControl}
      </div>
    )
  }

  const loadingLabel = progress === null ? 'Loading the recording' : `Loading the recording, ${Math.round(progress * 100)}%`
  return (
    <div className="mb-3 space-y-1">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={BUTTON} onClick={() => void load()} disabled={state === 'loading'}>
          {state === 'loading' ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : state === 'error' ? (
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Play className="h-4 w-4" aria-hidden="true" />
          )}
          {state === 'loading' ? loadingLabel : state === 'error' ? 'Try again' : 'Play the recording'}
        </button>
        {state === 'idle' && typeof durationMs === 'number' && durationMs > 0 && (
          <span className="text-xs tabular-nums text-content-secondary">{formatClock(durationMs)} of audio</span>
        )}
        {errorLine}
      </div>
      {state !== 'loading' && removeControl}
    </div>
  )
})

export default RecordingPlayer
