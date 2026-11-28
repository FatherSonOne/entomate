import React, { forwardRef, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { ChevronDown, Loader2, Pause, Play, RotateCcw, RotateCw, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react'
import { Display, Key, Tape, Toggle, type TapeMarker } from '../bench'
import { formatClock, type TranscriptSegment } from '../../services/meetingTranscriptService'
import { loadRecordingAudio, loadRecordingWaveformPeaks, removeRecordingAudio, type AudioTracks, type RecordingAudio } from '../../services/meetingRecorderService'
import { ISOLATED_AUDIO_TRACKS, roomParticipantTracks, TRACK_LABELS, type AudioGap, type IsolatedAudioTrack, type PlaybackTrack, type RecordingTrack, type RoomParticipantTrack } from '../../services/recordingAudioTracks'
import { TrackSaveStatus, type TrackSaveStates } from './TrackSaveStatus'
import { readRecordingWaveform, waveformFromPeaks } from '../../services/recordingWaveform'
import { recordingSpeakers } from './recordingSpeakers'
import { RoomAudioStem } from './RoomAudioStem'
import { RoomTrackTimeline } from './RoomTrackTimeline'
import { recordingsApi } from '../../services/api'
import './RecordingPlayer.css'

export interface RecordingPlayerHandle {
  /** The audio can seek immediately. */
  isReady: () => boolean
  /** Play from this moment, optionally stopping at the end of a preview. */
  playFrom: (atMs: number, endMs?: number) => void
  cueAt: (atMs: number) => void
}

export interface RecordingPlayerProps {
  meetingId: string
  /** Direct audio from a legacy meeting upload. Kept recordings use the playback service. */
  audioUrl?: string
  audioTracks?: AudioTracks
  roomRecording?: boolean
  cloudRoom?: boolean
  gaps?: ReadonlyArray<AudioGap>
  durationMs?: number | null
  waveformPeaks?: ReadonlyArray<number> | null
  /** Progress shown in place of the waveform while the transcript is rebuilt. */
  waveformReplacement?: React.ReactNode
  transcriptSegments?: ReadonlyArray<TranscriptSegment> | null
  decisions?: ReadonlyArray<TapeMarker>
  actions?: ReadonlyArray<TapeMarker>
  onMoment?: (atMs: number) => void
  onStepMoment?: (direction: number) => void
  /** The position in whole seconds, as ms, for the active transcript line. */
  onTime?: (atMs: number | null) => void
  onAudioRemoved?: () => void
}

interface Source extends RecordingAudio {
  url: string
}

interface SeekRequest {
  atMs: number
  play: boolean
  endMs?: number
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 2]
const finiteDuration = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0

function rulerMarks(durationMs: number): number[] {
  if (!durationMs) return []
  const step = [5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600].find(seconds => seconds * 1000 >= durationMs / 4)
  const marks = [0]
  if (step) {
    const interval = step * 1000
    for (let at = interval; at <= durationMs - interval * 0.6; at += interval) marks.push(at)
  }
  return [...marks, durationMs]
}

export const RecordingPlayer = forwardRef<RecordingPlayerHandle, RecordingPlayerProps>(function RecordingPlayer(
  { meetingId, audioUrl, audioTracks, roomRecording, cloudRoom, gaps = [], durationMs, waveformPeaks, waveformReplacement, transcriptSegments, decisions = [], actions = [], onMoment, onStepMoment, onTime, onAudioRemoved },
  ref,
) {
  const [source, setSource] = useState<Source | null>(null)
  const [track, setTrack] = useState<PlaybackTrack | undefined>()
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [audioRemoved, setAudioRemoved] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [mediaDuration, setMediaDuration] = useState(0)
  const [position, setPosition] = useState(0)
  const [hoverPosition, setHoverPosition] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [muted, setMuted] = useState(false)
  const [mutedParticipants, setMutedParticipants] = useState<Set<RoomParticipantTrack>>(() => new Set())
  const [volume, setVolume] = useState(1)
  const [showSpeakerColors, setShowSpeakerColors] = useState(false)
  const [waveforms, setWaveforms] = useState<Partial<Record<RecordingTrack, string>>>({})
  const [waveStatus, setWaveStatus] = useState<'idle' | 'drawing' | 'unavailable'>('idle')
  const audioRef = useRef<HTMLAudioElement>(null)
  const request = useRef<AbortController | null>(null)
  const pending = useRef<SeekRequest | null>(null)
  const previewEnd = useRef<number | undefined>(undefined)
  const mediaReady = useRef(false)
  const measuring = useRef(false)
  const renewed = useRef(false)
  const lastSecond = useRef<number | null>(null)
  const clipId = useId()
  const speakerGradientId = `${clipId}-speakers`
  const trackDuration = track ? audioTracks?.[track]?.durationMs : durationMs
  const effectiveDuration = mediaDuration || finiteDuration(source?.durationMs) || finiteDuration(trackDuration)
  // An incomplete track still uses the full recorded timeline.
  const timelineDuration = track ? Math.max(effectiveDuration, finiteDuration(durationMs)) : effectiveDuration
  const isPartial = Boolean(track && finiteDuration(trackDuration) < finiteDuration(durationMs))
  const coverageFraction = isPartial && timelineDuration ? Math.min(effectiveDuration / timelineDuration, 1) : 1
  const waveformScale = coverageFraction < 1 ? `scale(${coverageFraction} 1)` : undefined
  const speakers = useMemo(() => recordingSpeakers(transcriptSegments ?? [], timelineDuration), [transcriptSegments, timelineDuration])
  const speakerColorsVisible = showSpeakerColors && speakers.turns.length > 0
  const currentSpeaker = speakerColorsVisible
    ? speakers.turns.find(turn => turn.start <= position && position < turn.end)?.speaker
    : undefined
  const fraction = timelineDuration ? Math.min(position / timelineDuration, 1) : 0
  const elapsed = formatClock(position)
  const total = timelineDuration ? formatClock(timelineDuration) : '–:––'
  const savedWaveform = useMemo(() => waveformPeaks?.length ? waveformFromPeaks(waveformPeaks) : null, [waveformPeaks])
  const participantTracks = roomParticipantTracks(audioTracks)
  const roomTimeline = !audioRemoved && cloudRoom && participantTracks.length > 0
  const filteredMix = roomTimeline && !track && participantTracks.some(name => mutedParticipants.has(name))
  const audibleParticipants = filteredMix
    ? participantTracks.filter(name => (audioTracks?.[name]?.durationMs ?? 0) > 0 && !mutedParticipants.has(name))
    : []
  const waveformTrack = roomTimeline ? undefined : track
  const trackKey = waveformTrack ?? 'mix'
  const waveform = audioRemoved ? null : ((!waveformTrack ? savedWaveform : null) ?? waveforms[trackKey] ?? null)
  const availableTracks: PlaybackTrack[] = [
    ...ISOLATED_AUDIO_TRACKS.filter(name => (audioTracks?.[name]?.durationMs ?? 0) > 0),
    ...participantTracks.filter(name => (audioTracks?.[name]?.durationMs ?? 0) > 0),
  ]
  const labelOf = (name: PlaybackTrack): string => {
    if (name === 'mic' || name === 'tab') return TRACK_LABELS[name]
    const label = audioTracks?.[name]?.label || 'Participant'
    const duplicates = participantTracks.filter(key => (audioTracks?.[key]?.label || 'Participant') === label)
    return duplicates.length > 1 ? label + ' (' + (duplicates.indexOf(name) + 1) + ')' : label
  }
  const trackSaveStates: TrackSaveStates = { mix: { savedMs: 0, sentMs: finiteDuration(durationMs) } }
  for (const name of ISOLATED_AUDIO_TRACKS) {
    trackSaveStates[name] = { savedMs: 0, sentMs: audioTracks?.[name]?.durationMs ?? 0 }
  }

  useEffect(() => () => request.current?.abort(), [])
  useEffect(() => {
    if (!source?.blob) return
    return () => URL.revokeObjectURL(source.url)
  }, [source])

  useEffect(() => {
    if (waveform !== null || audioRemoved) return
    const controller = new AbortController()
    setWaveStatus('drawing')
    const readWaveform = audioUrl
      ? readRecordingWaveform(audioUrl, finiteDuration(durationMs), controller.signal)
      : loadRecordingWaveformPeaks(meetingId, controller.signal, waveformTrack).then(waveformFromPeaks)
    void readWaveform
      .then(path => {
        if (controller.signal.aborted) return
        setWaveforms(previous => ({ ...previous, [trackKey]: path }))
        setWaveStatus('idle')
      })
      .catch(() => {
        if (!controller.signal.aborted) setWaveStatus('unavailable')
      })
    return () => controller.abort()
  }, [audioRemoved, audioUrl, durationMs, meetingId, waveformTrack, trackKey, waveform])

  const load = async (playbackTrack: PlaybackTrack | undefined, refresh = false): Promise<void> => {
    if (request.current || (source && playbackTrack === track && !refresh)) return
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setProgress(null)
    setError(null)
    try {
      const recording = audioUrl
        ? { url: audioUrl, durationMs: finiteDuration(durationMs), blob: undefined }
        : await loadRecordingAudio(meetingId, fetch, fraction => {
          if (!controller.signal.aborted) setProgress(fraction)
        }, controller.signal, playbackTrack)
      if (controller.signal.aborted) return
      const url = recording.url ?? URL.createObjectURL(recording.blob!)
      setSource({ ...recording, url })
      if (source?.url === url) audioRef.current?.load()
    } catch (err) {
      if (controller.signal.aborted) return
      setSource(null)
      setError(refresh ? 'The recording could not be played. Try again.'
        : err instanceof Error ? err.message : 'The recording could not be loaded.')
    } finally {
      if (!controller.signal.aborted) {
        request.current = null
        setLoading(false)
      }
    }
  }

  const switchTrack = (nextTrack: PlaybackTrack | undefined, atMs: number, shouldPlay: boolean, endAtMs?: number): void => {
    const audio = audioRef.current
    const endMs = nextTrack ? audioTracks?.[nextTrack]?.durationMs : durationMs
    pending.current = { atMs: Math.min(atMs, endMs || Infinity), play: shouldPlay, endMs: endAtMs }
    audio?.pause()
    request.current?.abort()
    request.current = null
    mediaReady.current = false
    measuring.current = false
    renewed.current = false
    setPlaying(false)
    setMediaDuration(0)
    setPosition(pending.current.atMs)
    setSource(null)
    setTrack(nextTrack)
    void load(nextTrack, true)
  }

  const selectTrack = (nextTrack: PlaybackTrack | undefined): void => {
    if (nextTrack === track) return
    const audio = audioRef.current
    const ready = audio && mediaReady.current
    switchTrack(nextTrack, ready ? Math.round(audio.currentTime * 1000) : position,
      ready ? !audio.paused : Boolean(pending.current?.play), pending.current?.endMs ?? previewEnd.current)
  }

  const toggleParticipantMute = (name: RoomParticipantTrack): void => {
    setMutedParticipants(previous => {
      const next = new Set(previous)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const gapPlaybackTrack = (gap: AudioGap): IsolatedAudioTrack | undefined => {
    if (gap.track !== 'mic' && gap.track !== 'tab') return undefined
    const other = gap.track === 'mic' ? 'tab' : 'mic'
    const otherIsAvailable = (audioTracks?.[other]?.durationMs ?? 0) > gap.startMs
      && !gaps.some(point => point.track === other && point.startMs <= gap.startMs
        && (point.endMs === null || point.endMs > gap.startMs))
    return otherIsAvailable ? other : undefined
  }

  const playGap = (gap: AudioGap): void => {
    const nextTrack = gapPlaybackTrack(gap)
    if (nextTrack === track) seek(gap.startMs, true)
    else switchTrack(nextTrack, gap.startMs, true)
  }

  const updatePosition = (audio: HTMLAudioElement): void => {
    if (!mediaReady.current || !Number.isFinite(audio.currentTime)) return
    const atMs = Math.round(audio.currentTime * 1000)
    if (previewEnd.current !== undefined && atMs >= previewEnd.current) {
      previewEnd.current = undefined
      audio.pause()
    }
    setPosition(atMs)
    const second = Math.floor(atMs / 1000)
    if (second !== lastSecond.current) {
      lastSecond.current = second
      onTime?.(second * 1000)
    }
  }

  const play = (audio: HTMLAudioElement): void => {
    setError(null)
    void audio.play().catch((err: unknown) => {
      if (audio !== audioRef.current) return
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError('Press Play to start playback.')
      }
    })
  }

  const performSeek = (audio: HTMLAudioElement, { atMs, play: resume, endMs }: SeekRequest): void => {
    const duration = finiteDuration(audio.duration) * 1000
    const clamped = Math.max(0, duration ? Math.min(atMs, duration) : atMs)
    if (Math.abs(audio.currentTime * 1000 - clamped) > 0.5) {
      audio.currentTime = clamped / 1000
      updatePosition(audio)
    }
    previewEnd.current = endMs
    if (resume) play(audio)
  }

  const seek = (atMs: number, resume = false, endMs?: number): void => {
    if (!Number.isFinite(atMs)) return
    previewEnd.current = undefined
    const audio = audioRef.current
    const requested = { atMs, play: resume || Boolean(pending.current?.play), endMs }
    if (mediaReady.current && audio) {
      performSeek(audio, requested)
      return
    }
    pending.current = requested
    setPosition(atMs)
    void load(track)
  }

  useImperativeHandle(ref, () => ({
    isReady: () => mediaReady.current,
    playFrom: (atMs, endMs) => seek(atMs, true, endMs),
    cueAt: (atMs) => {
      const cue = { atMs, play: false }
      const audio = audioRef.current
      if (mediaReady.current && audio) {
        if (!audio.paused) audio.pause()
        performSeek(audio, cue)
      } else {
        pending.current = cue
        setPosition(atMs)
      }
    },
  }))

  const applyMetadata = (audio: HTMLAudioElement): void => {
    measuring.current = false
    mediaReady.current = true
    setMediaDuration(finiteDuration(audio.duration) * 1000)
    audio.playbackRate = speed
    audio.volume = volume
    const next = pending.current
    pending.current = null
    if (next) performSeek(audio, next)
    else updatePosition(audio)
  }

  const onMetadata = (audio: HTMLAudioElement): void => {
    if (!Number.isFinite(audio.duration)) {
      // Unindexed MediaRecorder WebM reports infinity until the browser sees the end.
      measuring.current = true
      audio.currentTime = 1e101
      return
    }
    applyMetadata(audio)
  }

  const onDuration = (audio: HTMLAudioElement): void => {
    if (measuring.current && Number.isFinite(audio.duration)) {
      if (!pending.current) pending.current = { atMs: 0, play: false }
      applyMetadata(audio)
    } else if (mediaReady.current) {
      setMediaDuration(finiteDuration(audio.duration) * 1000)
    }
  }

  const onError = (audio: HTMLAudioElement): void => {
    mediaReady.current = false
    measuring.current = false
    setPlaying(false)
    if (source && !audioUrl && !source.blob && !renewed.current) {
      renewed.current = true
      pending.current ??= { atMs: Math.round(audio.currentTime * 1000), play: playing, endMs: previewEnd.current }
      void load(track, true)
      return
    }
    renewed.current = false
    setSource(null)
    setError('The recording could not be played. Try again.')
  }

  const togglePlay = (): void => {
    previewEnd.current = undefined
    const audio = audioRef.current
    if (!mediaReady.current || !audio) {
      seek(position, true)
    } else if (!audio.paused) {
      audio.pause()
    } else {
      play(audio)
    }
  }

  const remove = async (): Promise<void> => {
    setRemoving(true)
    setError(null)
    try {
      await removeRecordingAudio(meetingId)
      audioRef.current?.pause()
      request.current?.abort()
      request.current = null
      pending.current = null
      previewEnd.current = undefined
      mediaReady.current = false
      setAudioRemoved(true)
      setWaveStatus('idle')
      setPosition(0)
      setSource(null)
      setLoading(false)
      onTime?.(null)
      onAudioRemoved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The audio could not be removed. Try again.')
      setRemoving(false)
      setConfirmRemove(false)
    }
  }

  const playLabel = playing ? 'Pause' : loading ? 'Loading recording' : !source && error ? 'Try again' : source ? 'Play' : 'Play the recording'
  const status = loading ? (progress == null ? 'Loading audio' : `Loading audio · ${Math.round(progress * 100)}%`)
    : playing ? 'Playing recording'
      : waveform === null && waveStatus === 'drawing' ? 'Drawing waveform'
        : waveform === null && waveStatus === 'unavailable' ? 'Audio recording · Waveform unavailable' : 'Audio recording'
  const hasMoments = decisions.length > 0 || actions.length > 0

  const download = async (all: boolean) => {
    setDownloading(true)
    setDownloadError(null)
    try {
      if (all) await recordingsApi.downloadTracks(meetingId)
      else {
        const { name, url } = await recordingsApi.trackDownload(meetingId, track || 'mix')
        const link = document.createElement('a')
        link.href = url
        link.download = name
        document.body.appendChild(link)
        link.click()
        link.remove()
      }
    } catch {
      setDownloadError('Could not download the audio. Try again.')
    } finally { setDownloading(false) }
  }

  return (
    <section className="bs-recording bs-tokens" aria-label="Meeting recording">
      {!audioRemoved && availableTracks.length > 0 && (
        <label className="flex flex-wrap items-center gap-2 text-sm">
          Audio source
          <select className="bs-key" value={track ?? ''} onChange={event => {
            const value = availableTracks.find(name => name === event.currentTarget.value)
            selectTrack(value)
          }}>
            <option value="">Combined</option>
            {availableTracks.map(name => {
              const coverage = audioTracks?.[name]?.durationMs ?? 0
              return <option key={name} value={name}>{labelOf(name)}
                {coverage < finiteDuration(durationMs) ? ` · through ${formatClock(coverage)}` : ''}
              </option>
            })}
          </select>
        </label>
      )}
      {!audioRemoved && audioTracks && !roomRecording && <TrackSaveStatus tracks={trackSaveStates} final />}
      {!audioRemoved && participantTracks.length > 0 && (
        <ul aria-label="Participant track status">
          {participantTracks.map(track => {
            const status = audioTracks?.[track]?.status
            const label = status === 'partial' ? 'Partial' : status === 'missing' ? 'Unavailable' : 'Saved'
            return <li key={track}>{labelOf(track)} · {label}</li>
          })}
        </ul>
      )}
      {!audioRemoved && cloudRoom && <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Aligned track downloads">
        <Key size="sm" disabled={downloading} onClick={() => void download(false)}>Download {track ? labelOf(track) : 'Combined'}</Key>
        {availableTracks.length > 0 && <Key size="sm" disabled={downloading} onClick={() => void download(true)}>
          {downloading ? 'Preparing download…' : 'Download all tracks (ZIP)'}
        </Key>}
        {downloadError && <p className="bs-recording-error" role="alert">{downloadError}</p>}
      </div>}
      {source && (
        <audio
          ref={audioRef}
          src={source.url}
          preload="auto"
          muted={muted || filteredMix}
          hidden
          data-testid="recording-player"
          onLoadedMetadata={e => onMetadata(e.currentTarget)}
          onDurationChange={e => onDuration(e.currentTarget)}
          onTimeUpdate={e => updatePosition(e.currentTarget)}
          onSeeked={e => updatePosition(e.currentTarget)}
          onPlaying={() => { renewed.current = false; setPlaying(true) }}
          onPause={() => setPlaying(false)}
          onEnded={() => { previewEnd.current = undefined; setPlaying(false) }}
          onError={e => onError(e.currentTarget)}
        />
      )}
      {source && audibleParticipants.map(name => (
        <RoomAudioStem key={name} meetingId={meetingId} track={name} label={labelOf(name)}
          masterRef={audioRef} muted={muted} volume={volume} />
      ))}
      {waveformReplacement ?? <Display className="bs-recording-display">
        <div className="bs-recording-readout">
          <span className="bs-recording-state" data-playing={playing}>
            <span aria-hidden="true" />
            <span role="status">{status}</span>
          </span>
          <span className="bs-recording-clock"><b>{elapsed}</b> <span aria-hidden="true">/</span> {total}</span>
        </div>
        <div className={roomTimeline ? 'bs-recording-room-row' : undefined}>
          {roomTimeline && <div className="bs-recording-room-label">
            <strong>Combined</strong>
            {filteredMix && <span>{audibleParticipants.length ? 'Mutes applied' : 'All tracks muted'}</span>}
          </div>}
          <div className="bs-recording-master-lane">
            <div className="bs-recording-scrub" style={{ '--position': `${fraction * 100}%` } as React.CSSProperties}>
              {isPartial && <span className="bs-recording-unavailable" style={{ left: `${coverageFraction * 100}%` }} aria-hidden="true" />}
              {(waveform !== null || speakerColorsVisible) && (
                <svg data-testid={waveform !== null ? 'recording-waveform' : undefined} viewBox="0 0 1000 80" preserveAspectRatio="none" aria-hidden="true">
                  <defs>
                    <clipPath id={clipId}><rect width={fraction * 1000} height="80" /></clipPath>
                    {speakerColorsVisible && (
                      <linearGradient id={speakerGradientId} gradientUnits="userSpaceOnUse" x1="0" x2="1000" y1="0" y2="0">
                        {speakers.stops.map(({ offset, color }, index) => <stop key={index} offset={offset} stopColor={color} />)}
                      </linearGradient>
                    )}
                  </defs>
                  {waveform !== null && (
                    <>
                      <path d={waveform} transform={waveformScale} className="bs-recording-unplayed" />
                      <g clipPath={`url(#${clipId})`}>
                        <path d={waveform} transform={waveformScale} className={speakerColorsVisible && !waveformTrack ? 'bs-recording-played-neutral' : 'bs-recording-played'} />
                      </g>
                      {speakerColorsVisible && !waveformTrack && (
                        <>
                          <path d={waveform} fill={`url(#${speakerGradientId})`} opacity="0.7" />
                          <path d={waveform} fill={`url(#${speakerGradientId})`} clipPath={`url(#${clipId})`} />
                        </>
                      )}
                    </>
                  )}
                  {speakerColorsVisible && <rect y="76" width="1000" height="4" fill={`url(#${speakerGradientId})`} />}
                </svg>
              )}
              {effectiveDuration > 0 && <span className="bs-recording-head" aria-hidden="true" />}
              {hoverPosition !== null && (
                <span className="bs-recording-hover" aria-hidden="true" style={{ left: `clamp(24px, ${hoverPosition * 100}%, calc(100% - 24px))` }}>
                  {formatClock(hoverPosition * effectiveDuration)}
                </span>
              )}
              <input
                type="range"
                style={coverageFraction < 1 ? { width: `${coverageFraction * 100}%` } : undefined}
                aria-label="Playback position"
                aria-valuetext={`${elapsed} of ${total}${currentSpeaker ? `, ${currentSpeaker}` : ''}`}
                min={0}
                max={effectiveDuration / 1000 || 1}
                step="any"
                value={effectiveDuration ? Math.min(position, effectiveDuration) / 1000 : 0}
                disabled={!effectiveDuration || removing}
                onChange={e => seek(e.currentTarget.valueAsNumber * 1000)}
                onPointerMove={e => {
                  if (e.pointerType === 'touch') return
                  const bounds = e.currentTarget.getBoundingClientRect()
                  if (bounds.width) setHoverPosition(Math.max(0, Math.min(1, (e.clientX - bounds.left) / bounds.width)))
                }}
                onPointerLeave={() => setHoverPosition(null)}
                onKeyDown={e => {
                  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
                  e.preventDefault()
                  const step = e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1000 : 1000
                  seek(Math.min(effectiveDuration, Math.max(0, position + step)))
                }}
              />
            </div>
            {timelineDuration > 0 && (
              <div className="bs-recording-ruler" aria-hidden="true">
                {rulerMarks(timelineDuration).map(at => (
                  <span key={at} style={{ left: `${at / timelineDuration * 100}%` }}>{formatClock(at)}</span>
                ))}
              </div>
            )}
          </div>
        </div>
        {roomTimeline && (
          <RoomTrackTimeline meetingId={meetingId} tracks={participantTracks} audioTracks={audioTracks} labelOf={labelOf}
            durationMs={timelineDuration} position={position} soloed={track}
            muted={mutedParticipants} disabled={removing} onSeek={seek}
            onSolo={name => selectTrack(track === name ? undefined : name)} onMute={toggleParticipantMute} />
        )}
        {!audioRemoved && timelineDuration > 0 && (roomRecording ? participantTracks : ISOLATED_AUDIO_TRACKS).map(name => {
          const trackGaps = gaps.filter(gap => gap.track === name && gap.startMs < timelineDuration)
          if (!trackGaps.length) return null
          const trackLabel = labelOf(name)
          return (
            <div className="bs-recording-gaps" key={name} role="group" aria-label={`${trackLabel} gaps`}>
              <span>{trackLabel} gaps</span>
              <div className="bs-recording-gap-lane">
                {trackGaps.map(gap => {
                  const left = gap.startMs / timelineDuration * 100
                  const end = Math.min(gap.endMs ?? timelineDuration, timelineDuration)
                  const until = gap.endMs === null ? 'the end' : formatClock(end)
                  const label = `${trackLabel} gap from ${formatClock(gap.startMs)} to ${until}. Play ${TRACK_LABELS[gapPlaybackTrack(gap) ?? 'mix']}.`
                  return (
                    <button type="button" key={gap.startMs} aria-label={label} title={label} onClick={() => playGap(gap)}
                      style={{ left: `min(${left}%, calc(100% - 24px))`, width: `${(end - gap.startMs) / timelineDuration * 100}%` }} />
                  )
                })}
              </div>
            </div>
          )
        })}
        {speakerColorsVisible && (
          <ul className="bs-recording-speakers" role="list" aria-label="Waveform speakers">
            {[...speakers.colors].map(([speaker, color]) => (
              <li key={speaker} data-current={speaker === currentSpeaker} style={{ '--speaker-color': color } as React.CSSProperties}>
                <span aria-hidden="true" />{speaker}
              </li>
            ))}
          </ul>
        )}
        {hasMoments && effectiveDuration > 0 && (
          <div className="bs-recording-moments">
            <Tape
              durationMs={effectiveDuration}
              decisions={decisions}
              actions={actions}
              progress={0}
              onSeek={onMoment}
              label="Recording moments. Choose a marker to play from that time."
            />
            <div className="bs-recording-legend" aria-hidden="true">
              {decisions.length > 0 && <span className="decision">Decisions</span>}
              {actions.length > 0 && <span className="action">Action items</span>}
            </div>
          </div>
        )}
      </Display>}

      <div className="bs-recording-controls">
        <div className="bs-recording-transport">
          <Key
            variant="primary"
            icon={playing ? <Pause aria-hidden="true" /> : loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Play aria-hidden="true" />}
            disabled={loading || removing}
            onClick={togglePlay}
          >{playLabel}</Key>
          <Key iconOnly aria-label="Back 10 seconds" title="Back 10 seconds" disabled={!effectiveDuration || removing}
            onClick={() => seek(Math.max(0, position - 10_000))}>
            <RotateCcw aria-hidden="true" /><small aria-hidden="true">10</small>
          </Key>
          <Key iconOnly aria-label="Forward 10 seconds" title="Forward 10 seconds" disabled={!effectiveDuration || removing}
            onClick={() => seek(Math.min(effectiveDuration, position + 10_000))}>
            <RotateCw aria-hidden="true" /><small aria-hidden="true">10</small>
          </Key>
        </div>
        {onStepMoment && (
          <div className="bs-recording-step" role="group" aria-label="Browse recording moments">
            <Key iconOnly aria-label="Previous moment" title="Previous moment" onClick={() => onStepMoment(-1)}><SkipBack aria-hidden="true" /></Key>
            <Key iconOnly aria-label="Next moment" title="Next moment" onClick={() => onStepMoment(1)}><SkipForward aria-hidden="true" /></Key>
          </div>
        )}
        <div className="bs-recording-settings">
          {speakers.turns.length > 0 && (
            <div className="bs-recording-speaker-toggle">
              <span aria-hidden="true">Speaker colors</span>
              <Toggle label="Speaker colors" checked={showSpeakerColors} onChange={setShowSpeakerColors} />
            </div>
          )}
          <div className="bs-recording-volume">
            <button type="button" aria-label={muted ? 'Unmute' : 'Mute'} title={muted ? 'Unmute' : 'Mute'} onClick={() => setMuted(!muted)}>{muted || !volume ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}</button>
            <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume} aria-label="Volume"
              aria-valuetext={`${Math.round((muted ? 0 : volume) * 100)}%`}
              onChange={e => {
                const value = e.currentTarget.valueAsNumber
                if (audioRef.current) audioRef.current.volume = value
                setVolume(value)
                setMuted(false)
              }} />
          </div>
          <label className="bs-recording-speed">
            <select className="bs-key" aria-label="Playback speed" value={speed} onChange={e => {
              const value = Number(e.currentTarget.value)
              if (audioRef.current) audioRef.current.playbackRate = value
              setSpeed(value)
            }}>
              {SPEEDS.map(value => <option key={value} value={value}>{value}×</option>)}
            </select>
            <ChevronDown aria-hidden="true" />
          </label>
        </div>
      </div>
      {error && <p className="bs-recording-error" role="alert">{error}</p>}
      {onAudioRemoved && (
        <div className="bs-recording-remove">
          {confirmRemove ? (
            <>
              <span>Remove the audio for good? The transcript and notes stay.</span>
              <Key size="sm" variant="danger" disabled={removing} onClick={() => void remove()}>{removing ? 'Removing…' : 'Remove audio'}</Key>
              <Key size="sm" disabled={removing} onClick={() => setConfirmRemove(false)}>Keep</Key>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmRemove(true)}>Remove audio</button>
          )}
        </div>
      )}
    </section>
  )
})

export default RecordingPlayer
