import React from 'react'
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'

const api = vi.hoisted(() => ({
  botCheck: vi.fn(),
  start: vi.fn(),
  uploadPiece: vi.fn(),
  finish: vi.fn(),
  salvage: vi.fn(),
  retry: vi.fn(),
  discard: vi.fn(),
}))
const cacheMock = vi.hoisted(() => ({ invalidate: vi.fn() }))
const meetings = vi.hoisted(() => ({ reprocess: vi.fn() }))
vi.mock('../services/api', () => ({ default: {}, recordingsApi: api, meetingsApi: meetings, settingsApi: { getUser: async () => ({}) } }))
vi.mock('../services/apiCache', () => ({ default: cacheMock }))
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u-1', name: 'Test User' } }) }))
vi.mock('../contexts/OrgContext', () => ({ useOrgSafe: () => null }))
vi.mock('../context/ThemeContext', () => ({ useTheme: () => ({ isBenchSwiss: true }) }))
vi.mock('../components/EntoAssistant/EntoAIProactiveChecker', () => ({ default: () => null }))
vi.mock('../components/bot/MissedBotAlert', () => ({ default: () => null }))
vi.mock('../components/bot/useBotDebriefWatch', () => ({ default: () => {} }))
vi.mock('../components/CommandPalette', () => ({ default: () => null }))

import MeetingRecorder from '../components/meetings/MeetingRecorder'
import RecordingStatus from '../components/meetings/RecordingStatus'
import Layout from '../components/Layout'
import {
  PieceUploader,
  canRetry,
  captureErrorMessage,
  pickAudioMime,
  tabCaptureSupported,
  toRecordingJob,
  STALE_JOB_MS,
} from '../services/meetingRecorderService'

beforeEach(() => vi.clearAllMocks())

