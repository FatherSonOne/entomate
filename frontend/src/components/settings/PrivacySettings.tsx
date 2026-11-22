/**
 * Settings › Workspace › Data and privacy (Ledger pass, 2026-11-22). Same storage as the
 * old DataRetentionSettings: tenant workspace settings.data_controls_json.retention_days
 * (read by services/retentionService.js) and .consent_jurisdiction. Owners and admins only.
 */
import React, { useEffect, useState } from 'react'
import { settingsApi } from '../../services/api'
import { useOrg } from '../../contexts/OrgContext'
import { Switch } from '../bench'
import { CONSENT_RULES, RETENTION_DAYS } from '../../services/settingsView'
import type { ConsentRule, RetentionDays } from '../../services/settingsView'
import { canAdmin } from './settingsTypes'
import type { OrgCtx } from './settingsTypes'

interface DataControls { retention_days?: number; consent_jurisdiction?: string; [k: string]: unknown }
interface WorkspaceRes { data?: { settings?: { data_controls_json?: DataControls } } }
const api = settingsApi as unknown as {
  getWorkspace: (id: string) => Promise<WorkspaceRes>
  updateWorkspace: (body: { workspaceId: string; data_controls_json: DataControls }) => Promise<unknown>
}

const isRetention = (n: number): n is RetentionDays => (RETENTION_DAYS as readonly number[]).includes(n)
const isConsent = (s: unknown): s is ConsentRule => CONSENT_RULES.some((c) => c.value === s)

export default function PrivacySettings(): React.ReactElement {
  const { org, myRole } = useOrg() as unknown as OrgCtx
  const admin = canAdmin(myRole)
  const [days, setDays] = useState<RetentionDays>(90)
  const [consent, setConsent] = useState<ConsentRule>('permissive')
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    if (!org?.id) return
    let live = true
    api.getWorkspace(org.id).then((res) => {
      if (!live) return
      const dc = res?.data?.settings?.data_controls_json ?? {}
      const r = Number(dc.retention_days)
      if (isRetention(r)) setDays(r)
      if (isConsent(dc.consent_jurisdiction)) setConsent(dc.consent_jurisdiction)
    }).catch(() => { if (live) setStatus('Couldn’t load data and privacy settings.') })
    return () => { live = false }
  }, [org?.id])

  /** Read-modify-write so neighbouring data_controls keys survive. */
  const persist = async (key: 'retention_days' | 'consent_jurisdiction', value: number | string): Promise<boolean> => {
    if (!org?.id || !admin) return false
    setStatus('Saving…')
    try {
      const cur = await api.getWorkspace(org.id)
      const existing = cur?.data?.settings?.data_controls_json ?? {}
      await api.updateWorkspace({ workspaceId: org.id, data_controls_json: { ...existing, [key]: value } })
      setStatus('Saved')
      return true
    } catch {
      setStatus('Couldn’t save. Try again.')
      return false
    }
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
          <span>Audio and video are cleared after this. The meeting, transcript and action items stay.</span>
        </div>
        <div className="bs-set-c">
          <Switch
            label="Keep recordings for"
            value={String(days)}
            onChange={(v) => { const n = Number(v); if (admin && isRetention(n) && n !== days) { const prev = days; setDays(n); void persist('retention_days', n).then((ok) => { if (!ok) setDays(prev) }) } }}
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
            value={consent}
            onChange={(v) => { if (admin && v !== consent) { const prev = consent; setConsent(v); void persist('consent_jurisdiction', v).then((ok) => { if (!ok) setConsent(prev) }) } }}
            options={CONSENT_RULES.map((c) => ({ value: c.value, label: c.label }))}
          />
        </div>
      </div>
    </>
  )
}
