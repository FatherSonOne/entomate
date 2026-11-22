import React, { useState } from 'react'
import { Key, Signal } from '../bench'
import { AuthProblemLine } from '../signin/AuthFrame'
import { tenantOrgService } from '../../services/tenantOrgService'
import { useOrg } from '../../contexts/OrgContext'

/** A pending team invite, on Bench inside the sign-in frame (OrgSetupGate). */
export function AcceptInviteBanner({ invite }) {
  const { refreshOrg } = useOrg()
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState('')

  const handleAccept = async () => {
    setAccepting(true)
    setError('')
    try {
      await tenantOrgService.acceptInvite(invite.token)
      await refreshOrg()
    } catch (err) {
      setError(err?.message || 'Something went wrong. Try again.')
      setAccepting(false)
    }
  }

  const expires = invite.expiresAt ? new Date(invite.expiresAt).toLocaleDateString() : null

  return (
    <div className="si-sent">
      <Signal tone="brand">Invite waiting</Signal>
      <p className="si-lede">
        You’ve been invited to join a workspace as <b>{invite.role}</b>.
        {expires && <> The invite expires {expires}.</>}
      </p>
      {error && <AuthProblemLine head="Couldn’t accept it">{error}</AuthProblemLine>}
      <Key variant="primary" className="si-go" onClick={handleAccept} disabled={accepting} autoFocus>
        {accepting ? 'Joining…' : 'Accept and join'}
      </Key>
    </div>
  )
}
