import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, test, vi, beforeEach } from 'vitest'
import CalendarConnectionSettings from '../components/settings/CalendarConnectionSettings'

const { getCalendars, getAuthUrl, disconnect } = vi.hoisted(() => ({
  getCalendars: vi.fn(),
  getAuthUrl: vi.fn(),
  disconnect: vi.fn(),
}))
vi.mock('../services/api', () => ({ calendarApi: { getCalendars, getAuthUrl, disconnect } }))

describe('Google Calendar connection', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    getCalendars.mockResolvedValue({ calendars: [{ id: 'calendar@work.example', primary: true }] })
  })

  test('shows the connected primary calendar and opens Google authorization from the switch control', async () => {
    getAuthUrl.mockResolvedValue({})
    render(<CalendarConnectionSettings status={{ configured: true, connected: true }} oauthError={null} onDisconnect={vi.fn()} />)
    expect(await screen.findByText('calendar@work.example')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Switch Google account' }))
    await waitFor(() => expect(getAuthUrl).toHaveBeenCalledWith('/settings?s=connections&dr=calendar'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not open the Google account picker')
  })

  test('asks for confirmation before disconnecting and refreshes connection settings', async () => {
    const refresh = vi.fn().mockResolvedValue()
    disconnect.mockResolvedValue({})
    render(<CalendarConnectionSettings status={{ configured: true, connected: true }} oauthError={null} onDisconnect={refresh} />)
    await screen.findByText('calendar@work.example')
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect', exact: true }))
    expect(disconnect).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm disconnect' }))
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce())
    expect(disconnect).toHaveBeenCalledOnce()
  })
})
