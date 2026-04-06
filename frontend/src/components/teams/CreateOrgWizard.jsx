import React, { useState, useMemo } from 'react'
import { Building2, ArrowRight, ArrowLeft, Check, Sparkles, Zap, Crown, Layers } from 'lucide-react'
import { useOrg } from '../../contexts/OrgContext'
import { tenantOrgService } from '../../services/tenantOrgService'
import {
  SELF_SERVICE_PLANS,
  TENANT_PLAN_LABELS,
  TENANT_PLAN_DESCRIPTIONS,
  TENANT_PLAN_PRICING,
  TENANT_PLAN_LIMITS,
  TENANT_PLAN_MAX_USERS,
  TENANT_PLAN_APPS,
  TENANT_PLAN_FEATURES,
} from '../../constants/plans'

const PLAN_ICONS = {
  free: Zap,
  starter: Zap,
  pro: Sparkles,
  business: Crown,
  ecosystem: Layers,
}

const PLAN_ACCENT_COLORS = {
  free: '#6b7280',
  starter: '#3b82f6',
  pro: '#6366f1',
  business: '#a855f7',
  ecosystem: '#10b981',
}

const PLAN_BADGES = {
  pro: { label: 'Popular', color: '#6366f1' },
  ecosystem: { label: 'Full Suite', color: '#10b981' },
}

export function CreateOrgWizard() {
  const { createOrg } = useOrg()
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [selectedPlan, setSelectedPlan] = useState('free')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const slugPreview = useMemo(() => {
    if (name.trim().length < 2) return ''
    return tenantOrgService.generateSlug(name.trim())
  }, [name])

  const handleNext = (e) => {
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
    setError('')
    setStep(2)
  }

  const handleSubmit = async () => {
    setSaving(true)
    setError('')
    try {
      await createOrg(name.trim(), selectedPlan)
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

  // --- Step 1: Name ---
  if (step === 1) {
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

          <div className="flex items-center justify-center gap-2 mb-6">
            <StepDot active />
            <div className="w-8 h-px" style={{ background: 'var(--b1, rgba(255,255,255,.08))' }} />
            <StepDot />
          </div>

          <form onSubmit={handleNext} className="space-y-4">
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
              disabled={name.trim().length < 2}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors"
              style={{ background: 'var(--accent-primary, #FF2D6B)' }}
            >
              Next: Choose Plan <ArrowRight size={16} />
            </button>
          </form>
        </div>
      </div>
    )
  }

  // --- Step 2: Plan Selection ---
  return (
    <div className="flex items-center justify-center py-8">
      <div
        className="w-full max-w-3xl rounded-xl shadow-lg p-8"
        style={{ background: 'var(--bg-elevated, #1a1a2e)', border: '1px solid var(--b1, rgba(255,255,255,.08))' }}
      >
        <div className="flex flex-col items-center mb-6">
          <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary, #fff)', fontFamily: 'var(--font-display)' }}>
            Choose Your Plan
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary, #999)' }}>
            for <strong style={{ color: 'var(--accent-primary, #FF2D6B)' }}>{name.trim()}</strong> — you can change this later
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 mb-6">
          <StepDot completed />
          <div className="w-8 h-px" style={{ background: 'var(--accent-primary, #FF2D6B)' }} />
          <StepDot active />
        </div>

        {error && (
          <div className="p-3 text-sm rounded-lg mb-4" style={{ background: 'rgba(239,68,68,.1)', color: '#f87171' }}>
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {SELF_SERVICE_PLANS.map((plan) => {
            const Icon = PLAN_ICONS[plan] || Zap
            const accent = PLAN_ACCENT_COLORS[plan]
            const badge = PLAN_BADGES[plan]
            const pricing = TENANT_PLAN_PRICING[plan]
            const isSelected = selectedPlan === plan
            const features = TENANT_PLAN_FEATURES[plan]
            const featureKeys = Object.keys(features || {})
            const maxUsers = TENANT_PLAN_MAX_USERS[plan]
            const workflowRuns = TENANT_PLAN_LIMITS[plan]

            return (
              <button
                key={plan}
                onClick={() => setSelectedPlan(plan)}
                className="relative text-left p-4 rounded-xl transition-all"
                style={{
                  background: isSelected ? `${accent}10` : 'var(--bg-base, #0f0f23)',
                  border: `2px solid ${isSelected ? accent : 'var(--b1, rgba(255,255,255,.06))'}`,
                  cursor: 'pointer',
                }}
              >
                {badge && (
                  <span
                    className="absolute -top-2.5 right-3 px-2 py-0.5 text-[10px] font-bold uppercase rounded-full text-white"
                    style={{ background: badge.color }}
                  >
                    {badge.label}
                  </span>
                )}

                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: `${accent}20` }}
                  >
                    <Icon size={16} style={{ color: accent }} />
                  </div>
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary, #fff)' }}>
                    {TENANT_PLAN_LABELS[plan]}
                  </span>
                  {isSelected && (
                    <Check size={16} style={{ color: accent, marginLeft: 'auto' }} />
                  )}
                </div>

                <p className="text-xs mb-3" style={{ color: 'var(--text-secondary, #999)' }}>
                  {TENANT_PLAN_DESCRIPTIONS[plan]}
                </p>

                <div className="mb-3">
                  <span className="text-lg font-bold" style={{ color: 'var(--text-primary, #fff)' }}>
                    {pricing.monthly === 0 ? '$0' : `$${pricing.monthly}`}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-tertiary, #666)' }}>/mo</span>
                </div>

                <div className="space-y-1.5 text-xs" style={{ color: 'var(--text-secondary, #999)' }}>
                  <div>{maxUsers === null ? 'Unlimited' : maxUsers} team member{maxUsers !== 1 ? 's' : ''}</div>
                  <div>{workflowRuns >= 50000 ? 'Unlimited' : workflowRuns.toLocaleString()} workflow runs/mo</div>
                  <div>{featureKeys.length} feature{featureKeys.length !== 1 ? 's' : ''} included</div>
                </div>

                {plan === 'ecosystem' && (
                  <div className="flex gap-1 mt-3 flex-wrap">
                    {TENANT_PLAN_APPS[plan].map(app => (
                      <span
                        key={app}
                        className="px-1.5 py-0.5 text-[10px] font-medium rounded"
                        style={{ background: `${accent}20`, color: accent }}
                      >
                        {app}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setStep(1)}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors"
            style={{
              color: 'var(--text-secondary, #999)',
              background: 'var(--bg-base, #0f0f23)',
              border: '1px solid var(--b1, rgba(255,255,255,.08))',
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={16} /> Back
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors"
            style={{ background: 'var(--accent-primary, #FF2D6B)', cursor: 'pointer' }}
          >
            {saving ? 'Creating...' : `Create with ${TENANT_PLAN_LABELS[selectedPlan]} Plan`}
          </button>
        </div>
      </div>
    </div>
  )
}

function StepDot({ active, completed }) {
  return (
    <div
      className="w-3 h-3 rounded-full flex items-center justify-center"
      style={{
        background: completed
          ? 'var(--accent-primary, #FF2D6B)'
          : active
            ? 'var(--accent-primary, #FF2D6B)'
            : 'var(--b2, #333)',
        opacity: active || completed ? 1 : 0.4,
      }}
    >
      {completed && <Check size={8} style={{ color: '#fff' }} />}
    </div>
  )
}
