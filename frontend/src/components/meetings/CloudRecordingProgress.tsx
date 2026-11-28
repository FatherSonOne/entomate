import React from 'react'
import { Key, Signal } from '../bench'

interface Props {
  status?: string
  stage?: string
  tracks?: ReadonlyArray<{ label?: string; status?: string }>
  onRetry?: () => void
  busy?: boolean
}

const trackState: Record<string, string> = {
  processing: 'Processing', saved: 'Saved', partial: 'Partial', missing: 'Unavailable',
}

export function CloudRecordingProgress({ status, stage, tracks, onRetry, busy }: Props) {
  const label = status === 'starting' ? 'Starting cloud recording'
    : status === 'recording' ? 'Recording in cloud'
      : status === 'stopping' ? 'Stopping cloud recording'
        : status === 'processing' ? (stage === 'recap' ? 'Building recap' : 'Saving to cloud storage')
          : status === 'done' ? 'Cloud audio ready'
            : status === 'failed' ? 'Cloud audio needs attention' : null
  if (!label) return null

  return (
    <div className="bs-recstat" role="status" aria-label="Cloud recording progress">
      <Signal tone={status === 'recording' ? 'live' : 'brand'}>{label}</Signal>
      {status === 'processing' && <p className="bs-mut">You can close this tab. Entomate will finish saving the audio.</p>}
      {tracks && tracks.length > 0 && status !== 'done' && <ul aria-label="Participant track progress">
        {tracks.map((track, index) => <li key={index}>{track.label || 'Participant'} · {trackState[track.status || ''] || 'Waiting'}</li>)}
      </ul>}
      {onRetry && <Key disabled={busy} onClick={onRetry}>{busy ? 'Retrying…' : 'Retry processing'}</Key>}
    </div>
  )
}
