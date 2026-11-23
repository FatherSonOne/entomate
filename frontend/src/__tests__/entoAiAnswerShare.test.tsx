import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { answerPlainText, answerTitle, plainInline } from '../components/EntoAssistant/answerText'
import { printDocument } from '../components/EntoAssistant/printAnswer'
import { AnswerSharePanel } from '../components/EntoAssistant/AnswerSharePanel'

// EAI-02c slice 2: the Share panel and action row, ported from Logos AI. The helper cases are
// LV's own (`answerDocument.test.ts`); the panel cases render the real Entomate panel.
const printer = vi.hoisted(() => ({ printAnswer: vi.fn((_answer: { title: string; question?: string; bodyHtml: string }) => true) }))
vi.mock('../components/EntoAssistant/printAnswer', async (orig) => ({ ...(await orig<object>()), printAnswer: printer.printAnswer }))
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

const ROSTER = [
  'Here are the open tasks:',
  '',
  '- **Send kickoff deck**: due Monday.',
  '- **Collect SSO details**: due Thursday.',
  '',
  'See the [Tasks](/tasks) page.',
].join('\n')

describe('answer text helpers (ported from Logos AI)', () => {
  test("plainInline keeps a web link's address and drops emphasis", () => {
    expect(plainInline('See **[the guide](https://example.org/g)** and _this_ `code`')).toBe('See the guide (https://example.org/g) and this code')
  })

  test('answerPlainText gives a paste-ready copy', () => {
    expect(answerPlainText(ROSTER)).toBe([
      'Here are the open tasks:',
      '',
      '• Send kickoff deck: due Monday.',
      '• Collect SSO details: due Thursday.',
      '',
      'See the Tasks page.',
    ].join('\n'))
    expect(answerPlainText('| Task | Due |\n|---|---|\n| **Deck** | Mon |')).toBe('Task | Due\nDeck | Mon')
  })

  test('answerTitle prefers a leading heading, then the question, then a fallback', () => {
    expect(answerTitle(undefined, 'Hello')).toBe('Entomate answer')
    expect(answerTitle('what is due?', '# Tasks due this week\n...')).toBe('Tasks due this week')
    expect(answerTitle('what is overdue?', 'Two tasks.')).toBe('What is overdue')
  })
})

describe('printDocument', () => {
  test('escapes the title and question, and carries the rendered answer', () => {
    const html = printDocument({ title: '<b>Plan</b>', question: 'a & b?', bodyHtml: '<ul><li>One</li></ul>', printedAt: '23 Nov 2026' })
    expect(html).toContain('<title>&lt;b&gt;Plan&lt;/b&gt;</title>')
    expect(html).toContain('Asked: a &amp; b?')
    expect(html).toContain('<main><ul><li>One</li></ul></main>')
    expect(html).toContain('Printed 23 Nov 2026 from Ask Entomate.')
    expect(html).not.toContain('<b>Plan</b>')
  })

  test('leaves the question line out when there is none', () => {
    expect(printDocument({ title: 'T', bodyHtml: '', printedAt: 'now' })).not.toContain('Asked:')
  })
})

describe('AnswerSharePanel', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn(() => Promise.resolve()) } })
  })

  test('offers only the options Entomate can honour', () => {
    render(<AnswerSharePanel answer={ROSTER} onPrint={() => true} />)
    expect(screen.getByRole('button', { name: /Print or save as PDF/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Copy as plain text/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /email|Documents|contact/i })).toBeNull()
  })

  test('says so when the print dialog could not open', () => {
    render(<AnswerSharePanel answer={ROSTER} onPrint={() => false} />)
    fireEvent.click(screen.getByRole('button', { name: /Print or save as PDF/ }))
    expect(screen.getByRole('status').textContent).toMatch(/Could not open the print dialog/)
  })

  test('copies the answer without Markdown marks', async () => {
    render(<AnswerSharePanel answer={ROSTER} onPrint={() => true} />)
    fireEvent.click(screen.getByRole('button', { name: /Copy as plain text/ }))
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(answerPlainText(ROSTER)))
    expect(await screen.findByText('Copied')).toBeTruthy()
  })
})

