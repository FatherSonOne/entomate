import React, { useEffect } from 'react'
import { useOrg } from '../../contexts/OrgContext'
import { CreateOrgWizard } from './CreateOrgWizard'
import { AcceptInviteBanner } from './AcceptInviteBanner'
import DeletedOrgInterstitial from './DeletedOrgInterstitial'
import PageLoader from '../PageLoader'
import { BootMark } from '../BootLoader'
import { endBoot } from '../../services/bootProgress'
import { useAuth } from '../../contexts/AuthContext'
import { AuthFrame } from '../signin/AuthFrame'
import { Key } from '../bench'

/**
 * OrgSetupGate — wraps protected content.
 * If the user has no org, shows the create wizard or invite acceptance.
 * If the user has a soft-deleted org, shows the recovery interstitial.
 * Once the user has an org, renders children normally.
 */
export default function OrgSetupGate({ children }) {
  const { org, loading, pendingInvite, deletedOrg } = useOrg()
  const { signOut } = useAuth()

  // First load with no workspace yet: the setup screens are the app, so the loader can go
  useEffect(() => {
    if (!loading && !org) endBoot('done')
  }, [loading, org])

  if (loading) {
    return <PageLoader />
  }

  // User has an org — render the app
  if (org) {
    return <><BootMark stage="workspace" />{children}</>
  }

  // User has a soft-deleted org — show recovery interstitial
  if (deletedOrg) {
    return <DeletedOrgInterstitial />
  }

  // No workspace yet: the sign-in frame, with the invite first when there is one
  return (
    <AuthFrame title={pendingInvite ? 'Join your team' : 'Set up your workspace'} actions={<Key size="sm" onClick={signOut}>Sign out</Key>}>
      {pendingInvite && (
        <>
          <AcceptInviteBanner invite={pendingInvite} />
          <div className="si-or org-or"><span className="si-lbl">or start your own</span></div>
        </>
      )}
      <CreateOrgWizard primary={!pendingInvite} />
    </AuthFrame>
  )
}
