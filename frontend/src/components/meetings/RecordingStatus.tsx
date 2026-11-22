/**
 * The state of a meeting recorded in the browser, on its meeting page: the transcript
 * being written (the page refreshes itself), a failure with a retry, or a recording whose
 * tab closed before Stop, with a way to transcribe the audio that was saved.
 * Renders nothing for a finished recording or a meeting not recorded in the browser.
 */

import React, { useEffect, useState } from 'react'
import { Loader2, RotateCcw } from 'lucide-react'
import { Key, Signal } from '../bench'
import {
  canRetry,
  retryRecording,
  rewriteSummary,
  salvageRecording,
  toRecordingJob,
} from '../../services/meetingRecorderService'

export interface RecordingStatusProps {
  meetingId: string
  /** `meetings.recording_job`, as the server sent it. */
  recordingJob: unknown
  /** Reload the meeting (fresh, not cached). */
  onRefresh: () => void
  /** The meeting already has a summary (so an old summary failure no longer matters). */
  hasSummary?: boolean
}

export const POLL_MS = 5000


export function RecordingStatus({ meetingId, recordingJob, onRefresh, hasSummary = false }: RecordingStatusProps): React.ReactElement | null {
  const job = toRecordingJob(recordingJob)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const retryable = canRetry(job)
  const writing = job?.status === 'transcribing' && !retryable

  useEffect(() => {
    if (!writing) return
    const timer = window.setInterval(onRefresh, POLL_MS)
    return () => window.clearInterval(timer)
  }, [writing, onRefresh])

  const summaryMissing = job?.status === 'done' && !!job.summaryError && !hasSummary
  if (!job || (job.status === 'done' && !summaryMissing)) return null

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

  const icon = busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RotateCcw aria-hidden="true" />

  return (
    <div role="status" data-testid="recording-status" className="bs-recstat" data-tone={writing ? 'live' : 'brand'}>
      {summaryMissing ? (
        <>
          <Signal tone="brand">No summary</Signal>
          <p className="bs-recstat-text">The transcript is saved, but the summary, decisions and action items could not be written.</p>
          <Key disabled={busy} onClick={() => void act(rewriteSummary)} icon={icon}>
            Write the summary
          </Key>
        </>
      ) : writing ? (
        <>
          <Signal tone="live">Writing</Signal>
          <p className="bs-recstat-text">Writing the transcript, speakers, summary and action items. This page updates by itself.</p>
          <Loader2 className="bs-recstat-spin animate-spin" aria-hidden="true" />
        </>
      ) : job.status === 'recording' ? (
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
          <Signal tone="brand">{job.status === 'failed' ? 'Failed' : 'Stopped'}</Signal>
          <p className="bs-recstat-text">
            {job.status === 'failed'
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
