import React from 'react'
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

// EAI-02c slice 4: the "View all" history page, and the bridge that opens its rows in the panel.
vi.mock('../components/ui/thinking-orbs', async (orig) => ({ ...(await orig<object>()), Orb: () => null }))
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-a', email: 'a@example.com' } }) }))
vi.mock('../components/EntoAssistant/useAssistantContext', () => ({
  default: () => ({ context: { data: {} }, section: 'tasks', sectionSummary: '', sectionLabel: 'Tasks', isLoading: false, isReady: true }),
}))
vi.mock('../services/entoAssistantService', () => ({
  getStarter: () => ({ title: 'Ask about your tasks', prompts: [] }),
  streamQuery: vi.fn(),
}))
vi.mock('../components/bench/useMediaQuery', () => ({ useMediaQuery: () => false, PHONE_QUERY: '' }))

const api = vi.hoisted(() => ({
  latestThread: vi.fn(),
  threads: { list: vi.fn(), get: vi.fn(), remove: vi.fn(), search: vi.fn() },
  actions: { list: vi.fn(), confirm: vi.fn(), reject: vi.fn(), undo: vi.fn(), edit: vi.fn() },
  plans: { confirm: vi.fn(), reject: vi.fn(), undo: vi.fn() },
  signals: vi.fn(),
}))
vi.mock('../services/api', () => ({ entoAiApi: api }))

import EntoAiHistoryPage from '../components/EntoAssistant/history/EntoAiHistoryPage'
import EntoAssistant from '../components/EntoAssistant/EntoAssistant'
import { groupThreads } from '../components/EntoAssistant/history/groupThreads'
import { onThreadRequest, onThreadsDeleted, requestThread, announceThreadsDeleted } from '../components/EntoAssistant/threadSignal'

