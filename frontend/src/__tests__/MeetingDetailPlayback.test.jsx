import React from 'react'
import { act, render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi, describe, test, expect, beforeEach } from 'vitest'

const api = vi.hoisted(() => ({ get: vi.fn(), carryForward: vi.fn(() => Promise.resolve(null)) }))
const player = vi.hoisted(() => ({ ready: false, playFrom: vi.fn() }))
const reports = vi.hoisted(() => ({ downloadMeetingDocument: vi.fn(async () => {}) }))
const recordings = vi.hoisted(() => ({ rebuildTranscript: vi.fn() }))
vi.mock('../services/api', () => ({ default: {}, meetingsApi: api, recordingsApi: recordings, integrationsApi: {}, calendarApi: {}, reportsApi: reports, searchApi: {} }))
vi.mock('../components/vc/ToastProvider', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }))
vi.mock('../components/intelligence/MeetingIntelligencePanel', () => ({ default: () => null }))
vi.mock('../components/EcosystemSyncStatus', () => ({ default: () => null }))
vi.mock('../components/meetings/MeetingNotesPanel', () => ({ default: () => null }))
vi.mock('../components/ChatChannelSelector', () => ({ default: () => null }))
vi.mock('../components/meetings/RecordingPlayer', async () => {
  const { forwardRef, useImperativeHandle } = await import('react')
  return {
    default: forwardRef(function Stub({ decisions, onMoment, audioUrl, waveformReplacement }, ref) {
      useImperativeHandle(ref, () => ({ isReady: () => player.ready, playFrom: player.playFrom }))
      return <div data-testid="player-stub" data-audio-url={audioUrl}>
        {waveformReplacement ?? decisions.map(({ atMs, label }) => (
          <button key={label} type="button" onClick={() => onMoment(atMs)}>{label}</button>
        ))}
      </div>
    }),
  }
})

import MeetingDetail from '../pages/MeetingDetail'

const MEETING = {
  id: 'm1',
  title: 'Planning',
  decisions: ['Ship on the fourteenth'],
  summary_moments: { decisions: [22_000] },
  transcript_segments: [
    { atMs: 0, speaker: 'Speaker 1', text: 'Morning' },
    { atMs: 22_000, speaker: 'Speaker 2', text: 'Ship on the fourteenth' },
  ],
  action_items: [],
}

function renderPage(recordingJob, overrides) {
  api.get.mockResolvedValue({ ...MEETING, recording_job: recordingJob, ...overrides })
  return render(
    <MemoryRouter initialEntries={['/meetings/m1']}>
      <Routes><Route path="/meetings/:id" element={<MeetingDetail />} /></Routes>
    </MemoryRouter>,
  )
}

