import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, test, expect, vi, beforeEach } from 'vitest'

// EAI-02b: the History rail inside the real panel. The services around it are faked.
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
  threads: { list: vi.fn(), get: vi.fn(), remove: vi.fn() },
  actions: { list: vi.fn(), confirm: vi.fn(), reject: vi.fn(), undo: vi.fn(), edit: vi.fn() },
  plans: { confirm: vi.fn(), reject: vi.fn(), undo: vi.fn() },
  signals: vi.fn(),
}))
vi.mock('../services/api', () => ({ entoAiApi: api }))

import EntoAssistant from '../components/EntoAssistant/EntoAssistant'
import { relativeTime } from '../components/EntoAssistant/ThreadRail'

const A = { id: 'aaaaaaaa-0000-4000-8000-000000000001', title: 'Venue shortlist', updated_at: new Date().toISOString() }
const B = { id: 'aaaaaaaa-0000-4000-8000-000000000002', title: 'Q1 launch', updated_at: new Date().toISOString() }
const msgs = (q: string, a: string) => [
  { role: 'user', content: q, section: 'tasks', ts: Date.now() },
  { role: 'assistant', content: a, section: 'tasks', ts: Date.now() },
]

function renderPanel() {
  const onClose = vi.fn()
  render(<MemoryRouter><EntoAssistant isOpen onClose={onClose} /></MemoryRouter>)
  return { onClose }
}
const openRail = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Conversation history' }))
  return screen.findByRole('dialog', { name: 'Conversation history' })
}

beforeEach(() => {
  vi.clearAllMocks()
  window.matchMedia = window.matchMedia || ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }) as unknown as MediaQueryList)
  Element.prototype.scrollIntoView = vi.fn()
  api.latestThread.mockResolvedValue(null)
  api.threads.list.mockResolvedValue({ threads: [A, B] })
})

describe('History rail in the panel', () => {
  test('History is offered on an empty panel and lists the threads', async () => {
    renderPanel()
    const rail = await openRail()
    expect(await within(rail).findByText('Venue shortlist')).toBeTruthy()
    expect(within(rail).getByText('Q1 launch')).toBeTruthy()
    expect(api.threads.list).toHaveBeenCalledTimes(1)
  })

  test('opening a thread shows its messages and closes the rail', async () => {
    api.threads.get.mockResolvedValue({ thread: { ...B, messages: msgs('When is the launch?', 'On **March 3**.') } })
    renderPanel()
    const rail = await openRail()
    fireEvent.click(await within(rail).findByText('Q1 launch'))
    expect(await screen.findByText('When is the launch?')).toBeTruthy()
    expect(api.threads.get).toHaveBeenCalledWith(B.id)
    expect(screen.queryByRole('dialog', { name: 'Conversation history' })).toBeNull()
  })

  test('delete asks once more; deleting the open thread empties the panel and keeps the rail', async () => {
    api.threads.get.mockResolvedValue({ thread: { ...A, messages: msgs('Which venues?', 'Three venues.') } })
    api.threads.remove.mockResolvedValue({ ok: true })
    renderPanel()
    fireEvent.click(await within(await openRail()).findByText('Venue shortlist'))
    expect(await screen.findByText('Which venues?')).toBeTruthy()

    const rail = await openRail()
    expect(within(rail).getByText('Open')).toBeTruthy()
    fireEvent.click(await within(rail).findByRole('button', { name: 'Delete Venue shortlist' }))
    expect(api.threads.remove).not.toHaveBeenCalled()
    fireEvent.click(within(rail).getByRole('button', { name: 'Confirm delete Venue shortlist' }))
    await waitFor(() => expect(api.threads.remove).toHaveBeenCalledWith(A.id))
    await waitFor(() => expect(within(rail).queryByText('Venue shortlist')).toBeNull())
    expect(screen.queryByText('Which venues?')).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Conversation history' })).toBeTruthy()
  })

  test('a failed delete keeps the row and says so inside the rail', async () => {
    api.threads.remove.mockRejectedValue(Object.assign(new Error('boom'), { status: 502 }))
    renderPanel()
    const rail = await openRail()
    fireEvent.click(await within(rail).findByRole('button', { name: 'Delete Q1 launch' }))
    fireEvent.click(within(rail).getByRole('button', { name: 'Confirm delete Q1 launch' }))
    expect((await within(rail).findByRole('alert')).textContent).toMatch(/could not be deleted/)
    expect(within(rail).getByText('Q1 launch')).toBeTruthy()
  })

  test('a failed list read is an alert: never "will appear here", never the last list', async () => {
    renderPanel()
    expect(await within(await openRail()).findByText('Q1 launch')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close conversation history' }))
    api.threads.list.mockRejectedValue(new Error('502'))
    const rail = await openRail()
    expect((await within(rail).findByRole('alert')).textContent).toMatch(/could not be loaded/)
    expect(within(rail).queryByText(/will appear here/)).toBeNull()
    expect(within(rail).queryByText('Q1 launch')).toBeNull()
  })

  test('Escape closes the rail only, not the panel', async () => {
    const { onClose } = renderPanel()
    await openRail()
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Conversation history' })).toBeNull())
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

test('relativeTime', () => {
  const now = new Date('2026-11-22T12:00:00Z')
  expect(relativeTime('2026-11-22T11:59:40Z', now)).toBe('Just now')
  expect(relativeTime('2026-11-22T11:55:00Z', now)).toBe('5 minutes ago')
  expect(relativeTime('2026-11-22T09:00:00Z', now)).toBe('3 hours ago')
  expect(relativeTime('2026-11-20T12:00:00Z', now)).toBe('2 days ago')
  expect(relativeTime('2026-10-01T12:00:00Z', now)).not.toMatch(/ago|2026/)
  expect(relativeTime('2025-10-01T12:00:00Z', now)).toMatch(/2025/)
})
