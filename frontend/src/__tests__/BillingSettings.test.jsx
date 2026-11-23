import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

// The drawer reads GET /api/billing/status (billing rebuild, Phase 4).
const getStatus = vi.fn()
const checkout = vi.fn()
const portal = vi.fn()
vi.mock('../services/api', () => ({
  billingApi: {
    getStatus: (...a) => getStatus(...a),
    checkout: (...a) => checkout(...a),
    portal: (...a) => portal(...a),
  },
}))

let mockOrg = { org: { id: 'org-1', plan: 'free' }, myRole: 'owner' }
vi.mock('../contexts/OrgContext', () => ({ useOrg: () => mockOrg }))

import BillingSettings from '../components/settings/BillingSettings'

const HOURS = {
  free: { plan: 'free', limited: true, included_hours: 2, used_hours: 0.5, pack_hours: 0, remaining_hours: 1.5, resets_at: '2026-12-01T00:00:00Z' },
  solo: { plan: 'solo', limited: true, included_hours: 15, used_hours: 13, pack_hours: 10, remaining_hours: 12, resets_at: '2026-12-01T00:00:00Z' },
}

function status(over = {}) {
  return {
    plan: 'free', botHours: HOURS.free, hasSubscription: false, subscription: null, canManage: true, configured: true, ...over,
  }
}
const SOLO = status({
  plan: 'solo',
  botHours: HOURS.solo,
  hasSubscription: true,
  subscription: { status: 'active', interval: 'month', currentPeriodEnd: '2026-12-20T00:00:00Z', cancelAtPeriodEnd: false },
})

let lastSearch = ''
function SearchProbe() {
  lastSearch = useLocation().search
  return null
}

function renderDrawer(path = '/settings?s=workspace&dr=billing') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <BillingSettings />
      <SearchProbe />
    </MemoryRouter>
  )
}

const realLocation = window.location
const assign = vi.fn()