describe('a pressed timecode plays the recording', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // jsdom has no matchMedia; jumpToTranscript asks it whether this is a phone. Desktop here.
    window.matchMedia = window.matchMedia || ((q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))
    player.ready = false
    Element.prototype.scrollIntoView = vi.fn()
  })

  test('loads and plays from the moment when the audio is not loaded yet', async () => {
    renderPage({ status: 'done', audioKept: true, durationMs: 60_000 })
    fireEvent.click(await screen.findByRole('button', { name: /^Play from 0:22: Ship/ }))
    expect(player.playFrom).toHaveBeenCalledTimes(1)
    expect(player.playFrom).toHaveBeenCalledWith(22_000)
  })

  test('moves loaded audio once, not twice', async () => {
    player.ready = true
    renderPage({ status: 'done', audioKept: true, durationMs: 60_000 })
    fireEvent.click(await screen.findByRole('button', { name: /^Play from 0:22: Ship/ }))
    expect(player.playFrom).toHaveBeenCalledTimes(1)
  })

  test('a decision mark in the Slate player plays from it too', async () => {
    renderPage({ status: 'done', audioKept: true, durationMs: 60_000 })
    fireEvent.click(await screen.findByRole('button', { name: 'Decision: Ship on the fourteenth' }))
    expect(player.playFrom).toHaveBeenCalledWith(22_000)
  })

  test.each([false, true])('offers to rebuild a browser recording with kept audio (complete timing: %s)', async (hasEndTimes) => {
    recordings.rebuildTranscript.mockResolvedValue({ success: true })
    renderPage({ status: 'done', source: 'browser', audioKept: true, durationMs: 60_000 }, {
      transcript_segments: hasEndTimes
        ? MEETING.transcript_segments.map(line => ({ ...line, endMs: line.atMs + 1000 }))
        : MEETING.transcript_segments,
    })
    fireEvent.click(await screen.findByRole('button', { name: 'More actions' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Rebuild transcript from audio' }))
    expect(recordings.rebuildTranscript).toHaveBeenCalledWith('m1')
    expect(screen.getByTestId('player-stub')).toBeInTheDocument()
  })

  test('swaps the waveform for rebuild progress and restores it when polling reports completion', async () => {
    const canvas = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    const intervals = vi.spyOn(window, 'setInterval')
    const job = { status: 'done', source: 'browser', audioKept: true, durationMs: 60_000 }
    try {
      renderPage(job)
      expect(await screen.findByRole('button', { name: 'Decision: Ship on the fourteenth' })).toBeInTheDocument()

      recordings.rebuildTranscript.mockResolvedValue({ success: true })
      api.get.mockResolvedValue({
        ...MEETING, recording_job: { ...job, transcriptRebuildAt: new Date().toISOString() },
      })
      fireEvent.click(screen.getByRole('button', { name: 'More actions' }))
      fireEvent.click(screen.getByRole('menuitem', { name: 'Rebuild transcript from audio' }))
      const progress = await screen.findByRole('progressbar', { name: 'Transcript rebuild progress' })
      expect(screen.getByTestId('player-stub')).toContainElement(progress)
      expect(screen.queryByRole('button', { name: 'Decision: Ship on the fourteenth' })).toBeNull()
      expect(screen.queryByText('Action items', { selector: '.bs-dl-steps span' })).toBeNull()

      api.get.mockResolvedValue({ ...MEETING, recording_job: job })
      const poll = intervals.mock.calls.find(([, delay]) => delay === 5000)?.[0]
      expect(poll).toBeTypeOf('function')
      await act(async () => { await poll() })
      expect(screen.queryByRole('progressbar', { name: 'Transcript rebuild progress' })).toBeNull()
      expect(screen.getByRole('button', { name: 'Decision: Ship on the fourteenth' })).toBeInTheDocument()
    } finally {
      intervals.mockRestore()
      canvas.mockRestore()
    }
  })

  test('a Virtual room speaker button includes its line count and plays from the first line', async () => {
    renderPage({ status: 'done', audioKept: true, durationMs: 60_000 })
    fireEvent.click(await screen.findByRole('tab', { name: 'Virtual room' }))
    const speaker = screen.getByRole('button', { name: 'Speaker 2, 1 line' })
    expect(speaker).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(speaker)
    expect(speaker).toHaveAttribute('aria-pressed', 'true')
    expect(player.playFrom).toHaveBeenCalledExactlyOnceWith(22_000)
  })

  test('routes legacy uploaded audio through Slate even without a timed transcript', async () => {
    const audioUrl = 'https://signed.test/uploaded'
    renderPage(undefined, { audio_file_url: audioUrl, transcript_segments: null })
    expect(await screen.findByTestId('player-stub')).toHaveAttribute('data-audio-url', audioUrl)
  })

  test('without kept audio it only jumps the transcript', async () => {
    renderPage({ status: 'done' })
    fireEvent.click(await screen.findByRole('button', { name: /Jump to 0:22 in the transcript: Ship/ }))
    expect(screen.queryByTestId('player-stub')).toBeNull()
    expect(player.playFrom).not.toHaveBeenCalled()
  })

  test.each([
    ['Recap PDF', 'recap', 'pdf', 'Planning - Recap.pdf'],
    ['Recap Word (.docx)', 'recap', 'docx', 'Planning - Recap.docx'],
    ['Transcript PDF', 'transcript', 'pdf', 'Planning - Transcript.pdf'],
    ['Transcript Word (.docx)', 'transcript', 'docx', 'Planning - Transcript.docx'],
  ])('downloads %s from the meeting header', async (option, kind, format, filename) => {
    renderPage({ status: 'done' })
    fireEvent.click(await screen.findByRole('button', { name: 'Export meeting' }))
    fireEvent.click(screen.getByRole('menuitem', { name: option }))
    expect(reports.downloadMeetingDocument).toHaveBeenCalledWith('m1', kind, format, filename)
  })
})
