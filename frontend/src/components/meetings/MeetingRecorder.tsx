/**
 * Record a meeting in the browser, no bot: microphone, camera and microphone, or a
 * browser tab (its sound, plus the microphone if wanted).
 *
 * Ported from Logos Vision's notetaker recorder. Audio goes to the server in 30-second
 * pieces while recording, so a closed tab loses at most one piece. When recording stops,
 * the server writes the transcript with speakers and times, then the summary, decisions
 * and action items, the same as a bot meeting. Camera and tab video stays on this device:
 * it can be downloaded once recording stops.
 *
 * Replaces the earlier microphone-only recorder, keeping its title, attendees, chosen
 * microphone, timer and level meter.
 *
 * One call, one meeting: when a bot of yours is in a call (or about to join one), the
 * recorder says so before you start. Recording that call adds the audio to the bot's
 * meeting as a backup (the bot writes the minutes), so there are never two meetings,
 * two summaries and every action item twice. You can say it is a different meeting.
 */

import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { lockRecording, recordingJournal, savedTrackCoverage, type SavedRecording } from '../../services/recordingJournal'
import { ISOLATED_AUDIO_TRACKS, type IsolatedAudioTrack, type RecordingGaps } from '../../services/recordingAudioTracks'
import { applyMicMode, MIC_CHECK_LEVELS, MIC_MODES, microphoneConstraints, reportedMicMode, type MicMode } from '../../services/recordingMicrophone'
import { useMicCheck } from './useMicCheck'
import { TrackSaveStatus, type TrackSaveStates } from './TrackSaveStatus'
import { AlertTriangle, Bot, Camera, Download, ExternalLink, Loader2, Mic, MonitorUp, Pause, Play, Square, Trash2 } from 'lucide-react'
import { canPip, dressWindow } from '../bot/BotLive'
import { protectRecordingFromReload } from '../../services/chunkReload'
import { formatClock } from '../../services/meetingTranscriptService'
import { SilenceWatch, levelOf, silenceMessage } from '../../services/silenceWatch'
import LiveCaptions, { speechRecognitionCtor } from './LiveCaptions'
import {
  BotInCallError,
  EMPTY_UPLOAD,
  recoverRecording,
  receivedRecordingTracks,
  PIECE_MS,
  PieceUploader,
  baseMime,
  captureErrorMessage,
  checkBotInCall,
  discardRecording,
  finishRecording,
  pickAudioMime,
  pickVideoMime,
  recorderOptions,
  sendPieceTo,
  startRecording,
  tabCaptureSupported,
  type BotInCall,
  type RecorderMode,
  type UploaderState,
} from '../../services/meetingRecorderService'

export interface MeetingRecorderProps {
  quickRecordRequest?: number
  onQuickRecordConsumed?: () => void
  /** A microphone chosen in Settings; the default one when empty. */
  audioInputDeviceId?: string
  recoveryUserId?: string
  /** Called once the recording is handed to the server for its transcript. */
  onRecorded?: (meetingId: string) => void
  /** Reports whether capture or audio handoff is in progress. */
  onCaptureChange?: (active: boolean) => void
  /** Called when the pop-out is ready to take over the visible controls. */
  onPopOut?: () => void
  onReset?: () => void
  onOpenMeeting?: () => void
}

type Phase = 'setup' | 'starting' | 'recording' | 'finishing' | 'done'

interface Capture {
  streams: MediaStream[]
  audioContext: AudioContext
  audioRecorder: MediaRecorder
  sourceTracks: SourceTrackCapture[]
  splitAudio: boolean
  gaps: RecordingGaps
  unwatch: Partial<Record<IsolatedAudioTrack, () => void>>
  inputs: Partial<Record<IsolatedAudioTrack, AudioInput>>
  mix: MediaStreamAudioDestinationNode
  videoRecorder: MediaRecorder | null
  videoChunks: Blob[]
  preview: MediaStream | null
}

interface AudioInput {
  stream: MediaStream
  track: MediaStreamTrack
  node: MediaStreamAudioSourceNode
}

interface SourceTrackCapture {
  track: IsolatedAudioTrack
  destination: MediaStreamAudioDestinationNode
  recorder: MediaRecorder
  uploader: PieceUploader
  pendingDurations: number[]
  failed: boolean
}

const MODE_OPTIONS: Array<{ mode: RecorderMode; label: string; hint: string; Icon: typeof Mic }> = [
  { mode: 'mic', label: 'Microphone', hint: 'Sound from this device, for a meeting in the room.', Icon: Mic },
  { mode: 'camera', label: 'Camera', hint: 'Video and sound from this device. The video stays here to download.', Icon: Camera },
  { mode: 'tab', label: 'Browser tab', hint: 'A call running in another tab, such as Meet, Zoom or Teams on the web.', Icon: MonitorUp },
]

const INPUT =
  'w-full rounded-lg border border-line bg-surface-elevated px-3 py-2 text-sm text-content-primary ' +
  'placeholder:text-content-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary disabled:opacity-60'
// The app's own button styles, so the recorder follows whichever design style is chosen.
const BUTTON = 'vbtn min-h-10 justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary disabled:opacity-50'
const PRIMARY = `${BUTTON} vbtn-primary`
const SECONDARY = `${BUTTON} vbtn-ghost`

function MicModeSelect({ value, disabled, onChange }: {
  value: MicMode | null
  disabled?: boolean
  onChange: (mode: MicMode) => void
}) {
  return (
    <label className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-content-primary">
      Microphone mode
      <select className={INPUT} value={value ?? ''} disabled={disabled} onChange={event => {
        const choice = event.currentTarget.value
        if (choice === 'noise-reduction' || choice === 'original') onChange(choice)
      }}>
        <option value="" disabled>Mode not reported</option>
        <option value="noise-reduction">{MIC_MODES['noise-reduction']}</option>
        <option value="original">{MIC_MODES.original}</option>
      </select>
    </label>
  )
}

interface DisplayMediaOptionsWithAudio extends DisplayMediaStreamOptions {
  selfBrowserSurface?: 'include' | 'exclude'
  systemAudio?: 'include' | 'exclude'
}

/** Level meter: bars drawn from the mixed audio. Colour comes from the theme's accent. */
function hasAudio(track: MediaStreamTrack | undefined): boolean {
  return track?.readyState === 'live' && track.enabled && !track.muted
}

const QUIET_INPUT_MS = 3000
const CLIP_HOLD_MS = 1500

