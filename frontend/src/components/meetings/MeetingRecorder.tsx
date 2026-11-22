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
 */

import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Camera, Download, Loader2, Mic, MonitorUp, Square, Trash2 } from 'lucide-react'
import { formatClock } from '../../services/meetingTranscriptService'
import LiveCaptions, { speechRecognitionCtor } from './LiveCaptions'
import {
  PIECE_MS,
  PieceUploader,
  baseMime,
  captureErrorMessage,
  discardRecording,
  finishRecording,
  pickAudioMime,
  pickVideoMime,
  recorderOptions,
  sendPieceTo,
  startRecording,
  tabCaptureSupported,
  type RecorderMode,
  type UploaderState,
} from '../../services/meetingRecorderService'

export interface MeetingRecorderProps {
  /** A microphone chosen in Settings; the default one when empty. */
  audioInputDeviceId?: string
  /** Called once the recording is handed to the server for its transcript. */
  onRecorded?: (meetingId: string) => void
}

type Phase = 'setup' | 'starting' | 'recording' | 'finishing' | 'done'

interface Capture {
  streams: MediaStream[]
  audioContext: AudioContext
  audioRecorder: MediaRecorder
  videoRecorder: MediaRecorder | null
  videoChunks: Blob[]
  preview: MediaStream | null
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
    const accent = getComputedStyle(canvas).color || '#888'
    let frame = 0
    const draw = (): void => {
      frame = requestAnimationFrame(draw)
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
      cancelAnimationFrame(frame)
      source.disconnect()
    }
  }, [context, stream])

  return <canvas ref={canvasRef} width={300} height={32} aria-hidden="true" className="h-8 w-full text-accent-primary" />
}

function Preview({ stream }: { stream: MediaStream }): React.ReactElement {
  const ref = useRef<HTMLVideoElement | null>(null)
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream
  }, [stream])
  return <video ref={ref} autoPlay muted playsInline aria-label="Recording preview" className="aspect-video w-full rounded-lg bg-black object-contain" />
}

