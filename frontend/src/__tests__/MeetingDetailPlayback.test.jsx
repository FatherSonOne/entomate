import React from 'react'
import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'

const api = vi.hoisted(() => ({ get: vi.fn(), regenerateSummary: vi.fn(async () => ({})), carryForward: vi.fn(() => Promise.resolve(null)) }))
const search = vi.hoisted(() => ({ askStream: vi.fn(), getHistory: async () => ({ history: [] }) }))
const player = vi.hoisted(() => ({ ready: false, playFrom: vi.fn(), cueAt: vi.fn() }))
const reports = vi.hoisted(() => ({ downloadMeetingDocument: vi.fn(async () => {}) }))
const recordings = vi.hoisted(() => ({ rebuildTranscript: vi.fn() }))
vi.mock('../services/api', () => ({ default: { get: async () => ({ notes: [] }) }, meetingsApi: api, recordingsApi: recordings, integrationsApi: {}, calendarApi: {}, reportsApi: reports, searchApi: search }))
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'playback-user' } }) }))
vi.mock('../contexts/OrgContext', () => ({ useOrgSafe: () => ({ org: { id: 'playback-org' } }) }))
vi.mock('../components/vc/ToastProvider', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }))
vi.mock('../components/intelligence/MeetingIntelligencePanel', () => ({ default: () => null }))
vi.mock('../components/EcosystemSyncStatus', () => ({ default: () => null }))
vi.mock('../components/meetings/MeetingNotesPanel', () => ({ default: () => null }))
vi.mock('../components/ChatChannelSelector', () => ({ default: () => null }))
vi.mock('../components/meetings/RecordingPlayer', async () => {
  const { forwardRef, useImperativeHandle } = await import('react')
  return {
    default: forwardRef(function Stub({ decisions, onMoment, audioUrl, waveformReplacement }, ref) {
      useImperativeHandle(ref, () => ({ isReady: () => player.ready, playFrom: player.playFrom, cueAt: player.cueAt }))
      return <div data-testid="player-stub" data-audio-url={audioUrl}>
        {waveformReplacement ?? decisions.map(({ atMs, label }) => (
          <button key={label} type="button" onClick={() => onMoment(atMs)}>{label}</button>
        ))}
      </div>
    }),
  }
})

import MeetingDetail from '../pages/MeetingDetail'
import Search from '../pages/Search'
import NavTrailRecorder from '../components/NavTrailRecorder'

const REVISION = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'

