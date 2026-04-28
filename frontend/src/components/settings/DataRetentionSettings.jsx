/**
 * DataRetentionSettings — workspace-scoped retention selector.
 *
 * Reads/writes workspace_settings.data_controls_json.retention_days via
 * /api/settings/workspace. Allowed values: {30, 90, 365}. Default: 90.
 *
 * Owner/admin only — the backend route gates on org role; this component
 * shows a disabled state if the user isn't admin/owner.
 */

import React, { useEffect, useState } from 'react'
import { Database, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { settingsApi } from '../../services/api'
import { useOrg } from '../../contexts/OrgContext'

const ALLOWED = [30, 90, 365]
const DEFAULT_DAYS = 90
const ADMIN_ROLES = ['owner', 'admin']

export default function DataRetentionSettings() {
  const { org, myRole } = useOrg()
  const isAdmin = ADMIN_ROLES.includes(myRole)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [retentionDays, setRetentionDays] = useState(DEFAULT_DAYS)
  const [savedAt, setSavedAt] = useState(null)

  useEffect(() => {
    if (!org?.id) return
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const res = await settingsApi.getWorkspace(org.id)
        if (cancelled) return
        const dc = res?.data?.settings?.data_controls_json || {}
        const v = Number(dc.retention_days)
        setRetentionDays(ALLOWED.includes(v) ? v : DEFAULT_DAYS)
      } catch (err) {
        if (!cancelled) setError('Could not load retention setting')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [org?.id])

  async function handleChange(newDays) {
    if (!isAdmin) return
    if (!ALLOWED.includes(newDays)) return
    if (newDays === retentionDays) return
    setSaving(true)
    setError(null)
    try {
      // Read-modify-write so we don't clobber other data_controls keys.
      const cur = await settingsApi.getWorkspace(org.id)
      const existing = cur?.data?.settings?.data_controls_json || {}
      const next = { ...existing, retention_days: newDays }
      await settingsApi.updateWorkspace({
        workspaceId: org.id,
        data_controls_json: next
      })
      setRetentionDays(newDays)
      setSavedAt(new Date())
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save retention setting')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
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

            {loading ? (
              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading…
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {ALLOWED.map((days) => {
                    const isSelected = retentionDays === days
                    const disabled = !isAdmin || saving
                    return (
                      <button
                        key={days}
                        type="button"
                        onClick={() => handleChange(days)}
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

                {!isAdmin && (
                  <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
                    Only workspace owners and admins can change retention.
                  </p>
                )}

                {savedAt && !error && !saving && (
                  <div className="flex items-center gap-2 mt-3 text-xs" style={{ color: 'var(--accent-success, #10b981)' }}>
                    <CheckCircle2 className="w-4 h-4" />
                    Saved
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 mt-3 text-xs" style={{ color: 'var(--accent-danger, #ef4444)' }}>
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div
        className="p-4 rounded-lg text-sm"
        style={{
          background: 'rgba(255, 184, 0, 0.06)',
          border: '1px solid rgba(255, 184, 0, 0.25)',
          color: 'var(--text-secondary)'
        }}
      >
        <strong style={{ color: 'var(--text-primary)' }}>Note:</strong>{' '}
        Retention is enforced by a daily sweep at 03:00 UTC. Changes apply
        on the next sweep. Already-deleted recordings cannot be restored.
        See <a href="/privacy" style={{ color: 'var(--accent-primary)' }}>the Privacy Policy</a>{' '}
        for the full data lifecycle.
      </div>
    </div>
  )
}
