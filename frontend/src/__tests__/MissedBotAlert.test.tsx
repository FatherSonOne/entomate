import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, test, expect, beforeEach } from 'vitest'

const cal = vi.hoisted(() => ({ syncAutoJoin: vi.fn(), dismissMissedBot: vi.fn() }))
vi.mock('../services/api', () => ({ calendarApi: cal }))

import MissedBotAlert from '../components/bot/MissedBotAlert'
import { alertsFor, lastCheckedLabel, toHealth } from '../services/autoJoinHealth'

const NOW = Date.parse('2026-11-22T16:00:00Z')

describe('autoJoinHealth', () => {
  test('only recent missed meetings alert, newest first', () => {
    const h = toHealth({ enabled: true, lastRunAt: null, missed: [
      { key: 'a', title: 'Old', start: '2026-11-22T12:00:00Z' },
      { key: 'b', title: 'Standup', start: '2026-11-22T15:30:00Z', reason: 'failed' },
      { key: 'c', start: '2026-11-22T15:45:00Z' },
      { title: 'no key' },
    ] })
    expect(alertsFor(h, NOW).map((m) => m.key)).toEqual(['c', 'b'])
    expect(alertsFor(h, NOW)[0]?.title).toBe('Untitled event')
  })
  test('last checked label', () => {
    expect(lastCheckedLabel(null, NOW)).toBeNull()
    expect(lastCheckedLabel('2026-11-22T15:57:00Z', NOW)).toBe('3 min ago')
    expect(lastCheckedLabel('2026-11-22T13:00:00Z', NOW)).toBe('3 h ago')
  })
})

describe('MissedBotAlert', () => {
  beforeEach(() => vi.clearAllMocks())

  test('nothing when no meeting was missed', async () => {
    cal.syncAutoJoin.mockResolvedValue({ enabled: true, lastRunAt: null, missed: [] })
    const { container } = render(<MemoryRouter><MissedBotAlert /></MemoryRouter>)
    await waitFor(() => expect(cal.syncAutoJoin).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  test('says the bot did not join, and can be dismissed', async () => {
    cal.syncAutoJoin.mockResolvedValue({ enabled: true, lastRunAt: null, missed: [{ key: 'k1', title: 'Weekly sync', start: new Date(Date.now() - 10 * 60000).toISOString() }] })
    cal.dismissMissedBot.mockResolvedValue({})
    render(<MemoryRouter><MissedBotAlert /></MemoryRouter>)
    expect(await screen.findByRole('alert')).toHaveTextContent(/did not join “Weekly sync”.*No bot was sent/)
    expect(screen.getByRole('button', { name: /send the bot now/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    await waitFor(() => expect(cal.dismissMissedBot).toHaveBeenCalledWith('k1'))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
