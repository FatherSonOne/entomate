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
import { lockRecording, recordingJournal, type SavedRecording } from '../../services/recordingJournal'
import type { IsolatedAudioTrack } from '../../services/recordingAudioTracks'
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
  splitInputs: Partial<Record<IsolatedAudioTrack, SplitInput>>
  mix: MediaStreamAudioDestinationNode
  videoRecorder: MediaRecorder | null
  videoChunks: Blob[]
  preview: MediaStream | null
}

interface SplitInput {
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

interface DisplayMediaOptionsWithAudio extends DisplayMediaStreamOptions {
  selfBrowserSurface?: 'include' | 'exclude'
  systemAudio?: 'include' | 'exclude'
}

/** Level meter: bars drawn from the mixed audio. Colour comes from the theme's accent. */
function LevelMeter({ context, stream }: { context: AudioContext; stream: MediaStream }): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const analyser = context.createAnalyser()
    analyser.fftSize = 256
    const source = context.createMediaStreamSource(stream)
    source.connect(analyser)
    const data = new Uint8Array(analyser.frequencyBinCount)
    // The window showing the canvas: in the pop-out it keeps animating while the app's tab is hidden.
    const view = canvas.ownerDocument.defaultView ?? window
    const accent = view.getComputedStyle(canvas).color || '#888'
    let frame = 0
    const draw = (): void => {
      frame = view.requestAnimationFrame(draw)
      analyser.getByteFrequencyData(data)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const bars = 32
      const width = canvas.width / bars
      const step = Math.floor(data.length / bars)
      for (let i = 0; i < bars; i++) {
        const level = (data[i * step] ?? 0) / 255
        ctx.globalAlpha = 0.15 + level * 0.85
        ctx.fillStyle = accent
        ctx.fillRect(i * width, canvas.height * (1 - level), width - 1, canvas.height * level)
      }
    }
    draw()
    return () => {
      view.cancelAnimationFrame(frame)
      source.disconnect()
    }
  }, [context, stream])

  return <canvas ref={canvasRef} width={300} height={32} aria-hidden="true" className="h-8 w-full text-accent-primary" />
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
  const [splitAudio, setSplitAudio] = useState(false)
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([])
  const [changingInput, setChangingInput] = useState(false)
  const pendingInput = useRef(false)
  const [sourceTrackWarning, setSourceTrackWarning] = useState(false)
  const [savedRecordings, setSavedRecordings] = useState<SavedRecording[]>([])
  const [recovering, setRecovering] = useState(false)
  const journal = useRef<{ id: string; release: () => void } | null>(null)
  const mounted = useRef(false)
  const [title, setTitle] = useState('')
  const [attendees, setAttendees] = useState('')
  const [consent, setConsent] = useState(false)
  // Live captions are opt-in: the browser's speech service (Google, in Chrome) hears the audio.
  const [captions, setCaptions] = useState(false)
  const [phase, setPhase] = useState<Phase>('setup')
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
  const captureActive = phase === 'starting' || phase === 'recording' || phase === 'finishing'

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
    c.streams.forEach((s) => s.getTracks().forEach((t) => t.stop()))
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

  const recover = async (id: string): Promise<void> => {
    if (!userId || recovering) return
    setRecovering(true)
    setError(null)
    try {
      await recoverRecording(id, userId)
      setSavedRecordings(rows => rows.filter(row => row.id !== id))
      openMeeting(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The saved recording could not be recovered.')
    } finally {
      setRecovering(false)
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
    const micConstraints: MediaTrackConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      ...(audioInputDeviceId ? { deviceId: { exact: audioInputDeviceId } } : {}),
    }
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

  const changeInput = async (kind: IsolatedAudioTrack, deviceId?: string): Promise<void> => {
    const current = capture.current
    const previous = current?.splitInputs[kind]
    if (!current || !previous || pendingInput.current || stopping.current) return
    pendingInput.current = true
    setChangingInput(true)
    setError(null)
    let replacement: MediaStream | undefined
    try {
      const mediaDevices = navigator.mediaDevices
      if (kind === 'mic') {
        replacement = await mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, ...(deviceId && deviceId !== 'default' ? { deviceId: { exact: deviceId } } : {}) },
        })
      } else {
        const options: DisplayMediaOptionsWithAudio = { video: true, audio: true, selfBrowserSurface: 'exclude', systemAudio: 'include' }
        replacement = await mediaDevices.getDisplayMedia(options)
      }
      if (capture.current !== current || stopping.current) return
      const track = replacement.getAudioTracks()[0]
      if (!track || track.readyState !== 'live') {
        throw new Error(kind === 'tab' ? 'Choose a browser tab and turn on “Also share tab audio”.' : 'The microphone did not provide audio.')
      }
      const node = current.audioContext.createMediaStreamSource(new MediaStream([track]))
      node.connect(current.mix)
      const source = current.sourceTracks.find(side => side.track === kind && !side.failed)
      if (source) node.connect(source.destination)
      previous.node.disconnect()
      // The original tab may still be writing a local video preview. Replacing
      // audio leaves its video track alone until the user stops that share.
      previous.track.stop()
      current.streams = current.streams.filter(stream => stream !== previous.stream || stream.getVideoTracks().length > 0)
      current.streams.push(replacement)
      current.splitInputs[kind] = { stream: replacement, track, node }
      replacement = undefined
    } catch (err) {
      if (capture.current === current && !stopping.current) setError(captureErrorMessage(err, kind))
    } finally {
      replacement?.getTracks().forEach(track => track.stop())
      pendingInput.current = false
      if (mounted.current) setChangingInput(false)
    }
  }

  const start = async (quick = false): Promise<void> => {
    if (phase !== 'setup' || recovering || (!consent && !quick)) return
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
    const splitInputs: Capture['splitInputs'] = {}
    opened.streams.forEach((stream, index) => {
      for (const track of stream.getAudioTracks()) {
        const node = audioContext.createMediaStreamSource(new MediaStream([track]))
        node.connect(mix)
        if (saveSourceTracks) splitInputs[index === 0 ? 'tab' : 'mic'] ??= { stream, track, node }
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
          await recordingJournal.create({ id, userId, title: title.trim() || 'Meeting recording', mimeType })
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
    setSourceTrackWarning(false)
    setHandedToBot(!quick && Boolean(bot && sameAsBot))

    const pieces = new PieceUploader(sendPieceTo(id, mimeType), setUpload, undefined, journal.current?.id)
    uploader.current = pieces
    const audioRecorder = new MediaRecorder(mix.stream, recorderOptions('audio', audioMime))
    const sourceTracks: SourceTrackCapture[] = []
    const failSourceTrack = (source: SourceTrackCapture): void => {
      if (source.failed) return
      source.failed = true
      if (source.recorder.state !== 'inactive') source.recorder.stop()
      if (mounted.current) setSourceTrackWarning(true)
    }
    for (const track of Object.keys(splitInputs) as IsolatedAudioTrack[]) {
      const input = splitInputs[track]!
      try {
        const destination = audioContext.createMediaStreamDestination()
        const recorder = new MediaRecorder(destination.stream, recorderOptions('audio', audioMime))
        const uploader = new PieceUploader(sendPieceTo(id, mimeType, track), state => {
          if (state.failed) failSourceTrack(source)
          else if (state.localSaveFailed && mounted.current) setSourceTrackWarning(true)
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
        setSourceTrackWarning(true)
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
      splitInputs,
      mix,
      videoRecorder,
      videoChunks,
      preview: opened.video ? new MediaStream([opened.video]) : null,
    }
    // "Stop sharing" in the browser's own bar, or a camera unplugged, ends the recording.
    if (saveSourceTracks) {
      void navigator.mediaDevices.enumerateDevices?.().then(devices => {
        if (mounted.current) setAudioInputs(devices.filter(device => device.kind === 'audioinput'))
      }).catch(() => {})
    } else {
      opened.streams.forEach(stream => stream.getTracks().forEach(track => track.addEventListener('ended', () => void stop())))
    }

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
      await Promise.all((capture.current?.sourceTracks ?? []).map(source => source.uploader.drain().catch(() => {
        if (mounted.current) setSourceTrackWarning(true)
      })))
      if (pieces.state.recorded === 0) throw new Error('Nothing was recorded. Check the microphone and try again.')
      await finishRecording(id, pieces.state.recorded)
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
    setSourceTrackWarning(false)
    setElapsedMs(0)
    setError(null)
    setHandedToBot(false)
    setBotCheck((n) => n + 1)
    setPhase('setup')
  }

  const c = capture.current
  const waiting = upload.recorded - upload.sent
  const locked = phase !== 'setup'
  const showSetup = phase === 'setup' || phase === 'starting'
  const inputControls = capture.current?.splitInputs.tab && phase === 'recording' && (
    <div className="flex flex-wrap items-center gap-2">
      {audioInputs.length > 0 && (
        <label className="flex items-center gap-2 text-sm">
          Microphone
          <select className={INPUT} aria-label="Recording microphone" disabled={changingInput}
            value={capture.current.splitInputs.mic?.track.getSettings?.().deviceId ?? 'default'}
            onChange={event => void changeInput('mic', event.currentTarget.value)}>
            <option value="default">System default</option>
            {audioInputs.filter(device => device.deviceId && device.deviceId !== 'default').map((device, index) => (
              <option key={device.deviceId} value={device.deviceId}>{device.label || 'Microphone ' + (index + 1)}</option>
            ))}
          </select>
        </label>
      )}
      <button type="button" className={SECONDARY} disabled={changingInput}
        onClick={() => void changeInput('tab')}>Re-share tab audio</button>
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
          {sourceTrackWarning && <p className="text-xs text-content-secondary">Some separate audio may be unavailable in the recap.</p>}
          <p ref={savedStatus} tabIndex={-1} className="text-sm text-content-primary">
            {handedToBot
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
          {savedRecordings.length > 0 && (
            <section aria-label="Recover separate audio" className="space-y-2">
              {savedRecordings.map(saved => (
                <button type="button" className={SECONDARY} key={saved.id} disabled={recovering} onClick={() => void recover(saved.id)}>
                  Recover recording · {saved.title}
                </button>
              ))}
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
          <button type="button" className={`${PRIMARY} w-full`} onClick={() => void start()} disabled={!consent || recovering || phase === 'starting'}>
            {phase === 'starting' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
            {phase === 'starting' ? 'Starting' : 'Start recording'}
          </button>
        </>
      ) : (
        <div className="m-enter space-y-3">
          {c?.preview && phase === 'recording' && <Preview stream={c.preview} />}
          <div className="flex items-center justify-between gap-3">
            {inputControls}
            <span ref={liveStatus} tabIndex={-1} role="status" className="flex items-center gap-2 text-sm font-medium text-content-primary">
              {phase === 'recording' && !paused && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent-primary" aria-hidden="true" />}
              {status}
            </span>
            <span className="font-mono text-2xl tabular-nums text-content-primary" aria-label={`Recorded ${formatClock(elapsedMs)}`}>
              {formatClock(elapsedMs)}
            </span>
          </div>
          {c && phase === 'recording' && !paused && (
            <LevelMeter context={c.audioContext} stream={c.audioRecorder.stream} />
          )}
          {c && phase === 'recording' && !paused && <SilenceAlert context={c.audioContext} stream={c.audioRecorder.stream} mode={mode} />}
          {c && phase === 'recording' && !paused && captions && (
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
            {c && phase === 'recording' && !paused && <LevelMeter context={c.audioContext} stream={c.audioRecorder.stream} />}
            {c && phase === 'recording' && !paused && <SilenceAlert context={c.audioContext} stream={c.audioRecorder.stream} mode={mode} />}
            {inputControls}
            {sourceTrackWarning && <p role="status" className="text-xs text-content-secondary">Some separate audio may be unavailable in the recap.</p>}
            {phase === 'finishing' && error ? <p role="alert" className="text-sm text-semantic-error">{error}</p> : (
              <p className="text-xs text-content-secondary" aria-live="polite">
                {upload.failed ?? (paused ? 'Nothing is recorded until you resume.'
                  : upload.retrying ? 'Connection lost. The audio is kept and sent when it is back.'
                    : upload.sent > 0 ? `Saved up to ${formatClock(upload.sent * PIECE_MS)}.`
                      : 'Audio is saved every 30 seconds.')}
              </p>
            )}
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
