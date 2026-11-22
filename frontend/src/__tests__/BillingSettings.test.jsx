import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach } from 'vitest'

// Production on 2026-11-22: there is no workspace_members table, so the lookup returns an error.
const getUser = vi.fn()
const memberLookup = vi.fn()
vi.mock('../services/supabaseClient', () => {
  const chain = { select: () => chain, eq: () => chain, limit: () => chain, single: () => memberLookup() }
  return { supabase: { auth: { getUser: () => getUser() }, from: () => chain } }
})

const getAvailablePlans = vi.fn()
vi.mock('../services/billingService', () => ({
  default: {
    getAvailablePlans: () => getAvailablePlans(),
    getInvoices: async () => [],
    getSubscription: async () => null,
    getEntitlements: async () => ({ apps: {}, usage: {} }),
    canUseFeature: () => false,
    isAtLimit: () => false,
  },
}))

import BillingSettings from '../components/settings/BillingSettings'

const NOT_SET_UP = 'Billing is not set up for this workspace yet'

describe('Plan and billing drawer', () => {
  beforeEach(() => {
    getUser.mockReset()
    memberLookup.mockReset()
    getAvailablePlans.mockReset()
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
  })

  test('shows the not-set-up state, not a spinner, when the user has no workspace', async () => {
    memberLookup.mockResolvedValue({ data: null, error: { code: '42P01', message: 'relation "workspace_members" does not exist' } })
    render(<BillingSettings />)
    expect(await screen.findByText(NOT_SET_UP)).toBeTruthy()
    expect(screen.queryByText('Loading billing information...')).toBeNull()
  })

  test('shows the not-set-up state when the billing data cannot load', async () => {
    memberLookup.mockResolvedValue({ data: { workspace_id: 'w1' }, error: null })
    getAvailablePlans.mockRejectedValue(new Error('relation "plans" does not exist'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<BillingSettings />)
    expect(await screen.findByText(NOT_SET_UP)).toBeTruthy()
  })

  test('keeps the loading line while the workspace lookup is still running', async () => {
    getUser.mockReturnValue(new Promise(() => {}))
    render(<BillingSettings />)
    expect(screen.getByText('Loading billing information...')).toBeTruthy()
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.queryByText(NOT_SET_UP)).toBeNull()
  })

  test('shows the plans when the workspace and billing data load', async () => {
    memberLookup.mockResolvedValue({ data: { workspace_id: 'w1' }, error: null })
    getAvailablePlans.mockResolvedValue([{ id: 'ent_pro', app: 'entomate', tier: 2, name: 'Professional' }])
    render(<BillingSettings />)
    expect(await screen.findByText('Professional')).toBeTruthy()
    expect(screen.queryByText(NOT_SET_UP)).toBeNull()
  })
})
