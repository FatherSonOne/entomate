import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { recordLinkPath } from '../components/EntoAssistant/AnswerRecordLinks'

// EAI-02c slice 3: record buttons under an answer, ported from Logos AI `AnswerRecordLinks`.
// The panel cases render the real Entomate panel.
vi.mock('../components/ui/thinking-orbs', async (orig) => ({ ...(await orig<object>()), Orb: () => null }))
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-a', email: 'a@example.com' } }) }))
vi.mock('../components/EntoAssistant/useAssistantContext', () => ({
  default: () => ({ context: { data: {} }, section: 'meetings', sectionSummary: '', sectionLabel: 'Meetings', isLoading: false, isReady: true }),
}))
const svc = vi.hoisted(() => ({ streamQuery: vi.fn() }))
vi.mock('../services/entoAssistantService', () => ({
  getStarter: () => ({ title: 'Ask about your meetings', prompts: [] }),
  streamQuery: svc.streamQuery,
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

const M1 = 'aaaaaaaa-1111-4111-8111-111111111111'
const P1 = 'bbbbbbbb-1111-4111-8111-111111111111'
const LINKS = [
  { kind: 'meeting', id: M1, label: 'Budget review' },
  { kind: 'project', id: P1, label: 'Website relaunch' },
]

describe('recordLinkPath', () => {
  test('opens a meeting or a project, and fails closed on anything else', () => {
    expect(recordLinkPath({ kind: 'meeting', id: M1 })).toBe(`/meetings/${M1}`)
    expect(recordLinkPath({ kind: 'project', id: P1 })).toBe(`/projects/${P1}`)
    expect(recordLinkPath({ kind: 'task', id: M1 })).toBeNull()
    expect(recordLinkPath({ kind: 'constructor', id: M1 })).toBeNull()
    expect(recordLinkPath({ kind: 'meeting', id: '../settings' })).toBeNull()
    expect(recordLinkPath({ kind: 'meeting', id: `${M1}/edit` })).toBeNull()
    expect(recordLinkPath(null)).toBeNull()
  })
})

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>
}

describe('record buttons in the panel', () => {
  const T = { id: 'aaaaaaaa-0000-4000-8000-000000000001', title: 'Budget', updated_at: new Date().toISOString() }
  const onClose = vi.fn()
  beforeEach(() => {
    vi.clearAllMocks()
    window.matchMedia = window.matchMedia || ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }) as unknown as MediaQueryList)
    Element.prototype.scrollIntoView = vi.fn()
    api.latestThread.mockResolvedValue(null)
    api.threads.list.mockResolvedValue({ threads: [T] })
  })

  const renderPanel = () => render(
    <MemoryRouter initialEntries={['/meetings']}>
      <EntoAssistant isOpen onClose={onClose} />
      <Routes><Route path="*" element={<Where />} /></Routes>
    </MemoryRouter>,
  )

  const openThread = async (assistant: Record<string, unknown>) => {
    api.threads.get.mockResolvedValue({ thread: { ...T, messages: [
      { role: 'user', content: 'what happened?', section: 'meetings', ts: 1 },
      { role: 'assistant', section: 'meetings', ts: 2, ...assistant },
    ] } })
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Conversation history' }))
    fireEvent.click(await within(await screen.findByRole('dialog', { name: 'Conversation history' })).findByText('Budget'))
  }

  test('a reopened answer shows its saved records; a click opens the record and closes the panel', async () => {
    await openThread({ content: 'The budget review covered the Website relaunch.', recordLinks: LINKS })
    const group = await screen.findByRole('group', { name: 'Records in this answer' })
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(['Budget review', 'Website relaunch'])
    fireEvent.click(within(group).getByRole('button', { name: 'Open Budget review' }))
    expect(screen.getByTestId('where').textContent).toBe(`/meetings/${M1}`)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('a saved link that cannot be opened gets no button; none left → no row', async () => {
    await openThread({ content: 'Ship it.', recordLinks: [{ kind: 'task', id: M1, label: 'Ship it' }, { kind: 'meeting', id: 'x', label: 'Bad' }] })
    await screen.findByText('Ship it.')
    expect(screen.queryByRole('group', { name: 'Records in this answer' })).toBeNull()
  })

  test('an answer saved before this slice (no recordLinks) shows no row', async () => {
    await openThread({ content: 'Older answer.' })
    await screen.findByText('Older answer.')
    expect(screen.queryByRole('group', { name: 'Records in this answer' })).toBeNull()
  })

  test('a streamed answer takes its records from the complete event', async () => {
    svc.streamQuery.mockImplementation(async (_q: string, _ctx: unknown, cb: { onComplete: (r: unknown) => void }) => {
      cb.onComplete({ answer: 'The Website relaunch is on track.', threadId: T.id, tools: [], proposals: [], recordLinks: [LINKS[1]] })
    })
    renderPanel()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'how is the relaunch?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
    const group = await screen.findByRole('group', { name: 'Records in this answer' })
    fireEvent.click(within(group).getByRole('button', { name: 'Open Website relaunch' }))
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe(`/projects/${P1}`))
  })
})
