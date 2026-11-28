import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import NavTrailRecorder from '../components/NavTrailRecorder'
import { MeetingNavigation } from '../components/meetings/MeetingNavigation'
import Search from '../pages/Search'
import { subscribeTrail, trailFor, trailVersion } from '../services/navTrail'

const api = vi.hoisted(() => ({
  post: vi.fn(), get: vi.fn(), ask: vi.fn(), askStream: vi.fn(), listLaunchMilestones: vi.fn(), findMilestones: vi.fn(),
}))
vi.mock('../services/api', () => ({
  default: api,
  searchApi: { ask: api.ask, askStream: api.askStream, getHistory: async () => ({ history: [] }) },
  projectsApi: { listLaunchMilestones: api.listLaunchMilestones, findMilestones: api.findMilestones },
}))
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'search-user' } }) }))
vi.mock('../contexts/OrgContext', () => ({ useOrgSafe: () => ({ org: { id: 'search-workspace' } }) }))
vi.mock('../components/vc/ToastProvider', () => ({ useToast: () => ({ error: vi.fn() }) }))

function Where() {
  const { pathname, search } = useLocation()
  return <output aria-label="Current route">{pathname + search}</output>
}

function Meeting() {
  const { pathname } = useLocation()
  React.useSyncExternalStore(subscribeTrail, trailVersion, trailVersion)
  return <MeetingNavigation back={trailFor(pathname).at(-1)} />
}

function Task() {
  const navigate = useNavigate()
  return <button onClick={() => navigate(-1)}>Browser back</button>
}

function setup(path = '/search') {
  render(
    <MemoryRouter initialEntries={[{ pathname: '/search', search: path.slice('/search'.length), key: crypto.randomUUID() }]}>
      <NavTrailRecorder />
      <Where />
      <Routes>
        <Route path="/search" element={<Search />} />
        <Route path="/meetings/:id" element={<Meeting />} />
        <Route path="/tasks" element={<Task />} />
      </Routes>
    </MemoryRouter>,
  )
}

const revision = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'
const meeting = { type: 'meeting', id: 'm1', title: 'Launch review', titleHits: [], snippet: 'Late launch decision', snippetHits: [],
  meta: { atMs: 25_345, passage: { revision, kind: 'segment', position: 73 } } }
const action = { type: 'action_item', id: 'a1', title: 'Send launch update', titleHits: [], snippet: '', snippetHits: [], meta: { meetingId: 'm1', atMs: 42_125 } }

