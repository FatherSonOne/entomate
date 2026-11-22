import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'

const api = vi.hoisted(() => ({
  start: vi.fn(),
  uploadPiece: vi.fn(),
  finish: vi.fn(),
  salvage: vi.fn(),
  retry: vi.fn(),
  discard: vi.fn(),
}))
const cacheMock = vi.hoisted(() => ({ invalidate: vi.fn() }))
const meetings = vi.hoisted(() => ({ reprocess: vi.fn() }))
vi.mock('../services/api', () => ({ recordingsApi: api, meetingsApi: meetings }))
vi.mock('../services/apiCache', () => ({ default: cacheMock }))

import MeetingRecorder from '../components/meetings/MeetingRecorder'
import RecordingStatus from '../components/meetings/RecordingStatus'
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
      status: 'failed', mode: 'tab', error: 'No speech', updatedAt: 'x', speakers: null, summaryError: null,
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
  createAnalyser(): { fftSize: number; frequencyBinCount: number; getByteFrequencyData: () => void } {
    return { fftSize: 0, frequencyBinCount: 8, getByteFrequencyData: () => {} }
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
  test('start waits for the consent tick', () => {
    renderRecorder()
    const start = screen.getByRole('button', { name: /start recording/i })
    expect(start).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox', { name: /knows it is being recorded/i }))
    expect(start).toBeEnabled()
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

  test('an unstopped recording offers to transcribe the saved audio', async () => {
    api.salvage.mockResolvedValue({ status: 'transcribing' })
    const onRefresh = vi.fn()
    render(<RecordingStatus meetingId="m" recordingJob={{ status: 'recording' }} onRefresh={onRefresh} />)
    fireEvent.click(screen.getByRole('button', { name: /transcribe the saved audio/i }))
    await waitFor(() => expect(api.salvage).toHaveBeenCalledWith('m'))
  })
})
