import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import SendBotForm from '../components/bot/SendBotForm'

const api = vi.hoisted(() => ({ launch: vi.fn(async () => ({ sessionId: 'session' })) }))
vi.mock('../services/api', () => ({
  botsApi: { launch: api.launch },
  settingsApi: { getWorkspace: vi.fn(async () => ({})) },
}))
vi.mock('../contexts/OrgContext', () => ({
  useOrgSafe: () => ({ org: { id: 'workspace' }, myRole: 'owner' }),
}))
vi.mock('../services/supabaseClient', () => ({
  supabase: { from: () => ({
    select: () => ({ eq: () => ({ order: async () => ({
      data: [{ id: 'board', name: 'Board Meeting', focus_areas: [{ label: 'Motions and votes' }] }],
    }) }) }),
  }) },
}))

test('sets the profile at bot launch after the organizer confirms consent', async () => {
  render(<SendBotForm />)
  fireEvent.change(screen.getByRole('textbox', { name: 'Meeting link' }), {
    target: { value: 'https://meet.google.com/abc-defg-hij' },
  })
  const profile = screen.getByRole('combobox', { name: 'Intelligence profile' })
  await waitFor(() => expect(profile).toBeEnabled())
  fireEvent.click(profile)
  fireEvent.click(await screen.findByRole('option', { name: 'Board Meeting' }))
  expect(screen.getByText(/Motions and votes/)).toBeInTheDocument()
  const send = screen.getByRole('button', { name: 'Send the bot' })
  expect(send).toBeDisabled()
  fireEvent.click(screen.getByRole('checkbox', { name: /agreed to be recorded/ }))
  fireEvent.click(send)
  await waitFor(() => expect(api.launch).toHaveBeenCalledWith(expect.objectContaining({
    workspaceId: 'workspace', consentAcknowledged: true, intelligenceProfileId: 'board',
  })))
})