function BrowserBack() {
  const navigate = useNavigate()
  return <button onClick={() => navigate(-1)}>Browser back</button>
}

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
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  })

  afterEach(() => { vi.restoreAllMocks() })

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

  test('opens the intelligence profile from the meeting toolbar', async () => {
    renderPage({ status: 'done' })
    fireEvent.click(await screen.findByRole('button', { name: 'Intelligence profile' }))
    expect(await screen.findByRole('dialog', { name: 'Intelligence profile' })).toBeInTheDocument()
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
      expect(screen.getByText('Preparing audio')).toBeInTheDocument()
      expect(progress).not.toHaveAttribute('aria-valuenow')
      expect(screen.queryByRole('button', { name: 'Decision: Ship on the fourteenth' })).toBeNull()
      expect(screen.queryByText('Action items', { selector: '.bs-dl-steps span' })).toBeNull()

      const poll = intervals.mock.calls.find(([, delay]) => delay === 5000)?.[0]
      expect(poll).toBeTypeOf('function')
      const rebuildingJob = { ...job, transcriptRebuildAt: new Date().toISOString() }
      api.get.mockResolvedValue({ ...MEETING, recording_job: {
        ...rebuildingJob, transcriptRebuildProgress: { stage: 'transcribing', processedMs: 30_000, totalMs: 60_000 },
      } })
      await act(async () => { await poll() })
      expect(progress).toHaveAttribute('aria-valuenow', '50')
      expect(screen.getByText('0:30 of 1:00 processed')).toBeInTheDocument()

      api.get.mockResolvedValue({ ...MEETING, recording_job: {
        ...rebuildingJob, transcriptRebuildProgress: { stage: 'saving', processedMs: 60_000, totalMs: 60_000 },
      } })
      await act(async () => { await poll() })
      expect(screen.getByText('Saving transcript')).toBeInTheDocument()

      api.get.mockResolvedValue({ ...MEETING, summary_template: 'planning', recording_job: { ...job, transcriptRebuiltAt: new Date().toISOString() } })
      await act(async () => { await poll() })
      expect(screen.queryByRole('progressbar', { name: 'Transcript rebuild progress' })).toBeNull()
      expect(screen.getByRole('button', { name: 'Decision: Ship on the fourteenth' })).toBeInTheDocument()
      expect(screen.getByText('Transcript rebuilt · 2 lines')).toBeInTheDocument()
      expect(api.regenerateSummary).not.toHaveBeenCalled()
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Rewrite summary' })) })
      expect(api.regenerateSummary).toHaveBeenCalledWith('m1', 'planning')
      expect(screen.queryByRole('button', { name: 'Rewrite summary' })).toBeNull()
    } finally {
      intervals.mockRestore()
      canvas.mockRestore()
    }
  })

  test('a paraphrased Ask cites the exact line and both Back paths restore the completed answer without asking again', async () => {
    const time = 22_000
    const question = 'What pushed the release date back?'
    api.get.mockResolvedValue({
      ...MEETING,
      recording_job: { status: 'done', audioKept: true, durationMs: 60_000 },
      transcript_search_revision: REVISION,
      transcript_segments: [
        { atMs: time, speaker: 'Ana', text: 'The vendor needed another week.' },
        { atMs: time, speaker: 'Pat', text: 'I will update the launch plan.' },
      ],
    })
    const claims = [
      ['The vendor needed more time.', 'Ana', 'The vendor needed another week.'],
      ['Pat owns the launch plan update.', 'Pat', 'I will update the launch plan.'],
    ].map(([text, speaker, quote], index) => ({
      text,
      citations: [{
        id: 'm1', title: 'Planning', speaker, quote, atMs: time,
        passage: { revision: REVISION, kind: 'segment', position: index + 1 },
      }],
    }))
    search.askStream.mockImplementation(async (_data, callbacks) => {
      callbacks.onComplete({ answer: claims.map((claim) => claim.text).join('\n\n'), claims })
    })
    render(
      <MemoryRouter initialEntries={[{ pathname: '/search', search: `?q=${encodeURIComponent(question)}&ask=1`, key: crypto.randomUUID() }]}>
        <NavTrailRecorder />
        <BrowserBack />
        <Routes>
          <Route path="/search" element={<Search />} />
          <Route path="/meetings/:id" element={<MeetingDetail />} />
        </Routes>
      </MemoryRouter>,
    )

    const first = await screen.findByRole('link', { name: /Planning · 00:22 · Ana/ })
    const second = screen.getByRole('link', { name: /Planning · 00:22 · Pat/ })
    expect(first).toHaveAttribute('href', `/meetings/m1?tab=transcript&t=22000&rev=${REVISION}&line=1`)
    expect(second).toHaveAttribute('href', `/meetings/m1?tab=transcript&t=22000&rev=${REVISION}&line=2`)
    fireEvent.change(screen.getByRole('textbox', { name: 'Question about your meetings' }), { target: { value: 'Unsubmitted draft' } })
    fireEvent.click(first)
    const transcript = await screen.findByRole('list', { name: 'Transcript' })
    const line = within(transcript).getByText('The vendor needed another week.', { exact: false }).closest('li')
    await waitFor(() => expect(line).toHaveFocus())
    expect(line).toHaveAttribute('aria-current', 'true')
    expect(player.cueAt).toHaveBeenCalledWith(time)
    expect(player.playFrom).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('link', { name: 'Back to Search' }))
    await waitFor(() => expect(screen.getByRole('link', { name: /Planning · 00:22 · Ana/ })).toHaveFocus())
    expect(screen.getByText('The vendor needed more time.')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Question about your meetings' })).toHaveValue('Unsubmitted draft')

    fireEvent.click(screen.getByRole('link', { name: /Planning · 00:22 · Pat/ }))
    expect(await screen.findByRole('tab', { name: 'Transcript & recording', selected: true })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Browser back' }))
    await waitFor(() => expect(screen.getByRole('link', { name: /Planning · 00:22 · Pat/ })).toHaveFocus())
    expect(screen.getByText('Pat owns the launch plan update.')).toBeInTheDocument()
    expect(search.askStream).toHaveBeenCalledTimes(1)
    expect(search.askStream).toHaveBeenCalledWith({ question }, expect.any(Object))
  })

  test('a Transcript & recording speaker button includes its line count and plays from the first line', async () => {
    renderPage({ status: 'done', audioKept: true, durationMs: 60_000 })
    fireEvent.click(await screen.findByRole('tab', { name: 'Transcript & recording' }))
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
