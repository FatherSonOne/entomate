import React, { forwardRef, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { ChevronDown, Loader2, Pause, Play, RotateCcw, RotateCw, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react'
import { Display, Key, Tape, Toggle, type TapeMarker } from '../bench'
import { formatClock, type TranscriptSegment } from '../../services/meetingTranscriptService'
import { loadRecordingAudio, loadRecordingWaveformPeaks, removeRecordingAudio, type RecordingAudio } from '../../services/meetingRecorderService'
import { readRecordingWaveform, waveformFromPeaks } from '../../services/recordingWaveform'
import { recordingSpeakers } from './recordingSpeakers'
import './RecordingPlayer.css'

export interface RecordingPlayerHandle {
  /** The audio can seek immediately. */
  isReady: () => boolean
  /** Play from this moment, optionally stopping at the end of a preview. */
  playFrom: (atMs: number, endMs?: number) => void
}

export interface RecordingPlayerProps {
  meetingId: string
  /** Direct audio from a legacy meeting upload. Kept recordings use the playback service. */
  audioUrl?: string
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
  { meetingId, audioUrl, durationMs, waveformPeaks, waveformReplacement, transcriptSegments, decisions = [], actions = [], onMoment, onStepMoment, onTime, onAudioRemoved },
  ref,
) {
  const [source, setSource] = useState<Source | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [audioRemoved, setAudioRemoved] = useState(false)
  const [mediaDuration, setMediaDuration] = useState(0)
  const [position, setPosition] = useState(0)
  const [hoverPosition, setHoverPosition] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [showSpeakerColors, setShowSpeakerColors] = useState(false)
  const [loadedWaveform, setLoadedWaveform] = useState<string | null>(null)
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
  const effectiveDuration = mediaDuration || finiteDuration(source?.durationMs) || finiteDuration(durationMs)
  const speakers = useMemo(() => recordingSpeakers(transcriptSegments ?? [], effectiveDuration), [transcriptSegments, effectiveDuration])
  const speakerColorsVisible = showSpeakerColors && speakers.turns.length > 0
  const currentSpeaker = speakerColorsVisible
    ? speakers.turns.find(turn => turn.start <= position && position < turn.end)?.speaker
    : undefined
  const fraction = effectiveDuration ? Math.min(position / effectiveDuration, 1) : 0
  const elapsed = formatClock(position)
  const total = effectiveDuration ? formatClock(effectiveDuration) : '–:––'
  const savedWaveform = useMemo(() => waveformPeaks?.length ? waveformFromPeaks(waveformPeaks) : null, [waveformPeaks])
  const waveform = audioRemoved ? null : savedWaveform ?? loadedWaveform

  useEffect(() => () => request.current?.abort(), [])
  useEffect(() => {
    if (!source?.blob) return
    return () => URL.revokeObjectURL(source.url)
  }, [source])

  useEffect(() => {
    if (savedWaveform !== null || audioRemoved) return
    const controller = new AbortController()
    setLoadedWaveform(null)
    setWaveStatus('drawing')
    const readWaveform = audioUrl
      ? readRecordingWaveform(audioUrl, finiteDuration(durationMs), controller.signal)
      : loadRecordingWaveformPeaks(meetingId, controller.signal).then(waveformFromPeaks)
    void readWaveform
      .then(path => {
        if (controller.signal.aborted) return
        setLoadedWaveform(path)
        setWaveStatus('idle')
      })
      .catch(() => {
        if (!controller.signal.aborted) setWaveStatus('unavailable')
      })
    return () => controller.abort()
  }, [audioRemoved, audioUrl, durationMs, meetingId, savedWaveform])

  const load = async (refresh = false): Promise<void> => {
    if (request.current || (source && !refresh)) return
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
        }, controller.signal)
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
    void load()
  }

  useImperativeHandle(ref, () => ({
    isReady: () => mediaReady.current,
    playFrom: (atMs, endMs) => seek(atMs, true, endMs),
  }))

  const applyMetadata = (audio: HTMLAudioElement): void => {
    measuring.current = false
    mediaReady.current = true
    setMediaDuration(finiteDuration(audio.duration) * 1000)
    audio.playbackRate = speed
    audio.volume = volume
    audio.muted = muted
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
      void load(true)
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

  return (
    <section className="bs-recording bs-tokens" aria-label="Meeting recording">
      {source && (
        <audio
          ref={audioRef}
          src={source.url}
          preload="auto"
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
      {waveformReplacement ?? <Display className="bs-recording-display">
        <div className="bs-recording-readout">
          <span className="bs-recording-state" data-playing={playing}>
            <span aria-hidden="true" />
            <span role="status">{status}</span>
          </span>
          <span className="bs-recording-clock"><b>{elapsed}</b> <span aria-hidden="true">/</span> {total}</span>
        </div>
        <div className="bs-recording-scrub" style={{ '--position': `${fraction * 100}%` } as React.CSSProperties}>
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
                  <path d={waveform} className="bs-recording-unplayed" />
                  <path d={waveform} className={speakerColorsVisible ? 'bs-recording-played-neutral' : 'bs-recording-played'} clipPath={`url(#${clipId})`} />
                  {speakerColorsVisible && (
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
        {effectiveDuration > 0 && (
          <div className="bs-recording-ruler" aria-hidden="true">
            {rulerMarks(effectiveDuration).map(at => (
              <span key={at} style={{ left: `${at / effectiveDuration * 100}%` }}>{formatClock(at)}</span>
            ))}
          </div>
        )}
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
            <button type="button" aria-label={muted ? 'Unmute' : 'Mute'} title={muted ? 'Unmute' : 'Mute'} onClick={() => {
              if (audioRef.current) audioRef.current.muted = !muted
              setMuted(!muted)
            }}>{muted || !volume ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}</button>
            <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume} aria-label="Volume"
              aria-valuetext={`${Math.round((muted ? 0 : volume) * 100)}%`}
              onChange={e => {
                const value = e.currentTarget.valueAsNumber
                if (audioRef.current) {
                  audioRef.current.volume = value
                  audioRef.current.muted = false
                }
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
