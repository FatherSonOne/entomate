import React from 'react'
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { vi, describe, test, expect, beforeEach } from 'vitest'

const http = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }))
vi.mock('../services/api', () => ({
  default: http,
  searchApi: { getHistory: vi.fn(() => Promise.resolve({ history: [{ query: 'northwind', result_count: 4 }] })) },
}))

import CommandPalette from '../components/CommandPalette'

const response = {
  query: 'pricing', terms: ['pricing'], total: 2, engine: 'words',
  counts: { meetings: 1, decisions: 1 },
  groups: {
    meetings: [{ type: 'meeting', id: 'm1', title: 'Acme pricing call', titleHits: [[5, 12]], snippet: 'the pricing floor', snippetHits: [[4, 11]], meta: { date: '2026-11-12', atMs: 895000 } }],
    decisions: [{ type: 'decision', id: 'm1:0', title: 'Pilot pricing floor', titleHits: [[6, 13]], snippet: '', snippetHits: [], meta: { meetingId: 'm1', atMs: 895000 } }],
  },
}

function Where(): React.ReactElement {
  const l = useLocation()
  return <p data-testid="where">{l.pathname + l.search}</p>
}

function setup() {
  const onClose = vi.fn()
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <CommandPalette isOpen onClose={onClose} />
      <Routes><Route path="*" element={<Where />} /></Routes>
    </MemoryRouter>,
  )
  return { onClose, input: screen.getByRole('combobox') }
}

describe('CommandPalette', () => {
  beforeEach(() => {
    http.post.mockReset()
    http.get.mockReset()
    http.post.mockResolvedValue(response)
    http.get.mockResolvedValue({ notes: [] })
  })

  test('empty: shows recent searches and pages', async () => {
    setup()
    expect(await screen.findByText('northwind')).toBeTruthy()
    expect(screen.getByText('Go to Today')).toBeTruthy()
  })

  test('command mode completes a typo and Enter opens the best destination without searching records', async () => {
    const { input } = setup()
    fireEvent.change(input, { target: { value: '>proejcts' } })
    expect(screen.getAllByRole('option')[0]?.textContent).toContain('Go to Projects')
    fireEvent.keyDown(input, { key: 'ArrowRight' })
    expect(input).toHaveValue('>Projects')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByTestId('where')).toHaveTextContent('/projects')
    expect(http.post).not.toHaveBeenCalled()
  })

  test('toolbar input remains mounted after close; outside pointer dismisses it', async () => {
    function Toolbar() {
      const [open, setOpen] = React.useState(false)
      return <><button>Outside</button><CommandPalette toolbar isOpen={open} onOpen={() => setOpen(true)} onClose={() => setOpen(false)} /></>
    }
    render(<MemoryRouter><Toolbar /></MemoryRouter>)
    const input = screen.getByRole('combobox')
    expect(input).toHaveAttribute('aria-expanded', 'false')
    fireEvent.focus(input)
    expect(input).toHaveAttribute('aria-expanded', 'true')
    fireEvent.pointerDown(screen.getByText('Outside'))
    expect(input).toHaveAttribute('aria-expanded', 'false')
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
    expect(input).toBeInTheDocument()
  })

  test('Enter waits for records after completing a suggestion instead of running Ask while loading', async () => {
    let settle!: (value: unknown) => void
    http.post.mockImplementation((_url: string, body: { query: string }) => body.query === 'pricing'
      ? Promise.resolve(response)
      : new Promise(resolve => { settle = resolve }))
    const { input, onClose } = setup()
    fireEvent.change(input, { target: { value: 'pricing' } })
    await screen.findAllByText('▶ 14:55')
    fireEvent.keyDown(input, { key: 'ArrowRight' })
    expect(input).toHaveValue('Acme pricing call')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onClose).not.toHaveBeenCalled()
    await waitFor(() => expect(settle).toBeTypeOf('function'))
    await act(async () => settle({ ...response, query: 'Acme pricing call' }))
    await screen.findAllByText('▶ 14:55')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByTestId('where')).toHaveTextContent('/meetings/m1?t=895000')
  })

  test('searches the shared engine and groups results with the moment', async () => {
    const { input } = setup()
    fireEvent.change(input, { target: { value: 'pricing' } })
    expect((await screen.findAllByText('▶ 14:55')).length).toBeGreaterThan(0)
    expect(http.post).toHaveBeenCalledWith('/search/everything', expect.objectContaining({ query: 'pricing', log: false }))
    expect(screen.getAllByRole('option')[0]).toHaveTextContent('Acme pricing call')
    expect(screen.getByText(/Ask Entomate about/)).toBeTruthy()
  })

  test('Enter opens the selected result at its moment; ⌘↵ opens Search', async () => {
    const { input, onClose } = setup()
    fireEvent.change(input, { target: { value: 'pricing' } })
    await screen.findAllByText('▶ 14:55')
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/meetings/m1?t=895000'))
    expect(onClose).toHaveBeenCalled()
  })

  test('⌘↵ carries the query to the Search page', async () => {
    const { input } = setup()
    fireEvent.change(input, { target: { value: 'pricing' } })
    fireEvent.keyDown(input, { key: 'Enter', metaKey: true })
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/search?q=pricing'))
  })

  test('⌘S clips the selected result to notes', async () => {
    http.post.mockImplementation((url: string) => Promise.resolve(url === '/search/notes'
      ? { note: { id: 'n1', kind: 'transcript', body: 'the pricing floor', origin: 'palette' } }
      : response))
    const { input } = setup()
    fireEvent.change(input, { target: { value: 'pricing' } })
    await screen.findAllByText('▶ 14:55')
    fireEvent.keyDown(input, { key: 's', metaKey: true })
    await waitFor(() => expect(http.post).toHaveBeenCalledWith('/search/notes', expect.objectContaining({ kind: 'transcript', sourceId: 'm1', origin: 'palette', atMs: 895000 })))
    expect(await screen.findByText(/Clipped to Notes/)).toBeTruthy()
  })
})
