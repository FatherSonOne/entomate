import React from 'react'
import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'

const api = vi.hoisted(() => ({ get: vi.fn(), regenerateSummary: vi.fn(async () => ({})), carryForward: vi.fn(() => Promise.resolve(null)) }))
const search = vi.hoisted(() => ({ ask: vi.fn(), askStream: vi.fn(), getHistory: async () => ({ history: [] }) }))
const listLaunchMilestones = vi.hoisted(() => vi.fn())
const findMilestones = vi.hoisted(() => vi.fn())
const player = vi.hoisted(() => ({ ready: false, playFrom: vi.fn(), cueAt: vi.fn() }))
const reports = vi.hoisted(() => ({ downloadMeetingDocument: vi.fn(async () => {}) }))
const recordings = vi.hoisted(() => ({ rebuildTranscript: vi.fn() }))
vi.mock('../services/api', () => ({ default: { get: async () => ({ notes: [] }) }, meetingsApi: api, recordingsApi: recordings, integrationsApi: {}, calendarApi: {}, reportsApi: reports, searchApi: search, projectsApi: { listLaunchMilestones, findMilestones } }))
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

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
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
    expect(search.askStream).toHaveBeenCalledWith({ question, workspaceId: 'playback-org', timeZone: expect.any(String) }, expect.any(Object))
  })

  test.each([
    { label: 'monthly recap', question: 'What changed this month?', comparing: false, coverageName: 'Monthly recap scope' },
    { label: 'month-over-month comparison', question: 'Compare this month to date with all of last month',
      comparing: true, coverageName: 'Month-over-month coverage' },
    { label: 'custom date comparison', question: 'What changed between these periods?',
      comparing: true, custom: true, coverageName: 'Date range coverage' },
    { label: 'typed ISO dates', question: 'Compare 2026-10-04 to 2026-10-07 with 2026-11-18 to 2026-11-25. What changed about launch?',
      comparing: true, custom: true, typed: true, coverageName: 'Date range coverage' },
    { label: 'typed written dates', question: 'What changed about launch between Oct 4–7, 2026 and Nov 18–26, 2026?',
      comparing: true, custom: true, typed: true, corrected: true, coverageName: 'Date range coverage' },
    { label: 'relative days', question: 'Compare the last 30 days vs. the previous 30. What changed about launch?',
      comparing: true, custom: true, typed: true, relative: 'days', coverageName: 'Date range coverage' },
    { label: 'relative weeks', question: 'What changed about launch last week vs. the previous week?',
      comparing: true, custom: true, typed: true, relative: 'weeks', coverageName: 'Date range coverage' },
    { label: 'relative months', question: 'Compare the last 3 months vs. the previous 3. What changed about launch?',
      comparing: true, custom: true, typed: true, relative: 'months', coverageName: 'Date range coverage' },
    { label: 'launch milestone comparison', question: 'The two weeks before launch vs. the two weeks after. What changed?',
      comparing: true, custom: true, typed: true, relative: 'launch', coverageName: 'Date range coverage' },
    { label: 'manual launch comparison', question: 'The two weeks before launch vs. the two weeks after. What changed?',
      comparing: true, custom: true, typed: true, relative: 'launch', manual: true, coverageName: 'Date range coverage' },
    { label: 'named milestone comparison', question: 'Compare the two weeks before and after Security Review. What changed?',
      comparing: true, custom: true, typed: true, relative: 'launch', named: true, coverageName: 'Date range coverage' },
    { label: 'manual named milestone comparison', question: 'Compare the two weeks before and after Security Review. What changed?',
      comparing: true, custom: true, typed: true, relative: 'launch', named: true, manual: true, coverageName: 'Date range coverage' },
    { label: 'selected milestone with unequal windows', question: '30 days before Security Review vs. 7 days after',
      comparing: true, custom: true, typed: true, relative: 'milestone-window', named: true, coverageName: 'Date range coverage' },
    { label: 'manual milestone with unequal windows', question: '30 days before Security Review vs. 7 days after',
      comparing: true, custom: true, typed: true, relative: 'milestone-window', named: true, manual: true, coverageName: 'Date range coverage' },
    { label: 'selected milestone with mixed units', question: '2 weeks before Security Review vs. 1 month after',
      comparing: true, custom: true, typed: true, relative: 'mixed-milestone-window', named: true, coverageName: 'Date range coverage' },
    { label: 'manual milestone with mixed units', question: '2 weeks before Security Review vs. 1 month after',
      comparing: true, custom: true, typed: true, relative: 'mixed-milestone-window', named: true, manual: true, coverageName: 'Date range coverage' },
    { label: 'selected milestone with spelled-out counts', question: 'two weeks before Security Review vs. one month after',
      comparing: true, custom: true, typed: true, relative: 'mixed-milestone-window', named: true, coverageName: 'Date range coverage' },
    { label: 'manual milestone with spelled-out counts', question: 'two weeks before Security Review vs. one month after',
      comparing: true, custom: true, typed: true, relative: 'mixed-milestone-window', named: true, manual: true, coverageName: 'Date range coverage' },
    { label: 'selected milestone with implied counts', question: 'a week before Security Review vs. a month after',
      comparing: true, custom: true, typed: true, relative: 'implied-milestone-window', named: true, coverageName: 'Date range coverage' },
    { label: 'manual milestone with implied counts', question: 'a week before Security Review vs. a month after',
      comparing: true, custom: true, typed: true, relative: 'implied-milestone-window', named: true, manual: true, coverageName: 'Date range coverage' },
    { label: 'selected milestone with a clarified count', question: 'a few weeks before Security Review vs. a month after',
      comparing: true, custom: true, typed: true, relative: 'ambiguous-milestone-window', named: true, coverageName: 'Date range coverage' },
    { label: 'manual milestone with a clarified count', question: 'a few weeks before Security Review vs. a month after',
      comparing: true, custom: true, typed: true, relative: 'ambiguous-milestone-window', named: true, manual: true, coverageName: 'Date range coverage' },
    { label: 'selected milestone with both counts clarified', question: 'a few weeks before Security Review vs. several days after',
      comparing: true, custom: true, typed: true, relative: 'two-ambiguous-milestone-windows', named: true, coverageName: 'Date range coverage' },
    { label: 'manual milestone with both counts clarified', question: 'a few weeks before Security Review vs. several days after',
      comparing: true, custom: true, typed: true, relative: 'two-ambiguous-milestone-windows', named: true, manual: true, coverageName: 'Date range coverage' },
    { label: 'selected milestone with a suggested count', question: 'a couple of weeks before Security Review vs. a few days after',
      comparing: true, custom: true, typed: true, relative: 'suggested-milestone-window', named: true, coverageName: 'Date range coverage' },
    { label: 'manual milestone with an edited suggested count', question: 'a couple of weeks before Security Review vs. a few days after',
      comparing: true, custom: true, typed: true, relative: 'suggested-milestone-window', named: true, manual: true, coverageName: 'Date range coverage' },
    { label: 'selected milestone with approximate counts', question: 'about two weeks before Security Review vs. roughly a month after',
      comparing: true, custom: true, typed: true, relative: 'approximate-milestone-window', named: true, coverageName: 'Date range coverage' },
    { label: 'manual milestone with edited approximate counts', question: 'about two weeks before Security Review vs. roughly a month after',
      comparing: true, custom: true, typed: true, relative: 'approximate-milestone-window', named: true, manual: true, coverageName: 'Date range coverage' },
  ])('$label restores coverage and the exact Before and After links without a second Ask request', async ({ question, comparing, custom, typed, corrected, relative, manual, named, coverageName }) => {
    const relativeCase = {
      days: {
        beforeMidnight: [10, 28], afterMidnight: [10, 29],
        previous: { startDate: '2026-09-29', endDate: '2026-10-28' },
        current: { startDate: '2026-10-29', endDate: '2026-11-26' },
        previewEnd: '2026-11-27', draftEnd: '2026-11-25',
        previousLabel: /Sep 29\D+Oct 28, 2026/, currentLabel: /Oct 29\D+Nov 26, 2026/,
        message: 'completed calendar days and exclude today',
      },
      weeks: {
        beforeMidnight: [10, 29], afterMidnight: [10, 30], beforeMeeting: '2026-11-13T18:00:00Z',
        previous: { startDate: '2026-11-09', endDate: '2026-11-15' },
        current: { startDate: '2026-11-16', endDate: '2026-11-21' },
        previewEnd: '2026-11-22', draftEnd: '2026-11-20',
        previousLabel: /Nov 9\D+15, 2026/, currentLabel: /Nov 16\D+21, 2026/,
        message: 'completed Monday–Sunday weeks and exclude the current week',
      },
      months: {
        beforeMidnight: [10, 30], afterMidnight: [11, 1],
        beforeMeeting: '2026-07-17T18:00:00Z', afterMeeting: '2026-10-20T18:00:00Z',
        previous: { startDate: '2026-05-01', endDate: '2026-07-31' },
        current: { startDate: '2026-08-01', endDate: '2026-10-30' },
        previewEnd: '2026-10-31', draftEnd: '2026-10-29',
        previousLabel: /May 1\D+Jul 31, 2026/, currentLabel: /Aug 1\D+Oct 30, 2026/,
        message: 'completed calendar months and exclude the current month',
      },
      launch: {
        beforeMidnight: [10, 24], afterMidnight: [10, 25],
        beforeMeeting: '2026-11-06T18:00:00Z',
        previous: { startDate: '2026-10-29', endDate: '2026-11-11' },
        current: { startDate: '2026-11-13', endDate: '2026-11-25' },
        previewEnd: '2026-11-26', draftEnd: '2026-11-24',
        previousLabel: /Oct 29\D+Nov 11, 2026/, currentLabel: /Nov 13\D+25, 2026/,
        message: '14 calendar days on each side and exclude ' + (named ? 'the milestone date' : 'launch day'),
      },
      'milestone-window': {
        beforeMidnight: [10, 24], afterMidnight: [10, 25],
        scheduledPreview: { earlierStart: '2026-06-14', laterEnd: '2026-07-21' },
        beforeMeeting: '2026-07-10T18:00:00Z', afterMeeting: '2026-07-20T18:00:00Z',
        previous: { startDate: '2026-06-15', endDate: '2026-07-14' },
        current: { startDate: '2026-07-16', endDate: '2026-07-22' },
        previewEnd: '2026-07-22', draftEnd: '2026-07-21',
        previousLabel: /Jun 15\D+Jul 14, 2026/, currentLabel: /Jul 16\D+22, 2026/,
        message: '30 days before and 7 days after. Both exclude the milestone date.',
      },
      'mixed-milestone-window': {
        beforeMidnight: [10, 24], afterMidnight: [10, 25],
        scheduledPreview: { earlierStart: '2026-06-30', laterEnd: '2026-08-14' },
        beforeMeeting: '2026-07-10T18:00:00Z', afterMeeting: '2026-08-10T18:00:00Z',
        previous: { startDate: '2026-07-01', endDate: '2026-07-14' },
        current: { startDate: '2026-07-16', endDate: '2026-08-15' },
        previewEnd: '2026-08-15', draftEnd: '2026-08-14',
        previousLabel: /Jul 1\D+14, 2026/, currentLabel: /Jul 16\D+Aug 15, 2026/,
        message: '2 weeks before and 1 calendar month after. Both exclude the milestone date.',
      },
      'implied-milestone-window': {
        beforeMidnight: [10, 24], afterMidnight: [10, 25],
        scheduledPreview: { earlierStart: '2026-07-07', laterEnd: '2026-08-14' },
        beforeMeeting: '2026-07-10T18:00:00Z', afterMeeting: '2026-08-10T18:00:00Z',
        previous: { startDate: '2026-07-08', endDate: '2026-07-14' },
        current: { startDate: '2026-07-16', endDate: '2026-08-15' },
        previewEnd: '2026-08-15', draftEnd: '2026-08-14',
        previousLabel: /Jul 8\D+14, 2026/, currentLabel: /Jul 16\D+Aug 15, 2026/,
        message: '1 week before and 1 calendar month after. Both exclude the milestone date.',
      },
      'ambiguous-milestone-window': {
        beforeMidnight: [10, 24], afterMidnight: [10, 25],
        clarifyCounts: { before: 3 },
        scheduledPreview: { earlierStart: '2026-06-23', laterEnd: '2026-08-14' },
        beforeMeeting: '2026-06-25T18:00:00Z', afterMeeting: '2026-08-10T18:00:00Z',
        previous: { startDate: '2026-06-24', endDate: '2026-07-14' },
        current: { startDate: '2026-07-16', endDate: '2026-08-15' },
        previewEnd: '2026-08-15', draftEnd: '2026-08-14',
        previousLabel: /Jun 24\D+Jul 14, 2026/, currentLabel: /Jul 16\D+Aug 15, 2026/,
        message: '3 weeks before and 1 calendar month after. Both exclude the milestone date.',
      },
      'two-ambiguous-milestone-windows': {
        beforeMidnight: [10, 24], afterMidnight: [10, 25],
        clarifyCounts: { before: 3, after: 5 },
        scheduledPreview: { earlierStart: '2026-06-23', laterEnd: '2026-07-19' },
        beforeMeeting: '2026-06-25T18:00:00Z', afterMeeting: '2026-07-17T18:00:00Z',
        previous: { startDate: '2026-06-24', endDate: '2026-07-14' },
        current: { startDate: '2026-07-16', endDate: '2026-07-20' },
        previewEnd: '2026-07-20', draftEnd: '2026-07-19',
        previousLabel: /Jun 24\D+Jul 14, 2026/, currentLabel: /Jul 16\D+20, 2026/,
        message: '3 weeks before and 5 days after. Both exclude the milestone date.',
      },
      'suggested-milestone-window': {
        beforeMidnight: [10, 24], afterMidnight: [10, 25],
        clarifyCounts: { after: 5 }, suggestedBefore: manual ? 3 : 2,
        scheduledPreview: { earlierStart: manual ? '2026-06-23' : '2026-06-30', laterEnd: '2026-07-19' },
        beforeMeeting: manual ? '2026-06-25T18:00:00Z' : '2026-07-06T18:00:00Z',
        afterMeeting: '2026-07-17T18:00:00Z',
        previous: { startDate: manual ? '2026-06-24' : '2026-07-01', endDate: '2026-07-14' },
        current: { startDate: '2026-07-16', endDate: '2026-07-20' },
        previewEnd: '2026-07-20', draftEnd: '2026-07-19',
        previousLabel: manual ? /Jun 24\D+Jul 14, 2026/ : /Jul 1\D+14, 2026/,
        currentLabel: /Jul 16\D+20, 2026/,
        message: (manual ? '3' : '2') + ' weeks before and 5 days after. Both exclude the milestone date.',
      },
      'approximate-milestone-window': {
        beforeMidnight: [10, 24], afterMidnight: [10, 25],
        suggestedBefore: manual ? 3 : 2, suggestedAfter: manual ? 2 : 1,
        scheduledPreview: { earlierStart: manual ? '2026-06-23' : '2026-06-30', laterEnd: manual ? '2026-09-14' : '2026-08-14' },
        beforeMeeting: manual ? '2026-06-25T18:00:00Z' : '2026-07-06T18:00:00Z',
        afterMeeting: '2026-08-10T18:00:00Z',
        previous: { startDate: manual ? '2026-06-24' : '2026-07-01', endDate: '2026-07-14' },
        current: { startDate: '2026-07-16', endDate: manual ? '2026-09-15' : '2026-08-15' },
        previewEnd: manual ? '2026-09-15' : '2026-08-15', draftEnd: manual ? '2026-09-14' : '2026-08-14',
        previousLabel: manual ? /Jun 24\D+Jul 14, 2026/ : /Jul 1\D+14, 2026/,
        currentLabel: manual ? /Jul 16\D+Sep 15, 2026/ : /Jul 16\D+Aug 15, 2026/,
        message: (manual ? '3 weeks before and 2 calendar months' : '2 weeks before and 1 calendar month') + ' after. Both exclude the milestone date.',
      },
    }[relative]
    const scheduledPreview = relativeCase?.scheduledPreview
    const eventComparison = relative === 'launch' || !!scheduledPreview
    const eventDate = scheduledPreview ? '2026-07-15' : '2026-11-12'
    const scheduledDate = scheduledPreview ? '2026-07-14' : '2026-11-11'
    const milestoneTitle = named ? 'Security Review' : 'Launch'
    const milestoneField = named ? 'Milestone and date' : 'Launch milestone and date'
    const eventFieldPrefix = named ? 'Milestone' : 'Launch'
    if (relativeCase) {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date(2026, ...relativeCase.beforeMidnight, 23, 59))
    }
    if (eventComparison) (named ? findMilestones : listLaunchMilestones).mockResolvedValue({ milestones: [
      { id: 'm-alpha', projectId: 'p-alpha', projectName: 'Alpha', title: milestoneTitle, dueDate: scheduledDate, completedAt: null },
      { id: 'm-beta', projectId: 'p-beta', projectName: 'Beta', title: milestoneTitle, dueDate: scheduledDate,
        completedAt: new Date(eventDate + 'T12:00:00').toISOString() },
    ] })
    const selectedMilestone = 'p-beta:m-beta:completed|' + eventDate
    const eventName = manual ? (named ? milestoneTitle : 'Website launch') : 'Beta · ' + milestoneTitle
    const beforeQuote = 'We agreed to launch on Monday.'
    const afterQuote = 'The launch is now scheduled for Friday.'
    const laterRevision = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'
    const sources = [
      { id: 'before-m1', title: 'Launch planning', date: relativeCase?.beforeMeeting ?? (comparing ? '2026-10-06T18:00:00Z' : '2026-11-06T18:00:00Z'),
        speaker: 'Ana', quote: beforeQuote, role: 'before', period: comparing ? 'previous' : undefined,
        atMs: 22_000, passage: { revision: REVISION, kind: 'segment', position: 2 } },
      { id: 'after-m2', title: 'Launch follow-up', date: relativeCase?.afterMeeting ?? '2026-11-20T18:00:00Z', speaker: 'Pat', quote: afterQuote,
        role: 'after', period: comparing ? 'current' : undefined,
        atMs: 22_000, passage: { revision: laterRevision, kind: 'segment', position: 2 } },
    ]
    api.get.mockImplementation(async (id) => {
      const source = sources.find((item) => item.id === id)
      return {
        ...MEETING, id, title: source.title,
        recording_job: { status: 'done', audioKept: true, durationMs: 60_000 },
        transcript_search_revision: source.passage.revision,
        transcript_segments: [
          { atMs: source.atMs, speaker: source.speaker, text: 'This is another line with the same timestamp.' },
          { atMs: source.atMs, speaker: source.speaker, text: source.quote },
          { atMs: source.atMs, speaker: source.speaker, text: 'The final line also shares that timestamp.' },
        ],
      }
    })
    const ranges = relativeCase ? {
      previous: relativeCase.previous, current: relativeCase.current,
    } : {
      previous: { startDate: '2026-10-04', endDate: '2026-10-07' },
      current: { startDate: '2026-11-18', endDate: '2026-11-25' },
    }
    const draftEnd = relativeCase?.draftEnd ?? '2026-11-26'
    const previewEnd = relativeCase?.previewEnd ?? (corrected ? '2026-11-26' : ranges.current.endDate)
    const recap = { ...(custom ? ranges.current : { startDate: '2026-11-01', endDate: '2026-11-27' }), timeZone: 'America/New_York',
      totalMeetings: 4, reviewedMeetings: 2, meetingsWithoutTranscripts: 1, unindexedMeetings: 1, unsampledMeetings: 0 }
    const previous = { ...recap, ...(custom ? ranges.previous : { startDate: '2026-10-01', endDate: '2026-10-31' }),
      totalMeetings: 5, reviewedMeetings: 3, unindexedMeetings: 0, unsampledMeetings: 1 }
    const answerScope = comparing ? { comparison: { previous, current: recap } } : { recap }
    const answer = 'Launch moved from Monday to Friday.'
    const reply = { answer, ...answerScope, claims: [{ topic: 'Launch', text: answer, citations: sources }] }
    const request = eventComparison ? search.ask : search.askStream
    if (eventComparison) search.ask.mockResolvedValue(reply)
    else search.askStream.mockImplementation(async (_data, callbacks) => callbacks.onComplete(reply))
    render(
      <MemoryRouter initialEntries={[{ pathname: '/search', search: custom ? '?mode=ask' : `?q=${encodeURIComponent(question)}&ask=1`, key: crypto.randomUUID() }]}>
        <NavTrailRecorder />
        <BrowserBack />
        <Routes>
          <Route path="/search" element={<Search />} />
          <Route path="/meetings/:id" element={<MeetingDetail />} />
        </Routes>
      </MemoryRouter>,
    )

    const rangeInput = (period, field) => within(screen.getByRole('group', { name: period })).getByLabelText(field)
    const clarificationAnswers = Object.entries(relativeCase?.clarifyCounts ?? {})
    const suggestedBefore = relativeCase?.suggestedBefore
    const suggestedAfter = relativeCase?.suggestedAfter
    const suggestedCountInput = (side = 'before') => screen.getByRole('spinbutton', {
      name: (side === 'before' ? 'Weeks before' : 'Months after') + ' Security Review',
    })
    const countInput = (side) => screen.getByRole('spinbutton', {
      name: 'How many ' + (side === 'before' ? 'weeks before' : 'days after') + ' Security Review should I include?',
    })
    if (typed) {
      const questionField = screen.getByRole('textbox', { name: 'Question about your meetings' })
      fireEvent.change(questionField, { target: { value: question } })
      fireEvent.click(screen.getByRole('button', { name: 'Ask Entomate' }))
      const confirmation = screen.getByRole('form', { name: 'Confirm date ranges' })
      await waitFor(() => expect(within(confirmation).getByRole('heading')).toHaveFocus())
      if (eventComparison) {
        expect(within(confirmation).getByRole('button', { name: 'Compare periods' })).toBeDisabled()
        expect(screen.queryByRole('group', { name: 'Earlier period' })).not.toBeInTheDocument()
        expect(await screen.findByRole('option', { name: `Alpha · ${milestoneTitle} · Scheduled date · ${scheduledDate}` })).toBeVisible()
        expect(screen.getByRole('option', { name: `Beta · ${milestoneTitle} · Scheduled date · ${scheduledDate}` })).toBeVisible()
        expect(screen.getByRole('option', { name: `Beta · ${milestoneTitle} · Marked complete · ${eventDate}` })).toBeVisible()
        expect(search.askStream).not.toHaveBeenCalled()
        expect(search.ask).not.toHaveBeenCalled()
        if (named) expect(findMilestones).toHaveBeenCalledWith('playback-org', milestoneTitle, expect.any(AbortSignal))
        else expect(listLaunchMilestones).toHaveBeenCalledWith('playback-org', expect.any(AbortSignal))
        if (manual) {
          fireEvent.change(screen.getByLabelText(eventFieldPrefix + ' source'), { target: { value: 'manual' } })
          const nameInput = screen.getByLabelText(eventFieldPrefix + ' name (optional)')
          if (named) expect(nameInput).toHaveValue(milestoneTitle)
          else fireEvent.change(nameInput, { target: { value: eventName } })
        }
        const dateField = screen.getByLabelText(manual ? eventFieldPrefix + ' date' : milestoneField)
        if (scheduledPreview) {
          fireEvent.change(dateField, { target: { value: manual ? scheduledDate : 'p-beta:m-beta:scheduled|' + scheduledDate } })
          const clarifications = manual ? [...clarificationAnswers].reverse() : clarificationAnswers
          const suggestedCount = Number(!!suggestedBefore) + Number(!!suggestedAfter)
          expect(within(confirmation).queryAllByRole('spinbutton')).toHaveLength(clarifications.length + suggestedCount)
          if (suggestedBefore) expect(suggestedCountInput()).toHaveValue(2)
          if (suggestedAfter) expect(suggestedCountInput('after')).toHaveValue(1)
          if (suggestedCount) expect(confirmation).toHaveTextContent('You can edit the suggested counts.')
          for (const [side, count] of clarifications) {
            const input = countInput(side)
            expect(input).toHaveValue(null)
            expect(screen.queryByRole('group', { name: 'Earlier period' })).not.toBeInTheDocument()
            expect(screen.queryByRole('group', { name: 'Later period' })).not.toBeInTheDocument()
            const confirm = within(confirmation).getByRole('button', { name: 'Compare periods' })
            expect(confirm).toBeDisabled()
            for (const value of ['0', '2.5']) {
              fireEvent.change(input, { target: { value } })
              expect(confirm).toBeDisabled()
            }
            fireEvent.change(input, { target: { value: String(count) } })
          }
          if (suggestedBefore && manual) {
            expect(rangeInput('Earlier period', 'Start date')).toHaveValue('2026-06-30')
            fireEvent.change(suggestedCountInput(), { target: { value: '' } })
            expect(suggestedCountInput()).toHaveValue(null)
            expect(within(confirmation).getByRole('button', { name: 'Compare periods' })).toBeDisabled()
            expect(screen.queryByRole('group', { name: 'Earlier period' })).not.toBeInTheDocument()
            fireEvent.change(suggestedCountInput(), { target: { value: String(suggestedBefore) } })
            if (suggestedAfter) {
              expect(rangeInput('Later period', 'End date')).toHaveValue('2026-08-14')
              fireEvent.change(suggestedCountInput('after'), { target: { value: String(suggestedAfter) } })
            }
          }
          expect(rangeInput('Earlier period', 'Start date')).toHaveValue(scheduledPreview.earlierStart)
          expect(rangeInput('Later period', 'End date')).toHaveValue(scheduledPreview.laterEnd)
        }
        fireEvent.change(dateField, { target: { value: manual ? eventDate : selectedMilestone } })
      }
      expect(confirmation).toHaveTextContent(Intl.DateTimeFormat().resolvedOptions().timeZone)
      expect(rangeInput('Earlier period', 'Start date')).toHaveValue(ranges.previous.startDate)
      expect(rangeInput('Earlier period', 'End date')).toHaveValue(ranges.previous.endDate)
      expect(rangeInput('Later period', 'Start date')).toHaveValue(ranges.current.startDate)
      expect(rangeInput('Later period', 'End date')).toHaveValue(previewEnd)
      expect(search.askStream).not.toHaveBeenCalled()
      if (relativeCase) {
        expect(confirmation).toHaveTextContent(relativeCase.message)
        vi.setSystemTime(new Date(2026, ...relativeCase.afterMidnight, 0, 1))
        fireEvent.change(questionField, { target: { value: 'Unsubmitted question across midnight' } })
        expect(rangeInput('Earlier period', 'Start date')).toHaveValue(ranges.previous.startDate)
        expect(rangeInput('Later period', 'Start date')).toHaveValue(ranges.current.startDate)
        expect(rangeInput('Later period', 'End date')).toHaveValue(previewEnd)
      }
      if (corrected || relativeCase) fireEvent.change(rangeInput('Later period', 'End date'), { target: { value: ranges.current.endDate } })
      if (scheduledPreview) {
        fireEvent.change(rangeInput('Earlier period', 'End date'), { target: { value: eventDate } })
        expect(within(confirmation).getByRole('button', { name: 'Compare periods' })).toBeDisabled()
        expect(confirmation).toHaveTextContent('Keep the earlier period before the milestone date')
        fireEvent.change(rangeInput('Earlier period', 'End date'), { target: { value: ranges.previous.endDate } })
      }
      expect(search.askStream).not.toHaveBeenCalled()
      expect(search.ask).not.toHaveBeenCalled()
      fireEvent.click(within(confirmation).getByRole('button', { name: 'Compare periods' }))
    } else if (custom) {
      fireEvent.click(screen.getByRole('button', { name: 'Compare date ranges' }))
      const submit = screen.getByRole('button', { name: 'Compare periods' })
      expect(submit).toBeDisabled()
      fireEvent.change(rangeInput('Earlier period', 'Start date'), { target: { value: ranges.previous.startDate } })
      fireEvent.change(rangeInput('Earlier period', 'End date'), { target: { value: ranges.current.startDate } })
      fireEvent.change(rangeInput('Later period', 'Start date'), { target: { value: ranges.current.startDate } })
      fireEvent.change(rangeInput('Later period', 'End date'), { target: { value: ranges.current.endDate } })
      expect(submit).toBeDisabled()
      expect(screen.getByText(/The earlier period must end before the later period starts/)).toBeVisible()
      expect(search.askStream).not.toHaveBeenCalled()
      fireEvent.change(rangeInput('Earlier period', 'End date'), { target: { value: ranges.previous.endDate } })
      fireEvent.click(submit)
    }
    const coverage = await screen.findByRole('region', { name: coverageName })
    const current = comparing ? within(coverage).getByRole('region', { name: custom ? 'Later period' : 'This month to date' }) : coverage
    expect(current).toHaveTextContent(relativeCase?.currentLabel ?? (custom ? /Nov 18\D+25, 2026/ : /Nov 1\D+27, 2026/))
    expect(coverage).toHaveTextContent('America/New_York')
    expect(current).toHaveTextContent('2 of 4 meetings reviewed · 1 without transcripts · 1 awaiting indexing')
    if (eventComparison) {
      expect(coverage).toHaveTextContent(eventName + ' · ' + eventDate + (manual ? '' : ' · Marked complete'))
      if (scheduledPreview) expect(current).not.toHaveTextContent('This period is incomplete')
      else expect(current).toHaveTextContent('This period is incomplete')
    }
    if (comparing) {
      const lastMonth = within(coverage).getByRole('region', { name: custom ? 'Earlier period' : 'Last month' })
      expect(lastMonth).toHaveTextContent(relativeCase?.previousLabel ?? (custom ? /Oct 4\D+7, 2026/ : /Oct 1\D+31, 2026/))
      expect(lastMonth).toHaveTextContent('3 of 5 meetings reviewed · 1 without transcripts · 1 beyond the review limit')
    }
    expect(screen.getByRole('heading', { name: 'Launch', exact: true })).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: 'Question about your meetings' }), { target: { value: 'Unsubmitted draft' } })
    if (custom) fireEvent.change(rangeInput('Later period', 'End date'), { target: { value: draftEnd } })

    for (const [index, source] of sources.entries()) {
      const linkName = new RegExp(`^${source.role} · ${source.title}`, 'i')
      const link = screen.getByRole('link', { name: linkName })
      expect(link).toHaveAttribute('href', `/meetings/${source.id}?tab=transcript&t=22000&rev=${source.passage.revision}&line=2`)
      fireEvent.click(link)
      const transcript = await screen.findByRole('list', { name: 'Transcript' })
      const line = within(transcript).getByText(source.quote, { exact: false }).closest('li')
      await waitFor(() => expect(line).toHaveFocus())
      expect(line).toHaveAttribute('aria-current', 'true')
      expect(api.get).toHaveBeenCalledWith(source.id, { _noCache: true })
      if (index === 0) fireEvent.click(screen.getByRole('link', { name: 'Back to Search' }))
      else fireEvent.click(screen.getByRole('button', { name: 'Browser back' }))
      await waitFor(() => expect(screen.getByRole('link', { name: linkName })).toHaveFocus())
      expect(screen.getByText(answer)).toBeInTheDocument()
      expect(screen.getByRole('region', { name: coverageName }).textContent).toBe(coverage.textContent)
      expect(screen.getByRole('textbox', { name: 'Question about your meetings' })).toHaveValue('Unsubmitted draft')
      if (custom) {
        expect(rangeInput('Earlier period', 'Start date')).toHaveValue(ranges.previous.startDate)
        expect(rangeInput('Earlier period', 'End date')).toHaveValue(ranges.previous.endDate)
        expect(rangeInput('Later period', 'Start date')).toHaveValue(ranges.current.startDate)
        expect(rangeInput('Later period', 'End date')).toHaveValue(draftEnd)
      }
      if (typed) expect(screen.getByRole('form', { name: 'Confirm date ranges' })).toHaveTextContent(question)
      if (scheduledPreview) expect(screen.getByRole('form', { name: 'Confirm date ranges' })).toHaveTextContent(relativeCase.message)
      for (const [side, count] of clarificationAnswers) expect(countInput(side)).toHaveValue(count)
      if (suggestedBefore) expect(suggestedCountInput()).toHaveValue(suggestedBefore)
      if (suggestedAfter) expect(suggestedCountInput('after')).toHaveValue(suggestedAfter)
      if (manual) {
        expect(screen.getByLabelText(eventFieldPrefix + ' name (optional)')).toHaveValue(eventName)
        expect(screen.getByLabelText(eventFieldPrefix + ' date')).toHaveValue(eventDate)
      } else if (eventComparison) expect(screen.getByLabelText(milestoneField)).toHaveValue(selectedMilestone)
    }
    expect(player.cueAt).toHaveBeenCalledWith(22_000)
    expect(player.playFrom).not.toHaveBeenCalled()
    expect(request).toHaveBeenCalledTimes(1)
    if (eventComparison) expect(search.askStream).not.toHaveBeenCalled()
    expect(request).toHaveBeenCalledWith({
      question, workspaceId: 'playback-org', timeZone: expect.any(String),
      ...(custom ? { comparisonRanges: ranges } : {}),
      ...(eventComparison ? { comparisonEvent: { name: eventName, date: eventDate } } : {}),
    }, eventComparison ? { signal: expect.any(AbortSignal), skipRetry: true } : expect.any(Object))
    if (custom) {
      fireEvent.click(screen.getByRole('button', { name: 'Compare periods' }))
      await waitFor(() => expect(request).toHaveBeenCalledTimes(2))
      expect(request).toHaveBeenLastCalledWith(expect.objectContaining({
        question,
        comparisonRanges: { ...ranges, current: { ...ranges.current, endDate: draftEnd } },
      }), expect.any(Object))
    }
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
