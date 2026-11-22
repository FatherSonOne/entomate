import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach } from 'vitest'

const getAutoJoin = vi.fn()
const updateAutoJoin = vi.fn()
vi.mock('../services/api', () => ({ calendarApi: { getAutoJoin: (...a) => getAutoJoin(...a), updateAutoJoin: (...a) => updateAutoJoin(...a), getAuthUrl: vi.fn() } }))
vi.mock('../contexts/OrgContext', () => ({ useOrg: () => ({ org: { id: 'o1' }, myRole: 'owner' }) }))

import CalendarAutoJoinSettings from '../components/settings/CalendarAutoJoinSettings'

const base = {
  configured: true,
  botsConfigured: true,
  connected: true,
  settings: { enabled: false, scope: 'organized', org_id: null, consent_at: null },
  previewError: null,
  upcoming: [
    { id: 'e1', title: 'Acme weekly', start: '2026-11-22T16:00:00Z', platform: 'meet', join: true, reason: null, botStatus: null },
    { id: 'e2', title: 'Focus time', start: '2026-11-22T18:00:00Z', platform: null, join: false, reason: 'no_link', botStatus: null },
  ],
}

describe('Bot auto-join settings', () => {
  beforeEach(() => { getAutoJoin.mockReset(); updateAutoJoin.mockReset() })

  test('shows what the bot would join and why it skips the rest', async () => {
    getAutoJoin.mockResolvedValue(base)
    render(<CalendarAutoJoinSettings />)
    expect(await screen.findByText('Acme weekly')).toBeTruthy()
    expect(screen.getByText('Would join')).toBeTruthy()
    expect(screen.getByText('No video link')).toBeTruthy()
  })

  test('turning it on needs the consent box, then sends consent and the org', async () => {
    getAutoJoin.mockResolvedValue(base)
    updateAutoJoin.mockResolvedValue({ settings: { ...base.settings, enabled: true } })
    render(<CalendarAutoJoinSettings />)
    const toggle = await screen.findByRole('switch', { name: 'Turn on auto-join' })
    expect(toggle.disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(toggle.disabled).toBe(false)
    fireEvent.click(toggle)
    await waitFor(() => expect(updateAutoJoin).toHaveBeenCalledWith({ enabled: true, scope: 'organized', orgId: 'o1', consentAcknowledged: true }))
  })

  test('asks to connect the calendar first', async () => {
    getAutoJoin.mockResolvedValue({ ...base, connected: false, upcoming: [] })
    render(<CalendarAutoJoinSettings />)
    expect(await screen.findByRole('button', { name: 'Connect' })).toBeTruthy()
    expect(screen.getByRole('switch', { name: 'Turn on auto-join' }).disabled).toBe(true)
  })
})
