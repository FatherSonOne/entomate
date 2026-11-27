import React from 'react'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'

const api = vi.hoisted(() => ({ playback: vi.fn(), waveform: vi.fn(), removeAudio: vi.fn() }))
const cacheMock = vi.hoisted(() => ({ invalidate: vi.fn() }))
vi.mock('../services/api', () => ({ recordingsApi: api, meetingsApi: { renameSpeaker: vi.fn() } }))
vi.mock('../services/apiCache', () => ({ default: cacheMock }))

import RecordingPlayer, { type RecordingPlayerHandle } from '../components/meetings/RecordingPlayer'
import TranscriptPanel from '../components/meetings/TranscriptPanel'
import LiveCaptions, { captionErrorMessage, speechRecognitionCtor } from '../components/meetings/LiveCaptions'
import { canPlay, loadRecordingAudio, toRecordingJob } from '../services/meetingRecorderService'
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
  test('defaults to combined, switches to either source at the same playhead, and can switch back', async () => {
    api.playback.mockImplementation((_id, track) => Promise.resolve({
      url: `https://signed.test/${track ?? 'combined'}`, durationMs: track === 'tab' ? 30_000 : 60_000,
    }))
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    try {
      render(<RecordingPlayer meetingId={MEETING} durationMs={60_000} audioTracks={{
        mic: { pieces: 2, durationMs: 60_000 }, tab: { pieces: 1, durationMs: 30_000 },
      }} />)
      const selector = screen.getByRole('combobox', { name: 'Audio source' })
      expect(selector).toHaveValue('')
      expect(api.playback).not.toHaveBeenCalled()
      fireEvent.change(screen.getByRole('slider', { name: 'Playback position' }), { target: { value: '12.25' } })
      for (const [index, track] of ['', 'mic', 'tab', ''].entries()) {
        if (index > 0) fireEvent.change(selector, { target: { value: track } })
        const audio = await screen.findByTestId('recording-player') as HTMLAudioElement
        expect(audio.getAttribute('src')).toBe(`https://signed.test/${track || 'combined'}`)
        Object.defineProperty(audio, 'duration', { configurable: true, value: track === 'tab' ? 30 : 60 })
        fireEvent.loadedMetadata(audio)
        expect(audio.currentTime).toBe(12.25)
      }
      expect(api.playback.mock.calls).toEqual([[MEETING], [MEETING, 'mic'], [MEETING, 'tab'], [MEETING]])
      expect(screen.getByRole('option', { name: 'Tab audio · through 0:30' })).toBeInTheDocument()
    } finally {
      pause.mockRestore()
    }
  })

  test('keeps the playhead across Combined and three named room tracks', async () => {
    api.playback.mockImplementation((_id, track) => Promise.resolve({
      url: `https://signed.test/${track ?? 'combined'}`, durationMs: 60_000,
    }))
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    const coverage = { pieces: 2, durationMs: 60_000 }
    const job = toRecordingJob({
      source: 'room', status: 'done', durationMs: 60_000, participantTracks: {
        p1: { ...coverage, label: 'Host' },
        p2: { ...coverage, label: 'Alex' },
        p3: { ...coverage, label: 'Alex' },
      },
    })
    try {
      render(<RecordingPlayer meetingId={MEETING} durationMs={60_000} roomRecording audioTracks={job?.audioTracks} />)
      const selector = screen.getByRole('combobox', { name: 'Audio source' })
      expect(selector).toHaveValue('')
      expect(within(selector).getAllByRole('option').map(option => option.textContent)).toEqual(['Combined', 'Host', 'Alex (1)', 'Alex (2)'])
      fireEvent.change(screen.getByRole('slider', { name: 'Playback position' }), { target: { value: '12.25' } })
      for (const [index, track] of ['', 'p1', 'p2', 'p3', ''].entries()) {
        if (index > 0) fireEvent.change(selector, { target: { value: track } })
        const audio = await screen.findByTestId('recording-player') as HTMLAudioElement
        expect(audio.src).toBe(`https://signed.test/${track || 'combined'}`)
        Object.defineProperty(audio, 'duration', { configurable: true, value: 60 })
        fireEvent.loadedMetadata(audio)
        expect(audio.currentTime).toBe(12.25)
      }
    } finally {
      pause.mockRestore()
    }
  })

  test('marks a partial participant track and jumps to the same time on Combined', async () => {
    api.playback.mockImplementation((_id, track) => Promise.resolve({
      url: `https://signed.test/${track ?? 'combined'}`, durationMs: 60_000,
    }))
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    const job = toRecordingJob({
      source: 'room', status: 'done', durationMs: 60_000, participantTracks: {
        p1: { pieces: 1, durationMs: 60_000, label: 'Host', status: 'saved' },
        p4: { pieces: 1, durationMs: 60_000, label: 'Guest', status: 'partial',
          gaps: [{ startMs: 9000, endMs: 14000 }] },
      },
    })
    try {
      render(<RecordingPlayer meetingId={MEETING} durationMs={60_000} roomRecording audioTracks={job?.audioTracks} gaps={job?.audioGaps} />)
      expect(screen.getByRole('list', { name: 'Participant track status' })).toHaveTextContent('Guest · Partial')
      const selector = screen.getByRole('combobox', { name: 'Audio source' })
      expect(selector).toHaveValue('')
      fireEvent.change(selector, { target: { value: 'p4' } })
      const guest = await screen.findByTestId('recording-player') as HTMLAudioElement
      expect(guest.src).toBe('https://signed.test/p4')
      fireEvent.click(screen.getByRole('button', { name: 'Guest gap from 0:09 to 0:14. Play Combined.' }))
      const combined = await screen.findByTestId('recording-player') as HTMLAudioElement
      expect(combined.src).toBe('https://signed.test/combined')
      Object.defineProperty(combined, 'duration', { configurable: true, value: 60 })
      fireEvent.loadedMetadata(combined)
      expect(combined.currentTime).toBe(9)
      expect(play).toHaveBeenCalledTimes(1)
    } finally {
      pause.mockRestore()
      play.mockRestore()
    }
  })

  test('draws each track on the shared clock and plays the available source when a gap is clicked', async () => {
    api.playback.mockImplementation((_id, track) => Promise.resolve({
      url: `https://signed.test/${track ?? 'combined'}`,
      durationMs: track === 'mic' ? 25_000 : 60_000,
    }))
    api.waveform.mockImplementation((_id, _signal, track) => Promise.resolve({
      peaks: track === 'mic' ? [0.2, 0.4, 0.2] : [0.1, 0.9, 0.1],
    }))
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    try {
      render(<RecordingPlayer meetingId={MEETING} durationMs={60_000} waveformPeaks={[0.1, 0.3, 0.1]} audioTracks={{
        mic: { pieces: 1, durationMs: 25_000 }, tab: { pieces: 2, durationMs: 60_000 },
      }} gaps={[
        { track: 'tab', startMs: 10_000, endMs: 15_000 },
        { track: 'mic', startMs: 33_000, endMs: null },
        { track: 'tab', startMs: 50_000, endMs: 52_000 },
      ]} />)
      const combined = screen.getByTestId('recording-waveform').querySelector('path')?.getAttribute('d')
      fireEvent.click(screen.getByRole('button', { name: 'Tab audio gap from 0:10 to 0:15. Play Microphone.' }))
      let audio = await screen.findByTestId('recording-player') as HTMLAudioElement
      expect(audio.src).toBe('https://signed.test/mic')
      Object.defineProperty(audio, 'duration', { configurable: true, value: 25 })
      fireEvent.loadedMetadata(audio)
      expect(audio.currentTime).toBe(10)
      expect(play).toHaveBeenCalledTimes(1)
      const micPath = (await screen.findByTestId('recording-waveform')).querySelector('path')
      expect(micPath?.getAttribute('d')).not.toBe(combined)
      expect(micPath?.getAttribute('transform')).toContain('scale(0.416')
      expect(screen.getByRole('slider', { name: 'Playback position' })).toHaveAttribute('max', '25')
      expect(screen.getByRole('list', { name: 'Track save status' })).toHaveTextContent('Microphone · Partial through 0:25')

      fireEvent.click(screen.getByRole('button', { name: 'Microphone gap from 0:33 to the end. Play Tab audio.' }))
      audio = await screen.findByTestId('recording-player') as HTMLAudioElement
      expect(audio.src).toBe('https://signed.test/tab')
      Object.defineProperty(audio, 'duration', { configurable: true, value: 60 })
      fireEvent.loadedMetadata(audio)
      expect(audio.currentTime).toBe(33)
      expect(play).toHaveBeenCalledTimes(2)
      expect(api.waveform).toHaveBeenCalledWith(MEETING, expect.any(AbortSignal), 'mic')
      expect(api.waveform).toHaveBeenCalledWith(MEETING, expect.any(AbortSignal), 'tab')
      fireEvent.click(screen.getByRole('button', { name: 'Tab audio gap from 0:50 to 0:52. Play Combined.' }))
      audio = await screen.findByTestId('recording-player') as HTMLAudioElement
      expect(audio.src).toBe('https://signed.test/combined')
      Object.defineProperty(audio, 'duration', { configurable: true, value: 60 })
      fireEvent.loadedMetadata(audio)
      expect(audio.currentTime).toBe(50)
    } finally {
      play.mockRestore()
      pause.mockRestore()
    }
  })

  test('downloads nothing until asked, then seeks with the Slate slider without starting playback', async () => {
    const onTime = vi.fn()
    render(<RecordingPlayer meetingId={MEETING} durationMs={754_000} onTime={onTime} />)
    expect(api.playback).not.toHaveBeenCalled()
    const slider = screen.getByRole('slider', { name: 'Playback position' })
    fireEvent.change(slider, { target: { value: '12.25' } })
    const audio = (await screen.findByTestId('recording-player')) as HTMLAudioElement
    const play = vi.spyOn(audio, 'play').mockResolvedValue(undefined)
    Object.defineProperty(audio, 'duration', { configurable: true, value: 60 })
    fireEvent.loadedMetadata(audio)
    expect(audio.getAttribute('src')).toBe('blob:recording')
    expect(audio.currentTime).toBe(12.25)
    expect(play).not.toHaveBeenCalled()
    expect(onTime).toHaveBeenLastCalledWith(12_000)
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

  test('a speaker preview waits for audio and pauses at its end', async () => {
    const ref = React.createRef<RecordingPlayerHandle>()
    render(<RecordingPlayer ref={ref} meetingId={MEETING} />)
    act(() => ref.current!.playFrom(10_000, 13_000))
    const audio = (await screen.findByTestId('recording-player')) as HTMLAudioElement
    const play = vi.spyOn(audio, 'play').mockResolvedValue(undefined)
    const pause = vi.spyOn(audio, 'pause').mockImplementation(() => {})
    Object.defineProperty(audio, 'duration', { configurable: true, value: 60 })
    fireEvent.loadedMetadata(audio)
    expect(audio.currentTime).toBe(10)
    expect(play).toHaveBeenCalledTimes(1)
    audio.currentTime = 12.9
    fireEvent.timeUpdate(audio)
    expect(pause).not.toHaveBeenCalled()
    audio.currentTime = 13
    fireEvent.timeUpdate(audio)
    expect(pause).toHaveBeenCalledTimes(1)

    act(() => ref.current!.playFrom(10_000, 13_000))
    act(() => ref.current!.playFrom(11_000))
    audio.currentTime = 14
    fireEvent.timeUpdate(audio)
    expect(pause).toHaveBeenCalledTimes(1)
  })

  test('draws uploaded audio on open and leaves its silent half empty', async () => {
    const signedUrl = 'https://signed.test/seekable'
    const decodeAudioData = vi.fn().mockResolvedValue({
      length: 4,
      numberOfChannels: 1,
      getChannelData: () => Float32Array.from([0, 0, 0.25, -0.5]),
    })
    vi.stubGlobal('OfflineAudioContext', class {
      decodeAudioData = decodeAudioData
    })
    render(<RecordingPlayer meetingId={MEETING} audioUrl={signedUrl} durationMs={12_000} />)
    const waveform = await screen.findByTestId('recording-waveform')
    expect(screen.queryByTestId('recording-player')).toBeNull()
    const path = waveform.querySelector('path')?.getAttribute('d') ?? ''
    expect(okFetch).toHaveBeenCalledWith(signedUrl, expect.objectContaining({ credentials: 'omit' }))
    expect(decodeAudioData).toHaveBeenCalledTimes(1)
    expect(path.match(/M/g)).toHaveLength(2)
    expect(Number(path.match(/^M([\d.]+),/)?.[1])).toBeGreaterThan(500)
  })

  test('renders server peaks for a linked video without downloading it to decode the waveform', async () => {
    const url = 'https://signed.test/full-meeting.mp4'
    api.playback.mockResolvedValue({ url, durationMs: 3_215_044, serverWaveform: true })
    api.waveform.mockResolvedValue({ peaks: [0, 0.4, 0, 0.25] })
    render(<RecordingPlayer meetingId={MEETING} />)
    const waveform = await screen.findByTestId('recording-waveform')
    expect(screen.queryByTestId('recording-player')).toBeNull()
    expect(api.playback).not.toHaveBeenCalled()
    expect(api.waveform).toHaveBeenCalledWith(MEETING, expect.any(AbortSignal))
    expect(okFetch).not.toHaveBeenCalled()
    expect(waveform.querySelector('path')?.getAttribute('d')?.match(/M/g)).toHaveLength(2)
  })

  test('can replace the waveform without resetting playback controls', () => {
    const recording = { meetingId: MEETING, durationMs: 12_000, waveformPeaks: [0.2, 0.5, 0.3] }
    const { rerender } = render(<RecordingPlayer {...recording} />)
    const speed = screen.getByRole('combobox', { name: 'Playback speed' })
    fireEvent.change(speed, { target: { value: '1.5' } })
    expect(screen.getByTestId('recording-waveform')).toBeInTheDocument()

    rerender(<RecordingPlayer {...recording} waveformReplacement={<p>Rebuilding transcript</p>} />)
    expect(screen.getByText('Rebuilding transcript')).toBeInTheDocument()
    expect(screen.queryByTestId('recording-waveform')).toBeNull()
    expect(speed).toHaveValue('1.5')

    rerender(<RecordingPlayer {...recording} />)
    expect(screen.getByTestId('recording-waveform')).toBeInTheDocument()
    expect(speed).toHaveValue('1.5')
  })

  test('renders peaks saved during processing immediately and colors speech near the end', () => {
    const { container } = render(<RecordingPlayer meetingId={MEETING} durationMs={1_740_000}
      waveformPeaks={[0.2, 0.5, 0.3]} transcriptSegments={[
        { speaker: 'Speaker 1', atMs: 0, endMs: 3_000, text: 'First' },
        { speaker: 'Speaker 2', atMs: 1_705_000, endMs: 1_710_000, text: 'Near the end' },
      ]} />)
    expect(screen.getByTestId('recording-waveform')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('switch', { name: 'Speaker colors' }))
    expect([...container.querySelectorAll('stop')].some(stop => Number(stop.getAttribute('offset')) > .97)).toBe(true)
    expect(api.waveform).not.toHaveBeenCalled()
    expect(api.playback).not.toHaveBeenCalled()
  })

  test('a recording moment passes the original transcript time to the jump handler', () => {
    const onMoment = vi.fn()
    render(<RecordingPlayer meetingId={MEETING} durationMs={60_000}
      decisions={[{ atMs: 22_000, label: 'Decision: Ship on the fourteenth' }]} onMoment={onMoment} />)
    fireEvent.click(screen.getByRole('button', { name: 'Decision: Ship on the fourteenth' }))
    expect(onMoment).toHaveBeenCalledWith(22_000)
  })

  test('toggles speaker colors and labels using transcript ranges without changing playback', () => {
    const transcriptSegments: TranscriptSegment[] = [
      { speaker: 'Morgan', atMs: 1_000, endMs: 3_000, text: 'First turn' },
      { speaker: 'Avery', atMs: 5_000, text: 'Older line with a start time only' },
      { speaker: 'Morgan', atMs: 8_000, endMs: 9_000, text: 'Last turn' },
    ]
    const { container } = render(<RecordingPlayer meetingId={MEETING} durationMs={10_000} transcriptSegments={transcriptSegments} />)
    const toggle = screen.getByRole('switch', { name: 'Speaker colors' })
    const slider = screen.getByRole('slider', { name: 'Playback position' })
    expect(toggle).not.toBeChecked()
    expect(screen.queryByRole('list', { name: 'Waveform speakers' })).toBeNull()

    fireEvent.click(toggle)
    expect(toggle).toBeChecked()
    const legend = screen.getByRole('list', { name: 'Waveform speakers' })
    expect(legend).toHaveTextContent('Morgan')
    expect(legend).toHaveTextContent('Avery')
    const stops = [...container.querySelectorAll('svg stop')]
    expect(stops.map(stop => Number(stop.getAttribute('offset')))).toEqual([
      .1, .1, .3, .3, .5, .5, .8, .8, .8, .8, .9, .9,
    ])
    expect(stops[1]?.getAttribute('stop-color')).not.toBe(stops[5]?.getAttribute('stop-color'))
    expect(stops[3]?.getAttribute('stop-color')).toBe('transparent')
    expect(slider).toHaveValue('0')
    expect(api.playback).not.toHaveBeenCalled()

    fireEvent.click(toggle)
    expect(toggle).not.toBeChecked()
    expect(screen.queryByRole('list', { name: 'Waveform speakers' })).toBeNull()
    expect(container.querySelector('svg stop')).toBeNull()
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

