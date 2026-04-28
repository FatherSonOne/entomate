/**
 * DataRetentionSettings — workspace data & privacy controls.
 *
 * Reads/writes workspace_settings.data_controls_json via /api/settings/workspace.
 *   - retention_days       (Slice 3): 30 / 90 / 365 — daily sweep nukes Recall-hosted media past the threshold.
 *   - consent_jurisdiction (Slice 4): 'permissive' / 'two_party' / 'gdpr' — surfaces a stronger disclosure on the launcher UI.
 *
 * Owner/admin only — the backend route gates on org role; this component
 * shows a disabled state if the user isn't admin/owner.
 */

import React, { useEffect, useState } from 'react'
import { Database, Scale, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { settingsApi } from '../../services/api'
import { useOrg } from '../../contexts/OrgContext'

const ALLOWED_RETENTION = [30, 90, 365]
const DEFAULT_RETENTION = 90
const ADMIN_ROLES = ['owner', 'admin']

const JURISDICTION_OPTIONS = [
  {
    value: 'permissive',
    label: 'Permissive (default)',
    description:
      "One-party consent assumed — the organizer's affirmation at launch is sufficient. Use for internal-only meetings, jurisdictions without all-party-consent rules, and design-partner work where consent is verbally pre-arranged."
  },
  {
    value: 'two_party',
    label: 'All-party consent (US two-party states)',
    description:
      'For meetings where any participant may be in California, Florida, Illinois, Maryland, Massachusetts, Montana, Nevada, New Hampshire, Pennsylvania, or Washington. Surfaces a stronger disclosure prompt at launch — the organizer must affirm all-party consent specifically.'
  },
  {
    value: 'gdpr',
    label: 'GDPR / EU + UK',
    description:
      'For meetings that may include participants in the EU or UK. Treats explicit consent (Art. 6(1)(a)) as the lawful basis. Surfaces the same stronger disclosure prompt and, in future releases, will gate launches that lack a confirmed attendee list.'
  }
]

export default function DataRetentionSettings() {
  const { org, myRole } = useOrg()
  const isAdmin = ADMIN_ROLES.includes(myRole)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null) // 'retention' | 'jurisdiction' | null
  const [error, setError] = useState(null)
  const [savedField, setSavedField] = useState(null) // 'retention' | 'jurisdiction' | null
  const [retentionDays, setRetentionDays] = useState(DEFAULT_RETENTION)
  const [jurisdiction, setJurisdiction] = useState('permissive')

  useEffect(() => {
    if (!org?.id) return
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const res = await settingsApi.getWorkspace(org.id)
        if (cancelled) return
        const dc = res?.data?.settings?.data_controls_json || {}
        const r = Number(dc.retention_days)
        setRetentionDays(ALLOWED_RETENTION.includes(r) ? r : DEFAULT_RETENTION)
        const j = dc.consent_jurisdiction
        const validJ = JURISDICTION_OPTIONS.some((opt) => opt.value === j)
        setJurisdiction(validJ ? j : 'permissive')
      } catch (err) {
        if (!cancelled) setError('Could not load data & privacy settings')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [org?.id])

  /**
   * Read-modify-write so we don't clobber adjacent data_controls keys.
   * `field` is the form-level identifier we use to drive the "Saved" indicator.
   */
  async function persist(field, key, value) {
    if (!isAdmin) return
    setSaving(field)
    setError(null)
    try {
      const cur = await settingsApi.getWorkspace(org.id)
      const existing = cur?.data?.settings?.data_controls_json || {}
      const next = { ...existing, [key]: value }
      await settingsApi.updateWorkspace({
        workspaceId: org.id,
        data_controls_json: next
      })
      setSavedField(field)
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save')
      throw err
    } finally {
      setSaving(null)
    }
  }

  async function handleRetentionChange(newDays) {
    if (!ALLOWED_RETENTION.includes(newDays) || newDays === retentionDays) return
    try {
      await persist('retention', 'retention_days', newDays)
      setRetentionDays(newDays)
    } catch {}
  }

  async function handleJurisdictionChange(newValue) {
    if (newValue === jurisdiction) return
    if (!JURISDICTION_OPTIONS.some((opt) => opt.value === newValue)) return
    try {
      await persist('jurisdiction', 'consent_jurisdiction', newValue)
      setJurisdiction(newValue)
    } catch {}
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Retention card ── */}
      <div
        className="p-6 rounded-lg"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--b1)' }}
      >
        <div className="flex items-start gap-4">
          <div
            className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--accent-soft)' }}
          >
            <Database className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3
              className="text-base font-medium mb-1"
              style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
            >
              Recording retention
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              How long Meet Mate keeps the audio recording and transcript for
              meetings in this workspace. After this many days, the
              Recall.ai-hosted media is deleted permanently and the URLs are
              cleared. The meeting record itself stays for audit. Default: 90 days.
            </p>

            <div className="flex flex-wrap gap-2">
              {ALLOWED_RETENTION.map((days) => {
                const isSelected = retentionDays === days
                const disabled = !isAdmin || saving === 'retention'
                return (
                  <button
                    key={days}
                    type="button"
                    onClick={() => handleRetentionChange(days)}
                    disabled={disabled}
                    className="px-4 py-2 rounded-md text-sm font-medium transition-all"
                    style={{
                      background: isSelected ? 'var(--accent-primary)' : 'var(--bg-base)',
                      color: isSelected ? '#fff' : 'var(--text-primary)',
                      border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--b1)'}`,
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      opacity: disabled && !isSelected ? 0.5 : 1
                    }}
                  >
                    {days} days
                  </button>
                )
              })}
            </div>

            {savedField === 'retention' && saving === null && !error && (
              <div className="flex items-center gap-2 mt-3 text-xs" style={{ color: 'var(--accent-success, #10b981)' }}>
                <CheckCircle2 className="w-4 h-4" />
                Saved
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Jurisdiction card ── */}
      <div
        className="p-6 rounded-lg"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--b1)' }}
      >
        <div className="flex items-start gap-4">
          <div
            className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--accent-soft)' }}
          >
            <Scale className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3
              className="text-base font-medium mb-1"
              style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
            >
              Consent jurisdiction
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              The legal posture this workspace assumes for meeting recording.
              Affects how prominently the launch consent prompt is surfaced.
              The legal obligation to obtain consent always rests with the
              organizer; this setting is product guidance, not a legal
              shield. See the{' '}
              <a href="/privacy" style={{ color: 'var(--accent-primary)' }}>Privacy Policy</a>{' '}
              for jurisdictional detail.
            </p>

            <div className="space-y-2">
              {JURISDICTION_OPTIONS.map((opt) => {
                const isSelected = jurisdiction === opt.value
                const disabled = !isAdmin || saving === 'jurisdiction'
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleJurisdictionChange(opt.value)}
                    disabled={disabled}
                    className="w-full text-left p-4 rounded-md transition-all"
                    style={{
                      background: isSelected ? 'rgba(255, 45, 107, 0.08)' : 'var(--bg-base)',
                      border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--b1)'}`,
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      opacity: disabled && !isSelected ? 0.5 : 1
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="flex-shrink-0 w-4 h-4 mt-0.5 rounded-full"
                        style={{
                          border: `2px solid ${isSelected ? 'var(--accent-primary)' : 'var(--text-muted)'}`,
                          background: isSelected ? 'var(--accent-primary)' : 'transparent',
                          boxShadow: isSelected ? 'inset 0 0 0 2px var(--bg-base)' : 'none'
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-sm font-medium mb-1"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {opt.label}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          {opt.description}
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            {savedField === 'jurisdiction' && saving === null && !error && (
              <div className="flex items-center gap-2 mt-3 text-xs" style={{ color: 'var(--accent-success, #10b981)' }}>
                <CheckCircle2 className="w-4 h-4" />
                Saved
              </div>
            )}
          </div>
        </div>
      </div>

      {!isAdmin && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Only workspace owners and admins can change these settings.
        </p>
      )}

      {error && (
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--accent-danger, #ef4444)' }}>
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <div
        className="p-4 rounded-lg text-sm"
        style={{
          background: 'rgba(255, 184, 0, 0.06)',
          border: '1px solid rgba(255, 184, 0, 0.25)',
          color: 'var(--text-secondary)'
        }}
      >
        <strong style={{ color: 'var(--text-primary)' }}>Note:</strong>{' '}
        Retention is enforced by a daily sweep at 03:00 UTC. Already-deleted
        recordings cannot be restored. Jurisdiction policy currently affects
        the launcher UI prompt only — see the{' '}
        <a href="/privacy" style={{ color: 'var(--accent-primary)' }}>Privacy Policy</a>{' '}
        and the in-tree{' '}
        <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-primary)' }}>
          docs/policies/CONSENT_JURISDICTIONS.md
        </code>{' '}
        for the legal reference.
      </div>
    </div>
  )
}
