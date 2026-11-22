import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'

const api = vi.hoisted(() => ({ playback: vi.fn(), removeAudio: vi.fn() }))
const cacheMock = vi.hoisted(() => ({ invalidate: vi.fn() }))
vi.mock('../services/api', () => ({ recordingsApi: api, meetingsApi: { renameSpeaker: vi.fn() } }))
vi.mock('../services/apiCache', () => ({ default: cacheMock }))

import RecordingPlayer, { type RecordingPlayerHandle } from '../components/meetings/RecordingPlayer'
import TranscriptPanel from '../components/meetings/TranscriptPanel'
import LiveCaptions, { captionErrorMessage, speechRecognitionCtor } from '../components/meetings/LiveCaptions'
import { canPlay, loadRecordingAudio } from '../services/meetingRecorderService'
import type { TranscriptSegment } from '../services/meetingTranscriptService'

const MEETING = 'meeting-1'
const PLAYBACK = {
  mimeType: 'audio/webm',
  durationMs: 60_000,
  pieces: [
    { seq: 0, durationMs: 30_000, url: 'https://signed.test/0' },
    { seq: 1, durationMs: 30_000, url: 'https://signed.test/1' },
  ],
}
const okFetch = vi.fn(async (url: RequestInfo | URL) => new Response(`audio:${String(url).slice(-1)}|`))

beforeEach(() => {
  vi.clearAllMocks()
  api.playback.mockResolvedValue(PLAYBACK)
  vi.stubGlobal('fetch', okFetch)
  URL.createObjectURL = vi.fn(() => 'blob:recording')
  URL.revokeObjectURL = vi.fn()
})
afterEach(() => vi.unstubAllGlobals())

describe('playback service', () => {
  test('canPlay needs a finished recording whose audio was kept and not expired', () => {
    expect(canPlay({ status: 'done', audioKept: true })).toBe(true)
    expect(canPlay({ status: 'done' })).toBe(false) // recorded before audio was kept
    expect(canPlay({ status: 'done', audioKept: true, retentionDeletedAt: '2026-12-01T00:00:00Z' })).toBe(false)
    expect(canPlay({ status: 'recording', audioKept: true })).toBe(false)
    expect(canPlay(null)).toBe(false)
  })

  test('loadRecordingAudio skips the cache and joins the pieces in order', async () => {
    const { blob, durationMs } = await loadRecordingAudio(MEETING)
    expect(cacheMock.invalidate).toHaveBeenCalledWith(`/recordings/${MEETING}/playback`)
    expect(okFetch.mock.calls.map((c) => c[0])).toEqual(['https://signed.test/0', 'https://signed.test/1'])
    expect(await blob!.text()).toBe('audio:0|audio:1|')
    expect(blob!.type).toBe('audio/webm')
    expect(durationMs).toBe(60_000)
  })

  test('reports the share of pieces downloaded', async () => {
    const onProgress = vi.fn()
    await loadRecordingAudio(MEETING, okFetch, onProgress)
    expect(onProgress.mock.calls.map((c) => c[0])).toEqual([0.5, 1])
  })

  test('a seekable copy comes as one link to stream, with nothing downloaded', async () => {
    api.playback.mockResolvedValueOnce({ mimeType: 'audio/webm', durationMs: 60_000, url: 'https://signed.test/playback' })
    expect(await loadRecordingAudio(MEETING)).toEqual({ url: 'https://signed.test/playback', durationMs: 60_000 })
    expect(okFetch).not.toHaveBeenCalled()
  })

  test('a piece that does not download fails the whole load', async () => {
    const bad = vi.fn(async (url: RequestInfo | URL) => new Response('', { status: String(url).endsWith('1') ? 403 : 200 }))
    await expect(loadRecordingAudio(MEETING, bad)).rejects.toThrow(/could not be downloaded/)
  })
})