describe('Search and Ask navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    api.get.mockResolvedValue({ notes: [] })
    api.listLaunchMilestones.mockResolvedValue({ milestones: [] })
    api.findMilestones.mockResolvedValue({ milestones: [] })
    api.post.mockImplementation(async (_path, body) => ({
      query: body.query, total: 2,
      engine: body.meaning ? 'words+meaning' : 'words',
      groups: { meetings: [meeting], action_items: [action] },
    }))
    api.askStream.mockImplementation(async (_body, callbacks) => {
      callbacks.onChunk('The vendor ')
      callbacks.onComplete({ answer: 'The vendor needed more time.', citations: [{ type: 'meeting', id: 'm1', title: 'Launch review' }] })
    })
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  test('an explicit question mark in Search stays a search and Ask requires submission', async () => {
    setup()
    const modes = screen.getByRole('group', { name: 'Discovery mode' })
    const query = screen.getByRole('textbox', { name: 'Search meetings, decisions, tasks, and notes' })
    fireEvent.change(query, { target: { value: 'Why did launch move?' } })
    fireEvent.submit(screen.getByRole('search'))
    expect(await screen.findByRole('link', { name: 'Launch review' })).toBeInTheDocument()
    expect(api.askStream).not.toHaveBeenCalled()
    fireEvent.click(within(modes).getByRole('button', { name: 'Ask' }))
    const question = screen.getByRole('textbox', { name: 'Question about your meetings' })
    expect(question).toHaveValue('Why did launch move?')
    expect(api.askStream).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Ask Entomate' }))
    expect(await screen.findByText('The vendor needed more time.')).toBeInTheDocument()
    expect(api.askStream).toHaveBeenCalledOnce()
    expect(api.askStream).toHaveBeenCalledWith({
      question: 'Why did launch move?', workspaceId: 'search-workspace', timeZone: expect.any(String),
    }, expect.any(Object))
  })

  test('a timed result opens the source and Back to Search restores its filtered results and focus', async () => {
    setup('/search?q=launch&f=meetings&meaning=1')
    const sourceName = 'View source at 00:25 for Launch review'
    const link = await screen.findByRole('link', { name: sourceName })
    const source = `/meetings/m1?tab=transcript&t=25345&rev=${revision}&line=73`
    expect(link).toHaveAttribute('href', source)
    expect(screen.queryByRole('link', { name: 'Send launch update' })).not.toBeInTheDocument()
    vi.stubGlobal('scrollY', 480)
    fireEvent.click(link)
    expect(screen.getByLabelText('Current route')).toHaveTextContent(source)
    const searches = api.post.mock.calls.length
    fireEvent.click(screen.getByRole('link', { name: 'Back to Search' }))
    const restored = await screen.findByRole('link', { name: sourceName })
    await waitFor(() => expect(restored).toHaveFocus())
    expect(screen.getByRole('combobox', { name: 'Filter by result type' })).toHaveValue('meetings')
    expect(screen.getByRole('button', { name: 'Include related meetings' })).toHaveAttribute('aria-pressed', 'true')
    expect(window.scrollTo).toHaveBeenCalledWith(0, 480)
    expect(api.post).toHaveBeenCalledTimes(searches)
  })

  test('a palette Ask with a missing year waits for the dates to be corrected and confirmed', async () => {
    const question = 'Compare Oct 4–7 and Nov 18–25, 2026.'
    setup('/search?q=' + encodeURIComponent(question) + '&ask=1')
    const form = await screen.findByRole('form', { name: 'Confirm date ranges' })
    const earlier = within(form).getByRole('group', { name: 'Earlier period' })
    const later = within(form).getByRole('group', { name: 'Later period' })
    const confirm = within(form).getByRole('button', { name: 'Compare periods' })
    expect(within(earlier).getByLabelText('Start date')).toHaveValue('')
    expect(within(later).getByLabelText('End date')).toHaveValue('2026-11-25')
    expect(confirm).toBeDisabled()
    expect(api.askStream).not.toHaveBeenCalled()
    fireEvent.change(within(earlier).getByLabelText('Start date'), { target: { value: '2026-10-04' } })
    fireEvent.change(within(earlier).getByLabelText('End date'), { target: { value: '2026-10-07' } })
    expect(confirm).toBeEnabled()
    expect(api.askStream).not.toHaveBeenCalled()
    fireEvent.click(confirm)
    await waitFor(() => expect(api.askStream).toHaveBeenCalledOnce())
    expect(api.askStream).toHaveBeenCalledWith({
      question, workspaceId: 'search-workspace', timeZone: expect.any(String),
      comparisonRanges: {
        previous: { startDate: '2026-10-04', endDate: '2026-10-07' },
        current: { startDate: '2026-11-18', endDate: '2026-11-25' },
      },
    }, expect.any(Object))
  })

  test.each(['days', 'weeks', 'months'])('a palette Ask with unequal counts of %s prompts for correction before running', async (unit) => {
    setup('/search?q=' + encodeURIComponent('Compare the last 4 ' + unit + ' vs. the previous 2') + '&ask=1')
    const form = await screen.findByRole('form', { name: 'Confirm date ranges' })
    expect(form).toHaveTextContent('Use the same positive whole number of ' + unit + ' for both periods')
    expect(within(form).getByRole('button', { name: 'Compare periods' })).toBeDisabled()
    expect(api.askStream).not.toHaveBeenCalled()
  })

  test.each([
    ['Launch', 'The two weeks before launch vs. the two weeks after', 'Website launch'],
    ['Milestone', 'Compare the two weeks before and after Unlisted Review', 'Unlisted Review'],
  ])('a manual %s date delivers the complete comparison in one request after confirmation', async (label, question, name) => {
    const ranges = {
      previous: { startDate: '2026-10-29', endDate: '2026-11-11' },
      current: { startDate: '2026-11-13', endDate: '2026-11-26' },
    }
    const counts = { totalMeetings: 1, reviewedMeetings: 1, meetingsWithoutTranscripts: 0, unindexedMeetings: 0, unsampledMeetings: 0 }
    api.ask.mockResolvedValueOnce({
      answer: 'The launch date is grounded in these two meetings.',
      comparison: {
        previous: { ...ranges.previous, ...counts, timeZone: 'America/New_York' },
        current: { ...ranges.current, ...counts, timeZone: 'America/New_York' },
      },
    })
    api.askStream.mockImplementation(async (_body, callbacks) => {
      callbacks.onChunk('The launch date is grounded in these two meetings.')
      // The connection closes after generation, before the final comparison event.
    })
    setup('/search?q=' + encodeURIComponent(question) + '&ask=1&compare=2026-10-29,2026-11-11,2026-11-13,2026-11-26')
    const form = await screen.findByRole('form', { name: 'Confirm date ranges' })
    const confirm = within(form).getByRole('button', { name: 'Compare periods' })
    expect(confirm).toBeDisabled()
    expect(api.ask).not.toHaveBeenCalled()
    if (label === 'Milestone') expect(await within(form).findByText(/No dated milestones match/)).toHaveTextContent(name)
    fireEvent.change(within(form).getByLabelText(label + ' source'), { target: { value: 'manual' } })
    const nameInput = within(form).getByLabelText(label + ' name (optional)')
    if (label === 'Milestone') expect(nameInput).toHaveValue(name)
    else fireEvent.change(nameInput, { target: { value: name } })
    fireEvent.change(within(form).getByLabelText(label + ' date'), { target: { value: '2026-11-12' } })
    expect(within(within(form).getByRole('group', { name: 'Earlier period' })).getByLabelText('Start date')).toHaveValue('2026-10-29')
    expect(within(within(form).getByRole('group', { name: 'Earlier period' })).getByLabelText('End date')).toHaveValue('2026-11-11')
    expect(within(within(form).getByRole('group', { name: 'Later period' })).getByLabelText('Start date')).toHaveValue('2026-11-13')
    expect(within(within(form).getByRole('group', { name: 'Later period' })).getByLabelText('End date')).toHaveValue('2026-11-26')
    expect(api.askStream).not.toHaveBeenCalled()
    expect(api.ask).not.toHaveBeenCalled()
    fireEvent.click(confirm)
    expect(await screen.findByRole('region', { name: 'Date range coverage' })).toHaveTextContent(name)
    expect(screen.getByText('The launch date is grounded in these two meetings.')).toBeInTheDocument()
    expect(api.askStream).not.toHaveBeenCalled()
    expect(api.ask).toHaveBeenCalledOnce()
    expect(api.ask).toHaveBeenCalledWith(expect.objectContaining({
      question, comparisonEvent: { name, date: '2026-11-12' },
      comparisonRanges: ranges,
    }), { signal: expect.any(AbortSignal), skipRetry: true })
  })

  test('a palette link with an invalid milestone window cannot run Ask with unconfirmed dates', async () => {
    const question = '2 weeks before Security Review vs. 0 months after'
    setup('/search?q=' + encodeURIComponent(question) + '&ask=1&compare=2026-06-15,2026-07-14,2026-07-16,2026-07-22')
    const form = await screen.findByRole('form', { name: 'Confirm date ranges' })
    expect(form).toHaveTextContent('Use a positive whole number of days, weeks, or months for each period')
    expect(within(form).getByRole('button', { name: 'Compare periods' })).toBeDisabled()
    expect(api.findMilestones).not.toHaveBeenCalled()
    expect(api.askStream).not.toHaveBeenCalled()
    expect(api.ask).not.toHaveBeenCalled()
  })

  test('a task title and its evidence are separate and browser Back restores the original view', async () => {
    setup('/search?q=launch&f=action_items')
    const title = await screen.findByRole('link', { name: 'Send launch update' })
    expect(screen.getByRole('link', { name: 'View source at 00:42 for Send launch update' }))
      .toHaveAttribute('href', '/meetings/m1?tab=transcript&t=42125')
    fireEvent.click(title)
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/tasks?item=action:a1')
    fireEvent.click(screen.getByRole('button', { name: 'Browser back' }))
    await waitFor(() => expect(screen.getByRole('link', { name: 'Send launch update' })).toHaveFocus())
  })

  test('Back from a related meeting restores a completed Ask answer and an unsubmitted draft', async () => {
    setup('/search?q=Why+did+launch+move%3F&ask=1')
    const related = await screen.findByRole('region', { name: 'Related meetings' })
    const link = within(related).getByRole('link', { name: 'Launch review' })
    expect(link).toHaveAttribute('href', '/meetings/m1')
    fireEvent.change(screen.getByRole('textbox', { name: 'Question about your meetings' }), { target: { value: 'Who owns the update?' } })
    fireEvent.click(link)
    fireEvent.click(screen.getByRole('link', { name: 'Back to Search' }))
    expect(screen.getByText('The vendor needed more time.')).toBeInTheDocument()
    expect(screen.getByText('Why did launch move?')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Question about your meetings' })).toHaveValue('Who owns the update?')
    await waitFor(() => expect(screen.getByRole('link', { name: 'Launch review' })).toHaveFocus())
    expect(api.askStream).toHaveBeenCalledOnce()
  })
})
