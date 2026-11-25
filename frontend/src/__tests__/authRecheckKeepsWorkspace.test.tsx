/**
 * Supabase re-sends SIGNED_IN when the tab regains focus, and TOKEN_REFRESHED about
 * hourly. For the same person that must not reload the workspace: the reload showed the
 * loader in place of the app, which unmounted the Meetings page and stopped a recording.
 */
import React from 'react'
import { render, screen, act, waitFor } from '@testing-library/react'
import { vi, describe, test, expect, beforeEach } from 'vitest'

type AuthCallback = (event: string, session: unknown) => void
const auth = vi.hoisted(() => ({ cb: null as null | ((event: string, session: unknown) => void) }))
const orgs = vi.hoisted(() => ({
  getCurrentOrg: vi.fn(),
  getOrgMembers: vi.fn(),
  getDeletedOrg: vi.fn(),
  getPendingInviteForUser: vi.fn(),
}))

vi.mock('../services/monitoring', () => ({ setMonitoringUser: vi.fn() }))
vi.mock('../services/profilePhotos', () => ({ getProfilePhotoUrls: vi.fn(async () => ({})), PROFILE_PHOTO_REFRESH_MS: 2700000 }))
vi.mock('../services/tenantOrgService', () => ({ tenantOrgService: orgs }))
vi.mock('../services/authService', () => {
  const toAuthUser = (u: { id: string; email?: string; user_metadata?: { name?: string } } | null | undefined) =>
    u ? { id: u.id, email: u.email || '', name: u.user_metadata?.name, avatar_url: undefined, role: 'member' } : null
  return {
    authService: {
      toAuthUser,
      getSession: vi.fn(async () => session('Frank')),
      onAuthStateChange: (cb: AuthCallback) => {
        auth.cb = cb
        return { data: { subscription: { unsubscribe: () => {} } } }
      },
    },
  }
})

function session(name: string) {
  return { access_token: `t-${Math.random()}`, user: { id: 'u-1', email: 'f@example.com', user_metadata: { name } } }
}

import { AuthProvider, useAuth } from '../contexts/AuthContext'
import { OrgProvider } from '../contexts/OrgContext'
import OrgSetupGate from '../components/teams/OrgSetupGate'

let mounts = 0
function Page(): React.ReactElement {
  React.useEffect(() => {
    mounts += 1
  }, [])
  const { user } = useAuth() as unknown as { user: { name: string } }
  return <><p>Meetings page</p><p>{user.name}</p></>
}

beforeEach(() => {
  mounts = 0
  window.matchMedia ||= ((q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} })) as unknown as typeof window.matchMedia
  orgs.getCurrentOrg.mockResolvedValue({ id: 'org-1', name: 'Org' })
  orgs.getOrgMembers.mockResolvedValue([{ userId: 'u-1', role: 'owner' }])
})

describe('an auth re-check for the same person', () => {
  test('keeps the page mounted and does not reload the workspace', async () => {
    render(
      <AuthProvider>
        <OrgProvider>
          <OrgSetupGate>
            <Page />
          </OrgSetupGate>
        </OrgProvider>
      </AuthProvider>,
    )
    await screen.findByText('Meetings page')
    await waitFor(() => expect(orgs.getCurrentOrg).toHaveBeenCalledTimes(1))
    expect(mounts).toBe(1)

    // Tab regains focus, then the hourly token renewal: a new session object each time.
    await act(async () => auth.cb!('SIGNED_IN', session('Frank')))
    await act(async () => auth.cb!('TOKEN_REFRESHED', session('Frank')))

    expect(screen.getByText('Meetings page')).toBeInTheDocument()
    expect(mounts).toBe(1)
    expect(orgs.getCurrentOrg).toHaveBeenCalledTimes(1)

    // Settings can change the person's name without reloading their workspace.
    await act(async () => auth.cb!('USER_UPDATED', session('Frank M')))
    expect(screen.getByText('Frank M')).toBeInTheDocument()
    expect(orgs.getCurrentOrg).toHaveBeenCalledTimes(1)
    expect(mounts).toBe(1)
  })
})
