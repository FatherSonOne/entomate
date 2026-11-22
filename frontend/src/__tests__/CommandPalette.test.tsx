import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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

  test('searches the shared engine and groups results with the moment', async () => {
    const { input } = setup()
    fireEvent.change(input, { target: { value: 'pricing' } })
    expect((await screen.findAllByText('▶ 14:55')).length).toBeGreaterThan(0)
    expect(http.post).toHaveBeenCalledWith('/search/everything', expect.objectContaining({ query: 'pricing', log: false }))
    expect(screen.getByText('Acme', { exact: false })).toBeTruthy()
    expect(screen.getByText(/Ask Entomate about/)).toBeTruthy()
  })

  test('Enter opens the selected result at its moment; ⌘↵ opens Search', async () => {
    const { input, onClose } = setup()
    fireEvent.change(input, { target: { value: 'pricing' } })
    await screen.findAllByText('▶ 14:55')
    fireEvent.keyDown(input, { key: 'ArrowDown' }) // past the Ask row
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
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 's', metaKey: true })
    await waitFor(() => expect(http.post).toHaveBeenCalledWith('/search/notes', expect.objectContaining({ kind: 'transcript', sourceId: 'm1', origin: 'palette', atMs: 895000 })))
    expect(await screen.findByText(/Clipped to Notes/)).toBeTruthy()
  })
})