describe('Share in the panel', () => {
  const T = { id: 'aaaaaaaa-0000-4000-8000-000000000001', title: 'Open tasks', updated_at: new Date().toISOString() }
  beforeEach(() => {
    vi.clearAllMocks()
    printer.printAnswer.mockReturnValue(true)
    window.matchMedia = window.matchMedia || ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }) as unknown as MediaQueryList)
    Element.prototype.scrollIntoView = vi.fn()
    Object.assign(navigator, { clipboard: { writeText: vi.fn(() => Promise.resolve()) } })
    api.latestThread.mockResolvedValue(null)
    api.threads.list.mockResolvedValue({ threads: [T] })
    api.threads.get.mockResolvedValue({ thread: { ...T, messages: [
      { role: 'user', content: 'what is open?', section: 'tasks', ts: 1 },
      { role: 'assistant', content: ROSTER, section: 'tasks', ts: 2 },
    ] } })
  })

  const openThread = async () => {
    render(<MemoryRouter><EntoAssistant isOpen onClose={() => {}} /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Conversation history' }))
    const rail = await screen.findByRole('dialog', { name: 'Conversation history' })
    fireEvent.click(await within(rail).findByText('Open tasks'))
    await screen.findByText('Send kickoff deck')
  }

  test('Share opens the panel under the answer, and Print sends the rendered answer', async () => {
    await openThread()
    const share = screen.getByRole('button', { name: 'Share, print or save this answer' })
    expect(share.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(share)
    expect(share.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(within(screen.getByRole('region', { name: 'Share this answer' })).getByRole('button', { name: /Print or save as PDF/ }))
    expect(printer.printAnswer).toHaveBeenCalledTimes(1)
    const arg = printer.printAnswer.mock.calls[0]![0]
    expect(arg.title).toBe('What is open')
    expect(arg.question).toBe('what is open?')
    expect(arg.bodyHtml).toContain('<strong>Send kickoff deck</strong>')
    expect(arg.bodyHtml).not.toContain('what is open?')
    fireEvent.click(share)
    expect(screen.queryByRole('region', { name: 'Share this answer' })).toBeNull()
  })

  test('a title taken from the leading heading is not printed twice', async () => {
    api.threads.get.mockResolvedValue({ thread: { ...T, messages: [
      { role: 'user', content: 'what is open?', section: 'tasks', ts: 1 },
      { role: 'assistant', content: '## Open this week\n\n- **Deck**: Monday', section: 'tasks', ts: 2 },
    ] } })
    render(<MemoryRouter><EntoAssistant isOpen onClose={() => {}} /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Conversation history' }))
    fireEvent.click(await within(await screen.findByRole('dialog', { name: 'Conversation history' })).findByText('Open tasks'))
    await screen.findByText('Deck')
    fireEvent.click(screen.getByRole('button', { name: 'Share, print or save this answer' }))
    fireEvent.click(screen.getByRole('button', { name: /Print or save as PDF/ }))
    const arg = printer.printAnswer.mock.calls[0]![0]
    expect(arg.title).toBe('Open this week')
    expect(arg.bodyHtml).not.toContain('Open this week')
    expect(arg.bodyHtml).toContain('<strong>Deck</strong>')
  })

  test('Copy copies the answer as written', async () => {
    await openThread()
    fireEvent.click(screen.getByRole('button', { name: 'Copy response' }))
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(ROSTER))
    expect(await screen.findByText('Copied')).toBeTruthy()
  })

  test('opening another conversation closes an open Share panel, even at the same place', async () => {
    const U = { id: 'aaaaaaaa-0000-4000-8000-000000000002', title: 'Launch date', updated_at: new Date().toISOString() }
    api.threads.list.mockResolvedValue({ threads: [T, U] })
    await openThread()
    fireEvent.click(screen.getByRole('button', { name: 'Share, print or save this answer' }))
    expect(screen.getByRole('region', { name: 'Share this answer' })).toBeTruthy()
    // Same index and ts as the first answer, so only the reset tells them apart.
    api.threads.get.mockResolvedValue({ thread: { ...U, messages: [
      { role: 'user', content: 'when is the launch?', section: 'tasks', ts: 1 },
      { role: 'assistant', content: 'On **March 3**.', section: 'tasks', ts: 2 },
    ] } })
    fireEvent.click(screen.getByRole('button', { name: 'Conversation history' }))
    const rail = await screen.findByRole('dialog', { name: 'Conversation history' })
    fireEvent.click(await within(rail).findByText('Launch date'))
    await screen.findByText('March 3')
    expect(screen.queryByRole('region', { name: 'Share this answer' })).toBeNull()
  })
})
