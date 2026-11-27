import React from 'react'
import { formatClock } from '../../services/meetingTranscriptService'
import { ISOLATED_AUDIO_TRACKS, TRACK_LABELS, type RecordingTrack } from '../../services/recordingAudioTracks'

export type TrackSaveStates = Partial<Record<RecordingTrack, {
  savedMs: number
  sentMs?: number
  recorded?: number
  sent?: number
  failed?: boolean | string | null
  retrying?: boolean
  localSaveFailed?: boolean
}>>

export function TrackSaveStatus({ tracks, final, sending }: {
  tracks: TrackSaveStates
  final?: boolean
  sending?: boolean
}): React.ReactElement {
  const total = tracks.mix?.sentMs ?? 0
  return (
    <ul aria-label="Track save status" className="space-y-1 text-xs">
      {(['mix', ...ISOLATED_AUDIO_TRACKS] as const).map(track => {
        const state = tracks[track]
        if (!state) return null
        const sent = state.sentMs ?? 0
        const localPending = state.savedMs > sent
        const uploading = sending && (localPending || (state.recorded ?? 0) > (state.sent ?? 0))
        const status = final
          ? !sent ? 'Unavailable' : sent < total ? 'Partial' : 'Ready'
          : state.failed ? 'Save interrupted' : state.retrying ? 'Retrying upload' : uploading ? 'Uploading'
            : localPending ? 'Ready to recover' : sent ? 'Saved' : 'Waiting for audio'
        return (
          <li key={track} className="break-words">
            <strong className="font-semibold">{TRACK_LABELS[track]}</strong> · {status}
            {final && sent > 0 && ` through ${formatClock(sent)}`}
            {!final && state.sentMs !== undefined && ` · Entomate through ${formatClock(sent)}`}
            {!final && localPending && (state.sentMs === undefined
              ? ` · Recoverable through ${formatClock(state.savedMs)}`
              : ` · On this device through ${formatClock(state.savedMs)}`)}
            {!final && state.localSaveFailed && ' · Device storage interrupted'}
          </li>
        )
      })}
    </ul>
  )
}
