import React, { useState, useMemo } from 'react'
import { Building2, ArrowRight } from 'lucide-react'
import { useOrg } from '../../contexts/OrgContext'
import { tenantOrgService } from '../../services/tenantOrgService'

// New organizations start on the Free plan. The server sets the plan
// (create_org_for_user); paid plans come from checkout, not from this form.
export function CreateOrgWizard() {
  const { createOrg } = useOrg()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const slugPreview = useMemo(() => {
    if (name.trim().length < 2) return ''
    return tenantOrgService.generateSlug(name.trim())
  }, [name])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed.length < 2) {
      setError('Organization name must be at least 2 characters')
      return
    }
    if (trimmed.length > 100) {
      setError('Organization name must be 100 characters or fewer')
      return
    }
    setSaving(true)
    setError('')
    try {
      await createOrg(name.trim())
    } catch (err) {
      const msg = err?.message || 'Failed to create organization'
      if (msg.includes('duplicate') || msg.includes('unique') || msg.includes('slug')) {
        setError('That name generated a duplicate slug. Please try a slightly different name.')
      } else if (msg.includes('already belongs')) {
        setError('You already belong to an organization. Please refresh the page.')
      } else {
        setError(msg)
      }
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center justify-center py-12">
      <div
        className="w-full max-w-md rounded-xl shadow-lg p-8"
        style={{ background: 'var(--bg-elevated, #1a1a2e)', border: '1px solid var(--b1, rgba(255,255,255,.08))' }}
      >
        <div className="flex flex-col items-center mb-6">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(255,45,107,.12)' }}
          >
            <Building2 size={28} style={{ color: 'var(--accent-primary, #FF2D6B)' }} />
          </div>
          <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary, #fff)', fontFamily: 'var(--font-display)' }}>
            Create Your Organization
          </h2>
          <p className="text-sm mt-1 text-center" style={{ color: 'var(--text-secondary, #999)' }}>
            Organizations group your teams, members, and data.
            You'll be the owner and can invite others after.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm rounded-lg" style={{ background: 'rgba(239,68,68,.1)', color: '#f87171' }}>
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary, #fff)' }}>
              Organization Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Acme Corp"
              maxLength={100}
              className="w-full px-3 py-2 text-sm rounded-lg bg-transparent focus:outline-none focus:ring-2"
              style={{
                color: 'var(--text-primary, #fff)',
                border: '1px solid var(--b1, rgba(255,255,255,.12))',
                focusRingColor: 'var(--accent-primary)',
              }}
              autoFocus
            />
            {slugPreview && (
              <p className="text-xs mt-1.5" style={{ color: 'var(--text-tertiary, #666)' }}>
                Slug: <span style={{ fontFamily: 'var(--font-mono)' }}>{slugPreview}</span>
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={saving || name.trim().length < 2}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors"
            style={{ background: 'var(--accent-primary, #FF2D6B)' }}
          >
            {saving ? 'Creating...' : <>Create Organization <ArrowRight size={16} /></>}
          </button>
        </form>
      </div>
    </div>
  )
}
