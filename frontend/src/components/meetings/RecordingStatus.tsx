/**
 * The state of a meeting's minutes on its meeting page, whichever engine heard it (the
 * bot or a browser recording): the minutes being written (the page refreshes itself), a
 * failure with a retry, a recording whose tab closed before Stop, with a way to transcribe
 * the audio that was saved, or a recording kept as a backup while the bot writes them.
 * Renders nothing for a finished recording or a meeting not recorded in the browser.
 */

import React, { useEffect, useState } from 'react'
import { Loader2, RotateCcw } from 'lucide-react'
import { Key, Signal } from '../bench'
import {
  canRetry,
  canPlay,
  isRebuildingTranscript,
  retryRecording,
  rewriteSummary,
  salvageRecording,
  toRecordingJob,
} from '../../services/meetingRecorderService'
import { DebriefLoader } from '../bot/DebriefLoader'
import { recordingSource } from '../../services/recordingProgress'

export interface RecordingStatusProps {
  meetingId: string
  /** `meetings.recording_job`, as the server sent it. */
  recordingJob: unknown
  /** Reload the meeting (fresh, not cached). */
  onRefresh: () => void
  /** The meeting already has a summary (so an old summary failure no longer matters). */
  hasSummary?: boolean
  /** A saved transcript can be used to recover minutes from non-recorder imports. */
  hasTranscript?: boolean
  /** For the writing loader's title line and its placeholder speakers. */
  title?: string | null
  attendees?: unknown
}

export const POLL_MS = 5000


export function RecordingStatus({ meetingId, recordingJob, onRefresh, hasSummary = false, hasTranscript = false, title, attendees }: RecordingStatusProps): React.ReactElement | null {
  const job = toRecordingJob(recordingJob)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const retryable = canRetry(job)
  const writing = job?.status === 'transcribing' && !retryable
  const rebuilding = canPlay(recordingJob) && isRebuildingTranscript(job)
  const waiting = writing || rebuilding || job?.status === 'backup'

  useEffect(() => {
    if (!waiting) return
    const timer = window.setInterval(onRefresh, POLL_MS)
    return () => window.clearInterval(timer)
  }, [waiting, onRefresh])

  if (rebuilding) return null
  if (canPlay(recordingJob) && job?.transcriptRebuildError) {
    return <p role="alert" className="bs-recstat-err">{job.transcriptRebuildError}</p>
  }

  const summaryMissing = !hasSummary && ((!job && hasTranscript) || (job?.status === 'done' && !!job.summaryError))
  if (!summaryMissing && (!job || job.status === 'done')) return null

  const act = async (fn: (id: string) => Promise<void>): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await fn(meetingId)
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work. Try again.')
    } finally {
      setBusy(false)
    }
  }

  // While the minutes are written: the same loader as a bot's debrief (steps, stopwatch, typed lines).
  if (writing) {
    return (
      <div data-testid="recording-status" className="bs-recstat-loader">
        <DebriefLoader source={recordingSource(job, title, attendees)} />
      </div>
    )
  }

  const icon = busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RotateCcw aria-hidden="true" />

  return (
    <div role="status" data-testid="recording-status" className="bs-recstat" data-tone="brand">
      {summaryMissing ? (
        <>
          <Signal tone="brand">No summary</Signal>
          <p className="bs-recstat-text">The transcript is saved. Try writing the minutes again to finish the summary and action items.</p>
          <Key disabled={busy} onClick={() => void act(rewriteSummary)} icon={icon}>
            Write the summary
          </Key>
        </>
      ) : job?.status === 'backup' ? (
        <>
          <Signal tone="brand">Backup</Signal>
          <p className="bs-recstat-text">
            The bot was in this call, so it is writing the minutes. Your recording is kept here and is written up on its own
            if the bot cannot finish.
          </p>
          <Key disabled={busy} onClick={() => void act(retryRecording)} icon={icon}>
            Use my recording instead
          </Key>
        </>
      ) : job?.status === 'recording' ? (
        <>
          <Signal tone="brand">Not stopped</Signal>
          <p className="bs-recstat-text">
            This recording was not stopped, so it has no transcript yet. If the recording tab was closed, the audio saved up to
            then can still be transcribed.
          </p>
          <Key disabled={busy} onClick={() => void act(salvageRecording)} icon={icon}>
            Transcribe the saved audio
          </Key>
        </>
      ) : (
        <>
          <Signal tone="brand">{job?.status === 'failed' ? 'Failed' : 'Stopped'}</Signal>
          <p className="bs-recstat-text">
            {job?.status === 'failed'
              ? job.error || 'The transcript could not be written.'
              : 'Writing the transcript stopped before it finished.'}
          </p>
          {retryable && (
            <Key disabled={busy} onClick={() => void act(retryRecording)} icon={icon}>
              Try again
            </Key>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="bs-recstat-err">
          {error}
        </p>
      )}
    </div>
  )
}

export default RecordingStatus
