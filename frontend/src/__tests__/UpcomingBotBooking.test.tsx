import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import UpcomingMeetings from '../components/meetings/UpcomingMeetings'

const api = vi.hoisted(() => ({ upcoming: vi.fn(), propose: vi.fn(), confirm: vi.fn(), getProfile: vi.fn(), setProfile: vi.fn() }))
vi.mock('../services/api', () => ({
  calendarApi: { getUpcomingMeetings: api.upcoming, getMeetingProfile: api.getProfile, setMeetingProfile: api.setProfile },
  meetingsApi: { carryForwardPreview: vi.fn().mockResolvedValue(null) },
  entoAiApi: { calendarBookings: { propose: api.propose, confirm: api.confirm, reject: vi.fn() } },
}))
vi.mock('../contexts/OrgContext', () => ({
  useOrgSafe: () => ({ org: { id: 'workspace' }, myRole: 'owner' }),
}))
vi.mock('../components/vc/ToastProvider', () => ({ useToast: () => ({ error: vi.fn() }) }))
vi.mock('../services/supabaseClient', () => ({
  supabase: { from: () => ({
    select: () => ({ eq: () => ({ order: async () => ({
      data: [{ id: 'board', name: 'Board Meeting', focus_areas: [{ label: 'Motions and votes' }] }],
    }) }) }),
  }) },
}))

test('schedules and cancels the selected occurrence while recurring auto-join is off', async () => {
  const start = new Date(Date.now() + 86_400_000).toISOString()
  const joinAt = new Date(Date.parse(start) - 5 * 60_000).toISOString()
  const event = {
    id: 'event_1', key: 'event_1@' + start, title: 'Thursday review', start,
    platform: 'meet', meetingLink: 'https://meet.google.com/abc-defg-hij', canSchedule: true,
  }
  api.getProfile.mockResolvedValue({ profileId: null })
  api.setProfile.mockResolvedValue({ profileId: 'board' })
  let booking: 'schedule' | 'cancel' | null = null
  api.upcoming.mockImplementation(async () => ({
    connected: true, autoJoin: { enabled: false, scope: 'organized', leadMinutes: 5 },
    events: [{ ...event, booking, botStatus: booking === 'schedule' ? 'launching' : null, joinAt }],
  }))
  api.propose.mockImplementation(async ({ decision }) => ({
    ok: true,
    proposal: {
      id: decision,
      summary: decision === 'schedule' ? 'Reserve the bot at 09:55.' : 'Cancel only Thursday review.',
      confirmToken: decision === 'schedule' ? 'I will notify attendees' : 'Cancel this bot',
    },
  }))
  api.confirm.mockImplementation(async (decision) => {
    booking = decision
    return { ok: true }
  })
  render(<MemoryRouter initialEntries={['/meetings?tab=upcoming&event=event_1']}><UpcomingMeetings /></MemoryRouter>)

  const drawer = within(await screen.findByRole('dialog', { name: 'Upcoming meeting' }))
  expect(drawer.getByRole('link', { name: /Join meeting/ }).getAttribute('href')).toBe(event.meetingLink)
  const profile = await drawer.findByRole('combobox', { name: 'Intelligence profile' })
  await waitFor(() => expect(profile).toBeEnabled())
  fireEvent.click(profile)
  fireEvent.click(await screen.findByRole('option', { name: 'Board Meeting' }))
  expect(drawer.getByText(/Motions and votes/)).toBeTruthy()
  fireEvent.click(drawer.getByRole('button', { name: 'Save for this meeting' }))
  expect(await drawer.findByText('Profile saved for this meeting.')).toBeTruthy()
  expect(api.setProfile).toHaveBeenCalledWith('workspace', event.key, 'board')
  expect(api.propose).not.toHaveBeenCalled()

  fireEvent.click(drawer.getByRole('button', { name: 'Schedule bot' }))
  expect(await drawer.findByText('Reserve the bot at 09:55.')).toBeTruthy()
  expect(api.propose).toHaveBeenCalledWith(expect.objectContaining({
    eventKey: event.key, decision: 'schedule', leadMinutes: 5,
  }))
  expect(api.confirm).not.toHaveBeenCalled()
  expect((drawer.getByRole('button', { name: 'Confirm' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.change(drawer.getByRole('textbox', { name: /I will notify attendees/ }), { target: { value: 'I will notify attendees' } })
  fireEvent.click(drawer.getByRole('button', { name: 'Confirm' }))
  expect(await drawer.findByText('Bot booked')).toBeTruthy()

  fireEvent.click(drawer.getByRole('button', { name: 'Cancel bot' }))
  const cancel = await drawer.findByRole('textbox', { name: /Cancel this bot/ })
  expect(api.confirm).toHaveBeenCalledTimes(1)
  fireEvent.change(cancel, { target: { value: 'Cancel this bot' } })
  fireEvent.click(drawer.getByRole('button', { name: 'Confirm' }))
  await waitFor(() => expect(api.confirm).toHaveBeenLastCalledWith('cancel', 'Cancel this bot'))
  expect(await drawer.findByText('Bot cancelled')).toBeTruthy()
})