const id = (n: number) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`
const row = (n: number, title: string | null, updated_at: string, extra: object = {}) =>
  ({ id: id(n), title, created_at: updated_at, updated_at, message_count: 2, snippet: null, ...extra })
const NOW = new Date().toISOString()
const OLD = '2025-03-04T10:00:00Z'
const A = row(1, 'Venue shortlist', NOW)
const B = row(2, 'Q1 launch', OLD, { message_count: 1 })

const openAssistant = vi.fn()
function Where() { const l = useLocation(); return <output data-testid="where">{l.pathname + l.search}</output> }
function renderPage(url = '/assistant/history') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route element={<Outlet context={{ openAssistant }} />}>
          <Route path="/assistant/history" element={<><EntoAiHistoryPage /><Where /></>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

let requests: Array<string | null>
let deletions: string[][]
let off: Array<() => void>
beforeEach(() => {
  vi.clearAllMocks()
  window.matchMedia = window.matchMedia || ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }) as unknown as MediaQueryList)
  Element.prototype.scrollIntoView = vi.fn()
  api.latestThread.mockResolvedValue(null)
  api.threads.list.mockResolvedValue({ threads: [A, B] })
  api.threads.search.mockResolvedValue({ threads: [A, B], total: 2 })
  api.threads.remove.mockResolvedValue({ ok: true })
  requests = []
  deletions = []
  off = []
})
afterEach(() => { cleanup(); off.forEach((f) => f()) })
// The page's side of the bridge, as the panel would see it.
const listen = () => {
  off.push(onThreadRequest(({ id: tid }) => { requests.push(tid) }), onThreadsDeleted((ids) => { deletions.push(ids) }))
}

describe('history page', () => {
  test('lists every conversation by date with its message count, through the search route', async () => {
    renderPage()
    expect(await screen.findByText('Venue shortlist')).toBeTruthy()
    expect(api.threads.search).toHaveBeenCalledWith('', 0)
    expect(screen.getByText('Today')).toBeTruthy()
    expect(screen.getByText('March 2025')).toBeTruthy()
    expect(screen.getByText('2 messages')).toBeTruthy()
    expect(screen.getByText('1 message')).toBeTruthy()
    expect(screen.getByText('2 conversations')).toBeTruthy()
    expect(screen.getByText('2 of 2 shown')).toBeTruthy()
  })

  test('search: debounced, in the URL, one Matches group with the snippet', async () => {
    renderPage()
    await screen.findByText('Venue shortlist')
    api.threads.search.mockResolvedValue({ threads: [{ ...B, snippet: '…the launch moved to March 3…' }], total: 1 })
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search conversations' }), { target: { value: ' launch ' } })
    expect(await screen.findByText('…the launch moved to March 3…')).toBeTruthy()
    expect(api.threads.search).toHaveBeenLastCalledWith(' launch ', 0)
    expect(screen.getByText('Matches')).toBeTruthy()
    expect(screen.queryByText('Venue shortlist')).toBeNull()
    expect(screen.getByTestId('where').textContent).toBe('/assistant/history?q=launch')
  })

  test('?q= in the URL is the first search', async () => {
    renderPage('/assistant/history?q=venue')
    await screen.findByText('Venue shortlist')
    expect(api.threads.search).toHaveBeenCalledWith('venue', 0)
    expect((screen.getByRole('searchbox', { name: 'Search conversations' }) as HTMLInputElement).value).toBe('venue')
  })

  test('a row opens that conversation in the panel; New conversation asks for a fresh one', async () => {
    listen()
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Q1 launch' }))
    expect(requests).toEqual([B.id])
    expect(openAssistant).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'New conversation' }))
    expect(requests).toEqual([B.id, null])
    expect(openAssistant).toHaveBeenCalledTimes(2)
  })

  test('delete asks once more, re-reads the list and tells the panel', async () => {
    listen()
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Venue shortlist' }))
    expect(api.threads.remove).not.toHaveBeenCalled()
    api.threads.search.mockResolvedValue({ threads: [B], total: 1 })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete Venue shortlist' }))
    await waitFor(() => expect(screen.queryByText('Venue shortlist')).toBeNull())
    expect(api.threads.remove).toHaveBeenCalledWith(A.id)
    expect(deletions).toEqual([[A.id]])
    expect(screen.getByText('1 conversation')).toBeTruthy()
  })

  test('bulk delete: select, confirm, every id removed and announced', async () => {
    listen()
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Select' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Venue shortlist' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Q1 launch' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete 2' }))
    expect(screen.getByText('Delete 2 for good?')).toBeTruthy()
    expect(api.threads.remove).not.toHaveBeenCalled()
    api.threads.search.mockResolvedValue({ threads: [], total: 0 })
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('No conversations yet')).toBeTruthy()
    expect(api.threads.remove.mock.calls.map((c) => c[0])).toEqual([A.id, B.id])
    expect(deletions).toEqual([[A.id, B.id]])
  })

  test('a failure part-way stops, says how many went, and announces only those', async () => {
    listen()
    api.threads.remove.mockResolvedValueOnce({ ok: true }).mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 502 }))
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Select' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select all' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete 2' }))
    api.threads.search.mockResolvedValue({ threads: [B], total: 1 })
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/1 of 2 conversations were deleted/)
    expect(deletions).toEqual([[A.id]])
  })

  test('a 404 on delete counts as gone (another device got there first)', async () => {
    listen()
    api.threads.remove.mockRejectedValue(Object.assign(new Error('gone'), { status: 404 }))
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Q1 launch' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete Q1 launch' }))
    await waitFor(() => expect(deletions).toEqual([[B.id]]))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  test('a failed read is an alert with Try again, never "No conversations yet"', async () => {
    api.threads.search.mockRejectedValue(new Error('502'))
    renderPage()
    expect((await screen.findByRole('alert')).textContent).toMatch(/could not be loaded/)
    expect(screen.queryByText('No conversations yet')).toBeNull()
    api.threads.search.mockResolvedValue({ threads: [A], total: 1 })
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Venue shortlist')).toBeTruthy()
  })

  test('load more asks from the end of the list and appends', async () => {
    api.threads.search.mockResolvedValue({ threads: [A], total: 2 })
    renderPage()
    await screen.findByText('Venue shortlist')
    api.threads.search.mockResolvedValue({ threads: [B], total: 2 })
    fireEvent.click(screen.getByRole('button', { name: 'Show 1 more' }))
    expect(await screen.findByText('Q1 launch')).toBeTruthy()
    expect(api.threads.search).toHaveBeenLastCalledWith('', 1)
    expect(screen.getByText('Venue shortlist')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /more/ })).toBeNull()
  })
})

describe('panel side of the bridge', () => {
  const msgs = (q: string, a: string) => [
    { role: 'user', content: q, section: 'tasks', ts: Date.now() },
    { role: 'assistant', content: a, section: 'tasks', ts: Date.now() },
  ]
  function Panel() {
    const onClose = vi.fn()
    const utils = render(
      <MemoryRouter initialEntries={['/tasks']}>
        <EntoAssistant isOpen onClose={onClose} />
        <Where />
      </MemoryRouter>,
    )
    return { onClose, ...utils }
  }

  test('the rail links to the page and closes the panel', async () => {
    const { onClose } = Panel()
    fireEvent.click(screen.getByRole('button', { name: 'Conversation history' }))
    const rail = await screen.findByRole('dialog', { name: 'Conversation history' })
    fireEvent.click(await within(rail).findByRole('button', { name: 'View all conversations' }))
    expect(screen.getByTestId('where').textContent).toBe('/assistant/history')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('a request parked before the panel mounts opens that thread, and the newest thread does not replace it', async () => {
    let releaseLatest: (v: unknown) => void = () => {}
    api.latestThread.mockReturnValue(new Promise((r) => { releaseLatest = r }))
    api.threads.get.mockResolvedValue({ thread: { ...B, messages: msgs('When is the launch?', 'On March 3.') } })
    requestThread(B.id)
    Panel()
    expect(await screen.findByText('When is the launch?')).toBeTruthy()
    expect(api.threads.get).toHaveBeenCalledWith(B.id)
    releaseLatest({ id: A.id, messages: msgs('Which venues?', 'Three.'), updated_at: NOW })
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.queryByText('Which venues?')).toBeNull()
    expect(screen.getByText('When is the launch?')).toBeTruthy()
  })

  test('New conversation from the page wins over the newest thread', async () => {
    let releaseLatest: (v: unknown) => void = () => {}
    api.latestThread.mockReturnValue(new Promise((r) => { releaseLatest = r }))
    requestThread(null)
    Panel()
    await new Promise((r) => setTimeout(r, 20))
    releaseLatest({ id: A.id, messages: msgs('Which venues?', 'Three.'), updated_at: NOW })
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.queryByText('Which venues?')).toBeNull()
  })

  test('deleting the open thread on the page empties the panel', async () => {
    api.latestThread.mockResolvedValue({ id: A.id, messages: msgs('Which venues?', 'Three.'), updated_at: NOW })
    Panel()
    expect(await screen.findByText('Which venues?')).toBeTruthy()
    announceThreadsDeleted([B.id])
    expect(screen.getByText('Which venues?')).toBeTruthy()
    announceThreadsDeleted([A.id])
    await waitFor(() => expect(screen.queryByText('Which venues?')).toBeNull())
  })
})

test('groupThreads: Today, Past 7 days, Earlier this month, then months; a search is one group', () => {
  const now = new Date(2026, 10, 23, 12)
  const at = (d: Date) => d.toISOString()
  const rows = [
    row(1, 'a', at(new Date(2026, 10, 23, 9))),
    row(2, 'b', at(new Date(2026, 10, 20, 9))),
    row(3, 'c', at(new Date(2026, 10, 2, 9))),
    row(4, 'd', at(new Date(2026, 9, 30, 9))),
  ]
  expect(groupThreads(rows, now, false).map((g) => [g.key, g.rows.length])).toEqual([['today', 1], ['week', 1], ['month', 1], ['2026-9', 1]])
  expect(groupThreads(rows, now, true).map((g) => g.label)).toEqual(['Matches'])
  expect(groupThreads([], now, true)).toEqual([])
})
