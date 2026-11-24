import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import OwnerPreferences from '../components/settings/OwnerPreferences'

const { getOwnerPreferences, decideOwnerPreference } = vi.hoisted(() => ({
  getOwnerPreferences: vi.fn(),
  decideOwnerPreference: vi.fn(),
}))
vi.mock('../services/api', () => ({ settingsApi: { getOwnerPreferences, decideOwnerPreference } }))

const preference = {
  scopeKey: 'finance-invoices', memberId: 'jordan', memberName: 'Jordan', meetingTitle: 'Weekly Finance',
  itemTitle: 'Review invoices', evidence: [{ from: 'Alex', to: 'Jordan', correctedAt: '2026-11-23T21:12:00Z' }],
}

beforeEach(() => vi.resetAllMocks())

test('shows supporting corrections and moves an approved suggestion to the active list', async () => {
  getOwnerPreferences.mockResolvedValueOnce({ suggested: [preference], active: [] })
    .mockResolvedValueOnce({ suggested: [], active: [preference] })
  decideOwnerPreference.mockResolvedValue({ success: true })
  render(<OwnerPreferences workspaceId="finance" canReview />)

  expect(await screen.findByText('Weekly Finance')).toBeInTheDocument()
  fireEvent.click(screen.getByText('Supporting corrections'))
  expect(screen.getByText('Alex changed to Jordan')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Approve' }))

  expect(decideOwnerPreference).toHaveBeenCalledWith('finance', preference.scopeKey, preference.memberId, 'approve')
  expect(await screen.findByText('Preference approved.')).toBeInTheDocument()
  const active = await screen.findByRole('region', { name: 'Active preferences' })
  expect(within(active).getByText('Jordan')).toBeInTheDocument()
  expect(within(active).getByRole('button', { name: 'Turn off' })).toBeInTheDocument()
})

test('offers retry on a load failure and shows read-only suggestions to members', async () => {
  getOwnerPreferences.mockRejectedValueOnce(new Error('Unavailable'))
    .mockResolvedValueOnce({ suggested: [preference], active: [] })
  render(<OwnerPreferences workspaceId="finance" canReview={false} />)

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load Owner preferences.')
  expect(screen.queryByText('No suggestions to review.')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByText('Review invoices')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull()
})