describe('meetingRecorderService', () => {
  test('pickAudioMime prefers webm opus and falls back', () => {
    expect(pickAudioMime(() => true)).toBe('audio/webm;codecs=opus')
    expect(pickAudioMime((t) => t === 'audio/mp4')).toBe('audio/mp4')
    expect(pickAudioMime(() => false)).toBeNull()
  })

  test('tab capture is offered on desktop browsers only', () => {
    const md = { getDisplayMedia: () => {} }
    expect(tabCaptureSupported({ userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/130', mediaDevices: md })).toBe(true)
    expect(tabCaptureSupported({ userAgent: 'Mozilla/5.0 (iPhone) Safari', mediaDevices: md })).toBe(false)
    expect(tabCaptureSupported({ userAgent: 'Chrome', mediaDevices: {} })).toBe(false)
  })

  test('toRecordingJob reads the stored job defensively', () => {
    expect(toRecordingJob(null)).toBeNull()
    expect(toRecordingJob({ status: 'weird' })).toBeNull()
    expect(toRecordingJob({ status: 'failed', mode: 'tab', error: 'No speech', updatedAt: 'x' })).toEqual({
      status: 'failed', source: null, mode: 'tab', error: 'No speech', updatedAt: 'x', speakers: null, summaryError: null,
      stage: null, stageAt: null, finishedAt: null, durationMs: 0,
    })
    expect(toRecordingJob({ status: 'transcribing', stage: 'summary', stageAt: 'y', finishedAt: 'z', durationMs: 90000 })).toMatchObject({
      stage: 'summary', stageAt: 'y', finishedAt: 'z', durationMs: 90000,
    })
    expect(toRecordingJob({ status: 'transcribing', stage: 'bogus' })?.stage).toBeNull()
  })

  test('canRetry: failed, or transcribing for too long', () => {
    const now = Date.parse('2026-11-21T12:00:00Z')
    expect(canRetry(toRecordingJob({ status: 'failed' }), now)).toBe(true)
    expect(canRetry(toRecordingJob({ status: 'transcribing', updatedAt: new Date(now - 1000).toISOString() }), now)).toBe(false)
    expect(canRetry(toRecordingJob({ status: 'transcribing', updatedAt: new Date(now - STALE_JOB_MS - 1).toISOString() }), now)).toBe(true)
    expect(canRetry(toRecordingJob({ status: 'done' }), now)).toBe(false)
  })

  test('captureErrorMessage names the problem', () => {
    expect(captureErrorMessage({ name: 'NotAllowedError' }, 'tab')).toMatch(/cancelled or blocked/)
    expect(captureErrorMessage({ name: 'NotFoundError' }, 'mic')).toBe('No microphone was found.')
  })

  test('PieceUploader sends in order, retries a dropped piece, and drains', async () => {
    const sent: number[] = []
    let failOnce = true
    const send = vi.fn(async (seq: number) => {
      if (seq === 1 && failOnce) {
        failOnce = false
        throw Object.assign(new Error('Network Error'), { isNetworkError: true })
      }
      sent.push(seq)
    })
    const up = new PieceUploader(send, () => {}, () => 0)
    up.add(new Blob(['a']), 30_000)
    up.add(new Blob(['b']), 30_000)
    up.add(new Blob([]), 30_000) // empty pieces are not pieces
    up.add(new Blob(['c']), 12_345)
    await up.drain()
    expect(sent).toEqual([0, 1, 2])
    expect(send).toHaveBeenCalledTimes(4)
    expect(up.state).toEqual({ recorded: 3, sent: 3, retrying: false, failed: null })
  })

  test('PieceUploader stops on a refusal that a retry cannot fix', async () => {
    const send = vi.fn(async () => {
      throw Object.assign(new Error('x'), {
        status: 409,
        originalError: { response: { data: { error: 'This meeting is not recording.' } } },
      })
    })
    const up = new PieceUploader(send, () => {}, () => 0)
    up.add(new Blob(['a']), 1000)
    await expect(up.drain()).rejects.toThrow('This meeting is not recording.')
    expect(send).toHaveBeenCalledTimes(1)
  })
})

// ── Browser media fakes ────────────────────────────────────────────────────

class FakeTrack {
  kind: string
  listeners: Record<string, Array<() => void>> = {}
  stopped = false
  constructor(kind: string) { this.kind = kind }
  stop(): void { this.stopped = true }
  addEventListener(type: string, fn: () => void): void { (this.listeners[type] ||= []).push(fn) }
}
class FakeStream {
  tracks: FakeTrack[]
  constructor(tracks: FakeTrack[] = []) { this.tracks = tracks }
  getTracks(): FakeTrack[] { return this.tracks }
  getAudioTracks(): FakeTrack[] { return this.tracks.filter((t) => t.kind === 'audio') }
  getVideoTracks(): FakeTrack[] { return this.tracks.filter((t) => t.kind === 'video') }
}
const recorders: FakeRecorder[] = []
class FakeRecorder {
  static isTypeSupported = (t: string): boolean => t.startsWith('audio/webm') || t.startsWith('video/webm')
  state = 'inactive'
  stream: FakeStream
  mimeType: string
  ondataavailable: ((e: { data: Blob }) => void) | null = null
  private stopFns: Array<() => void> = []
  constructor(stream: FakeStream, opts: { mimeType: string }) {
    this.stream = stream
    this.mimeType = opts.mimeType
    recorders.push(this)
  }
  start(): void { this.state = 'recording' }
  pause(): void { this.state = 'paused' }
  resume(): void { this.state = 'recording' }
  emit(text: string): void { this.ondataavailable?.({ data: new Blob([text], { type: this.mimeType }) }) }
  addEventListener(type: string, fn: () => void): void { if (type === 'stop') this.stopFns.push(fn) }
  stop(): void {
    this.emit('last')
    this.state = 'inactive'
    this.stopFns.forEach((f) => f())
  }
}
class FakeAudioContext {
  createMediaStreamDestination(): { stream: FakeStream } { return { stream: new FakeStream([new FakeTrack('audio')]) } }
  createMediaStreamSource(): { connect: () => void; disconnect: () => void } { return { connect: () => {}, disconnect: () => {} } }
  createAnalyser(): { fftSize: number; frequencyBinCount: number; getByteFrequencyData: () => void; getByteTimeDomainData: (a: Uint8Array) => void } {
    return { fftSize: 0, frequencyBinCount: 8, getByteFrequencyData: () => {}, getByteTimeDomainData: (a) => a.fill(128) }
  }
  resume(): Promise<void> { return Promise.resolve() }
  close(): Promise<void> { return Promise.resolve() }
}

const getUserMedia = vi.fn()
const getDisplayMedia = vi.fn()

beforeEach(() => {
  recorders.length = 0
  vi.stubGlobal('MediaRecorder', FakeRecorder)
  vi.stubGlobal('MediaStream', FakeStream)
  vi.stubGlobal('AudioContext', FakeAudioContext)
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia, getDisplayMedia } })
  getUserMedia.mockResolvedValue(new FakeStream([new FakeTrack('audio')]))
  getDisplayMedia.mockResolvedValue(new FakeStream([new FakeTrack('video'), new FakeTrack('audio')]))
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext
  api.botCheck.mockResolvedValue({ bot: null })
  api.start.mockResolvedValue({ meetingId: 'm-1' })
  api.uploadPiece.mockResolvedValue(undefined)
  api.finish.mockResolvedValue({ status: 'transcribing' })
})
afterEach(() => vi.unstubAllGlobals())

