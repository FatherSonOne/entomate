import React from 'react'
import { useOrg } from '../../contexts/OrgContext'
import { CreateOrgWizard } from './CreateOrgWizard'
import { AcceptInviteBanner } from './AcceptInviteBanner'
import DeletedOrgInterstitial from './DeletedOrgInterstitial'
import PageLoader from '../PageLoader'

/**
 * OrgSetupGate — wraps protected content.
 * If the user has no org, shows the create wizard or invite acceptance.
 * If the user has a soft-deleted org, shows the recovery interstitial.
 * Once the user has an org, renders children normally.
 */
export default function OrgSetupGate({ children }) {
  const { org, loading, pendingInvite, deletedOrg } = useOrg()

  if (loading) {
    return <PageLoader />
  }

  // User has an org — render the app
  if (org) {
    return children
  }

  // User has a soft-deleted org — show recovery interstitial
  if (deletedOrg) {
    return <DeletedOrgInterstitial />
  }

  // User has a pending invite — show accept banner + create wizard
  if (pendingInvite) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg-base, #0f0f23)' }}>
        <div className="max-w-2xl mx-auto px-4 py-12">
          <AcceptInviteBanner invite={pendingInvite} />
          <div className="my-8 flex items-center gap-4">
            <div className="flex-1 h-px" style={{ background: 'var(--b1)' }} />
            <span className="text-sm" style={{ color: 'var(--text-tertiary, #666)' }}>or create your own</span>
            <div className="flex-1 h-px" style={{ background: 'var(--b1)' }} />
          </div>
          <CreateOrgWizard />
        </div>
      </div>
    )
  }

  // No org, no invite — show create wizard
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base, #0f0f23)' }}>
      <CreateOrgWizard />
    </div>
  )
}
