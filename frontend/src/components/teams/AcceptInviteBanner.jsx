import React, { useState } from 'react'
import { Mail, Check, Loader2 } from 'lucide-react'
import { tenantOrgService } from '../../services/tenantOrgService'
import { useOrg } from '../../contexts/OrgContext'

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
      setError(err?.message || 'Failed to accept invite')
      setAccepting(false)
    }
  }

  return (
    <div
      className="rounded-xl p-6"
      style={{
        background: 'linear-gradient(135deg, rgba(255,45,107,.08), rgba(255,107,138,.04))',
        border: '1px solid rgba(255,45,107,.2)',
      }}
    >
      <div className="flex items-start gap-4">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(255,45,107,.15)' }}
        >
          <Mail size={20} style={{ color: '#FF6B8A' }} />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary, #fff)' }}>
            You have a team invite!
          </h3>
          <p className="text-sm mb-3" style={{ color: 'var(--text-secondary, #999)' }}>
            You've been invited to join an organization as a <strong>{invite.role}</strong>.
            This invite expires on {new Date(invite.expiresAt).toLocaleDateString()}.
          </p>

          {error && (
            <p className="text-sm mb-2" style={{ color: '#f87171' }}>{error}</p>
          )}

          <button
            onClick={handleAccept}
            disabled={accepting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50"
            style={{ background: 'var(--accent-primary, #FF2D6B)', cursor: 'pointer', border: 'none' }}
          >
            {accepting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {accepting ? 'Accepting...' : 'Accept Invitation'}
          </button>
        </div>
      </div>
    </div>
  )
}