function renderRecorder(onRecorded = vi.fn()) {
  render(
    <MemoryRouter>
      <MeetingRecorder onRecorded={onRecorded} />
    </MemoryRouter>,
  )
  return onRecorded
}

describe('MeetingRecorder', () => {
  test('pop-out frees the app for navigation and stops the same recording from the popup', async () => {
    const frame = document.createElement('iframe')
    document.body.append(frame)
    const popDoc = frame.contentDocument!
    const popWin = { document: popDoc, addEventListener: vi.fn(), close: vi.fn(), focus: vi.fn() }
    const open = vi.spyOn(window, 'open').mockReturnValue(popWin as unknown as Window)
    try {
      render(<MemoryRouter initialEntries={['/dashboard']}>
        <Routes><Route element={<Layout />}>
          <Route path="/dashboard" element={<h1>Dashboard</h1>} />
          <Route path="/tasks" element={<h1>Tasks page</h1>} />
        </Route></Routes>
      </MemoryRouter>)
      fireEvent.click(screen.getByRole('button', { name: /^record.*to set up/i }))
      const drawer = within(await screen.findByRole('dialog', { name: 'New meeting' }))
      fireEvent.click(await drawer.findByRole('checkbox', { name: /knows it is being recorded/i }))
      fireEvent.click(drawer.getByRole('button', { name: /start recording/i }))
      const popOut = await drawer.findByRole('button', { name: /pop out/i })
      expect(drawer.getByRole('button', { name: 'Close' })).toBeDisabled()
      fireEvent.click(popOut)

      await waitFor(() => expect(document.documentElement).not.toHaveClass('bs-scroll-lock'))
      fireEvent.click(screen.getAllByRole('link', { name: /tasks/i })[0]!)
      expect(await screen.findByRole('heading', { name: 'Tasks page' })).toBeInTheDocument()
      expect(recorders[0]?.state).toBe('recording')
      act(() => recorders[0]!.emit('piece while hidden'))
      await waitFor(() => expect(api.uploadPiece).toHaveBeenCalledTimes(1))

      fireEvent.click(screen.getAllByRole('button', { name: /recorder active/i })[0]!)
      expect(await drawer.findByRole('button', { name: 'Close' })).toBeEnabled()
      fireEvent.click(drawer.getByRole('button', { name: 'Close' }))
      fireEvent.click(within(popDoc.body).getByRole('button', { name: /pause/i }))
      expect(recorders[0]?.state).toBe('paused')
      fireEvent.click(within(popDoc.body).getByRole('button', { name: /stop recording/i }))
      await waitFor(() => expect(api.finish).toHaveBeenCalledWith('m-1', 2, []))
      expect(api.start).toHaveBeenCalledTimes(1)
      fireEvent.click((await screen.findAllByRole('button', { name: /review recording/i }))[0]!)
      expect(await screen.findByRole('button', { name: /open the meeting/i })).toBeInTheDocument()
    } finally {
      open.mockRestore()
      frame.remove()
    }
  })

  test('start waits for the consent tick', () => {
    renderRecorder()
    const start = screen.getByRole('button', { name: /start recording/i })
    expect(start).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox', { name: /knows it is being recorded/i }))
    expect(start).toBeEnabled()
  })

  test('the drawer can only dismiss once the recording is handed over', async () => {
    const onCaptureChange = vi.fn()
    render(<MemoryRouter><MeetingRecorder onCaptureChange={onCaptureChange} /></MemoryRouter>)
    expect(onCaptureChange).toHaveBeenLastCalledWith(false)

    fireEvent.click(screen.getByRole('checkbox', { name: /knows it is being recorded/i }))
    fireEvent.click(screen.getByRole('button', { name: /start recording/i }))
    expect(onCaptureChange).toHaveBeenLastCalledWith(true)
    const stop = await screen.findByRole('button', { name: /stop recording/i })
    expect(onCaptureChange).toHaveBeenLastCalledWith(true)
    expect(screen.queryByText(/what to record/i)).not.toBeInTheDocument()

    fireEvent.click(stop)
    expect(onCaptureChange).toHaveBeenLastCalledWith(true)
    await screen.findByRole('button', { name: /open the meeting/i })
    expect(onCaptureChange).toHaveBeenLastCalledWith(false)
  })

  test('records the microphone in pieces and hands the recording over', async () => {
    const onRecorded = renderRecorder()
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Standup' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /knows it is being recorded/i }))
    fireEvent.click(screen.getByRole('button', { name: /start recording/i }))

    await screen.findByRole('button', { name: /stop recording/i })
    expect(api.start).toHaveBeenCalledWith(expect.objectContaining({ title: 'Standup', mode: 'mic', mimeType: 'audio/webm;codecs=opus', consentAcknowledged: true }))
    expect(recorders).toHaveLength(1) // audio only: no video copy for the microphone

    act(() => recorders[0]!.emit('piece-0'))
    await waitFor(() => expect(api.uploadPiece).toHaveBeenCalledWith('m-1', 0, expect.any(Number), expect.any(Blob), 'audio/webm'))

    fireEvent.click(screen.getByRole('button', { name: /stop recording/i }))
    await screen.findByRole('button', { name: /open the meeting/i })
    expect(api.uploadPiece).toHaveBeenCalledTimes(2)
    expect(api.finish).toHaveBeenCalledWith('m-1', 2)
    expect(onRecorded).toHaveBeenCalledWith('m-1')
  })

  test('an untitled recording is named by this device\'s date, not the server\'s', async () => {
    renderRecorder()
    fireEvent.click(screen.getByRole('checkbox', { name: /knows it is being recorded/i }))
    fireEvent.click(screen.getByRole('button', { name: /start recording/i }))
    await screen.findByRole('button', { name: /stop recording/i })
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    expect(api.start).toHaveBeenCalledWith(expect.objectContaining({ title: `Recording, ${today}` }))
  })

  test('pause stops the recorders, and paused time is not counted in the piece', async () => {
    let now = 1_000_000
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => now)
    renderRecorder()
    fireEvent.click(screen.getByRole('checkbox', { name: /knows it is being recorded/i }))
    fireEvent.click(screen.getByRole('button', { name: /start recording/i }))
    await screen.findByRole('button', { name: /stop recording/i })

    now += 10_000
    fireEvent.click(screen.getByRole('button', { name: /^pause$/i }))
    expect(recorders[0]!.state).toBe('paused')
    expect(screen.getByText(/nothing is recorded until you resume/i)).toBeInTheDocument()

    now += 600_000 // ten minutes paused
    fireEvent.click(screen.getByRole('button', { name: /resume/i }))
    expect(recorders[0]!.state).toBe('recording')

    now += 5_000
    act(() => recorders[0]!.emit('piece-0'))
    await waitFor(() => expect(api.uploadPiece).toHaveBeenCalledWith('m-1', 0, 15_000, expect.any(Blob), 'audio/webm'))
    clock.mockRestore()
  })

  test('the pop-out window carries the controls and closes when the recording is handed over', async () => {
    const popDoc = document.implementation.createHTMLDocument('pop')
    const popWin = { document: popDoc, addEventListener: vi.fn(), close: vi.fn(), focus: vi.fn() }
    const open = vi.spyOn(window, 'open').mockReturnValue(popWin as unknown as Window)
    renderRecorder()
    fireEvent.click(screen.getByRole('checkbox', { name: /knows it is being recorded/i }))
    fireEvent.click(screen.getByRole('button', { name: /start recording/i }))
    await screen.findByRole('button', { name: /stop recording/i })

    fireEvent.click(screen.getByRole('button', { name: /pop out/i }))
    await waitFor(() => expect(popDoc.querySelector('[data-testid="recorder-pop"]')).not.toBeNull())
    expect(popDoc.querySelector('canvas')).not.toBeNull() // the level meter
    expect(popDoc.querySelector('video')).toBeNull() // a microphone has no picture
    const popButton = (name: string): HTMLButtonElement =>
      [...popDoc.querySelectorAll('button')].find((b) => b.textContent?.trim() === name) as HTMLButtonElement

    act(() => popButton('Pause').click())
    expect(recorders[0]!.state).toBe('paused')
    expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument()

    act(() => popButton('Stop recording').click())
    await screen.findByRole('button', { name: /open the meeting/i })
    expect(popWin.close).toHaveBeenCalled()
    open.mockRestore()
  })

  test('a browser tab records its sound with the microphone, and keeps a video copy', async () => {
    renderRecorder()
    fireEvent.click(screen.getByRole('radio', { name: /browser tab/i }))
    expect(screen.getByRole('checkbox', { name: /also record my microphone/i })).toBeChecked()
    fireEvent.click(screen.getByRole('checkbox', { name: /knows it is being recorded/i }))
    fireEvent.click(screen.getByRole('button', { name: /start recording/i }))

    await screen.findByRole('button', { name: /stop recording/i })
    expect(getDisplayMedia).toHaveBeenCalledWith(expect.objectContaining({ audio: true, video: true }))
    expect(getUserMedia).toHaveBeenCalledTimes(1)
    expect(recorders.map((r) => r.mimeType)).toEqual(['audio/webm;codecs=opus', 'video/webm;codecs=vp9,opus'])
    expect(api.start).toHaveBeenCalledWith(expect.objectContaining({ mode: 'tab' }))

    URL.createObjectURL = vi.fn(() => 'blob:video')
    URL.revokeObjectURL = vi.fn()
    fireEvent.click(screen.getByRole('button', { name: /stop recording/i }))
    expect(await screen.findByRole('link', { name: /download the video/i })).toHaveAttribute('href', 'blob:video')
  })

  test('the pop-out shows the shared tab and the level meter', async () => {
    const popDoc = document.implementation.createHTMLDocument('pop')
    const popWin = { document: popDoc, addEventListener: vi.fn(), close: vi.fn(), focus: vi.fn() }
    const open = vi.spyOn(window, 'open').mockReturnValue(popWin as unknown as Window)
    renderRecorder()
    fireEvent.click(screen.getByRole('radio', { name: /browser tab/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /knows it is being recorded/i }))
    fireEvent.click(screen.getByRole('button', { name: /start recording/i }))
    await screen.findByRole('button', { name: /stop recording/i })

    fireEvent.click(screen.getByRole('button', { name: /pop out/i }))
    await waitFor(() => expect(popDoc.querySelector('[data-testid="recorder-pop"]')).not.toBeNull())
    expect(open).toHaveBeenCalledWith('', 'entomate-recorder', expect.stringContaining('height=420'))
    expect(popDoc.querySelector('video[aria-label="Recording preview"]')).not.toBeNull()
    expect(popDoc.querySelector('canvas')).not.toBeNull()
    open.mockRestore()
  })

  test('a blocked share explains itself and makes no meeting', async () => {
    getDisplayMedia.mockRejectedValueOnce(Object.assign(new Error('denied'), { name: 'NotAllowedError' }))
    renderRecorder()
    fireEvent.click(screen.getByRole('radio', { name: /browser tab/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /knows it is being recorded/i }))
    fireEvent.click(screen.getByRole('button', { name: /start recording/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/cancelled or blocked/)
    expect(api.start).not.toHaveBeenCalled()
  })

  test('a share with no sound and no microphone is refused', async () => {
    getDisplayMedia.mockResolvedValueOnce(new FakeStream([new FakeTrack('video')]))
    renderRecorder()
    fireEvent.click(screen.getByRole('radio', { name: /browser tab/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /also record my microphone/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /knows it is being recorded/i }))
    fireEvent.click(screen.getByRole('button', { name: /start recording/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/No sound was shared/)
    expect(api.start).not.toHaveBeenCalled()
  })

  test('a tab shared without its sound is refused even with the microphone on', async () => {
    getDisplayMedia.mockResolvedValueOnce(new FakeStream([new FakeTrack('video')]))
    renderRecorder()
    fireEvent.click(screen.getByRole('radio', { name: /browser tab/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /knows it is being recorded/i }))
    fireEvent.click(screen.getByRole('button', { name: /start recording/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/only your microphone would be heard/)
    expect(api.start).not.toHaveBeenCalled()
  })
})

describe('RecordingStatus', () => {
  test('nothing for a finished or non-recorded meeting', () => {
    const { container, rerender } = render(<RecordingStatus meetingId="m" recordingJob={null} onRefresh={() => {}} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<RecordingStatus meetingId="m" recordingJob={{ status: 'done' }} onRefresh={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  test('refreshes the page while the transcript is written', () => {
    vi.useFakeTimers()
    const onRefresh = vi.fn()
    render(<RecordingStatus meetingId="m" recordingJob={{ status: 'transcribing', updatedAt: new Date().toISOString() }} onRefresh={onRefresh} />)
    expect(screen.getByRole('progressbar', { name: 'Minutes progress' })).toBeInTheDocument()
    expect(screen.getByText('Recording stopped · writing the minutes')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(10_000))
    expect(onRefresh).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  test('a failure shows its reason and retries', async () => {
    api.retry.mockResolvedValue({ status: 'transcribing' })
    const onRefresh = vi.fn()
    render(<RecordingStatus meetingId="m" recordingJob={{ status: 'failed', error: 'No speech was heard.' }} onRefresh={onRefresh} />)
    expect(screen.getByRole('status')).toHaveTextContent('No speech was heard.')
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    await waitFor(() => expect(onRefresh).toHaveBeenCalled())
    expect(api.retry).toHaveBeenCalledWith('m')
  })

  test('a missing summary can be written again from the transcript', async () => {
    meetings.reprocess.mockResolvedValue({ success: true })
    const onRefresh = vi.fn()
    const job = { status: 'done', summaryError: 'Summary generation failed: bad JSON' }
    const { rerender, container } = render(<RecordingStatus meetingId="m" recordingJob={job} onRefresh={onRefresh} />)
    fireEvent.click(screen.getByRole('button', { name: /write the summary/i }))
    await waitFor(() => expect(meetings.reprocess).toHaveBeenCalledWith('m'))
    await waitFor(() => expect(onRefresh).toHaveBeenCalled())
    rerender(<RecordingStatus meetingId="m" recordingJob={job} onRefresh={onRefresh} hasSummary />)
    expect(container).toBeEmptyDOMElement()
  })

  test('a transcript import exposes a failed retry and can recover', async () => {
    meetings.reprocess.mockRejectedValueOnce(new Error('Request failed')).mockResolvedValueOnce({ success: true })
    const onRefresh = vi.fn()
    render(<RecordingStatus meetingId="import" recordingJob={null} hasTranscript onRefresh={onRefresh} />)
    const retry = screen.getByRole('button', { name: /write the summary/i })
    fireEvent.click(retry)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(onRefresh).not.toHaveBeenCalled()
    fireEvent.click(retry)
    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  test('an unstopped recording offers to transcribe the saved audio', async () => {
    api.salvage.mockResolvedValue({ status: 'transcribing' })
    const onRefresh = vi.fn()
    render(<RecordingStatus meetingId="m" recordingJob={{ status: 'recording' }} onRefresh={onRefresh} />)
    fireEvent.click(screen.getByRole('button', { name: /transcribe the saved audio/i }))
    await waitFor(() => expect(api.salvage).toHaveBeenCalledWith('m'))
  })
})

describe('one call, one meeting (recording beside the bot)', () => {
  const BOT = { sessionId: 's-1', meetingId: 'bot-m', title: 'Weekly sync', platform: 'meet', phase: 'live', joinAt: null }

  test('says the bot has this call and records into its meeting by default', async () => {
    api.botCheck.mockResolvedValue({ bot: BOT })
    api.start.mockResolvedValue({ meetingId: 'bot-m' })
    renderRecorder()
    expect(await screen.findByText('Your bot is in a call now')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /same call/i })).toBeChecked()
    fireEvent.click(screen.getByRole('checkbox', { name: /knows it is being recorded/i }))
    fireEvent.click(screen.getByRole('button', { name: /start recording/i }))
    await screen.findByRole('button', { name: /stop recording/i })
    expect(api.start).toHaveBeenCalledWith(expect.objectContaining({ botSessionId: 's-1' }))
    expect(api.start.mock.calls[0]?.[0]?.separate).toBeUndefined()

    fireEvent.click(screen.getByRole('button', { name: /stop recording/i }))
    expect(await screen.findByText(/saved with the bot’s meeting/i)).toBeInTheDocument()
  })

  test('"a different meeting" records separately', async () => {
    api.botCheck.mockResolvedValue({ bot: BOT })
    renderRecorder()
    fireEvent.click(await screen.findByRole('radio', { name: /a different meeting/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /knows it is being recorded/i }))
    fireEvent.click(screen.getByRole('button', { name: /start recording/i }))
    await screen.findByRole('button', { name: /stop recording/i })
    expect(api.start).toHaveBeenCalledWith(expect.objectContaining({ separate: true }))
  })

  test('a bot that joined after the page loaded is caught on start, and the choice appears', async () => {
    api.start.mockRejectedValueOnce({
      message: 'Request failed',
      originalError: { response: { data: { error: 'The bot is already in this call.', code: 'bot_in_call', bot: BOT } } },
    })
    renderRecorder()
    fireEvent.click(screen.getByRole('checkbox', { name: /knows it is being recorded/i }))
    fireEvent.click(screen.getByRole('button', { name: /start recording/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/your bot is in a call now/i)
    expect(screen.getByRole('radio', { name: /same call/i })).toBeChecked()
  })
})

describe('RecordingStatus beside the bot', () => {
  test('a backup recording says the bot is writing and can be used instead', async () => {
    api.retry.mockResolvedValue({ status: 'transcribing' })
    const onRefresh = vi.fn()
    render(<RecordingStatus meetingId="m" recordingJob={{ status: 'backup', botSessionId: 's-1' }} onRefresh={onRefresh} />)
    expect(screen.getByRole('status')).toHaveTextContent(/bot was in this call/i)
    fireEvent.click(screen.getByRole('button', { name: /use my recording instead/i }))
    await waitFor(() => expect(api.retry).toHaveBeenCalledWith('m'))
  })

  test('the bot\'s run shows the same loader with its own words', () => {
    render(<RecordingStatus meetingId="m" recordingJob={{ status: 'transcribing', source: 'bot', stage: 'summary', updatedAt: new Date().toISOString() }} onRefresh={() => {}} />)
    expect(screen.getByText('The bot left · writing the minutes')).toBeInTheDocument()
  })

  test('toRecordingJob reads backup and the source', () => {
    expect(toRecordingJob({ status: 'backup', source: 'bot' })).toMatchObject({ status: 'backup', source: 'bot' })
    expect(toRecordingJob({ status: 'done' })?.source).toBeNull()
  })
})