describe('RecordingPlayer', () => {
  test('downloads nothing until asked, then plays the joined audio', async () => {
    render(<RecordingPlayer meetingId={MEETING} durationMs={754_000} />)
    expect(screen.getByText('12:34 of audio')).toBeTruthy()
    expect(api.playback).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Play the recording' }))
    const audio = (await screen.findByTestId('recording-player')) as HTMLAudioElement
    expect(audio.getAttribute('src')).toBe('blob:recording')
    expect(audio.hasAttribute('controls')).toBe(true)
  })

  test('playFrom before loading loads, then seeks once the length is known', async () => {
    const ref = React.createRef<RecordingPlayerHandle>()
    render(<RecordingPlayer ref={ref} meetingId={MEETING} />)
    expect(ref.current!.isReady()).toBe(false)
    act(() => ref.current!.playFrom(65_000))
    const audio = (await screen.findByTestId('recording-player')) as HTMLAudioElement
    const play = vi.spyOn(audio, 'play').mockResolvedValue(undefined)
    Object.defineProperty(audio, 'duration', { configurable: true, value: 120 })
    fireEvent.loadedMetadata(audio)
    expect(audio.currentTime).toBe(65)
    expect(play).toHaveBeenCalled()
  })

  test('streams the seekable copy, and renews its link once when it fails', async () => {
    api.playback.mockResolvedValue({ durationMs: 60_000, url: 'https://signed.test/playback?v=1' })
    render(<RecordingPlayer meetingId={MEETING} />)
    fireEvent.click(screen.getByRole('button', { name: 'Play the recording' }))
    let audio = (await screen.findByTestId('recording-player')) as HTMLAudioElement
    expect(audio.getAttribute('src')).toBe('https://signed.test/playback?v=1')
    expect(URL.createObjectURL).not.toHaveBeenCalled()

    api.playback.mockResolvedValue({ durationMs: 60_000, url: 'https://signed.test/playback?v=2' })
    Object.defineProperty(audio, 'currentTime', { configurable: true, writable: true, value: 30 })
    await act(async () => {
      fireEvent.error(audio)
    })
    audio = screen.getByTestId('recording-player') as HTMLAudioElement
    expect(audio.getAttribute('src')).toBe('https://signed.test/playback?v=2')

    // A second failure before anything played again is final.
    await act(async () => {
      fireEvent.error(audio)
    })
    expect((await screen.findByRole('alert')).textContent).toContain('could not be played')
  })

  test('remove audio asks first, then removes it', async () => {
    api.removeAudio.mockResolvedValue({ success: true })
    const onAudioRemoved = vi.fn()
    render(<RecordingPlayer meetingId={MEETING} onAudioRemoved={onAudioRemoved} />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove audio' }))
    expect(screen.getByText(/Remove the audio for good\? The transcript and notes stay\./)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }))
    expect(api.removeAudio).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Remove audio' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Remove audio' }))
    })
    expect(api.removeAudio).toHaveBeenCalledWith(MEETING)
    expect(onAudioRemoved).toHaveBeenCalled()
  })

  test('without onAudioRemoved there is no remove control', () => {
    render(<RecordingPlayer meetingId={MEETING} />)
    expect(screen.queryByRole('button', { name: 'Remove audio' })).toBeNull()
  })

  test('a failed load says why and can be tried again', async () => {
    api.playback.mockRejectedValueOnce({ originalError: { response: { data: { error: 'There is no recording to play.' } } } })
    render(<RecordingPlayer meetingId={MEETING} />)
    fireEvent.click(screen.getByRole('button', { name: 'Play the recording' }))
    expect((await screen.findByRole('alert')).textContent).toContain('There is no recording to play.')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await screen.findByTestId('recording-player')
  })
})

