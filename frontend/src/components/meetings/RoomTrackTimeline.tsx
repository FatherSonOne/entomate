import React, { useEffect, useState } from 'react'
import { LogIn, LogOut } from 'lucide-react'
import { formatClock } from '../../services/meetingTranscriptService'
import { loadRecordingWaveformPeaks } from '../../services/meetingRecorderService'
import { waveformFromPeaks } from '../../services/recordingWaveform'
import type { AudioTracks, RoomParticipantTrack } from '../../services/recordingAudioTracks'

interface Props {
  meetingId: string
  tracks: RoomParticipantTrack[]
  audioTracks?: AudioTracks
  labelOf: (track: RoomParticipantTrack) => string
  durationMs: number
  position: number
  soloed?: string
  muted: ReadonlySet<RoomParticipantTrack>
  disabled: boolean
  onSeek: (atMs: number) => void
  onSolo: (track: RoomParticipantTrack) => void
  onMute: (track: RoomParticipantTrack) => void
  muteDisabled?: boolean
  mixer?: {
    gains: Partial<Record<RoomParticipantTrack, number>>
    disabled: boolean
    setGain: (track: RoomParticipantTrack, gain: number) => void
  }
}

export function RoomTrackTimeline({
  meetingId, tracks, audioTracks, labelOf, durationMs, position, soloed, muted, disabled, onSeek, onSolo, onMute, muteDisabled, mixer,
}: Props) {
  const [waveforms, setWaveforms] = useState<Partial<Record<RoomParticipantTrack, string | null>>>({})
  const playable = tracks.filter(track => (audioTracks?.[track]?.durationMs ?? 0) > 0).join(',')

  useEffect(() => {
    if (!playable) return
    const controller = new AbortController()
    const load = async () => {
      // The waveform service limits concurrent audio decodes.
      for (const track of playable.split(',') as RoomParticipantTrack[]) {
        if (controller.signal.aborted) break
        const waveform = await loadRecordingWaveformPeaks(meetingId, controller.signal, track)
          .then(waveformFromPeaks).catch(() => null)
        if (!controller.signal.aborted) setWaveforms(rows => ({ ...rows, [track]: waveform }))
      }
    }
    void load()
    return () => controller.abort()
  }, [meetingId, playable])

  const percent = (time: number) => `${durationMs ? Math.min(time / durationMs, 1) * 100 : 0}%`
  return (
    <div className="bs-recording-room-tracks" role="group" aria-label="Participant timeline">
      {tracks.map(track => {
        const info = audioTracks?.[track]
        const label = labelOf(track)
        const available = (info?.durationMs ?? 0) > 0
        const waveform = waveforms[track]
        const gain = mixer?.gains[track] ?? 0
        const isMuted = muted.has(track)
        const isSoloed = soloed === track
        return (
          <div key={track} className="bs-recording-room-row" role="group" aria-label={label}>
            <div className="bs-recording-room-label">
              <strong title={label}>{label}</strong>
              {available && <div className="bs-recording-room-controls">
                <button type="button" aria-label={`Solo ${label}`} aria-pressed={isSoloed}
                  disabled={disabled} onClick={() => onSolo(track)}>Solo</button>
                <button type="button" aria-label={`Mute ${label} in Combined`} aria-pressed={isMuted}
                  disabled={disabled || muteDisabled} onClick={() => onMute(track)}>Mute</button>
              </div>}
              {available && mixer && <label className="bs-recording-track-gain">
                Volume <output>{gain > 0 ? '+' : ''}{gain} dB</output>
                <input type="range" min={-24} max={12} step={1} value={gain}
                  aria-label={label + ' volume'} aria-valuetext={gain + ' decibels'}
                  disabled={mixer.disabled} onChange={event => mixer.setGain(track, event.currentTarget.valueAsNumber)} />
              </label>}
            </div>
            <div className="bs-recording-scrub bs-recording-room-lane"
              data-dimmed={soloed ? !isSoloed : isMuted} style={{ '--position': percent(position) } as React.CSSProperties}>
              {waveform ? (
                <svg viewBox="0 0 1000 80" preserveAspectRatio="none" aria-hidden="true" data-testid="participant-waveform">
                  <path d={waveform} className="bs-recording-unplayed" />
                </svg>
              ) : <span className="bs-recording-room-wave-status">
                {!available ? 'Audio unavailable' : waveform === undefined ? 'Loading waveform…' : 'Waveform unavailable'}
              </span>}
              {durationMs > 0 && <span className="bs-recording-head" aria-hidden="true" />}
              <input type="range" aria-label={`${label} playback position`}
                aria-valuetext={formatClock(position)} min={0} max={durationMs || 1} step="any"
                value={Math.min(position, durationMs)} disabled={disabled || !durationMs}
                onChange={event => onSeek(event.currentTarget.valueAsNumber)}
                onKeyDown={event => {
                  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
                  event.preventDefault()
                  const step = event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1000 : 1000
                  onSeek(Math.min(durationMs, Math.max(0, position + step)))
                }} />
              {info?.attendance?.filter(marker => marker.atMs <= durationMs).map(({ kind, atMs }) => {
                const title = `${label} ${kind === 'join' ? 'joined' : 'left'} at ${formatClock(atMs)}`
                const Icon = kind === 'join' ? LogIn : LogOut
                return (
                  <button key={kind + atMs} className="bs-recording-room-attendance" data-kind={kind}
                    type="button" title={title} aria-label={title} disabled={disabled}
                    style={{ '--marker': percent(atMs) } as React.CSSProperties} onClick={() => onSeek(atMs)}>
                    <Icon aria-hidden="true" />
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