export function MeetingRecorder({ audioInputDeviceId, onRecorded }: MeetingRecorderProps): React.ReactElement {
  const navigate = useNavigate()
  // Unique per recorder, so two on one page (or a test harness) never share a radio group.
  const uid = useId()
  const [mode, setMode] = useState<RecorderMode>('mic')
  const [withMic, setWithMic] = useState(true)
  const [title, setTitle] = useState('')
  const [attendees, setAttendees] = useState('')
  const [consent, setConsent] = useState(false)
  // Live captions are opt-in: the browser's speech service (Google, in Chrome) hears the audio.
  const [captions, setCaptions] = useState(false)
  const [phase, setPhase] = useState<Phase>('setup')
  const [error, setError] = useState<string | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [upload, setUpload] = useState<UploaderState>({ recorded: 0, sent: 0, retrying: false, failed: null })
  const [meetingId, setMeetingId] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [, setTick] = useState(0)

  const capture = useRef<Capture | null>(null)
  const uploader = useRef<PieceUploader | null>(null)
  const startedAt = useRef(0)
  const lastPieceAt = useRef(0)
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

  // Leaving the page mid-recording: stop the devices; warn before losing unsent audio.
  useEffect(() => () => releaseDevices(), [releaseDevices])
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
    const timer = window.setInterval(() => setElapsedMs(Date.now() - startedAt.current), 500)
    return () => window.clearInterval(timer)
  }, [phase])

  /** Ask the browser for the devices the chosen mode needs. */
  const openStreams = async (): Promise<{ streams: MediaStream[]; video: MediaStreamTrack | null }> => {
    const md = navigator.mediaDevices
    if (!md?.getUserMedia) throw new Error('This browser cannot record. Try a current Chrome, Edge, Firefox or Safari.')
    const micConstraints: MediaTrackConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      ...(audioInputDeviceId ? { deviceId: { exact: audioInputDeviceId } } : {}),
    }
    if (mode === 'mic') return { streams: [await md.getUserMedia({ audio: micConstraints })], video: null }
    if (mode === 'camera') {
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
    if (!streams.some((s) => s.getAudioTracks().length)) {
      streams.forEach((s) => s.getTracks().forEach((t) => t.stop()))
      throw new Error('No sound was shared. Share a tab and turn on "Also share tab audio", or record your microphone too.')
    }
    return { streams, video: tab.getVideoTracks()[0] ?? null }
  }

  const start = async (): Promise<void> => {
    if (phase !== 'setup' || !consent) return
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
      opened = await openStreams()
    } catch (err) {
      setError(captureErrorMessage(err, mode))
      setPhase('setup')
      return
    }

    // Every source (tab sound, microphone) mixed into one track for the transcript.
    const audioContext = new AudioContext()
    const mix = audioContext.createMediaStreamDestination()
    for (const s of opened.streams) {
      for (const track of s.getAudioTracks()) audioContext.createMediaStreamSource(new MediaStream([track])).connect(mix)
    }
    void audioContext.resume()

    let id: string
    try {
      ;({ meetingId: id } = await startRecording({ title, attendees, mode, mimeType: audioMime }))
    } catch (err) {
      opened.streams.forEach((s) => s.getTracks().forEach((t) => t.stop()))
      void audioContext.close()
      setError(err instanceof Error ? err.message : 'The recording could not be started.')
      setPhase('setup')
      return
    }

    const pieces = new PieceUploader(sendPieceTo(id, baseMime(audioMime)), setUpload)
    uploader.current = pieces
    const audioRecorder = new MediaRecorder(mix.stream, recorderOptions('audio', audioMime))
    audioRecorder.ondataavailable = (e: BlobEvent): void => {
      const now = Date.now()
      pieces.add(e.data, now - lastPieceAt.current)
      lastPieceAt.current = now
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
      videoRecorder,
      videoChunks,
      preview: opened.video ? new MediaStream([opened.video]) : null,
    }
    // "Stop sharing" in the browser's own bar, or a camera unplugged, ends the recording.
    opened.streams.forEach((s) => s.getTracks().forEach((t) => t.addEventListener('ended', () => void stop())))

    startedAt.current = Date.now()
    lastPieceAt.current = startedAt.current
    stopping.current = false
    audioRecorder.start(PIECE_MS)
    videoRecorder?.start(10_000)
    meetingRef.current = id
    setMeetingId(id)
    setElapsedMs(0)
    setPhase('recording')
  }

  /** Resolve once a recorder has handed over its last piece. */
  const stopRecorder = (recorder: MediaRecorder | null): Promise<void> =>
    new Promise((resolve) => {
      if (!recorder || recorder.state === 'inactive') return resolve()
      recorder.addEventListener('stop', () => resolve(), { once: true })
      recorder.stop()
    })

  const stop = async (): Promise<void> => {
    const c = capture.current
    const pieces = uploader.current
    if (!c || !pieces || !meetingRef.current || stopping.current) return
    stopping.current = true
    setPhase('finishing')
    await Promise.all([stopRecorder(c.audioRecorder), stopRecorder(c.videoRecorder)])
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
      if (pieces.state.recorded === 0) throw new Error('Nothing was recorded. Check the microphone and try again.')
      await finishRecording(id, pieces.state.recorded)
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
    try {
      await discardRecording(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The recording could not be discarded.')
      return
    }
    reset()
  }

  const reset = (): void => {
    capture.current = null
    uploader.current = null
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    setVideoUrl(null)
    meetingRef.current = null
    setMeetingId(null)
    setUpload({ recorded: 0, sent: 0, retrying: false, failed: null })
    setElapsedMs(0)
    setError(null)
    setPhase('setup')
  }

  const c = capture.current
  const waiting = upload.recorded - upload.sent
  const locked = phase !== 'setup'

  return (
    <section aria-labelledby={`${uid}-heading`} className="space-y-4 rounded-xl border border-line bg-surface-elevated p-4">
      <h3 id={`${uid}-heading`} className="text-base font-semibold text-content-primary">
        Record a meeting
      </h3>

      {error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-semantic-error">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" /> {error}
        </p>
      )}

      {phase === 'done' && meetingId ? (
        <div className="space-y-3" aria-live="polite">
          <p className="text-sm text-content-primary">
            Recording saved. The transcript, speakers, summary and action items are being written now. This takes about a
            minute for every ten minutes recorded.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={PRIMARY} onClick={() => navigate(`/meetings/${meetingId}`)}>
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
      ) : (
        <>
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
                placeholder="Names or emails, separated by commas"
                value={attendees}
                onChange={(e) => setAttendees(e.target.value)}
                disabled={locked}
                className={INPUT}
              />
            </div>
          </div>

          {phase === 'setup' || phase === 'starting' ? (
            <>
              <label className="flex items-start gap-2 text-sm text-content-primary">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} disabled={locked} className="mt-0.5 h-4 w-4 accent-accent-primary" />
                Everyone in this meeting knows it is being recorded and has agreed.
              </label>
              <button type="button" className={`${PRIMARY} w-full`} onClick={() => void start()} disabled={!consent || phase === 'starting'}>
                {phase === 'starting' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
                {phase === 'starting' ? 'Starting' : 'Start recording'}
              </button>
            </>
          ) : (
            <div className="space-y-3 rounded-lg border border-line-subtle p-3">
              {c?.preview && phase === 'recording' && <Preview stream={c.preview} />}
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm font-medium text-content-primary">
                  {phase === 'recording' && <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-accent-primary" aria-hidden="true" />}
                  {phase === 'recording' ? 'Recording' : 'Sending the last of the audio'}
                </span>
                <span className="font-mono text-2xl tabular-nums text-content-primary" aria-label={`Recorded ${formatClock(elapsedMs)}`}>
                  {formatClock(elapsedMs)}
                </span>
              </div>
              {c && phase === 'recording' && (
                <LevelMeter context={c.audioContext} stream={c.audioRecorder.stream} />
              )}
              {c && phase === 'recording' && captions && (
                <LiveCaptions
                  track={c.audioRecorder.stream.getAudioTracks()[0] ?? null}
                  startedAt={startedAt.current}
                  onClose={() => setCaptions(false)}
                />
              )}
              <p className="text-xs text-content-secondary" aria-live="polite">
                {upload.failed
                  ? upload.failed
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
                  <button type="button" className={`${PRIMARY} flex-1`} onClick={() => void stop()}>
                    <Square className="h-4 w-4" aria-hidden="true" /> Stop recording
                  </button>
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
                            await Promise.all([stopRecorder(c2.audioRecorder), stopRecorder(c2.videoRecorder)])
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
        </>
      )}
    </section>
  )
}

export default MeetingRecorder
