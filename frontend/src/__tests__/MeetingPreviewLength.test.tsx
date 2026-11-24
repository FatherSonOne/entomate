import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, test, expect } from 'vitest'

vi.mock('../services/api', () => ({ meetingsApi: { get: vi.fn(() => new Promise(() => {})) } }))

import MeetingPreview from '../components/meetings/MeetingPreview'

const row = (extra: Record<string, unknown>) =>
  ({ id: 'm-1', title: 'Jennifer', start_time: '2026-11-23T20:44:00Z', ...extra }) as unknown as Parameters<typeof MeetingPreview>[0]['meeting']

test('the quick panel shows the recording length as a badge beside the status', () => {
  window.matchMedia ||= ((q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} })) as unknown as typeof window.matchMedia
  const { rerender } = render(<MemoryRouter><MeetingPreview meeting={row({ duration_minutes: 65 })} onClose={() => {}} /></MemoryRouter>)
  expect(screen.getByText('1h 05m').closest('.bs-mtg-pv-status')).not.toBeNull()

  // A meeting still being recorded has no length yet: no badge.
  rerender(<MemoryRouter><MeetingPreview meeting={row({ id: 'm-2' })} onClose={() => {}} /></MemoryRouter>)
  expect(document.querySelector('.bs-mtg-pv-length')).toBeNull()
})