describe('Plan and billing drawer', () => {
  beforeEach(() => {
    getStatus.mockReset()
    checkout.mockReset()
    portal.mockReset()
    assign.mockReset()
    mockOrg = { org: { id: 'org-1', plan: 'free' }, myRole: 'owner' }
    Object.defineProperty(window, 'location', { value: { ...realLocation, assign }, writable: true, configurable: true })
  })
  afterEach(() => {
    Object.defineProperty(window, 'location', { value: realLocation, writable: true, configurable: true })
    vi.useRealTimers()
  })

  test('a Free owner sees 2 bot hours, the plans and no pack or portal', async () => {
    getStatus.mockResolvedValue(status())
    renderDrawer()
    expect(await screen.findByText('1.5')).toBeTruthy()
    expect(getStatus).toHaveBeenCalledWith('org-1')
    expect(screen.getByText(/0.5 of 2 plan hours used/)).toBeTruthy()
    // Hours reset at 1 Dec 00:00 UTC; west of UTC, local time would say 30 Nov.
    expect(screen.getByText(/resets (Dec 1|1 Dec)/)).toBeTruthy()
    expect(screen.getByText(/Free includes 2 bot hours a month/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Choose Solo' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Choose Team' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Add 10 hours/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Manage billing' })).toBeNull()
  })

  test('the yearly cycle shows yearly prices and checks out the yearly item', async () => {
    getStatus.mockResolvedValue(status())
    checkout.mockResolvedValue({ id: 'cs_1', url: 'https://checkout.stripe.test/cs_1' })
    renderDrawer()
    await screen.findByText('$20 a month')
    expect(screen.getByText('$100 a month')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Yearly' }))
    expect(screen.getByText(/^\$200 a year · 2 months free$/)).toBeTruthy()
    expect(screen.getByText(/^\$1,000 a year · 2 months free$/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Choose Team' }))
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith('https://checkout.stripe.test/cs_1'))
    expect(checkout).toHaveBeenCalledWith('org-1', 'team_yearly')
  })

  test('a subscribed Solo owner gets the portal, the pack, and no second checkout', async () => {
    getStatus.mockResolvedValue(SOLO)
    portal.mockResolvedValue({ url: 'https://billing.stripe.test/p_1' })
    checkout.mockResolvedValue({ id: 'cs_2', url: 'https://checkout.stripe.test/cs_2' })
    renderDrawer()
    expect(await screen.findByText('Current plan')).toBeTruthy()
    expect(screen.getByText(/10 extra hours/)).toBeTruthy()
    expect(screen.getByText(/Monthly, renews/)).toBeTruthy()
    expect(screen.getByText('Change plans in Manage billing')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Choose/ })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Add 10 hours ($10)' }))
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith('https://checkout.stripe.test/cs_2'))
    expect(checkout).toHaveBeenCalledWith('org-1', 'bot_pack_10')
  })

  test('Manage billing opens the Stripe portal', async () => {
    getStatus.mockResolvedValue(SOLO)
    portal.mockResolvedValue({ url: 'https://billing.stripe.test/p_1' })
    renderDrawer()
    fireEvent.click(await screen.findByRole('button', { name: 'Manage billing' }))
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith('https://billing.stripe.test/p_1'))
    expect(portal).toHaveBeenCalledWith('org-1')
  })

  test('a failed checkout shows the server message and frees the keys', async () => {
    getStatus.mockResolvedValue(status())
    checkout.mockRejectedValue(new Error('This plan is not available yet.'))
    renderDrawer()
    fireEvent.click(await screen.findByRole('button', { name: 'Choose Solo' }))
    expect(await screen.findByText('This plan is not available yet.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Choose Solo' }).disabled).toBe(false)
    expect(assign).not.toHaveBeenCalled()
  })

  test('a member who is not an owner or admin only reads', async () => {
    getStatus.mockResolvedValue({ ...SOLO, canManage: false })
    renderDrawer()
    expect(await screen.findByText('Only an owner or admin can change the plan. Ask one of them.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Manage billing' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Add 10 hours/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Choose/ })).toBeNull()
  })

  test('the ecosystem bundle shows no price and no checkout', async () => {
    getStatus.mockResolvedValue(status({ plan: 'ecosystem', botHours: { plan: 'ecosystem', limited: false, used_hours: 1 } }))
    renderDrawer()
    expect(await screen.findByText('No limit')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Choose/ })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Contact us' })).toBeNull()
    expect(screen.getByText(/To change the bundle, email/)).toBeTruthy()
  })

  test('other plans can ask about the bundle by email', async () => {
    getStatus.mockResolvedValue(status())
    renderDrawer()
    const link = await screen.findByRole('link', { name: 'Contact us' })
    expect(link.getAttribute('href')).toMatch(/^mailto:fm1@qntmecos\.com\?subject=/)
  })

  test('back from Checkout: re-reads the status until the webhook sets the plan, and clears the URL flag', async () => {
    vi.useFakeTimers()
    getStatus.mockResolvedValueOnce(status()).mockResolvedValueOnce(status()).mockResolvedValue(SOLO)
    renderDrawer('/settings?s=workspace&dr=billing&billing=success&session_id=cs_live_1')
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(screen.getByText('Payment received. Waiting for Stripe to confirm it…')).toBeTruthy()
    expect(lastSearch).toBe('?s=workspace&dr=billing')

    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(getStatus).toHaveBeenCalledTimes(2)
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(getStatus).toHaveBeenCalledTimes(3)
    expect(screen.getByText('Payment received. This workspace is on Solo.')).toBeTruthy()

    await act(async () => { await vi.advanceTimersByTimeAsync(9000) })
    expect(getStatus).toHaveBeenCalledTimes(3)
  })

  test('back from a cancelled Checkout: says nothing was charged', async () => {
    getStatus.mockResolvedValue(status())
    renderDrawer('/settings?s=workspace&dr=billing&billing=cancelled')
    expect(await screen.findByText('Checkout cancelled. Nothing was charged.')).toBeTruthy()
    expect(getStatus).toHaveBeenCalledTimes(1)
  })

  test('a failed status read offers to try again', async () => {
    getStatus.mockRejectedValueOnce(new Error('A server error occurred. Please try again later.')).mockResolvedValue(status())
    renderDrawer()
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('1.5')).toBeTruthy()
  })
})
