import React, { useState } from 'react'
import { AlertTriangle, RotateCcw, Plus, Trash2 } from 'lucide-react'
import { useOrg } from '../../contexts/OrgContext'
import { VCButton, VCIconBox } from '../vc'
import DeleteOrgDialog from '../settings/DeleteOrgDialog'

export default function DeletedOrgInterstitial() {
  const { deletedOrg, restoreOrg, hardDeleteOrg, createOrg } = useOrg()
  const [isRestoring, setIsRestoring] = useState(false)
  const [showHardDelete, setShowHardDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  if (!deletedOrg) return null

  const getDaysRemaining = () => {
    const deleted = new Date(deletedOrg.deletedAt)
    const expiry = new Date(deleted.getTime() + 30 * 24 * 60 * 60 * 1000)
    const now = new Date()
    return Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
  }

  const daysLeft = getDaysRemaining()
  const isUrgent = daysLeft <= 7

  const handleRestore = async () => {
    setIsRestoring(true)
    try {
      await restoreOrg(deletedOrg.id)
    } catch (err) {
      console.error('Failed to restore org:', err)
    } finally {
      setIsRestoring(false)
    }
  }

  const handleHardDelete = async () => {
    setIsDeleting(true)
    try {
      await hardDeleteOrg(deletedOrg.id)
      setShowHardDelete(false)
    } catch (err) {
      console.error('Failed to hard-delete org:', err)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCreateNew = async () => {
    setIsCreating(true)
    try {
      await hardDeleteOrg(deletedOrg.id)
    } catch {
      // Best-effort cleanup
    }
    setIsCreating(false)
    // After hard-delete, fetchOrg in context will find no org → OrgSetupGate shows wizard
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--bg-base, #0f0f23)' }}
    >
      <div className="max-w-lg w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(255,184,0,.12)' }}
          >
            <AlertTriangle className="w-8 h-8" style={{ color: 'var(--accent-tertiary, #FFB800)' }} />
          </div>
          <h1
            className="text-2xl font-bold"
            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
          >
            Your organization was archived
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            You can restore it, create a fresh organization, or permanently delete it.
          </p>
        </div>

        {/* Deleted org card */}
        <div
          className="vc p-5 space-y-4"
        >
          <div className="flex items-start justify-between">
            <div>
              <h3
                className="font-semibold text-base"
                style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
              >
                {deletedOrg.name}
              </h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                Archived on {new Date(deletedOrg.deletedAt).toLocaleDateString()}
              </p>
            </div>
            <span
              className="text-xs font-medium px-2 py-1 rounded-full"
              style={{
                background: isUrgent ? 'rgba(255,45,107,.12)' : 'rgba(255,184,0,.12)',
                color: isUrgent ? 'var(--accent-primary, #FF2D6B)' : 'var(--accent-tertiary, #FFB800)',
              }}
            >
              {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
            </span>
          </div>

          <div className="flex items-center gap-2">
            <VCButton
              variant="primary"
              className="flex-1"
              onClick={handleRestore}
              disabled={isRestoring}
            >
              <RotateCcw className="w-4 h-4" />
              {isRestoring ? 'Restoring...' : 'Restore Organization'}
            </VCButton>
            <button
              onClick={() => setShowHardDelete(true)}
              className="px-3 py-2.5 rounded-lg transition"
              style={{
                color: 'var(--accent-primary, #FF2D6B)',
                border: '1px solid rgba(255,45,107,.3)',
                background: 'transparent',
                cursor: 'pointer',
              }}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Create new org */}
        <button
          onClick={handleCreateNew}
          disabled={isCreating}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-xl transition"
          style={{
            color: 'var(--text-secondary)',
            background: 'var(--bg-surface, #1a1a2e)',
            border: '1px solid var(--b1)',
            cursor: 'pointer',
            opacity: isCreating ? 0.6 : 1,
          }}
        >
          <Plus className="w-4 h-4" />
          {isCreating ? 'Cleaning up...' : 'Start Fresh \u2014 Create New Organization'}
        </button>

        <p className="text-center text-xs" style={{ color: 'var(--text-tertiary)' }}>
          Creating a new organization will permanently delete the archived one.
        </p>
      </div>

      {/* Hard delete confirmation */}
      {showHardDelete && (
        <DeleteOrgDialog
          orgName={deletedOrg.name}
          mode="hard"
          isOpen={true}
          isLoading={isDeleting}
          onConfirm={handleHardDelete}
          onCancel={() => setShowHardDelete(false)}
        />
      )}
    </div>
  )
}
