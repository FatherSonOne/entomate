/**
 * Settings › Workspace › Data and privacy (Ledger pass, 2026-11-22). Same storage as the
 * old DataRetentionSettings: tenant workspace settings.data_controls_json.retention_days
 * (read by services/retentionService.js) and .consent_jurisdiction. Owners and admins only.
 */
import React, { useEffect, useRef, useState } from 'react'
import { settingsApi } from '../../services/api'
import { useOrg } from '../../contexts/OrgContext'
import { Key, Switch } from '../bench'
import { CONSENT_RULES, RETENTION_DAYS } from '../../services/settingsView'
import type { ConsentRule, RetentionDays } from '../../services/settingsView'
import { canAdmin } from './settingsTypes'
import type { OrgCtx } from './settingsTypes'

interface DataControls { retention_days?: number; consent_jurisdiction?: string; [k: string]: unknown }
interface WorkspaceRes { success?: boolean; settings?: { data_controls_json?: DataControls } }
const api = settingsApi as unknown as {
  getWorkspace: (id: string) => Promise<WorkspaceRes>
  updateWorkspace: (body: { workspaceId: string; data_controls_json: DataControls }) => Promise<WorkspaceRes>
}

const isRetention = (n: number): n is RetentionDays => (RETENTION_DAYS as readonly number[]).includes(n)
const isConsent = (s: unknown): s is ConsentRule => CONSENT_RULES.some((c) => c.value === s)

function dataControls(response: WorkspaceRes): DataControls {
  if (response?.success !== true || !response.settings) throw new Error('Missing workspace settings')
  return response.settings.data_controls_json ?? {}
}

function policyFrom(dc: DataControls) {
  const days = Number(dc.retention_days)
  return {
    days: isRetention(days) ? days : 90 as const,
    consent: isConsent(dc.consent_jurisdiction) ? dc.consent_jurisdiction : 'permissive' as const,
  }
}

export default function PrivacySettings(): React.ReactElement {
  const { org, myRole } = useOrg() as unknown as OrgCtx
  const admin = canAdmin(myRole)
  const [policy, setPolicy] = useState<{ days: RetentionDays; consent: ConsentRule } | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const saving = useRef(false)

  useEffect(() => {
    if (!org?.id || !admin) return
    let live = true
    api.getWorkspace(org.id).then((res) => {
      if (!live) return
      setPolicy(policyFrom(dataControls(res)))
    }).catch(() => { if (live) setStatus('Couldn’t load data and privacy settings.') })
    return () => { live = false }
  }, [org?.id, admin, attempt])

  /** Read-modify-write so neighbouring data_controls keys survive. */
  const persist = async (patch: Partial<DataControls>): Promise<void> => {
    if (!org?.id || !admin || !policy || saving.current) return
    saving.current = true
    setStatus('Saving…')
    try {
      const existing = dataControls(await api.getWorkspace(org.id))
      const next = { ...existing, ...patch }
      const saved = await api.updateWorkspace({ workspaceId: org.id, data_controls_json: next })
      setPolicy(policyFrom(dataControls(saved)))
      setStatus('Saved')
    } catch {
      setStatus('Couldn’t save. Try again.')
    } finally {
      saving.current = false
    }
  }

  if (!policy || !admin) {
    return (
      <div className="bs-set-sub">
        <span className="bs-h3">Data and privacy</span>
        <span className="bs-lbl" role="status">
          {admin ? status ?? 'Loading data and privacy settings…' : 'Only owners and admins can view or change these settings.'}
        </span>
        {admin && status && <Key size="sm" onClick={() => { setStatus(null); setAttempt(value => value + 1) }}>Retry</Key>}
      </div>
    )
  }

  return (
    <>
      <div className="bs-set-sub">
        <span className="bs-h3">Data and privacy</span>
        <span className="bs-lbl" role="status">{status ?? (admin ? 'Owners and admins' : 'Only owners and admins can change these')}</span>
      </div>
      <div className="bs-set-row">
        <div className="bs-set-l">
          <b>Keep recordings for</b>
          <span>The retention sweep clears recordings and transcripts. Meeting records, summaries and action items can remain.</span>
        </div>
        <div className="bs-set-c">
          <Switch
            label="Keep recordings for"
            value={String(policy.days)}
            disabled={!admin || status === 'Saving…'}
            onChange={(v) => { const n = Number(v); if (isRetention(n) && n !== policy.days) void persist({ retention_days: n }) }}
            options={RETENTION_DAYS.map((d) => ({ value: String(d), label: `${d} days` }))}
          />
        </div>
      </div>
      <div className="bs-set-row">
        <div className="bs-set-l">
          <b>Consent rules</b>
          <span>How the bot announces itself and who must agree before it records.</span>
        </div>
        <div className="bs-set-c">
          <Switch
            label="Consent rules"
            value={policy.consent}
            disabled={!admin || status === 'Saving…'}
            onChange={(v) => { if (v !== policy.consent) void persist({ consent_jurisdiction: v }) }}
            options={CONSENT_RULES.map((c) => ({ value: c.value, label: c.label }))}
          />
        </div>
      </div>
    </>
  )
}
