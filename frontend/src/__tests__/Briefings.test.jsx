import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import IntelligenceDashboard from '../components/intelligence/IntelligenceDashboard'
import { Drawer } from '../components/bench/Drawer'

const getDashboard = vi.hoisted(() => vi.fn())
vi.mock('../services/api', () => ({ default: { intelligence: { getDashboard } } }))
vi.mock('../contexts/OrgContext', () => ({ useOrgSafe: () => null }))
vi.mock('../components/vc/ToastProvider', () => ({ useToast: () => ({}) }))

const briefing = {
  success: true,
  data: {
    meetingPrep: { count: 0, cards: [] },
    dealRisks: { count: 0, cards: [] },
    actionItems: {
      summary: { total: 4, completed: 0, overdue: 4, completionRate: 0 },
      criticalItems: [{ id: 'item-1', task: 'Send the transcript', owner: 'Frank', daysOverdue: 2 }],
    },
  },
}

beforeEach(() => {
  localStorage.clear()
  getDashboard.mockReset().mockResolvedValue(briefing)
})

function renderBriefings() {
  render(<Drawer open onClose={() => {}} label="Briefings"><IntelligenceDashboard /></Drawer>)
}

describe('Briefings', () => {
  test('shows action items in the dashboard response', async () => {
    renderBriefings()
    expect(await screen.findByText('Send the transcript')).toBeInTheDocument()
  })

  test('saves preferences inside the drawer and loads with the new filters', async () => {
    renderBriefings()
    fireEvent.click(await screen.findByRole('button', { name: /customize/i }))
    fireEvent.change(screen.getByRole('spinbutton', { name: /meetings/i }), { target: { value: '48' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /action item tracking/i }))
    fireEvent.click(screen.getByRole('button', { name: /save preferences/i }))

    await waitFor(() => expect(getDashboard.mock.calls.at(-1)[0]).toMatchObject({ meetingHours: 48 }))
    expect(getDashboard).toHaveBeenCalledTimes(2)
    expect(await screen.findByText(/no briefings match/i)).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('entomate_intelligence_prefs')).showActionItems).toBe(false)
  })

  test('offers retry when the service returns a failure response', async () => {
    getDashboard.mockResolvedValueOnce({ success: false, data: null, error: 'Briefings unavailable' })
    renderBriefings()
    expect(await screen.findByRole('alert')).toHaveTextContent('Briefings unavailable')
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Retry' })))
    expect(screen.getByText('Send the transcript')).toBeInTheDocument()
  })
})
