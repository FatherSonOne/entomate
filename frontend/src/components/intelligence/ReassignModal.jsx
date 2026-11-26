import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { UserPlus, X, Search } from 'lucide-react'
import { VCButton, VCInput } from '../vc'
import { meetingsApi } from '../../services/api'
import { useOrgSafe } from '../../contexts/OrgContext'
import { useToast } from '../vc/ToastProvider'

export default function ReassignModal({ isOpen, onClose, itemId, currentAssignee, onReassigned }) {
  const toast = useToast()
  const members = useOrgSafe()?.orgMembers || []
  const [submitting, setSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)

  if (!isOpen) return null

  const search = searchQuery.trim().toLowerCase()
  const filtered = members.filter(member =>
    [member.userName, member.userEmail].some(value => value && value.toLowerCase().includes(search))
  )

  const handleSubmit = async () => {
    if (!selectedUser) {
      toast.warning('Required', 'Please select a person to reassign to')
      return
    }

    setSubmitting(true)
    try {
      const name = selectedUser.userName || selectedUser.userEmail
      await meetingsApi.updateActionItem(itemId, {
        assigned_to_name: name,
        assigned_to_email: selectedUser.userEmail || null,
      })

      toast.success('Reassigned', `Action item reassigned to ${name}`)
      onReassigned?.()
      onClose()
    } catch (err) {
      console.error('Failed to reassign:', err)
      toast.error('Error', err.message || 'Failed to reassign task')
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div className="vc-confirm-overlay" onClick={onClose}>
      <div className="vc" style={{ maxWidth: 400, width: '90%', padding: 24 }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 style={{ fontFamily: 'var(--font)', fontWeight: 700, fontSize: 16, color: 'var(--t0)' }}>
            <UserPlus className="w-4 h-4 inline-block mr-2 vc-text-warning" />
            Reassign Task
          </h3>
          <button onClick={onClose} style={{ color: 'var(--t2)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {currentAssignee && (
          <p style={{ color: 'var(--t1)', fontSize: 13, marginBottom: 12 }}>
            Currently assigned to: <strong style={{ color: 'var(--t0)' }}>{currentAssignee}</strong>
          </p>
        )}

        <VCInput
          icon={<Search className="w-4 h-4" />}
          placeholder="Search team members..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />

        <div style={{ maxHeight: 200, overflowY: 'auto', marginTop: 12 }} className="space-y-1">
          {filtered.length === 0 ? (
            <p style={{ color: 'var(--t2)', fontSize: 13, textAlign: 'center', padding: 16 }}>
              No team members found
            </p>
          ) : (
            filtered.slice(0, 10).map(member => (
              <button
                key={member.userId}
                type="button"
                onClick={() => setSelectedUser(member)}
                aria-pressed={selectedUser?.userId === member.userId}
                className="w-full flex items-center gap-3 p-2 rounded-lg transition-colors"
                style={{
                  background: selectedUser?.userId === member.userId ? 'var(--cd)' : 'transparent',
                  border: selectedUser?.userId === member.userId ? '1px solid var(--c)' : '1px solid transparent',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--cd)', color: 'var(--c)', fontSize: 11, fontWeight: 700 }}
                >
                  {(member.userName || member.userEmail)[0].toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {member.userName || member.userEmail}
                  </div>
                  {member.userName && member.userEmail && (
                    <div style={{ fontSize: 11, color: 'var(--t2)' }}>{member.userEmail}</div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="flex gap-3 justify-end" style={{ marginTop: 16 }}>
          <VCButton variant="ghost" onClick={onClose}>Cancel</VCButton>
          <VCButton variant="primary" onClick={handleSubmit} disabled={!selectedUser || submitting}>
            {submitting ? 'Reassigning...' : 'Reassign'}
          </VCButton>
        </div>
      </div>
    </div>,
    document.body
  )
}
