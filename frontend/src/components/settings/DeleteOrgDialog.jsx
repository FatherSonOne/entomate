import React, { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { VCButton } from '../vc'

export default function DeleteOrgDialog({ orgName, mode, isOpen, isLoading, onConfirm, onCancel }) {
  const [confirmText, setConfirmText] = useState('')

  if (!isOpen) return null

  const isSoft = mode === 'soft'
  const isConfirmed = confirmText === orgName

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="rounded-2xl shadow-2xl max-w-md w-full"
        style={{ background: 'var(--bg-surface, #1a1a2e)', border: '1px solid var(--b1)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-5"
          style={{ borderBottom: '1px solid var(--b1)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: isSoft ? 'rgba(255,184,0,.12)' : 'rgba(255,45,107,.12)',
              }}
            >
              <AlertTriangle
                className="w-5 h-5"
                style={{ color: isSoft ? 'var(--accent-tertiary, #FFB800)' : 'var(--accent-primary, #FF2D6B)' }}
              />
            </div>
            <h3
              className="text-lg font-bold"
              style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
            >
              {isSoft ? 'Archive Organization' : 'Permanently Delete Organization'}
            </h3>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition"
            style={{ color: 'var(--text-tertiary)', background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {isSoft ? (
            <>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                This will archive <strong style={{ color: 'var(--text-primary)' }}>{orgName}</strong> and
                hide it from all members. You have <strong>30 days</strong> to restore it before it becomes
                eligible for permanent deletion.
              </p>
              <div
                className="rounded-lg p-3"
                style={{ background: 'rgba(255,184,0,.06)', border: '1px solid rgba(255,184,0,.2)' }}
              >
                <p className="text-xs" style={{ color: 'var(--accent-tertiary, #FFB800)' }}>
                  Members will lose access immediately. Invites will stop working.
                  Your personal data (projects, tasks, automations, AI agents) is not affected.
                </p>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                This will{' '}
                <strong style={{ color: 'var(--accent-primary, #FF2D6B)' }}>permanently delete</strong>{' '}
                <strong style={{ color: 'var(--text-primary)' }}>{orgName}</strong> and all
                membership data including team members and invites.
              </p>
              <div
                className="rounded-lg p-3"
                style={{ background: 'rgba(255,45,107,.06)', border: '1px solid rgba(255,45,107,.2)' }}
              >
                <p className="text-xs font-medium" style={{ color: 'var(--accent-primary, #FF2D6B)' }}>
                  This action cannot be undone. Your personal projects, tasks, and automations will remain in your account.
                </p>
              </div>
            </>
          )}

          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: 'var(--text-secondary)' }}
            >
              Type <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{orgName}</strong> to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={orgName}
              autoFocus
              className="w-full px-3 py-2 text-sm rounded-lg"
              style={{
                background: 'var(--bg-elevated, #12121f)',
                border: '1px solid var(--b1)',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3 p-5"
          style={{ borderTop: '1px solid var(--b1)' }}
        >
          <VCButton variant="ghost" onClick={onCancel} disabled={isLoading}>
            Cancel
          </VCButton>
          <VCButton
            variant={isSoft ? 'amber' : 'danger'}
            onClick={onConfirm}
            disabled={!isConfirmed || isLoading}
          >
            {isLoading
              ? (isSoft ? 'Archiving...' : 'Deleting...')
              : (isSoft ? 'Archive Organization' : 'Delete Permanently')}
          </VCButton>
        </div>
      </div>
    </div>
  )
}