function LevelMeter({ context, source, label, paused }: {
  context: AudioContext
  source: AudioInput | null
  label: string
  paused: boolean
}): React.ReactElement {
  const ref = useRef<HTMLMeterElement | null>(null)
  const [signal, setSignal] = useState<'On' | 'Quiet' | 'Near clipping'>('On')
  const track = source?.track
  const state = !track ? 'Off' : track.readyState === 'ended' ? 'Disconnected' : !track.enabled ? 'Muted'
    : track.muted ? 'Interrupted' : paused ? 'Paused' : 'On'

  useEffect(() => {
    const meter = ref.current
    if (!meter) return
    meter.value = 0
    setSignal('On')
    if (!source || state !== 'On') return
    const analyser = context.createAnalyser()
    analyser.fftSize = 1024
    source.node.connect(analyser)
    const data = new Uint8Array(analyser.fftSize)
    const view = meter.ownerDocument.defaultView ?? window
    const watch = new SilenceWatch(performance.now())
    let clipUntil = 0
    const update = (): void => {
      analyser.getByteTimeDomainData(data)
      const level = levelOf(data)
      const now = performance.now()
      const quiet = watch.push(level, now) >= QUIET_INPUT_MS
      if (data.some(sample => sample <= 2 || sample >= 254)) clipUntil = now + CLIP_HOLD_MS
      setSignal(now < clipUntil ? 'Near clipping' : quiet ? 'Quiet' : 'On')
      // Use a decibel scale so normal speech is visible without jumping to full scale.
      meter.value = Math.max(0, 1 + (20 * Math.log10(level)) / 60)
    }
    const timer = view.setInterval(update, 100)
    update()
    return () => {
      view.clearInterval(timer)
      source.node.disconnect(analyser)
    }
  }, [context, source, state])

  const health = state === 'On' ? signal : state
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="min-w-0 break-words font-medium">{label}{track?.label && label === 'Microphone' ? <span className="font-normal text-content-secondary"> · {track.label}</span> : null}</span>
        <span role="status" aria-label={`${label} health`}
          className={['Disconnected', 'Interrupted', 'Near clipping'].includes(health) ? 'text-semantic-error' : 'text-content-secondary'}>{health}</span>
      </div>
      <meter ref={ref} min={0} max={1} aria-label={`${label} level`} className="meeting-source-meter h-2 w-full text-accent-primary" />
    </div>
  )
}

/** A loud warning while the recording hears nothing (muted mic, tab shared without sound). */
function SilenceAlert({ context, stream, mode }: { context: AudioContext; stream: MediaStream; mode: RecorderMode }): React.ReactElement | null {
  const [silentMs, setSilentMs] = useState(0)
  useEffect(() => {
    const analyser = context.createAnalyser()
    analyser.fftSize = 1024
    const source = context.createMediaStreamSource(stream)
    source.connect(analyser)
    const data = new Uint8Array(analyser.fftSize)
    const watch = new SilenceWatch(Date.now())
    const timer = window.setInterval(() => {
      analyser.getByteTimeDomainData(data)
      setSilentMs(watch.push(levelOf(data), Date.now()))
    }, 500)
    return () => {
      window.clearInterval(timer)
      source.disconnect()
    }
  }, [context, stream])
  const message = silenceMessage(silentMs, mode)
  if (!message) return null
  return (
    <p role="alert" data-testid="recorder-silence" className="flex items-start gap-2 rounded-lg border border-semantic-error p-2 text-sm font-medium text-semantic-error">
      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" /> {message}
    </p>
  )
}

function Preview({ stream }: { stream: MediaStream }): React.ReactElement {
  const ref = useRef<HTMLVideoElement | null>(null)
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream
  }, [stream])
  return <video ref={ref} autoPlay muted playsInline aria-label="Recording preview" className="aspect-video w-full rounded-lg bg-black object-contain" />
}