describe('TranscriptPanel with playback', () => {
  const SEGMENTS: TranscriptSegment[] = [
    { atMs: 0, speaker: 'Speaker 1', text: 'Morning' },
    { atMs: 7_000, speaker: 'Speaker 2', text: 'Ship on the fourteenth' },
    { atMs: 15_000, speaker: 'Speaker 1', text: 'Agreed' },
  ]

  test('marks the line being played and plays from a chosen line', () => {
    const onPlayFrom = vi.fn()
    render(<TranscriptPanel meetingId={MEETING} segments={SEGMENTS} playingAtMs={9_000} onPlayFrom={onPlayFrom} />)
    const lines = screen.getAllByTestId('transcript-line')
    expect(lines.map((l) => l.getAttribute('data-playing'))).toEqual([null, 'true', null])
    fireEvent.click(screen.getByRole('button', { name: 'Play from 0:15' }))
    expect(onPlayFrom).toHaveBeenCalledWith(15_000)
  })

  test('without audio the times stay plain text', () => {
    render(<TranscriptPanel meetingId={MEETING} segments={SEGMENTS} />)
    expect(screen.queryByRole('button', { name: /Play from/ })).toBeNull()
  })
})

class FakeRecognition {
  static last: FakeRecognition | null = null
  continuous = false
  interimResults = false
  lang = ''
  onresult: ((e: unknown) => void) | null = null
  onerror: ((e: { error: string }) => void) | null = null
  onend: (() => void) | null = null
  start = vi.fn()
  abort = vi.fn()
  constructor() {
    FakeRecognition.last = this
  }
  say(text: string, isFinal: boolean): void {
    const results = [Object.assign([{ transcript: text }], { isFinal })]
    act(() => this.onresult?.({ resultIndex: 0, results }))
  }
}

describe('LiveCaptions', () => {
  beforeEach(() => {
    FakeRecognition.last = null
    vi.stubGlobal('webkitSpeechRecognition', FakeRecognition)
  })

  test('finds the browser recogniser, prefixed or not', () => {
    expect(speechRecognitionCtor({})).toBeNull()
    expect(speechRecognitionCtor({ webkitSpeechRecognition: FakeRecognition })).toBe(FakeRecognition)
    expect(captionErrorMessage('no-speech')).toBeNull()
    expect(captionErrorMessage('not-allowed')).toMatch(/blocked/)
  })

  test('listens to the mixed track, shows words as they settle, and keeps listening', () => {
    const track = { readyState: 'live' } as MediaStreamTrack
    const { unmount } = render(<LiveCaptions track={track} startedAt={Date.now() - 42_000} onClose={() => {}} />)
    const rec = FakeRecognition.last!
    expect(rec.continuous && rec.interimResults).toBe(true)
    expect(rec.start).toHaveBeenCalledWith(track)

    rec.say('ship on the', false)
    expect(screen.getByText('ship on the')).toBeTruthy()
    rec.say('Ship on the fourteenth.', true)
    expect(screen.getByText('Ship on the fourteenth.')).toBeTruthy()
    expect(screen.getByText('0:42')).toBeTruthy()

    act(() => rec.onend?.())
    expect(rec.start).toHaveBeenCalledTimes(2) // the service ended a session; listen again

    unmount()
    expect(rec.abort).toHaveBeenCalled()
  })

  test('a browser without start(track) falls back to the microphone', () => {
    render(<LiveCaptions track={{ readyState: 'live' } as MediaStreamTrack} startedAt={Date.now()} onClose={() => {}} />)
    const rec = FakeRecognition.last!
    expect(rec.start).toHaveBeenCalledTimes(1)
    rec.start.mockImplementationOnce(() => {
      throw new TypeError('no track input')
    })
    act(() => rec.onend?.())
    expect(rec.start).toHaveBeenLastCalledWith()
  })

  test('a blocked service says so and stops listening; Turn off closes', () => {
    const onClose = vi.fn()
    render(<LiveCaptions track={null} startedAt={Date.now()} onClose={onClose} />)
    const rec = FakeRecognition.last!
    act(() => rec.onerror?.({ error: 'not-allowed' }))
    expect(screen.getByRole('alert').textContent).toMatch(/blocked/)
    act(() => rec.onend?.())
    expect(rec.start).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Turn off' }))
    expect(onClose).toHaveBeenCalled()
  })
})

