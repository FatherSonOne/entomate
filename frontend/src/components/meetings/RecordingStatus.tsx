/**
 * The state of a meeting recorded in the browser, on its meeting page: the transcript
 * being written (the page refreshes itself), a failure with a retry, or a recording whose
 * tab closed before Stop, with a way to transcribe the audio that was saved.
 * Renders nothing for a finished recording or a meeting not recorded in the browser.
 */

import React, { useEffect, useState } from 'react'
import { AlertTriangle, Loader2, RotateCcw } from 'lucide-react'
import {
  canRetry,
  retryRecording,
  salvageRecording,
  toRecordingJob,
} from '../../services/meetingRecorderService'

export interface RecordingStatusProps {
  meetingId: string
  /** `meetings.recording_job`, as the server sent it. */
  recordingJob: unknown
  /** Reload the meeting (fresh, not cached). */
  onRefresh: () => void
}

export const POLL_MS = 5000

const BUTTON =
  'inline-flex min-h-9 items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-content-primary ' +
  'hover:border-line-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary disabled:opacity-50'

export function RecordingStatus({ meetingId, recordingJob, onRefresh }: RecordingStatusProps): React.ReactElement | null {
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

  if (!job || job.status === 'done') return null

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

  return (
    <div role="status" data-testid="recording-status" className="rounded-xl border border-line bg-surface-elevated p-4 text-sm">
      {writing ? (
        <p className="flex items-center gap-2 text-content-primary">
          <Loader2 className="h-4 w-4 animate-spin text-accent-primary" aria-hidden="true" />
          Writing the transcript, speakers, summary and action items. This page updates by itself.
        </p>
      ) : job.status === 'recording' ? (
        <div className="space-y-2">
          <p className="text-content-primary">
            This recording was not stopped, so it has no transcript yet. If the recording tab was closed, the audio saved up to
            then can still be transcribed.
          </p>
          <button type="button" className={BUTTON} disabled={busy} onClick={() => void act(salvageRecording)}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RotateCcw className="h-4 w-4" aria-hidden="true" />}
            Transcribe the saved audio
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="flex items-start gap-2 text-content-primary">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-semantic-error" aria-hidden="true" />
            {job.status === 'failed'
              ? job.error || 'The transcript could not be written.'
              : 'Writing the transcript stopped before it finished.'}
          </p>
          {retryable && (
            <button type="button" className={BUTTON} disabled={busy} onClick={() => void act(retryRecording)}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RotateCcw className="h-4 w-4" aria-hidden="true" />}
              Try again
            </button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-semantic-error">
          {error}
        </p>
      )}
    </div>
  )
}

export default RecordingStatus