export function MeetingRecorder({ audioInputDeviceId, recoveryUserId: userId, onRecorded, onCaptureChange, onOpenMeeting, onPopOut, onReset, quickRecordRequest, onQuickRecordConsumed }: MeetingRecorderProps): React.ReactElement {
  const navigate = useNavigate()
  // Unique per recorder, so two on one page (or a test harness) never share a radio group.
  const uid = useId()
  const [mode, setMode] = useState<RecorderMode>('mic')
  const [withMic, setWithMic] = useState(true)
  const [micMode, setMicMode] = useState<MicMode>('noise-reduction')
  const [micModeNotice, setMicModeNotice] = useState('')
  const [splitAudio, setSplitAudio] = useState(false)
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([])
  const [changingInput, setChangingInput] = useState(false)
  const pendingInput = useRef(false)
  const [sourceUploads, setSourceUploads] = useState<Partial<Record<IsolatedAudioTrack, UploaderState>>>({})
  const [failedSources, setFailedSources] = useState<IsolatedAudioTrack[]>([])
  const [recoveryProgress, setRecoveryProgress] = useState<Partial<Record<string, TrackSaveStates>>>({})
  const [finishedTracks, setFinishedTracks] = useState<TrackSaveStates | null>(null)
  const [, setSourceRevision] = useState(0)
  const [savedRecordings, setSavedRecordings] = useState<SavedRecording[]>([])
  const [recovering, setRecovering] = useState<string | null>(null)
  const journal = useRef<{ id: string; release: () => void } | null>(null)
  const mounted = useRef(false)
  const [title, setTitle] = useState('')
  const [attendees, setAttendees] = useState('')
  const [consent, setConsent] = useState(false)
  // Live captions are opt-in: the browser's speech service (Google, in Chrome) hears the audio.
  const [captions, setCaptions] = useState(false)
  const [phase, setPhase] = useState<Phase>('setup')
  const micCheck = useMicCheck(micMode, audioInputDeviceId, phase === 'setup' && !recovering && (mode !== 'tab' || withMic))
  const micCheckAudio = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    const audio = micCheckAudio.current
    return () => { if (audio && !audio.paused) audio.pause() }
  }, [micCheck.playback])
  const [error, setError] = useState<string | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [upload, setUpload] = useState<UploaderState>(EMPTY_UPLOAD)
  const [meetingId, setMeetingId] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [, setTick] = useState(0)
  // A bot of yours in a call now: this recording joins its meeting unless you say otherwise.
  const [bot, setBot] = useState<BotInCall | null>(null)
  const [sameAsBot, setSameAsBot] = useState(true)
  const [handedToBot, setHandedToBot] = useState(false)
  const [botCheck, setBotCheck] = useState(0)
  const [paused, setPaused] = useState(false)
  // A small always-on-top window with the controls, for while you are in the call's tab.
  const [pop, setPop] = useState<{ win: Window; root: HTMLElement } | null>(null)
  const heading = useRef<HTMLHeadingElement | null>(null)
  const liveStatus = useRef<HTMLSpanElement | null>(null)
  const savedStatus = useRef<HTMLParagraphElement | null>(null)
  const previousPhase = useRef(phase)
  const captureActive = Boolean(recovering) || phase === 'starting' || phase === 'recording' || phase === 'finishing'

  useLayoutEffect(() => {
    if (captureActive) return protectRecordingFromReload()
  }, [captureActive])

  useLayoutEffect(() => {
    onCaptureChange?.(captureActive)
  }, [captureActive, onCaptureChange])

  useEffect(() => {
    if (previousPhase.current === phase) return
    previousPhase.current = phase
    if (phase === 'starting' || phase === 'setup') heading.current?.focus({ preventScroll: true })
    if (phase === 'recording') liveStatus.current?.focus({ preventScroll: true })
    if (phase === 'done') savedStatus.current?.focus({ preventScroll: true })
  }, [phase])

  const openMeeting = (id: string): void => {
    onOpenMeeting?.()
    navigate(`/meetings/${id}`)
  }

  const capture = useRef<Capture | null>(null)
  const uploader = useRef<PieceUploader | null>(null)
  const startedAt = useRef(0)
  // Recorded time leaves out pauses: banked ms plus the run since the last start or resume.
  const bankedMs = useRef(0)
  const activeSince = useRef<number | null>(null)
  const msAtLastPiece = useRef(0)
  const recordedMs = (now = Date.now()): number => bankedMs.current + (activeSince.current === null ? 0 : now - activeSince.current)
  const stopping = useRef(false)
  // Read by device 'ended' listeners set up before the meeting id reached state.
  const meetingRef = useRef<string | null>(null)

  const tabSupported = tabCaptureSupported(typeof navigator === 'undefined' ? undefined : navigator)
  const captionsSupported = speechRecognitionCtor() !== null

  const releaseDevices = useCallback((): void => {
    const c = capture.current
    if (!c) return
    Object.values(c.unwatch).forEach(unwatch => unwatch())
    c.streams.forEach(s => s.getTracks().forEach(t => t.stop()))
    void c.audioContext.close().catch(() => {})
  }, [])

  // Ask once on arrival (and after "Record another") whether a bot of yours is in a call.
  useEffect(() => {
    let off = false
    void checkBotInCall().then((found) => {
      if (!off) setBot(found)
    })
    return () => {
      off = true
    }
  }, [botCheck])

  // Leaving the page mid-recording: stop the devices; warn before losing unsent audio.
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      uploader.current?.cancel()
      capture.current?.sourceTracks.forEach(source => source.uploader.cancel())
      journal.current?.release()
      journal.current = null
      releaseDevices()
    }
  }, [releaseDevices])

  useEffect(() => {
    if (!userId || phase !== 'setup') return
    let disposed = false
    void recordingJournal.list(userId).then(rows => {
      if (!disposed) setSavedRecordings(rows)
    }).catch(() => {})
    return () => { disposed = true }
  }, [phase, userId])

  const recover = async (saved: SavedRecording): Promise<void> => {
    if (!userId || recovering || phase !== 'setup') return
    setError(null)
    setRecovering(saved.id)
    try {
      const tracks = await recoverRecording(saved.id, userId, next => {
        setRecoveryProgress(current => ({ ...current, [saved.id]: next }))
      })
      setFinishedTracks(tracks)
      setTitle(saved.title)
      setMeetingId(saved.id)
      setPhase('done')
      onRecorded?.(saved.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The saved recording could not be recovered.')
    } finally {
      setRecovering(null)
    }
  }

  useEffect(() => {
    if (phase !== 'recording' && phase !== 'finishing') return
    const warn = (e: BeforeUnloadEvent): void => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [phase])
  useEffect(() => () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl)
  }, [videoUrl])

  useEffect(() => {
    if (phase !== 'recording') return
    const timer = window.setInterval(() => setElapsedMs(recordedMs()), 500)
    return () => window.clearInterval(timer)
  }, [phase])

  // The pop-out closes once the recording is handed over, or when this recorder goes away.
  useEffect(() => {
    if (pop && phase !== 'recording' && phase !== 'finishing') {
      pop.win.close()
      setPop(null)
    }
  }, [phase, pop])
  useEffect(() => () => pop?.win.close(), [pop])

  /** Ask the browser for the devices the chosen mode needs. */
  const openStreams = async (captureMode: RecorderMode): Promise<{ streams: MediaStream[]; video: MediaStreamTrack | null }> => {
    const md = navigator.mediaDevices
    if (!md?.getUserMedia) throw new Error('This browser cannot record. Try a current Chrome, Edge, Firefox or Safari.')
    const micConstraints = microphoneConstraints(micMode, audioInputDeviceId)
    if (captureMode === 'mic') return { streams: [await md.getUserMedia({ audio: micConstraints })], video: null }
    if (captureMode === 'camera') {
      const s = await md.getUserMedia({ audio: micConstraints, video: { width: { ideal: 1280 }, height: { ideal: 720 } } })
      return { streams: [s], video: s.getVideoTracks()[0] ?? null }
    }
    const options: DisplayMediaOptionsWithAudio = { video: true, audio: true, selfBrowserSurface: 'exclude', systemAudio: 'include' }
    const tab = await md.getDisplayMedia(options)
    const streams = [tab]
    if (withMic) {
      try {
        streams.push(await md.getUserMedia({ audio: micConstraints }))
      } catch (err) {
        streams.forEach((s) => s.getTracks().forEach((t) => t.stop()))
        throw err
      }
    }
    // Without the tab's sound only your microphone is heard: in a call on headphones,
    // nobody else would be in the recording. Refuse rather than record half a meeting.
    if (!tab.getAudioTracks().length) {
      streams.forEach((s) => s.getTracks().forEach((t) => t.stop()))
      throw new Error(
        withMic
          ? 'The tab was shared without its sound, so only your microphone would be heard. Share the tab again and turn on "Also share tab audio". For a call in a desktop app, use Microphone instead.'
          : 'No sound was shared. Share a tab and turn on "Also share tab audio", or record your microphone too.',
      )
    }
    return { streams, video: tab.getVideoTracks()[0] ?? null }
  }

  const syncGap = (current: Capture, kind: IsolatedAudioTrack): void => {
    const track = current.inputs[kind]?.track
    if (!track || capture.current !== current || stopping.current) return
    setSourceRevision(revision => revision + 1)
    // Manual mic mute is intentional, even if the browser reports silence.
    const unavailable = (kind === 'tab' || track.enabled) && !hasAudio(track)
    const field = kind === 'mic' ? 'micAudioGaps' : 'tabAudioGaps'
    const gaps = current.gaps[field] ?? []
    const last = gaps.at(-1)
    const atMs = Math.round(recordedMs())
    if (unavailable && last?.endMs !== null) {
      current.gaps = { ...current.gaps, [field]: [...gaps, { startMs: atMs, endMs: null }] }
    } else if (!unavailable && last?.endMs === null) {
      const closed = atMs > last.startMs ? [{ startMs: last.startMs, endMs: atMs }] : []
      current.gaps = { ...current.gaps, [field]: [...gaps.slice(0, -1), ...closed] }
    } else return
    if (journal.current) void recordingJournal.saveGaps(journal.current.id, current.gaps).catch(() => {})
  }

  const watchInput = (current: Capture, kind: IsolatedAudioTrack): void => {
    current.unwatch[kind]?.()
    const input = current.inputs[kind]
    if (!input) return
    const track = input.track
    const video = kind === 'tab' ? input.stream.getVideoTracks()[0] : undefined
    const update = (): void => {
      if (current.inputs[kind] === input) syncGap(current, kind)
    }
    const shareEnded = (): void => {
      if (capture.current !== current || current.inputs[kind] !== input || stopping.current) return
      track.stop()
      if (video && current.preview?.getVideoTracks().includes(video)) current.preview = null
      update()
    }
    const events = ['mute', 'unmute', 'ended']
    events.forEach(event => track.addEventListener(event, update))
    video?.addEventListener('ended', shareEnded)
    current.unwatch[kind] = () => {
      events.forEach(event => track.removeEventListener(event, update))
      video?.removeEventListener('ended', shareEnded)
    }
    if (video?.readyState === 'ended') shareEnded()
    else update()
  }

  const toggleMic = (): void => {
    const current = capture.current
    const track = current?.inputs.mic?.track
    if (!current || !track || stopping.current || track.readyState === 'ended') return
    track.enabled = !track.enabled
    syncGap(current, 'mic')
  }

  const changeInput = async (kind: IsolatedAudioTrack, options: {
    deviceId?: string
    view?: Window | null
    micMode?: MicMode
  } = {}): Promise<void> => {
    const current = capture.current
    const previous = current?.inputs[kind]
    if (!current || !previous || pendingInput.current || stopping.current) return
    const nextMode = options.micMode
    const currentCapture = () => capture.current === current && !stopping.current
    pendingInput.current = true
    setChangingInput(true)
    setError(null)
    if (kind === 'mic') setMicModeNotice('')
    let replacement: MediaStream | undefined
    let reopeningMic = false
    let restoredMode = false
    try {
      const mediaDevices = navigator.mediaDevices
      if (kind === 'mic' && nextMode) {
        const active = await applyMicMode(previous.track, nextMode).catch(() => null)
        if (!currentCapture() || previous.track.readyState !== 'live') return
        if (active === nextMode) {
          setMicMode(nextMode)
          return
        }

        // Some browsers fix processing when opening a device and reuse it
        // while any track from that input is live.
        const previousMode = reportedMicMode(previous.track)
        const deviceId = previous.track.getSettings?.().deviceId
        const choices = previous.track.getCapabilities?.().noiseSuppression
        if (!previousMode || !deviceId || !choices?.includes(nextMode === 'noise-reduction')) {
          throw new Error('Microphone mode unavailable')
        }
        reopeningMic = true
        previous.track.stop()
        syncGap(current, 'mic')
        try {
          replacement = await mediaDevices.getUserMedia({ audio: microphoneConstraints(nextMode, deviceId) })
          if (!currentCapture()) return
          const track = replacement.getAudioTracks()[0]
          if (!track || track.readyState !== 'live' || reportedMicMode(track) !== nextMode) {
            throw new Error('Microphone mode unconfirmed')
          }
        } catch {
          replacement?.getTracks().forEach(track => track.stop())
          replacement = undefined
          if (!currentCapture()) return
          replacement = await mediaDevices.getUserMedia({ audio: microphoneConstraints(previousMode, deviceId) })
          restoredMode = true
        }
      } else if (kind === 'mic') {
        replacement = await mediaDevices.getUserMedia({ audio: microphoneConstraints(micMode, options.deviceId) })
      } else {
        const display: DisplayMediaOptionsWithAudio = { video: true, audio: true, selfBrowserSurface: 'exclude', systemAudio: 'include' }
        const popup = navigator.userActivation?.isActive === false && options.view !== window ? options.view?.navigator.mediaDevices : undefined
        replacement = await (popup?.getDisplayMedia ? popup : mediaDevices).getDisplayMedia(display)
      }
      if (!currentCapture()) return
      const track = replacement.getAudioTracks()[0]
      if (!track || track.readyState !== 'live') {
        throw new Error(kind === 'tab' ? 'Choose a browser tab and turn on “Also share tab audio”.' : 'The microphone did not provide audio.')
      }
      if (kind === 'mic') track.enabled = previous.track.enabled
      const node = current.audioContext.createMediaStreamSource(new MediaStream([track]))
      node.connect(current.mix)
      const source = current.sourceTracks.find(side => side.track === kind)
      if (source) {
        node.connect(source.destination)
        previous.node.disconnect(source.destination)
      }
      previous.node.disconnect(current.mix)
      // The original tab may still be writing a local video preview. Replacing
      // audio leaves its video track alone until the user stops that share.
      previous.track.stop()
      current.streams = current.streams.filter(stream => stream !== previous.stream || stream.getVideoTracks().length > 0)
      current.streams.push(replacement)
      current.inputs[kind] = { stream: replacement, track, node }
      replacement = undefined
      if (nextMode && !restoredMode) setMicMode(nextMode)
      if (restoredMode) setMicModeNotice('This microphone could not switch modes. Recording continues.')
      watchInput(current, kind)
    } catch (err) {
      if (currentCapture()) {
        if (nextMode) {
          setMicModeNotice(reopeningMic ? 'The microphone could not restart. Choose a microphone to reconnect.'
            : 'This microphone could not switch modes. Recording continues.')
        } else setError(captureErrorMessage(err, kind))
      }
    } finally {
      replacement?.getTracks().forEach(track => track.stop())
      pendingInput.current = false
      if (mounted.current) setChangingInput(false)
    }
  }

  const start = async (quick = false): Promise<void> => {
    if (phase !== 'setup' || recovering || (!quick && (!consent || micCheck.pending()))) return
    const sample = micCheckAudio.current
    if (sample && !sample.paused) sample.pause()
    micCheck.clear()
    setMicModeNotice('')
    const captureMode = quick ? 'mic' : mode
    setError(null)
    if (typeof MediaRecorder === 'undefined') {
      setError('This browser cannot record. Try a current Chrome, Edge, Firefox or Safari.')
      return
    }
    const audioMime = pickAudioMime((t) => MediaRecorder.isTypeSupported(t))
    if (!audioMime) {
      setError('This browser cannot record audio in a format Entomate can transcribe.')
      return
    }
    setPhase('starting')

    let opened: { streams: MediaStream[]; video: MediaStreamTrack | null }
    try {
      opened = await openStreams(captureMode)
    } catch (err) {
      setError(captureErrorMessage(err, captureMode))
      setPhase('setup')
      return
    }

    // Every source (tab sound, microphone) mixed into one track for the transcript.
    const audioContext = new AudioContext()
    const mix = audioContext.createMediaStreamDestination()
    const saveSourceTracks = captureMode === 'tab' && splitAudio && withMic && !(bot && sameAsBot)
    const inputs: Capture['inputs'] = {}
    opened.streams.forEach((stream, index) => {
      for (const track of stream.getAudioTracks()) {
        const node = audioContext.createMediaStreamSource(new MediaStream([track]))
        node.connect(mix)
        const kind = captureMode === 'tab' && index === 0 ? 'tab' : 'mic'
        inputs[kind] ??= { stream, track, node }
      }
    })
    void audioContext.resume()

    let id: string
    try {
      const beside = quick ? {} : bot && sameAsBot ? { botSessionId: bot.sessionId } : { separate: true }
      // The server's clock is UTC: name an untitled recording by this device's date, or an
      // evening meeting gets tomorrow's. Beside a bot, an empty title keeps the bot's title.
      const named = title.trim() || (!quick && bot && sameAsBot ? '' : `Recording, ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`)
      ;({ meetingId: id } = await startRecording({ title: named, attendees, mode: captureMode, mimeType: audioMime, ...beside,
        ...(saveSourceTracks ? { splitAudio: true } : {}),
      }))
    } catch (err) {
      opened.streams.forEach((s) => s.getTracks().forEach((t) => t.stop()))
      void audioContext.close()
      if (err instanceof BotInCallError) {
        // A bot joined after this page asked: show the choice, then start again.
        setBot(err.bot)
        setSameAsBot(true)
        setError('Your bot is in a call now. Choose below whether this is the same meeting, then start again.')
      } else {
        setError(err instanceof Error ? err.message : 'The recording could not be started.')
      }
      setPhase('setup')
      return
    }
    const mimeType = baseMime(audioMime)
    if (mounted.current && userId && saveSourceTracks) {
      let release: (() => void) | null = null
      try {
        release = await lockRecording(id)
        if (release) {
          await recordingJournal.create({ id, userId, title: title.trim() || 'Meeting recording', mimeType, splitAudio: true })
          if (mounted.current) journal.current = { id, release }
        }
      } catch { /* A browser that denies local storage can still upload during capture. */ }
      if (!journal.current) release?.()
    }
    if (!mounted.current) {
      opened.streams.forEach(stream => stream.getTracks().forEach(track => track.stop()))
      await audioContext.close().catch(() => {})
      return
    }
    setFailedSources([])
    setSourceUploads({})
    setFinishedTracks(null)
    setHandedToBot(!quick && Boolean(bot && sameAsBot))

    const pieces = new PieceUploader(sendPieceTo(id, mimeType), setUpload, undefined, journal.current?.id)
    uploader.current = pieces
    const audioRecorder = new MediaRecorder(mix.stream, recorderOptions('audio', audioMime))
    const sourceTracks: SourceTrackCapture[] = []
    const markSourceFailed = (track: IsolatedAudioTrack): void => {
      if (mounted.current) setFailedSources(failed => failed.includes(track) ? failed : [...failed, track])
    }
    const failSourceTrack = (source: SourceTrackCapture): void => {
      if (source.failed) return
      source.failed = true
      if (source.recorder.state !== 'inactive') source.recorder.stop()
      markSourceFailed(source.track)
    }
    for (const track of (saveSourceTracks ? ISOLATED_AUDIO_TRACKS : [])) {
      const input = inputs[track]!
      try {
        const destination = audioContext.createMediaStreamDestination()
        const recorder = new MediaRecorder(destination.stream, recorderOptions('audio', audioMime))
        const uploader = new PieceUploader(sendPieceTo(id, mimeType, track), state => {
          if (mounted.current) setSourceUploads(current => ({ ...current, [track]: state }))
          if (state.failed) failSourceTrack(source)
        }, undefined, journal.current?.id, track)
        const source = { track, destination, recorder, uploader, pendingDurations: [] as number[], failed: false }
        recorder.ondataavailable = ({ data }): void => {
          const duration = source.pendingDurations.shift()
          if (duration === undefined || source.failed) return
          if (data.size) uploader.add(data, duration)
          else failSourceTrack(source)
        }
        recorder.onerror = () => failSourceTrack(source)
        input.node.connect(destination)
        sourceTracks.push(source)
      } catch {
        markSourceFailed(track)
      }
    }
    audioRecorder.ondataavailable = (e: BlobEvent): void => {
      if (!e.data.size) return
      const ms = Math.round(recordedMs())
      const duration = ms - msAtLastPiece.current
      pieces.add(e.data, duration)
      // Cut both source streams on the combined recording's chunk boundaries.
      for (const source of sourceTracks) {
        if (source.failed || source.recorder.state === 'inactive') continue
        source.pendingDurations.push(duration)
        try { source.recorder.requestData() } catch {
          source.pendingDurations.pop()
          failSourceTrack(source)
        }
      }
      msAtLastPiece.current = ms
    }

    let videoRecorder: MediaRecorder | null = null
    const videoChunks: Blob[] = []
    const videoMime = opened.video ? pickVideoMime((t) => MediaRecorder.isTypeSupported(t)) : null
    if (opened.video && videoMime) {
      videoRecorder = new MediaRecorder(new MediaStream([opened.video, ...mix.stream.getAudioTracks()]), recorderOptions('video', videoMime))
      videoRecorder.ondataavailable = (e: BlobEvent): void => {
        if (e.data.size) videoChunks.push(e.data)
      }
    }

    capture.current = {
      streams: opened.streams,
      audioContext,
      audioRecorder,
      sourceTracks,
      splitAudio: saveSourceTracks,
      gaps: {},
      unwatch: {},
      inputs,
      mix,
      videoRecorder,
      videoChunks,
      preview: opened.video ? new MediaStream([opened.video]) : null,
    }
    if (inputs.mic) {
      void navigator.mediaDevices.enumerateDevices?.().then(devices => {
        if (mounted.current) setAudioInputs(devices.filter(device => device.kind === 'audioinput'))
      }).catch(() => {})
    }
    if (captureMode === 'camera') opened.video?.addEventListener('ended', () => void stop(), { once: true })

    startedAt.current = Date.now()
    bankedMs.current = 0
    activeSince.current = startedAt.current
    msAtLastPiece.current = 0
    setPaused(false)
    stopping.current = false
    audioRecorder.start(PIECE_MS)
    for (const source of sourceTracks) {
      try { source.recorder.start() } catch { failSourceTrack(source) }
    }
    videoRecorder?.start(10_000)
    meetingRef.current = id
    for (const track of ISOLATED_AUDIO_TRACKS) watchInput(capture.current, track)
    setMeetingId(id)
    setElapsedMs(0)
    setPhase('recording')
  }

  const handledQuickRequest = useRef(false)
  useEffect(() => {
    if (!quickRecordRequest) {
      handledQuickRequest.current = false
      return
    }
    if (handledQuickRequest.current) return
    handledQuickRequest.current = true
    onQuickRecordConsumed?.()
    if (phase === 'setup') {
      setMode('mic')
      setConsent(true)
      void start(true)
    }
  // Start once per explicit launcher click. Capture uses settings from that render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickRecordRequest])

  /** Resolve once a recorder has handed over its last piece. */
  const stopRecorder = (recorder: MediaRecorder | null): Promise<void> =>
    new Promise((resolve) => {
      if (!recorder || recorder.state === 'inactive') return resolve()
      recorder.addEventListener('stop', () => resolve(), { once: true })
      recorder.stop()
    })

  const stopAudio = async (current: Capture): Promise<void> => {
    // The combined recorder's last event asks both source recorders for their final piece.
    await stopRecorder(current.audioRecorder)
    await Promise.all(current.sourceTracks.map(source => stopRecorder(source.recorder)))
  }

  /** Pause or resume the recorders; paused time is not recorded and not counted. */
  const togglePause = (): void => {
    const c = capture.current
    if (!c || phase !== 'recording') return
    const now = Date.now()
    if (paused) {
      c.audioRecorder.resume()
      for (const source of c.sourceTracks) if (source.recorder.state === 'paused') source.recorder.resume()
      if (c.videoRecorder?.state === 'paused') c.videoRecorder.resume()
      activeSince.current = now
      setPaused(false)
    } else {
      c.audioRecorder.pause()
      for (const source of c.sourceTracks) if (source.recorder.state === 'recording') source.recorder.pause()
      if (journal.current) c.audioRecorder.requestData()
      if (c.videoRecorder?.state === 'recording') c.videoRecorder.pause()
      bankedMs.current = recordedMs(now)
      activeSince.current = null
      setPaused(true)
    }
    setElapsedMs(recordedMs(now))
  }

  const openPop = async (): Promise<void> => {
    if (pop) {
      pop.win.focus()
      onPopOut?.()
      return
    }
    let win: Window | null = null
    try {
      const pip = (window as unknown as { documentPictureInPicture?: { requestWindow: (o: { width: number; height: number }) => Promise<Window> } })
        .documentPictureInPicture
      const height = capture.current?.preview ? 420 : 230
      win = canPip() && pip ? await pip.requestWindow({ width: 360, height }) : window.open('', 'entomate-recorder', `popup,width=360,height=${height}`)
      if (!win) {
        setError('Your browser blocked the pop-out. Allow pop-ups for Entomate.')
        return
      }
      const root = dressWindow(win, 'Entomate · recording') as HTMLElement
      win.addEventListener('pagehide', () => setPop(current => current?.win === win ? null : current), { once: true })
      setPop({ win, root })
      setError(null)
      onPopOut?.()
    } catch {
      win?.close()
      setError('The pop-out could not open in this browser.')
    }
  }

  const stop = async (): Promise<void> => {
    const c = capture.current
    const pieces = uploader.current
    if (!c || !pieces || !meetingRef.current || stopping.current) return
    stopping.current = true
    bankedMs.current = recordedMs()
    activeSince.current = null
    setElapsedMs(bankedMs.current)
    setPhase('finishing')
    await Promise.all([stopAudio(c), stopRecorder(c.videoRecorder)])
    releaseDevices()
    if (c.videoRecorder && c.videoChunks.length) {
      setVideoUrl(URL.createObjectURL(new Blob(c.videoChunks, { type: c.videoRecorder.mimeType || 'video/webm' })))
    }
    await sendAll()
  }

  /** Send what is left and hand the recording over. Safe to call again after a failure. */
  const sendAll = async (): Promise<void> => {
    const pieces = uploader.current
    const id = meetingRef.current
    if (!pieces || !id) return
    setError(null)
    setPhase('finishing')
    try {
      await pieces.drain()
      await Promise.all((capture.current?.sourceTracks ?? []).map(source => source.uploader.drain().catch(() => {})))
      if (!mounted.current || uploader.current !== pieces) return
      if (pieces.state.recorded === 0) throw new Error('Nothing was recorded. Check the microphone and try again.')
      const coverage = await finishRecording(id, pieces.state.recorded, capture.current?.gaps)
      if (coverage) setFinishedTracks(receivedRecordingTracks(coverage))
      if (journal.current) {
        await recordingJournal.remove(id).catch(() => {})
        journal.current.release()
        journal.current = null
      }
      setPhase('done')
      onRecorded?.(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The recording could not be sent.')
      setTick((n) => n + 1)
    }
  }

  const discard = async (): Promise<void> => {
    const id = meetingRef.current
    if (!id) return
    uploader.current?.cancel()
    capture.current?.sourceTracks.forEach(source => source.uploader.cancel())
    try {
      await discardRecording(id)
      if (journal.current) {
        await recordingJournal.remove(id).catch(() => {})
        journal.current.release()
        journal.current = null
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The recording could not be discarded.')
      return
    }
    reset()
  }

  const reset = (): void => {
    onReset?.()
    setPaused(false)
    capture.current = null
    uploader.current = null
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    setVideoUrl(null)
    meetingRef.current = null
    setMeetingId(null)
    setUpload(EMPTY_UPLOAD)
    setFailedSources([])
    setSourceUploads({})
    setRecoveryProgress({})
    setFinishedTracks(null)
    setElapsedMs(0)
    setError(null)
    setHandedToBot(false)
    setBotCheck((n) => n + 1)
    setPhase('setup')
  }

  const c = capture.current
  const waiting = upload.recorded - upload.sent
  const locked = phase !== 'setup' || Boolean(recovering)
  const showSetup = phase === 'setup' || phase === 'starting'
  const mic = c?.inputs.mic
  const tab = c?.inputs.tab
  const tabGap = c?.gaps.tabAudioGaps?.at(-1)
  const micGap = c?.gaps.micAudioGaps?.at(-1)
  const micAvailable = hasAudio(mic?.track)
  const tabAvailable = hasAudio(tab?.track)
  const currentMic = mic?.track.readyState === 'live' ? mic.track.getSettings?.().deviceId ?? 'default' : ''
  const selectedMic = currentMic === 'default' || audioInputs.some(device => device.deviceId === currentMic) ? currentMic : ''
  const inputControls = c && phase === 'recording' && (
    <div className="space-y-2 rounded-lg border border-line px-3 py-2">
      <LevelMeter context={c.audioContext} source={mic ?? null} label="Microphone" paused={paused} />
      {tab && <LevelMeter context={c.audioContext} source={tab} label="Tab audio" paused={paused} />}
      {tabGap?.endMs === null && <p role="status" className="text-xs text-semantic-error">
        Tab audio interrupted at {formatClock(tabGap.startMs)}. {paused ? 'Recording is paused.'
          : micAvailable ? 'Microphone is still recording.' : 'No audio source is available.'}
      </p>}
      {micGap?.endMs === null && <p role="status" className="text-xs text-semantic-error">
        Microphone interrupted at {formatClock(micGap.startMs)}. {paused ? 'Recording is paused.'
          : tabAvailable ? 'Tab audio is still recording.' : 'Choose an available microphone.'}
      </p>}
      {mic && <MicModeSelect value={mic.track.readyState === 'live' ? reportedMicMode(mic.track) : null}
        disabled={changingInput || mic.track.readyState !== 'live'} onChange={next => void changeInput('mic', { micMode: next })} />}
      {micModeNotice && <p role="status" className="text-xs text-content-secondary">{micModeNotice}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {mic && (
          <label className="flex items-center gap-2 text-sm">
            Microphone
            <select className={INPUT} aria-label="Recording microphone" disabled={changingInput} value={selectedMic}
              onChange={event => void changeInput('mic', { deviceId: event.currentTarget.value })}>
              <option value="" disabled>Choose a microphone</option>
              <option value="default">System default</option>
              {audioInputs.filter(device => device.deviceId && device.deviceId !== 'default').map((device, index) => (
                <option key={device.deviceId} value={device.deviceId}>{device.label || 'Microphone ' + (index + 1)}</option>
              ))}
            </select>
          </label>
        )}
        {tab && <button type="button" className={SECONDARY} disabled={changingInput}
          onClick={event => void changeInput('tab', { view: event.currentTarget.ownerDocument.defaultView })}>Re-share tab audio</button>}
        {tab && mic && <button type="button" className={SECONDARY} disabled={mic.track.readyState === 'ended'} onClick={toggleMic}>
          {mic.track.enabled ? 'Mute mic' : 'Unmute mic'}
        </button>}
      </div>
    </div>
  )
  const liveTracks: TrackSaveStates = { mix: upload }
  if (c?.splitAudio) {
    for (const track of ISOLATED_AUDIO_TRACKS) {
      const state = sourceUploads[track] ?? EMPTY_UPLOAD
      liveTracks[track] = { ...state, failed: failedSources.includes(track) || state.failed }
    }
  }
  const saveStatus = (
    <div aria-live="polite" className="space-y-1 text-xs text-content-secondary">
      {upload.failed && <p role="alert">{upload.failed}</p>}
      <TrackSaveStatus tracks={liveTracks} sending />
      {c?.splitAudio && userId && !journal.current && <p>Device storage is unavailable. Keep this tab open until uploads finish.</p>}
    </div>
  )
  const status = phase === 'finishing' ? (error ? 'Audio needs attention' : 'Sending the last of the audio') : paused ? 'Paused' : 'Recording'

  return (
    <section aria-labelledby={`${uid}-heading`} className="space-y-4 rounded-xl border border-line bg-surface-elevated p-4">
      <h3 ref={heading} id={`${uid}-heading`} tabIndex={-1} className="text-base font-semibold text-content-primary">
        {showSetup ? 'Record in this browser' : title.trim() || 'Meeting recording'}
      </h3>

      {error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-semantic-error">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" /> {error}
        </p>
      )}

      {phase === 'done' && meetingId ? (
        <div className="space-y-3" aria-live="polite">
          <TrackSaveStatus tracks={finishedTracks ?? liveTracks} final />
          <p ref={savedStatus} tabIndex={-1} className="text-sm text-content-primary">
            {!capture.current ? 'Recording recovered. Open the meeting to see its transcript status.' : handedToBot
              ? 'Recording saved with the bot’s meeting. The bot writes the minutes; your recording is kept as a backup and is written up on its own if the bot cannot finish.'
              : 'Recording saved. The transcript, speakers, summary and action items are being written now. This takes about a minute for every ten minutes recorded.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={PRIMARY} onClick={() => openMeeting(meetingId)}>
              Open the meeting
            </button>
            {videoUrl && (
              <a className={SECONDARY} href={videoUrl} download={`${title.trim() || 'meeting'}.webm`}>
                <Download className="h-4 w-4" aria-hidden="true" /> Download the video
              </a>
            )}
            <button type="button" className={SECONDARY} onClick={reset}>
              Record another
            </button>
          </div>
          {videoUrl && <p className="text-xs text-content-secondary">The video stays on this device. Download it before leaving this page.</p>}
        </div>
      ) : showSetup ? (
        <>
          {savedRecordings.some(saved => saved.userId === userId) && (
            <section aria-label="Interrupted recordings" className="space-y-2 rounded-lg border border-line p-3">
              <h4 className="text-sm font-medium text-content-primary">Interrupted recordings</h4>
              {savedRecordings.filter(saved => saved.userId === userId).map(saved => {
                const tracks: TrackSaveStates = {}
                for (const track of (saved.splitAudio ? ['mix', ...ISOLATED_AUDIO_TRACKS] as const : ['mix'] as const)) {
                  tracks[track] = {
                    savedMs: savedTrackCoverage(saved, track).durationMs,
                    sentMs: saved.receivedTracks && (saved.receivedTracks[track]?.durationMs ?? 0),
                  }
                }
                const visible = recoveryProgress[saved.id] ?? tracks
                const hasPendingUpload = Object.values(visible).some(state => state.sentMs !== undefined && state.savedMs > state.sentMs)
                return (
                  <div key={saved.id} className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0 break-words text-sm">
                      <p>{saved.title}</p>
                      <TrackSaveStatus tracks={visible} sending={recovering === saved.id} />
                    </div>
                    <button type="button" className={SECONDARY} disabled={locked} onClick={() => void recover(saved)}>
                      {recovering === saved.id ? 'Recovering…' : hasPendingUpload ? 'Resume upload' : 'Recover and save'}
                    </button>
                  </div>
                )
              })}
            </section>
          )}
          {bot && (
            <fieldset data-testid="recorder-bot" className="space-y-2 rounded-lg border border-line p-3" disabled={locked}>
              <legend className="flex items-center gap-2 px-1 text-sm font-medium text-content-primary">
                <Bot className="h-4 w-4 text-accent-primary" aria-hidden="true" />
                {bot.phase === 'live' ? 'Your bot is in a call now' : bot.phase === 'scheduled' ? 'Your bot joins a call soon' : 'Your bot is joining a call'}
              </legend>
              <p className="text-xs text-content-secondary">
                {bot.title ? <>&ldquo;{bot.title}&rdquo;. </> : null}
                It takes the notes for that call. Recording the same call here would make a second meeting with every action item twice.
              </p>
              <label className="flex items-start gap-2 text-sm text-content-primary">
                <input type="radio" name={`${uid}-bot`} checked={sameAsBot} onChange={() => setSameAsBot(true)} className="mt-0.5 h-4 w-4 accent-accent-primary" />
                <span>
                  Same call: add my recording to the bot&apos;s meeting
                  <span className="block text-xs text-content-secondary">One meeting. The bot writes the minutes; yours is the backup.</span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-content-primary">
                <input type="radio" name={`${uid}-bot`} checked={!sameAsBot} onChange={() => setSameAsBot(false)} className="mt-0.5 h-4 w-4 accent-accent-primary" />
                <span>A different meeting</span>
              </label>
              <button type="button" className="text-xs font-medium text-accent-primary underline-offset-2 hover:underline" onClick={() => openMeeting(bot.meetingId)}>
                Open the bot&apos;s meeting
              </button>
            </fieldset>
          )}

          <fieldset disabled={locked} className="space-y-2">
            <legend className="mb-1.5 text-xs font-medium text-content-secondary">What to record</legend>
            <div className="flex flex-wrap gap-2">
              {MODE_OPTIONS.filter((o) => o.mode !== 'tab' || tabSupported).map(({ mode: m, label, Icon }) => (
                <label
                  key={m}
                  className={`flex min-h-10 flex-1 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border px-3 py-2 text-sm font-medium text-content-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent-primary ${
                    mode === m ? 'border-accent-primary bg-accent-primary-dim' : 'border-line hover:border-line-strong'
                  }`}
                >
                  <input type="radio" name={`${uid}-mode`} value={m} checked={mode === m} onChange={() => setMode(m)} className="sr-only" />
                  <Icon className="h-4 w-4 flex-shrink-0 text-content-secondary" aria-hidden="true" />
                  {label}
                </label>
              ))}
            </div>
            <p className="text-xs text-content-secondary">{MODE_OPTIONS.find((o) => o.mode === mode)?.hint}</p>
            {mode === 'tab' && (
              <label className="flex items-center gap-2 text-sm text-content-primary">
                <input type="checkbox" checked={withMic} onChange={(e) => setWithMic(e.target.checked)} className="h-4 w-4 accent-accent-primary" />
                Also record my microphone
              </label>
            )}
            {mode === 'tab' && withMic && !(bot && sameAsBot) && (
              <label className="flex items-start gap-2 text-sm text-content-primary">
                <input type="checkbox" checked={splitAudio} onChange={event => setSplitAudio(event.target.checked)} className="mt-0.5 h-4 w-4 accent-accent-primary" />
                <span>Save separate mic and tab tracks <span className="block text-xs text-content-secondary">Listen to either source in the recap. Uses extra storage.</span></span>
              </label>
            )}
            {mode === 'tab' && (
              <p className="text-xs text-content-secondary">
                Choose the tab with the call and turn on &quot;Also share tab audio&quot;. Chrome and Edge share tab sound; other browsers may share video only.
              </p>
            )}
            {captionsSupported && (
              <>
                <label className="flex items-center gap-2 text-sm text-content-primary">
                  <input type="checkbox" checked={captions} onChange={(e) => setCaptions(e.target.checked)} className="h-4 w-4 accent-accent-primary" />
                  Show live captions while recording
                </label>
                <p className="text-xs text-content-secondary">
                  A rough preview without speakers, from your browser&apos;s speech service (Chrome sends the audio to Google). Captions are not saved;
                  the transcript with speakers is written after you stop.
                </p>
              </>
            )}
          </fieldset>

          {(mode !== 'tab' || withMic) && <fieldset disabled={locked} className="space-y-2 rounded-lg border border-line px-3 py-2">
            <legend className="px-1 text-xs font-medium text-content-secondary">Microphone setup</legend>
            <MicModeSelect value={micMode} onChange={setMicMode} />
            <p className="text-xs text-content-secondary">Original mic turns off noise reduction and keeps the recorder’s echo cancellation setting.</p>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={SECONDARY} disabled={micCheck.running} onClick={() => void micCheck.start()}>
                {micCheck.playback ? 'Repeat mic check' : 'Run five-second mic check'}
              </button>
              {micCheck.running && <button type="button" className={SECONDARY} onClick={micCheck.clear}>Cancel mic check</button>}
            </div>
            {micCheck.running && <p role="status" className="text-xs text-content-secondary">Recording a five-second mic sample…</p>}
            {micCheck.error && <p role="alert" className="text-xs text-semantic-error">{micCheck.error}</p>}
            {micCheck.playback && <div className="space-y-1">
              <p role="status" className="text-xs text-content-secondary">
                Mic check ready{micCheck.playback.label ? ' · ' + micCheck.playback.label : ''} · {micCheck.playback.mode ? MIC_MODES[micCheck.playback.mode] : 'Mode not reported'}
                {micCheck.playback.level ? <>
                  <strong className="mt-1 block text-content-primary">{MIC_CHECK_LEVELS[micCheck.playback.level][0]}</strong>
                  {MIC_CHECK_LEVELS[micCheck.playback.level][1]}
                </> : <span className="mt-1 block">Level unavailable. Play the sample to hear your microphone.</span>}
              </p>
              <audio ref={micCheckAudio} className="w-full" src={micCheck.playback.url} controls aria-label="Mic check playback" />
            </div>}
          </fieldset>}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`${uid}-title`} className="mb-1 block text-xs font-medium text-content-secondary">
                Title (optional)
              </label>
              <input id={`${uid}-title`} type="text" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} disabled={locked} className={INPUT} />
            </div>
            <div>
              <label htmlFor={`${uid}-attendees`} className="mb-1 block text-xs font-medium text-content-secondary">
                Attendees (optional)
              </label>
              <input
                id={`${uid}-attendees`}
                type="text"
                placeholder="Comma-separated names or emails"
                value={attendees}
                onChange={(e) => setAttendees(e.target.value)}
                disabled={locked}
                className={INPUT}
              />
            </div>
          </div>

          <label className="flex items-start gap-2 text-sm text-content-primary">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} disabled={locked} className="mt-0.5 h-4 w-4 accent-accent-primary" />
            Everyone in this meeting knows it is being recorded and has agreed.
          </label>
          <button type="button" className={`${PRIMARY} w-full`} onClick={() => void start()} disabled={!consent || Boolean(recovering) || phase === 'starting' || micCheck.running}>
            {phase === 'starting' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
            {phase === 'starting' ? 'Starting' : 'Start recording'}
          </button>
        </>
      ) : (
        <div className="m-enter space-y-3">
          {inputControls}
          {saveStatus}
          {c?.preview && phase === 'recording' && <Preview stream={c.preview} />}
          <div className="flex items-center justify-between gap-3">
            <span ref={liveStatus} tabIndex={-1} role="status" className="flex items-center gap-2 text-sm font-medium text-content-primary">
              {phase === 'recording' && !paused && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent-primary" aria-hidden="true" />}
              {status}
            </span>
            <span className="font-mono text-2xl tabular-nums text-content-primary" aria-label={`Recorded ${formatClock(elapsedMs)}`}>
              {formatClock(elapsedMs)}
            </span>
          </div>
          {c && phase === 'recording' && !paused && <SilenceAlert context={c.audioContext} stream={c.audioRecorder.stream} mode={mode} />}
          {c && phase === 'recording' && !paused && captions && micAvailable && (
            <LiveCaptions
              track={c.audioRecorder.stream.getAudioTracks()[0] ?? null}
              startedAt={startedAt.current}
              onClose={() => setCaptions(false)}
            />
          )}
          <p className="text-xs text-content-secondary" aria-live="polite">
            {upload.failed
              ? upload.failed
              : paused
                ? 'Paused. Nothing is recorded until you resume.'
                : upload.retrying
                ? 'Connection lost. The audio is kept here and will be sent when it is back.'
                : waiting > 1
                  ? `${waiting} pieces waiting to be sent.`
                  : upload.sent > 0
                    ? `Saved to Entomate up to ${formatClock(upload.sent * PIECE_MS)}.`
                    : 'Audio is saved to Entomate every 30 seconds.'}
          </p>
          <div className="flex flex-wrap gap-2">
            {phase === 'recording' ? (
              <>
                <button type="button" className={`${PRIMARY} flex-1`} onClick={() => void stop()}>
                  <Square className="h-4 w-4" aria-hidden="true" /> Stop recording
                </button>
                <button type="button" className={SECONDARY} onClick={togglePause} aria-pressed={paused}>
                  {paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
                  {paused ? 'Resume' : 'Pause'}
                </button>
                {/* Desktop only: phones have no second window. */}
                {tabSupported && (
                  <button type="button" className={SECONDARY} onClick={() => void openPop()}>
                    <ExternalLink className="h-4 w-4" aria-hidden="true" /> {pop ? 'Focus pop-out' : 'Pop out'}
                  </button>
                )}
              </>
            ) : error ? (
              <button type="button" className={`${PRIMARY} flex-1`} onClick={() => void sendAll()}>
                Try sending again
              </button>
            ) : (
              <span className="flex flex-1 items-center gap-2 text-sm text-content-secondary">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Finishing
              </span>
            )}
            {(phase === 'recording' || error) && (
              <button
                type="button"
                className={SECONDARY}
                onClick={() => {
                  if (window.confirm('Discard this recording? The audio will be deleted.')) {
                    void (async () => {
                      const c2 = capture.current
                      if (c2) {
                        stopping.current = true
                        await Promise.all([stopAudio(c2), stopRecorder(c2.videoRecorder)])
                        releaseDevices()
                      }
                      await discard()
                    })()
                  }
                }}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" /> Discard
              </button>
            )}
          </div>
        </div>
      )}
      {pop &&
        (phase === 'recording' || phase === 'finishing') &&
        createPortal(
          <section className="meeting-recorder-pop bs-skin m-enter" aria-label="Meeting recording" data-testid="recorder-pop">
            <div className="flex items-center justify-between gap-3">
              <span role="status" className="flex items-center gap-2 text-sm font-semibold">
                {phase === 'recording' && !paused && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent-primary" aria-hidden="true" />}
                {status}
              </span>
              <span className="font-mono text-2xl tabular-nums" aria-label={`Recorded ${formatClock(elapsedMs)}`}>{formatClock(elapsedMs)}</span>
            </div>
            {c?.preview && phase === 'recording' && <Preview stream={c.preview} />}
            {c && phase === 'recording' && !paused && <SilenceAlert context={c.audioContext} stream={c.audioRecorder.stream} mode={mode} />}
            {inputControls}
            {saveStatus}
            {error && <p role="alert" className="text-sm text-semantic-error">{error}</p>}
            {phase === 'recording' && (
              <div className="flex flex-wrap gap-2">
                <button type="button" className={`${PRIMARY} flex-1`} onClick={() => void stop()}>
                  <Square className="h-4 w-4" aria-hidden="true" /> Stop recording
                </button>
                <button type="button" className={`${SECONDARY} flex-1`} onClick={togglePause}>
                  {paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
                  {paused ? 'Resume' : 'Pause'}
                </button>
              </div>
            )}
            {phase === 'finishing' && error && (
              <button type="button" className={PRIMARY} onClick={() => void sendAll()}>Try sending again</button>
            )}
          </section>,
          pop.root,
        )}
    </section>
  )
}

export default MeetingRecorder
